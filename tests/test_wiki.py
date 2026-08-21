#!/usr/bin/env python3
"""
Test suite di LLM Wiki Portable. Solo unittest, nessuna dipendenza.

  python3 -m unittest discover -s tests -v
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))

import wikilib as W  # noqa: E402
import sync as sync_mod  # noqa: E402
import search as search_mod  # noqa: E402
import lint as lint_mod  # noqa: E402
import log as log_mod  # noqa: E402


PAGE = """---
created: 2026-01-01
updated: 2026-02-02
tags: [alpha, beta]
sources: [[src-uno]]
---

# {title}

{body}
"""


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)


class WikiFixture(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix='llmwiki-test-')
        self.wiki = os.path.join(self.tmp, 'wiki')
        write(os.path.join(self.tmp, '.llmwiki-root'), json.dumps({
            'llm_wiki_portable': True, 'version': W.VERSION, 'id': 'test',
            'template': 'general', 'folders': ['sources', 'concepts'],
        }))
        write(os.path.join(self.wiki, 'concepts', 'docker.md'),
              PAGE.format(title='Docker', body='Container. Vedi [[kubernetes]] e [[fantasma]].'))
        write(os.path.join(self.wiki, 'concepts', 'kubernetes.md'),
              PAGE.format(title='Kubernetes', body='Orchestratore per [[docker]].'))
        write(os.path.join(self.wiki, 'sources', 'src-uno.md'),
              PAGE.format(title='Fonte Uno', body='Una fonte sui container.'))
        write(os.path.join(self.wiki, 'index.md'), '# Wiki Index\n')
        write(os.path.join(self.wiki, 'log.md'), '# Wiki Log\n')

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)


class TestSlugify(unittest.TestCase):
    def test_lowercase_and_ascii(self):
        self.assertEqual(W.slugify('Città Metropolitana'), 'citta-metropolitana')

    def test_strips_forbidden_chars(self):
        """Su exFAT questi caratteri rendono il file non creabile."""
        self.assertEqual(W.slugify('A/B:C?D*E"F<G>H|I'), 'a-b-c-d-e-f-g-h-i')

    def test_case_collision_prevented(self):
        self.assertEqual(W.slugify('Docker'), W.slugify('docker'))

    def test_reserved_windows_names(self):
        self.assertTrue(W.slugify('CON').startswith('page-'))

    def test_empty(self):
        self.assertEqual(W.slugify(''), 'untitled')


class TestFrontmatter(unittest.TestCase):
    def test_inline_list(self):
        meta, body = W.parse_frontmatter("---\ntags: [a, b]\n---\n\ncorpo\n")
        self.assertEqual(meta['tags'], ['a', 'b'])
        self.assertEqual(body.strip(), 'corpo')

    def test_block_list(self):
        meta, _ = W.parse_frontmatter("---\ntags:\n  - a\n  - b\n---\n\nx\n")
        self.assertEqual(meta['tags'], ['a', 'b'])

    def test_wikilink_value_not_parsed_as_list(self):
        meta, _ = W.parse_frontmatter("---\nsources: [[src-x]]\n---\n\nx\n")
        self.assertEqual(meta['sources'], '[[src-x]]')

    def test_roundtrip(self):
        original = {'created': '2026-01-01', 'tags': ['a', 'b']}
        meta, _ = W.parse_frontmatter(W.dump_frontmatter(original) + '\ncorpo\n')
        self.assertEqual(meta['created'], '2026-01-01')
        self.assertEqual(meta['tags'], ['a', 'b'])

    def test_no_frontmatter(self):
        meta, body = W.parse_frontmatter('# Solo titolo\n')
        self.assertEqual(meta, {})
        self.assertEqual(body, '# Solo titolo\n')


class TestWikilinks(unittest.TestCase):
    def test_extract(self):
        self.assertEqual(W.extract_wikilinks('vedi [[a]] e [[b|Bi]]'), ['a', 'b'])

    def test_ignores_code_blocks(self):
        text = "reale [[vero]]\n```\nesempio [[finto]]\n```\n`[[inline]]`"
        self.assertEqual(W.extract_wikilinks(text), ['vero'])


class TestSync(WikiFixture):
    def test_broken_links_are_reported(self):
        """La regressione principale della v1: i link rotti sparivano in silenzio."""
        data = sync_mod.build_data(self.wiki)
        targets = [b['target'] for b in data['health']['broken_links']]
        self.assertIn('fantasma', targets)
        self.assertEqual(data['stats']['total_broken'], 1)

    def test_backlinks(self):
        data = sync_mod.build_data(self.wiki)
        page = next(p for p in data['pages'] if p['slug'] == 'concepts/kubernetes')
        self.assertIn('concepts/docker', page['backlinks'])

    def test_frontmatter_sources_create_links(self):
        data = sync_mod.build_data(self.wiki)
        page = next(p for p in data['pages'] if p['slug'] == 'concepts/docker')
        self.assertIn('sources/src-uno', page['links'])

    def test_category_order_follows_marker(self):
        data = sync_mod.build_data(self.wiki)
        self.assertEqual(list(data['categories'])[:2], ['sources', 'concepts'])

    def test_orphans(self):
        data = sync_mod.build_data(self.wiki)
        self.assertNotIn('concepts/kubernetes', data['health']['orphans'])

    def test_rebuild_index_is_deterministic(self):
        data = sync_mod.build_data(self.wiki)
        sync_mod.rebuild_index(self.wiki, data)
        first = W.read_text(os.path.join(self.wiki, 'index.md'))
        sync_mod.rebuild_index(self.wiki, sync_mod.build_data(self.wiki))
        second = W.read_text(os.path.join(self.wiki, 'index.md'))
        self.assertEqual(first, second)

    def test_rebuild_index_creates_no_phantom_links(self):
        """Il riassunto nell'index non deve generare link (rotti) fantasma."""
        sync_mod.sync(self.wiki, os.path.join(self.tmp, 'web', 'data.json'),
                      do_rebuild_index=True, quiet=True)
        data = sync_mod.build_data(self.wiki)
        from_index = [b for b in data['health']['broken_links'] if b['from'] == 'index']
        self.assertEqual(from_index, [])

    def test_writes_both_json_and_js(self):
        out = os.path.join(self.tmp, 'web', 'data.json')
        sync_mod.sync(self.wiki, out, quiet=True)
        self.assertTrue(os.path.isfile(out))
        js = os.path.join(self.tmp, 'web', 'data.js')
        self.assertTrue(os.path.isfile(js))
        self.assertTrue(W.read_text(js).startswith('var WIKI_DATA = '))


class TestSearch(WikiFixture):
    def test_finds_relevant_page(self):
        pages = search_mod.drop_meta(W.load_pages(self.wiki))
        results = search_mod.bm25_search(pages, 'orchestratore container', 3)
        self.assertTrue(results)
        self.assertEqual(results[0][2]['slug'], 'concepts/kubernetes')

    def test_meta_pages_excluded(self):
        pages = search_mod.drop_meta(W.load_pages(self.wiki))
        self.assertNotIn('index', [p['slug'] for p in pages])

    def test_stopwords_only_query(self):
        pages = W.load_pages(self.wiki)
        self.assertEqual(search_mod.bm25_search(pages, 'e di il', 3), [])


class TestLint(WikiFixture):
    def _issues(self, **kwargs):
        pages = W.resolve_graph(W.load_pages(self.wiki))
        options = dict(only=set(lint_mod.CHECKS), max_words=500,
                       thin_words=40, stale_days=180)
        options.update(kwargs)
        return lint_mod.run_checks(pages, **options)

    def test_detects_broken_link(self):
        broken = [i for i in self._issues() if i['check'] == 'broken']
        self.assertEqual(len(broken), 1)
        self.assertIn('fantasma', broken[0]['message'])

    def test_detects_orphan(self):
        write(os.path.join(self.wiki, 'concepts', 'isolata.md'),
              PAGE.format(title='Isolata', body='Nessuno mi linka.'))
        orphans = [i['slug'] for i in self._issues() if i['check'] == 'orphans']
        self.assertIn('concepts/isolata', orphans)

    def test_detects_bloated(self):
        write(os.path.join(self.wiki, 'concepts', 'lunga.md'),
              PAGE.format(title='Lunga', body='parola ' * 600))
        bloated = [i['slug'] for i in self._issues() if i['check'] == 'bloated']
        self.assertIn('concepts/lunga', bloated)

    def test_detects_missing_frontmatter(self):
        write(os.path.join(self.wiki, 'concepts', 'nuda.md'), '# Nuda\n\n- a\n- b\n- c\n')
        issues = [i for i in self._issues()
                  if i['check'] == 'frontmatter' and i['slug'] == 'concepts/nuda']
        self.assertTrue(any(i['severity'] == 'error' for i in issues))

    def test_detects_raw_notes(self):
        write(os.path.join(self.wiki, 'concepts', 'grezza.md'),
              PAGE.format(title='Grezza', body='TODO: sistemare questa roba'))
        raw = [i['slug'] for i in self._issues() if i['check'] == 'raw']
        self.assertIn('concepts/grezza', raw)

    def test_only_filter(self):
        issues = self._issues(only={'broken'})
        self.assertTrue(all(i['check'] == 'broken' for i in issues))


class TestLog(WikiFixture):
    def test_append_and_read(self):
        path = os.path.join(self.wiki, 'log.md')
        log_mod.append_entry(path, 'ingest', 'Fonte X', ['Creato: [[a]]'])
        entries = log_mod.read_entries(path)
        self.assertEqual(entries[-1]['kind'], 'ingest')
        self.assertEqual(entries[-1]['title'], 'Fonte X')

    def test_append_only(self):
        path = os.path.join(self.wiki, 'log.md')
        log_mod.append_entry(path, 'ingest', 'Prima', [])
        log_mod.append_entry(path, 'lint', 'Seconda', [])
        self.assertEqual(len(log_mod.read_entries(path)), 2)


class TestResolver(WikiFixture):
    def test_finds_root_from_subdirectory(self):
        found = W.find_wiki_root(start=os.path.join(self.wiki, 'concepts'), scan_drives=False)
        self.assertEqual(os.path.realpath(found), os.path.realpath(self.tmp))

    def test_marker_roundtrip(self):
        W.write_marker(self.tmp, {'llm_wiki_portable': True, 'version': '9.9.9', 'id': 'x'})
        self.assertEqual(W.read_marker(self.tmp)['version'], '9.9.9')

    def test_is_wiki_root_requires_marker(self):
        plain = tempfile.mkdtemp()
        os.makedirs(os.path.join(plain, 'wiki'))
        try:
            self.assertFalse(W.is_wiki_root(plain))
        finally:
            shutil.rmtree(plain, ignore_errors=True)


class TestInstaller(unittest.TestCase):
    """L'installer non deve mai distruggere configurazione preesistente."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix='llmwiki-install-')
        self.home = os.path.join(self.tmp, 'home')
        self.target = os.path.join(self.tmp, 'wiki')
        os.makedirs(os.path.join(self.home, '.claude'))

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def run_installer(self, *args):
        env = dict(os.environ, HOME=self.home, USERPROFILE=self.home)
        return subprocess.run(
            [sys.executable, os.path.join(ROOT, 'install.py')] + list(args),
            capture_output=True, text=True, timeout=180, env=env)

    def test_fresh_install(self):
        result = self.run_installer('--mode', 'local', '--target', self.target,
                                    '--template', 'general', '--lang', 'it', '--no-git')
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        for path in ('.llmwiki-root', 'AGENT-WIKI.md', 'tools/wikilib.py',
                     'hooks/claude/session_start.py', 'wiki/index.md'):
            self.assertTrue(os.path.exists(os.path.join(self.target, path)), path)

    def test_preserves_existing_claude_md(self):
        claude_md = os.path.join(self.home, '.claude', 'CLAUDE.md')
        with open(claude_md, 'w', encoding='utf-8') as f:
            f.write('# Le mie preferenze\n\n- usa pnpm\n')

        self.run_installer('--mode', 'local', '--target', self.target,
                           '--template', 'general', '--no-git')

        content = W.read_text(claude_md)
        self.assertIn('usa pnpm', content)
        self.assertIn('BEGIN llm-wiki-portable', content)

    def test_idempotent(self):
        claude_md = os.path.join(self.home, '.claude', 'CLAUDE.md')
        args = ('--mode', 'local', '--target', self.target, '--template', 'general', '--no-git')
        self.run_installer(*args)
        first = W.read_text(claude_md)
        self.run_installer(*args)
        second = W.read_text(claude_md)
        self.assertEqual(first.count('BEGIN llm-wiki-portable'), 1)
        self.assertEqual(first, second)

    def test_registers_hooks_without_clobbering_settings(self):
        settings = os.path.join(self.home, '.claude', 'settings.json')
        with open(settings, 'w', encoding='utf-8') as f:
            json.dump({'model': 'opus', 'hooks': {'Notification': [{'hooks': [
                {'type': 'command', 'command': 'echo mio'}]}]}}, f)

        self.run_installer('--mode', 'local', '--target', self.target,
                           '--template', 'general', '--no-git')

        with open(settings, 'r', encoding='utf-8') as f:
            data = json.load(f)
        self.assertEqual(data['model'], 'opus')
        self.assertIn('Notification', data['hooks'])
        for event in ('SessionStart', 'UserPromptSubmit', 'PostToolUse', 'Stop'):
            self.assertIn(event, data['hooks'])

    def test_upgrade_from_v1_preserves_content(self):
        os.makedirs(os.path.join(self.target, 'wiki', 'concepts'))
        write(os.path.join(self.target, 'wiki', 'concepts', 'mio.md'),
              PAGE.format(title='Mio', body='contenuto prezioso'))
        write(os.path.join(self.target, 'sync.py'), "print('v1')\n")
        write(os.path.join(self.target, 'CLAUDE.md'),
              '# LLM Wiki Portable — D:/wiki\n\n## Wiki Root\n`D:/wiki`\n')

        result = self.run_installer('--mode', 'upgrade', '--target', self.target, '--no-git')
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)

        page = W.read_text(os.path.join(self.target, 'wiki', 'concepts', 'mio.md'))
        self.assertIn('contenuto prezioso', page)

        marker = W.read_marker(self.target)
        self.assertEqual(marker['version'], W.VERSION)
        self.assertTrue(os.path.exists(os.path.join(self.target, 'CLAUDE.md.v1.bak')))

    def test_doctor_exits_nonzero_when_no_wiki(self):
        result = self.run_installer('--mode', 'doctor', '--target',
                                    os.path.join(self.tmp, 'inesistente'))
        self.assertEqual(result.returncode, 1)


class TestDemoWiki(unittest.TestCase):
    """La wiki demo pubblicata su GitHub Pages deve restare pulita."""

    def test_demo_has_no_broken_links(self):
        demo = os.path.join(ROOT, 'demo')
        if not os.path.isdir(demo):
            self.skipTest('demo assente')
        data = sync_mod.build_data(os.path.join(demo, 'wiki'))
        self.assertEqual(data['health']['broken_links'], [])

    def test_demo_data_js_is_current(self):
        demo = os.path.join(ROOT, 'demo')
        data_js = os.path.join(ROOT, 'web', 'data.js')
        if not (os.path.isdir(demo) and os.path.isfile(data_js)):
            self.skipTest('demo assente')
        raw = W.read_text(data_js)
        published = json.loads(raw[raw.index('{'):raw.rindex(';')])
        fresh = sync_mod.build_data(os.path.join(demo, 'wiki'))
        self.assertEqual(published['stats']['total_pages'], fresh['stats']['total_pages'],
                         'web/data.js non rigenerato: esegui '
                         'python3 tools/sync.py --root demo --output web/data.json')


if __name__ == '__main__':
    unittest.main(verbosity=2)
