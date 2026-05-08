#!/usr/bin/env python3
"""
sync.py — Genera web/data.json dai file wiki/*.md
Uso: python sync.py [--wiki-dir ./wiki] [--output ./web/data.json]
Funziona con Python standard, nessuna dipendenza esterna.
"""

import os
import re
import json
import sys
import argparse

WIKILINK_RE = re.compile(r'\[\[([^\]|]+)(?:\|([^\]]+))?\]\]')
FRONTMATTER_RE = re.compile(r'^---\s*\n(.*?)\n---\s*\n', re.DOTALL)

CATEGORY_ORDER = ["sources", "entities", "concepts", "comparisons", "clippings"]


def parse_frontmatter(text):
    """Parse YAML frontmatter from markdown text. Returns (metadata_dict, content_without_frontmatter).
    Supports both inline lists [a, b] and YAML block lists (- item).
    """
    m = FRONTMATTER_RE.match(text)
    if not m:
        return {}, text

    raw = m.group(1)
    meta = {}
    current_key = None
    current_list = None

    for line in raw.split('\n'):
        stripped = line.strip()
        if not stripped:
            continue

        # YAML block list item (  - value)
        if stripped.startswith('- ') and current_list is not None:
            current_list.append(stripped[2:].strip().strip("'\""))
            continue

        # New key — reset list accumulator
        if ':' not in stripped:
            current_list = None
            current_key = None
            continue

        current_list = None
        current_key = None

        key, _, val = stripped.partition(':')
        key = key.strip()
        val = val.strip()

        # Remove surrounding quotes
        if (val.startswith('"') and val.endswith('"')) or \
           (val.startswith("'") and val.endswith("'")):
            val = val[1:-1]

        # Inline list [a, b, c]
        if val.startswith('[') and val.endswith(']'):
            val = [v.strip().strip("'\"") for v in val[1:-1].split(',') if v.strip()]
        elif val == '' or val == '[]':
            # Empty value — may be followed by block list items
            val = []
            current_key = key
            current_list = val
        elif val.lower() in ('true', 'false'):
            val = val.lower() == 'true'
        elif val.lower() in ('null', 'none'):
            val = None

        meta[key] = val

    content = text[m.end():]
    return meta, content


def extract_wikilinks(text):
    """Extract wikilink targets from a string."""
    if not isinstance(text, str):
        return []
    return [m.group(1) for m in WIKILINK_RE.finditer(text)]


def get_category(rel_path):
    """Derive category from first path segment."""
    parts = rel_path.replace('\\', '/').split('/')
    if len(parts) <= 1:
        return "root"
    return parts[0]


def get_slug(rel_path):
    """Get slug from relative path (strip .md extension). Python 3.8 compatible."""
    s = rel_path.replace('\\', '/')
    return s[:-3] if s.endswith('.md') else s


def walk_md_files(directory):
    """Recursively find all .md files in directory."""
    results = []
    for root, dirs, files in os.walk(directory):
        for f in sorted(files):
            if f.endswith('.md'):
                full = os.path.join(root, f)
                rel = os.path.relpath(full, directory)
                results.append((full, rel))
    return results


def resolve_link(link_target, pages_by_slug, pages_by_title):
    """Fuzzy resolve a wikilink target to a page slug."""
    lt = link_target.lower()

    if link_target in pages_by_slug:
        return link_target

    for slug in pages_by_slug:
        if slug.endswith('/' + link_target):
            return slug

    if lt in pages_by_title:
        return pages_by_title[lt]

    return None


def collect_frontmatter_links(meta):
    """Extract wikilinks from frontmatter fields (sources, related, etc.)."""
    links = []
    for key in ('sources', 'related'):
        val = meta.get(key)
        if isinstance(val, str):
            links += extract_wikilinks(val)
        elif isinstance(val, list):
            for item in val:
                links += extract_wikilinks(str(item))
    return links


def sync(wiki_dir, output_path):
    """Main sync: read all .md, parse, resolve links, generate data.json."""
    if not os.path.isdir(wiki_dir):
        print(f"Errore: directory {wiki_dir} non trovata")
        sys.exit(1)

    md_files = walk_md_files(wiki_dir)
    if not md_files:
        print(f"Nessun file .md trovato in {wiki_dir}")
        sys.exit(1)

    print(f"Trovati {len(md_files)} file .md")

    # Parse all pages
    pages = []
    for full_path, rel_path in md_files:
        try:
            with open(full_path, 'r', encoding='utf-8') as f:
                text = f.read()
        except UnicodeDecodeError:
            with open(full_path, 'r', encoding='latin-1') as f:
                text = f.read()

        meta, content = parse_frontmatter(text)
        content_links = extract_wikilinks(content)
        frontmatter_links = collect_frontmatter_links(meta)
        all_links = content_links + frontmatter_links

        slug = get_slug(rel_path)
        category = get_category(rel_path)

        # Title from frontmatter or filename
        title = meta.get('title', '')
        if not title:
            basename = os.path.basename(rel_path)
            basename = basename[:-3] if basename.endswith('.md') else basename
            title = basename.replace('-', ' ').replace('_', ' ').title()

        # Normalize tags to list
        tags = meta.get('tags', [])
        if isinstance(tags, str):
            tags = [t.strip() for t in tags.split(',') if t.strip()]
            meta['tags'] = tags

        pages.append({
            'slug': slug,
            'title': title,
            'category': category,
            'content': content.strip(),
            'frontmatter': meta,
            'links': all_links,
            'backlinks': [],
        })

    # Build lookup tables
    pages_by_slug = {p['slug']: p for p in pages}
    pages_by_title = {p['title'].lower(): p['slug'] for p in pages}

    # Resolve links and build backlinks
    resolved_links = {}
    for page in pages:
        resolved = []
        seen = set()
        for link_target in page['links']:
            slug = resolve_link(link_target, pages_by_slug, pages_by_title)
            if slug and slug != page['slug'] and slug not in seen:
                seen.add(slug)
                resolved.append(slug)
                target_page = pages_by_slug.get(slug)
                if target_page and page['slug'] not in target_page['backlinks']:
                    target_page['backlinks'].append(page['slug'])
        resolved_links[page['slug']] = resolved

    for page in pages:
        page['links'] = resolved_links.get(page['slug'], [])

    # Write output
    out_dir = os.path.dirname(output_path)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    data = {
        'pages': pages,
        'stats': {
            'total_pages': len(pages),
            'total_links': sum(len(p['links']) for p in pages),
            'categories': {cat: sum(1 for p in pages if p['category'] == cat) for cat in CATEGORY_ORDER},
        }
    }

    json_path = output_path
    js_path = os.path.join(os.path.dirname(output_path) or '.', 'data.js')

    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    js_content = 'var WIKI_DATA = ' + json.dumps(data, ensure_ascii=False) + ';\n'
    with open(js_path, 'w', encoding='utf-8') as f:
        f.write(js_content)

    print(f"Generato {json_path}: {len(pages)} pagine, {data['stats']['total_links']} link")
    print(f"Generato {js_path} (file:// compatibile)")
    for cat, count in data['stats']['categories'].items():
        if count > 0:
            print(f"  {cat}: {count}")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Sync wiki MD files to data.json')
    parser.add_argument('--wiki-dir', default='./wiki', help='Wiki directory (default: ./wiki)')
    parser.add_argument('--output', default='./web/data.json', help='Output JSON path (default: ./web/data.json)')
    args = parser.parse_args()
    sync(args.wiki_dir, args.output)
