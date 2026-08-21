#!/usr/bin/env python3
"""
lint.py — Health check eseguibile della wiki.

Nella v1 il lint era solo prosa dentro CLAUDE.md, quindi il modello lo
faceva "a occhio". Qui e' deterministico: l'LLM legge il report e corregge.

Controlli:
  broken      link [[...]] verso pagine inesistenti
  orphans     pagine senza backlink
  bloated     pagine > --max-words (vanno divise)
  thin        pagine con meno di 3 punti (vanno fuse)
  frontmatter frontmatter mancante o incompleto
  duplicates  titoli/slug quasi identici (pagine da fondere)
  stale       pagine con `verified:` piu' vecchio di --stale-days
  raw         note grezze finite in wiki/ invece che in raw/

Uso:
  python lint.py
  python lint.py --json
  python lint.py --only broken,orphans
  python lint.py --fix-index      (rigenera index.md, l'unico fix automatico sicuro)
"""

import argparse
import json
import os
import re
import sys
from datetime import date, datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import wikilib as W  # noqa: E402

CHECKS = ['broken', 'orphans', 'bloated', 'thin', 'frontmatter', 'duplicates', 'stale', 'raw']

SEVERITY_ICON = {'error': '[X]', 'warn': '[!]', 'info': '[i]'}

RAW_MARKERS = re.compile(
    r'(^|\n)\s*(TODO|FIXME|appunti grezzi|raw notes|da sistemare|incolla qui)',
    re.IGNORECASE,
)


def norm_title(text):
    return re.sub(r'[^a-z0-9]+', '', (text or '').lower())


def count_bullets(content):
    return sum(1 for line in content.split('\n') if line.strip().startswith(('-', '*', '1.')))


def parse_date(value):
    if not value:
        return None
    try:
        return datetime.strptime(str(value)[:10], '%Y-%m-%d').date()
    except ValueError:
        return None


def run_checks(pages, only, max_words, thin_words, stale_days):
    issues = []

    def add(check, severity, slug, message, hint=''):
        if check in only:
            issues.append({
                'check': check, 'severity': severity, 'slug': slug,
                'message': message, 'hint': hint,
            })

    skip = {'index', 'log'}
    content_pages = [p for p in pages if p['slug'] not in skip]

    for p in pages:
        for target in p['broken_links']:
            add('broken', 'error', p['slug'],
                "link rotto [[{}]]".format(target),
                "crea la pagina oppure correggi il link (verifica con search.py --list-pages)")

    for p in content_pages:
        if not p['backlinks']:
            add('orphans', 'warn', p['slug'],
                "orfana: nessuna pagina la linka",
                "collegala da una pagina esistente oppure fondila/eliminala")

    for p in content_pages:
        if p['words'] > max_words:
            add('bloated', 'warn', p['slug'],
                "{} parole (max {})".format(p['words'], max_words),
                "dividila in due pagine piu' precise — la distillazione accorcia, non allunga")

    for p in content_pages:
        if p['words'] < thin_words and count_bullets(p['content']) < 3:
            add('thin', 'warn', p['slug'],
                "troppo sottile ({} parole, {} punti)".format(p['words'], count_bullets(p['content'])),
                "fondila con la pagina correlata piu' vicina")

    for p in content_pages:
        fm = p['frontmatter']
        missing = [k for k in ('created', 'updated') if not fm.get(k)]
        if not p.get('has_frontmatter'):
            add('frontmatter', 'error', p['slug'], "frontmatter assente",
                "aggiungi created/updated/tags")
        elif missing:
            add('frontmatter', 'warn', p['slug'],
                "frontmatter incompleto: manca {}".format(', '.join(missing)))
        if not fm.get('tags'):
            add('frontmatter', 'info', p['slug'], "nessun tag")

    seen = {}
    for p in content_pages:
        key = norm_title(p['slug'].split('/')[-1])
        seen.setdefault(key, []).append(p['slug'])
    keys = list(seen)
    for i, a in enumerate(keys):
        for slug in seen[a][1:]:
            add('duplicates', 'warn', slug,
                "slug duplicato di {}".format(seen[a][0]), "fondi le due pagine")
        for b in keys[i + 1:]:
            if not a or not b or abs(len(a) - len(b)) > 4:
                continue
            if a.startswith(b) or b.startswith(a) or a in b or b in a:
                add('duplicates', 'info', seen[a][0],
                    "titolo quasi identico a {}".format(seen[b][0]),
                    "verifica se sono la stessa cosa e fondile")

    today = date.today()
    for p in content_pages:
        verified = parse_date(p['frontmatter'].get('verified'))
        if verified and (today - verified).days > stale_days:
            add('stale', 'info', p['slug'],
                "non verificata da {} giorni".format((today - verified).days),
                "rivedi la pagina e aggiorna `verified:`")

    for p in content_pages:
        if RAW_MARKERS.search(p['content']):
            add('raw', 'warn', p['slug'],
                "sembra contenere note grezze (TODO/FIXME/appunti)",
                "le note non distillate vanno in raw/, mai in wiki/")

    return issues


def main():
    parser = argparse.ArgumentParser(description='Health check della wiki')
    parser.add_argument('--root', help='Wiki root (auto-detect se omesso)')
    parser.add_argument('--json', action='store_true')
    parser.add_argument('--only', help='Controlli da eseguire, separati da virgola ({})'.format(','.join(CHECKS)))
    parser.add_argument('--max-words', type=int, default=500)
    parser.add_argument('--thin-words', type=int, default=40)
    parser.add_argument('--stale-days', type=int, default=180)
    parser.add_argument('--fix-index', action='store_true', help='Rigenera wiki/index.md')
    parser.add_argument('--strict', action='store_true', help='Exit 1 se ci sono errori (per la CI)')
    args = parser.parse_args()

    root = W.require_wiki_root(args.root)
    wdir = W.wiki_dir(root)

    only = set(CHECKS)
    if args.only:
        only = {c.strip() for c in args.only.split(',') if c.strip()}
        unknown = only - set(CHECKS)
        if unknown:
            parser.error('controlli sconosciuti: {}'.format(', '.join(sorted(unknown))))

    if args.fix_index:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        import sync as sync_mod
        data = sync_mod.build_data(wdir)
        path = sync_mod.rebuild_index(wdir, data)
        print("index.md rigenerato: {}".format(path))

    pages = W.resolve_graph(W.load_pages(wdir))
    issues = run_checks(pages, only, args.max_words, args.thin_words, args.stale_days)

    errors = sum(1 for i in issues if i['severity'] == 'error')
    warns = sum(1 for i in issues if i['severity'] == 'warn')

    if args.json:
        print(json.dumps({
            'root': root,
            'pages': len(pages),
            'errors': errors,
            'warnings': warns,
            'issues': issues,
        }, ensure_ascii=False, indent=2))
    else:
        print("Health check — {} ({} pagine)\n".format(root, len(pages)))
        if not issues:
            print("Nessun problema. La wiki e' in salute.")
        else:
            by_check = {}
            for i in issues:
                by_check.setdefault(i['check'], []).append(i)
            for check in CHECKS:
                group = by_check.get(check)
                if not group:
                    continue
                print("## {} ({})".format(check, len(group)))
                for i in group:
                    print("  {} {} — {}".format(
                        SEVERITY_ICON[i['severity']], i['slug'], i['message']))
                    if i['hint']:
                        print("      -> {}".format(i['hint']))
                print()
            print("Totale: {} errori, {} warning, {} info".format(
                errors, warns, len(issues) - errors - warns))

    if args.strict and errors:
        sys.exit(1)


if __name__ == '__main__':
    main()
