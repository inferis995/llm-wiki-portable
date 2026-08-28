#!/usr/bin/env python3
"""
log.py — Changelog append-only della wiki (wiki/log.md).

Il log e' cio' che il SessionStart hook inietta in contesto: e' il modo in cui
l'agente sa cosa e' successo nelle sessioni precedenti senza rileggere tutto.

Uso:
  python log.py --tail 10
  python log.py --append ingest --title "Paper X" --detail "Creato: [[src-x]]"
  python log.py --stats
"""

import argparse
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import wikilib as W  # noqa: E402

ENTRY_RE = re.compile(r'^## \[(\d{4}-\d{2}-\d{2})\]\s*(\S+)\s*\|\s*(.*)$')

VALID_KINDS = ('ingest', 'query', 'lint', 'setup', 'upgrade', 'refactor', 'note')


def log_path(root):
    return os.path.join(W.wiki_dir(root), 'log.md')


def read_entries(path):
    if not os.path.isfile(path):
        return []
    lines = W.read_text(path).split('\n')
    entries, current = [], None
    for line in lines:
        m = ENTRY_RE.match(line)
        if m:
            if current:
                entries.append(current)
            current = {'date': m.group(1), 'kind': m.group(2),
                       'title': m.group(3).strip(), 'details': []}
        elif current is not None and line.strip():
            current['details'].append(line.rstrip())
    if current:
        entries.append(current)
    return entries


def append_entry(path, kind, title, details):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    existing = W.read_text(path) if os.path.isfile(path) else '# Wiki Log\n'
    if not existing.endswith('\n'):
        existing += '\n'

    block = '\n## [{}] {} | {}\n'.format(W.today(), kind, title)
    for detail in details or []:
        block += '- {}\n'.format(detail.lstrip('- ').strip())

    with open(path, 'w', encoding='utf-8') as f:
        f.write(existing + block)
    return block


def main():
    parser = argparse.ArgumentParser(description='Changelog della wiki')
    parser.add_argument('--root', help='Wiki root (auto-detect se omesso)')
    parser.add_argument('--tail', type=int, metavar='N', help='Mostra le ultime N voci')
    parser.add_argument('--append', metavar='KIND', help='Aggiungi una voce ({})'.format('|'.join(VALID_KINDS)))
    parser.add_argument('--title', default='')
    parser.add_argument('--detail', action='append', default=[], help='Ripetibile')
    parser.add_argument('--stats', action='store_true')
    args = parser.parse_args()

    root = W.require_wiki_root(args.root)
    path = log_path(root)

    if args.append:
        if not args.title:
            parser.error('--append richiede --title')
        block = append_entry(path, args.append, args.title, args.detail)
        print("Log aggiornato: {}".format(path))
        print(block.strip())
        return

    entries = read_entries(path)

    if args.stats:
        kinds = {}
        for e in entries:
            kinds[e['kind']] = kinds.get(e['kind'], 0) + 1
        print("{} voci di log".format(len(entries)))
        for kind, count in sorted(kinds.items(), key=lambda kv: -kv[1]):
            print("  {}: {}".format(kind, count))
        if entries:
            print("Ultima attivita': {}".format(entries[-1]['date']))
        return

    n = args.tail if args.tail else 10
    recent = entries[-n:]
    if not recent:
        print("Log vuoto — nessuna operazione registrata.")
        return

    print("Ultime {} operazioni sulla wiki:\n".format(len(recent)))
    for e in recent:
        print("[{}] {} | {}".format(e['date'], e['kind'], e['title']))
        for d in e['details'][:4]:
            print("   {}".format(d))
    print()


if __name__ == '__main__':
    main()
