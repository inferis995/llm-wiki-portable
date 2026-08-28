#!/usr/bin/env python3
"""
sync.py — Genera web/data.json + web/data.js dai file wiki/*.md.

Novita' v2:
  - i link rotti non spariscono piu' in silenzio: finiscono in data.json
  - orfani calcolati e esportati
  - --rebuild-index rigenera wiki/index.md in modo deterministico

Uso:
  python sync.py                          (auto-detect della wiki root)
  python sync.py --root /media/usb/wiki
  python sync.py --wiki-dir ./wiki --output ./web/data.json
  python sync.py --rebuild-index
"""

import argparse
import json
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import wikilib as W  # noqa: E402


def ordered_categories(wiki_directory):
    """Categorie nell'ordine del template, non alfabetico.

    L'ordine alfabetico farebbe cambiare colore a meta' grafo ogni volta che
    si aggiunge una cartella: il marker conserva l'ordine dichiarato.
    """
    detected = W.detect_categories(wiki_directory)
    marker = W.read_marker(os.path.dirname(os.path.abspath(wiki_directory))) or {}
    declared = [c for c in (marker.get('folders') or []) if c in detected]
    return declared + [c for c in detected if c not in declared]


def recent_log(wiki_directory, limit=40):
    """Ultime voci del log, cosi' la dashboard puo' mostrare una timeline."""
    path = os.path.join(wiki_directory, 'log.md')
    if not os.path.isfile(path):
        return []
    try:
        import log as log_mod
        entries = log_mod.read_entries(path)[-limit:]
    except Exception:  # noqa: BLE001
        return []
    return [{
        'date': e['date'],
        'kind': e['kind'],
        'title': e['title'],
        'details': e['details'][:6],
    } for e in reversed(entries)]


def build_data(wiki_directory, reproducible=False):
    pages = W.resolve_graph(W.load_pages(wiki_directory))

    detected = ordered_categories(wiki_directory)
    colors = W.build_category_colors(detected)
    all_cats = detected or sorted({p['category'] for p in pages if p['category'] != 'root'})

    out_pages = []
    broken = []
    orphans = []

    for p in pages:
        out_pages.append({
            'slug': p['slug'],
            'title': p['title'],
            'category': p['category'],
            'content': p['content'],
            'frontmatter': p['frontmatter'],
            'links': p['links'],
            'backlinks': p['backlinks'],
            'broken_links': p['broken_links'],
            'words': p['words'],
        })
        for target in p['broken_links']:
            broken.append({'from': p['slug'], 'target': target})
        # Un backlink dall'index non conta: l'index linka tutto per costruzione
        real_backlinks = [b for b in p['backlinks'] if b not in W.META_SLUGS]
        if not real_backlinks and p['slug'] not in W.META_SLUGS and p['category'] != 'root':
            orphans.append(p['slug'])

    tags = {}
    for p in pages:
        for tag in p['frontmatter'].get('tags', []) or []:
            tags[tag] = tags.get(tag, 0) + 1

    # generated_at e root sono volatili (ora corrente, path assoluto della
    # macchina): in modalita' riproducibile restano fuori, cosi' il data.js di
    # una wiki pubblicata e' confrontabile e non espone il filesystem locale.
    meta = {} if reproducible else {
        'generated_at': datetime.now().isoformat(timespec='seconds'),
        'root': os.path.abspath(os.path.dirname(os.path.abspath(wiki_directory))),
    }

    return {
        'version': W.VERSION,
        'pages': out_pages,
        'categories': {c: colors.get(c, W.FALLBACK_COLOR) for c in all_cats},
        'tags': dict(sorted(tags.items(), key=lambda kv: (-kv[1], kv[0]))),
        'log': recent_log(wiki_directory),
        **meta,
        'health': {
            'broken_links': broken,
            'orphans': orphans,
        },
        'stats': {
            'total_pages': len(pages),
            'total_links': sum(len(p['links']) for p in pages),
            # Esclude i link generati dall'index: e' l'unico conteggio che non
            # cambia quando si rigenera l'index, quindi e' quello che ci va dentro.
            'content_links': sum(len(p['links']) for p in pages
                                 if p['slug'] not in W.META_SLUGS),
            'total_broken': len(broken),
            'total_orphans': len(orphans),
            'categories': {c: sum(1 for p in pages if p['category'] == c) for c in all_cats},
        },
    }


def rebuild_index(wiki_directory, data):
    """Rigenera wiki/index.md. Deterministico: niente drift dell'LLM."""
    index_path = os.path.join(wiki_directory, 'index.md')

    created = W.today()
    previous_updated = None
    previous_body = None
    if os.path.isfile(index_path):
        meta, previous_body = W.parse_frontmatter(W.read_text(index_path))
        created = meta.get('created') or created
        previous_updated = meta.get('updated')

    lines = [
        '__FRONTMATTER__',
        '',
        '# Wiki Index',
        '',
        '> Generato automaticamente da `sync.py --rebuild-index`. Non modificare a mano.',
        '',
        '{} pagine · {} link · {} link rotti · {} orfani'.format(
            data['stats']['total_pages'],
            data['stats'].get('content_links', data['stats']['total_links']),
            data['stats']['total_broken'],
            data['stats']['total_orphans'],
        ),
        '',
    ]

    by_cat = {}
    for p in data['pages']:
        if p['slug'] in ('index', 'log'):
            continue
        by_cat.setdefault(p['category'], []).append(p)

    for cat in sorted(by_cat):
        if cat == 'root':
            continue
        lines.append('## {}'.format(cat))
        lines.append('')
        for p in sorted(by_cat[cat], key=lambda x: x['title'].lower()):
            name = p['slug'].split('/')[-1]
            summary = ''
            for raw in p['content'].split('\n'):
                raw = raw.strip()
                if raw and not raw.startswith('#') and not raw.startswith('>'):
                    # I [[link]] nel riassunto creerebbero archi fantasma nel grafo
                    # (e link rotti se la pagina citata non esiste): tieni il testo,
                    # butta le parentesi.
                    summary = W.WIKILINK_RE.sub(
                        lambda m: m.group(2) or m.group(1), raw)[:110]
                    break
            entry = '- [[{}]]'.format(name)
            if summary:
                entry += ' — {}'.format(summary)
            lines.append(entry)
        lines.append('')

    body = '\n'.join(lines[1:]).lstrip('\n').rstrip('\n') + '\n'

    # `updated` cambia solo se cambia il contenuto: altrimenti l'index
    # risulterebbe modificato ogni giorno anche a wiki ferma.
    updated = W.today()
    if previous_body is not None and previous_updated and \
            previous_body.strip() == body.strip():
        updated = previous_updated

    frontmatter = W.dump_frontmatter({
        'created': created,
        'updated': updated,
        'tags': ['index'],
        'generated': 'auto (sync.py --rebuild-index)',
    }).rstrip('\n')

    with open(index_path, 'w', encoding='utf-8') as f:
        f.write(frontmatter + '\n\n' + body)
    return index_path


def sync(wiki_directory, output_path, do_rebuild_index=False, quiet=False,
         reproducible=False):
    if not os.path.isdir(wiki_directory):
        sys.stderr.write("Errore: directory {} non trovata\n".format(wiki_directory))
        sys.exit(1)

    data = build_data(wiki_directory, reproducible)

    if do_rebuild_index:
        # Una passata basta: le statistiche scritte nell'index escludono i link
        # dell'index stesso, quindi rigenerarlo e' un punto fisso.
        rebuild_index(wiki_directory, data)
        data = build_data(wiki_directory, reproducible)

    out_dir = os.path.dirname(output_path)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    js_path = os.path.join(out_dir or '.', 'data.js')
    with open(js_path, 'w', encoding='utf-8') as f:
        f.write('var WIKI_DATA = ' + json.dumps(data, ensure_ascii=False) + ';\n')

    if not quiet:
        s = data['stats']
        print("Sync OK: {} pagine, {} link".format(s['total_pages'], s['total_links']))
        print("  -> {}".format(output_path))
        print("  -> {} (file:// compatibile)".format(js_path))
        for cat, count in s['categories'].items():
            if count:
                print("  {}: {} ({})".format(cat, count, data['categories'].get(cat)))
        if s['total_broken']:
            print("  ! {} link rotti — esegui: python tools/lint.py".format(s['total_broken']))
        if s['total_orphans']:
            print("  ! {} pagine orfane".format(s['total_orphans']))

    return data


def main():
    parser = argparse.ArgumentParser(description='Sync wiki markdown -> data.json/data.js')
    parser.add_argument('--root', help='Wiki root (auto-detect se omesso)')
    parser.add_argument('--wiki-dir', help='Directory wiki (default: <root>/wiki)')
    parser.add_argument('--output', help='Path del JSON (default: <root>/web/data.json)')
    parser.add_argument('--rebuild-index', action='store_true', help='Rigenera wiki/index.md')
    parser.add_argument('--reproducible', action='store_true',
                        help='Ometti timestamp e path assoluto: output identico a parita\' di contenuto')
    parser.add_argument('--quiet', action='store_true')
    args = parser.parse_args()

    if args.wiki_dir:
        wdir = os.path.abspath(args.wiki_dir)
        out = args.output or os.path.join(os.path.dirname(wdir), 'web', 'data.json')
    else:
        root = W.require_wiki_root(args.root)
        wdir = W.wiki_dir(root)
        out = args.output or os.path.join(root, 'web', 'data.json')

    sync(wdir, out, args.rebuild_index, args.quiet, args.reproducible)


if __name__ == '__main__':
    main()
