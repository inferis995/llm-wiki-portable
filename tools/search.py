#!/usr/bin/env python3
"""
search.py — Ricerca nella wiki, zero dipendenze.

Serve a rendere deterministico il comportamento dell'agente:
  - `--list-pages` e' la fonte di verita' per NON inventare wikilink
  - `--query` usa BM25 (titolo e tag pesati) invece di un grep cieco

Uso:
  python search.py --query "docker networking" --top 5
  python search.py --list-pages
  python search.py --list-pages --json
  python search.py --backlinks concepts/docker
"""

import argparse
import json
import math
import os
import re
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import wikilib as W  # noqa: E402

TOKEN_RE = re.compile(r"[a-z0-9]+")

# Stopword IT + EN: senza queste "cosa so di X" pesca tutto
STOPWORDS = set("""
a ai al alla alle allo agli anche c che chi ci coi col come con cui da dal dalla
dalle dallo degli dei del della delle dello di e ed gli i il in io la le lo ma mi
ne nei nel nella nelle nello non o per piu se si sono su sul sulla sue sui suo
tra un una uno vi
about all an and are as at be but by for from has have how i if in into is it its
me more no not of on or that the their there they this to was what when where
which who why with you your
""".split())

BM25_K1 = 1.5
BM25_B = 0.75

# index.md e log.md sono pagine di servizio: inquinano ogni ricerca
META_SLUGS = {'index', 'log', 'README'}


def drop_meta(pages):
    return [p for p in pages if p['slug'] not in META_SLUGS]


def tokenize(text):
    return [t for t in TOKEN_RE.findall((text or "").lower())
            if t not in STOPWORDS and len(t) > 1]


def page_tokens(page):
    """Titolo x3 e tag x2: un match nel titolo vale piu' di uno nel corpo."""
    fm = page['frontmatter']
    tags = " ".join(str(t) for t in (fm.get('tags') or []))
    return (
        tokenize(page['title']) * 3
        + tokenize(page['slug'].replace('/', ' ').replace('-', ' ')) * 2
        + tokenize(tags) * 2
        + tokenize(page['content'])
    )


def bm25_search(pages, query, top=5):
    q_tokens = tokenize(query)
    if not q_tokens:
        return []

    docs = [page_tokens(p) for p in pages]
    doc_len = [len(d) for d in docs]
    avgdl = (sum(doc_len) / len(doc_len)) if doc_len else 1.0
    n_docs = len(docs)

    df = Counter()
    for d in docs:
        for term in set(d):
            df[term] += 1

    freqs = [Counter(d) for d in docs]
    scored = []

    for i, page in enumerate(pages):
        score = 0.0
        matched = []
        for term in set(q_tokens):
            f = freqs[i].get(term, 0)
            if not f:
                continue
            matched.append(term)
            idf = math.log(1 + (n_docs - df[term] + 0.5) / (df[term] + 0.5))
            denom = f + BM25_K1 * (1 - BM25_B + BM25_B * doc_len[i] / (avgdl or 1))
            score += idf * (f * (BM25_K1 + 1)) / (denom or 1)
        if score > 0:
            scored.append((score, matched, page))

    scored.sort(key=lambda x: -x[0])
    return scored[:top]


def snippet(page, query, width=200):
    q = tokenize(query)
    content = re.sub(r'\s+', ' ', page['content'])
    lowered = content.lower()
    for term in q:
        idx = lowered.find(term)
        if idx >= 0:
            start = max(0, idx - width // 3)
            return ('…' if start else '') + content[start:start + width].strip() + '…'
    return content[:width].strip() + ('…' if len(content) > width else '')


def cmd_list_pages(pages, as_json):
    if as_json:
        print(json.dumps([{
            'slug': p['slug'],
            'title': p['title'],
            'category': p['category'],
            'tags': p['frontmatter'].get('tags', []),
            'words': p['words'],
        } for p in pages], ensure_ascii=False, indent=2))
        return

    if not pages:
        print("(wiki vuota — nessuna pagina)")
        return

    print("{} pagine. Usa SOLO questi slug nei [[wikilink]]:\n".format(len(pages)))
    by_cat = {}
    for p in pages:
        by_cat.setdefault(p['category'], []).append(p)
    for cat in sorted(by_cat):
        print("## {}".format(cat))
        for p in sorted(by_cat[cat], key=lambda x: x['slug']):
            print("  [[{}]]  {}".format(p['slug'].split('/')[-1], p['title']))
        print()


def main():
    parser = argparse.ArgumentParser(description='Ricerca nella wiki')
    parser.add_argument('--root', help='Wiki root (auto-detect se omesso)')
    parser.add_argument('--query', help='Query di ricerca')
    parser.add_argument('--top', type=int, default=5)
    parser.add_argument('--list-pages', action='store_true', help='Elenca tutti gli slug validi')
    parser.add_argument('--backlinks', metavar='SLUG', help='Chi linka questa pagina')
    parser.add_argument('--tag', help='Filtra per tag')
    parser.add_argument('--include-meta', action='store_true',
                        help='Includi index.md e log.md nei risultati')
    parser.add_argument('--json', action='store_true')
    args = parser.parse_args()

    root = W.require_wiki_root(args.root)
    pages = W.load_pages(W.wiki_dir(root))

    if args.tag:
        pages = [p for p in pages
                 if args.tag in (p['frontmatter'].get('tags') or [])]

    if args.list_pages:
        cmd_list_pages(drop_meta(pages) if not args.include_meta else pages, args.json)
        return

    if args.backlinks:
        W.resolve_graph(pages)
        target = args.backlinks
        found = [p for p in pages if p['slug'] == target or p['slug'].endswith('/' + target)]
        if not found:
            print("Pagina non trovata: {}".format(target))
            sys.exit(1)
        page = found[0]
        print("Backlink verso [[{}]]: {}".format(page['slug'], len(page['backlinks'])))
        for b in page['backlinks']:
            print("  - [[{}]]".format(b))
        return

    if not args.query:
        parser.error('serve --query, --list-pages o --backlinks')

    if not args.include_meta:
        pages = drop_meta(pages)

    results = bm25_search(pages, args.query, args.top)

    if args.json:
        print(json.dumps([{
            'slug': p['slug'],
            'title': p['title'],
            'score': round(score, 3),
            'matched': matched,
            'path': p['path'],
            'snippet': snippet(p, args.query),
        } for score, matched, p in results], ensure_ascii=False, indent=2))
        return

    if not results:
        print("Nessun risultato per: {}".format(args.query))
        print("La wiki non copre ancora questo argomento — valuta di crearne la pagina.")
        return

    print("{} risultati per «{}»:\n".format(len(results), args.query))
    for score, matched, p in results:
        print("[[{}]]  ({:.2f})  {}".format(p['slug'], score, p['path']))
        print("  {}".format(snippet(p, args.query)))
        print()


if __name__ == '__main__':
    main()
