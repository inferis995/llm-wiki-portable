#!/usr/bin/env python3
"""
wikilib.py — Libreria condivisa di LLM Wiki Portable.
Zero dipendenze esterne. Python 3.8+.

Fornisce: parsing frontmatter, wikilinks, slug sanitization (exFAT-safe),
scoperta della wiki root (resolver portabile) e caricamento delle pagine.
"""

import json
import os
import re
import string
import sys
import unicodedata
from datetime import date

VERSION = "2.0.0"

MARKER_NAME = ".llmwiki-root"
REGISTRY_PATH = os.path.join(os.path.expanduser("~"), ".llm-wiki", "roots.json")

WIKILINK_RE = re.compile(r'\[\[([^\]|]+)(?:\|([^\]]+))?\]\]')
FRONTMATTER_RE = re.compile(r'^---\s*\n(.*?)\n---\s*\n', re.DOTALL)
CODE_FENCE_RE = re.compile(r'```.*?```', re.DOTALL)
INLINE_CODE_RE = re.compile(r'`[^`\n]*`')

PALETTE = [
    "#3b82f6",  # blue
    "#22c55e",  # green
    "#f59e0b",  # amber
    "#a855f7",  # purple
    "#ef4444",  # red
    "#06b6d4",  # cyan
    "#f97316",  # orange
    "#ec4899",  # pink
]
FALLBACK_COLOR = "#6b7280"

# Pagine di servizio: non contano come fonte di backlink (altrimenti l'index,
# che linka tutto, renderebbe impossibile avere una pagina orfana) e non
# entrano nelle statistiche di contenuto.
META_SLUGS = {'index', 'log', 'README'}

# Caratteri vietati su exFAT/FAT32/NTFS
FORBIDDEN_CHARS = '<>:"/\\|?*'
RESERVED_NAMES = {
    'con', 'prn', 'aux', 'nul',
    *(f'com{i}' for i in range(1, 10)),
    *(f'lpt{i}' for i in range(1, 10)),
}


# ─────────────────────────────────────────────────────────────── slug ──

def slugify(text):
    """Slug sicuro su qualsiasi filesystem (exFAT/FAT32 inclusi).

    Lowercase perche' exFAT e' case-insensitive: senza questo `Docker.md`
    e `docker.md` collidono e una delle due pagine sparisce.
    """
    if not text:
        return "untitled"

    # Translitterazione accenti -> ASCII
    text = unicodedata.normalize('NFKD', str(text))
    text = ''.join(c for c in text if not unicodedata.combining(c))

    text = text.lower().strip()

    for ch in FORBIDDEN_CHARS:
        text = text.replace(ch, '-')

    text = re.sub(r'[^a-z0-9._-]+', '-', text)
    text = re.sub(r'-{2,}', '-', text).strip('-.')

    if not text:
        return "untitled"

    if text.split('.')[0] in RESERVED_NAMES:
        text = "page-" + text

    return text[:100]


# ──────────────────────────────────────────────────────── frontmatter ──

def parse_frontmatter(text):
    """Parsa il frontmatter YAML. Ritorna (meta_dict, contenuto_senza_frontmatter).

    Supporta liste inline [a, b] e liste a blocco YAML (- item).
    """
    m = FRONTMATTER_RE.match(text)
    if not m:
        return {}, text

    raw = m.group(1)
    meta = {}
    current_list = None

    for line in raw.split('\n'):
        stripped = line.strip()
        if not stripped or stripped.startswith('#'):
            continue

        if stripped.startswith('- ') and current_list is not None:
            current_list.append(stripped[2:].strip().strip("'\""))
            continue

        if ':' not in stripped:
            current_list = None
            continue

        current_list = None
        key, _, val = stripped.partition(':')
        key = key.strip()
        val = val.strip()

        if (val.startswith('"') and val.endswith('"')) or \
           (val.startswith("'") and val.endswith("'")):
            val = val[1:-1]

        if val.startswith('[') and val.endswith(']') and not val.startswith('[['):
            val = [v.strip().strip("'\"") for v in val[1:-1].split(',') if v.strip()]
        elif val == '' or val == '[]':
            val = []
            current_list = val
        elif val.lower() in ('true', 'false'):
            val = val.lower() == 'true'
        elif val.lower() in ('null', 'none'):
            val = None

        meta[key] = val

    return meta, text[m.end():]


def dump_frontmatter(meta):
    """Serializza un dict in frontmatter YAML minimale."""
    lines = ["---"]
    for key, val in meta.items():
        if isinstance(val, list):
            lines.append("{}: [{}]".format(key, ", ".join(str(v) for v in val)))
        elif isinstance(val, bool):
            lines.append("{}: {}".format(key, "true" if val else "false"))
        elif val is None:
            lines.append("{}:".format(key))
        else:
            lines.append("{}: {}".format(key, val))
    lines.append("---")
    return "\n".join(lines) + "\n"


# ────────────────────────────────────────────────────────── wikilinks ──

def strip_code(text):
    """Rimuove blocchi e inline code: i [[link]] negli esempi non sono link veri."""
    text = CODE_FENCE_RE.sub(' ', text)
    return INLINE_CODE_RE.sub(' ', text)


def extract_wikilinks(text, ignore_code=True):
    """Estrae i target dei wikilink da una stringa."""
    if not isinstance(text, str):
        return []
    if ignore_code:
        text = strip_code(text)
    return [m.group(1).strip() for m in WIKILINK_RE.finditer(text)]


def collect_frontmatter_links(meta, keys=('sources', 'related', 'supersedes')):
    """Estrae i wikilink dai campi del frontmatter."""
    links = []
    for key in keys:
        val = meta.get(key)
        if isinstance(val, str):
            links += extract_wikilinks(val, ignore_code=False)
        elif isinstance(val, list):
            for item in val:
                links += extract_wikilinks(str(item), ignore_code=False)
    return links


# ──────────────────────────────────────────────────────────── pagine ──

def get_slug(rel_path):
    s = rel_path.replace('\\', '/')
    return s[:-3] if s.endswith('.md') else s


def get_category(rel_path):
    parts = rel_path.replace('\\', '/').split('/')
    return "root" if len(parts) <= 1 else parts[0]


def walk_md_files(directory):
    """Trova ricorsivamente tutti i .md, saltando le directory nascoste."""
    results = []
    for root, dirs, files in os.walk(directory):
        dirs[:] = [d for d in sorted(dirs) if not d.startswith('.')]
        for f in sorted(files):
            if f.endswith('.md'):
                full = os.path.join(root, f)
                results.append((full, os.path.relpath(full, directory)))
    return results


def read_text(path):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return f.read()
    except UnicodeDecodeError:
        with open(path, 'r', encoding='latin-1') as f:
            return f.read()


def title_from_path(rel_path):
    base = os.path.basename(rel_path)
    base = base[:-3] if base.endswith('.md') else base
    return base.replace('-', ' ').replace('_', ' ').title()


def load_pages(wiki_dir):
    """Carica tutte le pagine della wiki come lista di dict."""
    pages = []
    for full_path, rel_path in walk_md_files(wiki_dir):
        text = read_text(full_path)
        meta, content = parse_frontmatter(text)
        had_frontmatter = bool(meta)

        title = meta.get('title') or title_from_path(rel_path)

        tags = meta.get('tags', [])
        if isinstance(tags, str):
            tags = [t.strip() for t in tags.split(',') if t.strip()]
        meta['tags'] = tags

        pages.append({
            'slug': get_slug(rel_path),
            'path': full_path,
            'rel_path': rel_path.replace('\\', '/'),
            'title': title,
            'category': get_category(rel_path),
            'content': content.strip(),
            'frontmatter': meta,
            'has_frontmatter': had_frontmatter,
            'raw_links': extract_wikilinks(content) + collect_frontmatter_links(meta),
            'links': [],
            'broken_links': [],
            'backlinks': [],
            'words': len(content.split()),
        })
    return pages


def resolve_link(link_target, pages_by_slug, pages_by_title):
    """Risolve un wikilink su uno slug. Match esatto -> suffisso -> titolo."""
    target = link_target.strip()
    if target in pages_by_slug:
        return target

    slugged = slugify(target)
    if slugged in pages_by_slug:
        return slugged

    for slug in pages_by_slug:
        if slug.endswith('/' + target) or slug.endswith('/' + slugged):
            return slug

    lt = target.lower()
    if lt in pages_by_title:
        return pages_by_title[lt]

    return None


def resolve_graph(pages):
    """Risolve i link, costruisce i backlink e registra i link rotti.

    A differenza della v1 i link non risolti NON vengono scartati in silenzio:
    finiscono in page['broken_links'] e quindi in data.json e nel lint.
    """
    pages_by_slug = {p['slug']: p for p in pages}
    pages_by_title = {}
    for p in pages:
        pages_by_title.setdefault(p['title'].lower(), p['slug'])

    for page in pages:
        seen = set()
        for target in page['raw_links']:
            slug = resolve_link(target, pages_by_slug, pages_by_title)
            if slug is None:
                if target not in page['broken_links']:
                    page['broken_links'].append(target)
                continue
            if slug == page['slug'] or slug in seen:
                continue
            seen.add(slug)
            page['links'].append(slug)
            target_page = pages_by_slug[slug]
            if page['slug'] not in target_page['backlinks']:
                target_page['backlinks'].append(page['slug'])

    return pages


def detect_categories(wiki_dir):
    cats = []
    try:
        for entry in sorted(os.listdir(wiki_dir)):
            if os.path.isdir(os.path.join(wiki_dir, entry)) and not entry.startswith('.'):
                cats.append(entry)
    except OSError:
        pass
    return cats


def build_category_colors(categories):
    colors = {cat: PALETTE[i % len(PALETTE)] for i, cat in enumerate(categories)}
    colors["root"] = FALLBACK_COLOR
    return colors


# ────────────────────────────────────────────────── resolver wiki root ──

def read_marker(root):
    """Legge .llmwiki-root. Ritorna dict o None."""
    path = os.path.join(root, MARKER_NAME)
    if not os.path.isfile(path):
        return None
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return data if isinstance(data, dict) else None
    except (ValueError, OSError):
        return None


def write_marker(root, data):
    data = dict(data)
    data['updated'] = date.today().isoformat()
    path = os.path.join(root, MARKER_NAME)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')
    return path


def is_wiki_root(path):
    return bool(path) and os.path.isdir(os.path.join(path, 'wiki')) and \
        read_marker(path) is not None


def _candidate_mount_points():
    """Punti di mount plausibili per un drive USB, per OS."""
    candidates = []
    if os.name == 'nt':
        for letter in string.ascii_uppercase:
            candidates.append(letter + ':\\')
    else:
        for base in ('/media', '/mnt', '/Volumes', '/run/media'):
            if not os.path.isdir(base):
                continue
            candidates.append(base)
            try:
                for entry in os.listdir(base):
                    sub = os.path.join(base, entry)
                    if os.path.isdir(sub):
                        candidates.append(sub)
            except OSError:
                pass
    return candidates


def load_registry():
    """Registro dei wiki root conosciuti su questo PC."""
    try:
        with open(REGISTRY_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {"roots": []}
    except (OSError, ValueError):
        return {"roots": []}


def save_registry(reg):
    os.makedirs(os.path.dirname(REGISTRY_PATH), exist_ok=True)
    with open(REGISTRY_PATH, 'w', encoding='utf-8') as f:
        json.dump(reg, f, ensure_ascii=False, indent=2)
        f.write('\n')


def register_root(root, marker=None):
    """Registra un wiki root, deduplicando per id (non per path).

    Dedup per id: se la chiavetta passa da D: a E: e' la stessa wiki,
    quindi la voce vecchia viene sostituita invece di accumulare path morti.
    """
    root = os.path.abspath(root)
    marker = marker or read_marker(root) or {}
    wiki_id = marker.get('id')

    reg = load_registry()
    roots = [
        r for r in reg.get('roots', [])
        if os.path.abspath(r.get('path', '')) != root
        and not (wiki_id and r.get('id') == wiki_id)
    ]
    roots.insert(0, {
        'path': root,
        'id': wiki_id,
        'template': marker.get('template'),
        'version': marker.get('version'),
        'last_seen': date.today().isoformat(),
    })
    reg['roots'] = roots[:20]
    save_registry(reg)
    return reg


def find_wiki_root(explicit=None, start=None, scan_drives=True):
    """Trova la wiki root in modo portabile.

    Ordine: argomento esplicito -> $LLM_WIKI_ROOT -> marker in cwd/antenati
    -> registro ~/.llm-wiki/roots.json -> scansione dei mount point.

    E' questo che fa sopravvivere la wiki al cambio di lettera del drive USB.
    """
    if explicit:
        explicit = os.path.abspath(os.path.expanduser(explicit))
        if is_wiki_root(explicit):
            return explicit
        # Puntato a wiki/ invece che alla root?
        parent = os.path.dirname(explicit)
        if os.path.basename(explicit) == 'wiki' and is_wiki_root(parent):
            return parent
        return explicit if os.path.isdir(explicit) else None

    env_root = os.environ.get('LLM_WIKI_ROOT')
    if env_root:
        env_root = os.path.abspath(os.path.expanduser(env_root))
        if is_wiki_root(env_root):
            return env_root

    current = os.path.abspath(start or os.getcwd())
    while True:
        if is_wiki_root(current):
            return current
        parent = os.path.dirname(current)
        if parent == current:
            break
        current = parent

    for entry in load_registry().get('roots', []):
        path = entry.get('path')
        if path and is_wiki_root(path):
            return os.path.abspath(path)

    if scan_drives:
        known_ids = {e.get('id') for e in load_registry().get('roots', []) if e.get('id')}
        for mount in _candidate_mount_points():
            if not os.path.isdir(mount):
                continue
            if is_wiki_root(mount):
                return mount
            try:
                entries = os.listdir(mount)
            except OSError:
                continue
            for name in entries[:200]:
                sub = os.path.join(mount, name)
                if is_wiki_root(sub):
                    marker = read_marker(sub) or {}
                    # Preferisci una wiki gia' conosciuta (drive rimontato)
                    if not known_ids or marker.get('id') in known_ids:
                        return sub
    return None


def require_wiki_root(explicit=None):
    """Come find_wiki_root ma esce con un errore chiaro invece di ritornare None."""
    root = find_wiki_root(explicit)
    if not root or not os.path.isdir(os.path.join(root, 'wiki')):
        sys.stderr.write(
            "Errore: wiki non trovata.\n"
            "  - Passa --root <path>, oppure\n"
            "  - Imposta LLM_WIKI_ROOT=<path>, oppure\n"
            "  - Se il drive USB non e' montato, montalo e riprova.\n"
            "  - Prima installazione? Usa la skill llm-wiki-setup.\n"
        )
        sys.exit(2)
    return root


def wiki_dir(root):
    return os.path.join(root, 'wiki')


def today():
    return date.today().isoformat()
