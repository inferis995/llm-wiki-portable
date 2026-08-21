#!/usr/bin/env python3
"""
SessionStart hook — inietta lo stato della wiki all'avvio della sessione.

Risolve: "l'agente non sa che la wiki esiste". Con questo hook ogni sessione
parte sapendo dov'e' la wiki, cosa contiene e cosa e' successo di recente.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _hookutil as H  # noqa: E402

MAX_INDEX_CHARS = 3000
MAX_LOG_ENTRIES = 8


def run():
    H.read_input()
    W = H.load_wikilib()
    if W is None:
        sys.exit(0)

    root = W.find_wiki_root()
    if not root or not os.path.isdir(W.wiki_dir(root)):
        sys.exit(0)

    W.register_root(root)
    wdir = W.wiki_dir(root)
    pages = W.load_pages(wdir)
    marker = W.read_marker(root) or {}

    parts = [
        "# LLM Wiki Portable — knowledge base attiva",
        "",
        "Root: `{}`  ·  template: {}  ·  {} pagine".format(
            root, marker.get('template', 'general'), len(pages)),
        "",
        "**Prima di rispondere a domande su ambiti che potrebbero essere gia' nella wiki, "
        "consultala.** Prima di chiudere un lavoro che ha prodotto conoscenza durevole, salvala.",
        "",
        "```bash",
        "python {}/tools/search.py --query \"<termini>\" --top 5   # cerca".format(root),
        "python {}/tools/search.py --list-pages                    # slug validi per i [[link]]".format(root),
        "python {}/tools/lint.py                                   # health check".format(root),
        "```",
        "",
    ]

    index_path = os.path.join(wdir, 'index.md')
    if os.path.isfile(index_path):
        text = W.read_text(index_path)
        _, body = W.parse_frontmatter(text)
        body = body.strip()
        if body:
            if len(body) > MAX_INDEX_CHARS:
                body = body[:MAX_INDEX_CHARS] + "\n[...index troncato, leggi {} per il resto]".format(index_path)
            parts += ["## Indice della wiki", "", body, ""]
    elif pages:
        parts += ["## Pagine", ""]
        parts += ["- [[{}]] — {}".format(p['slug'], p['title']) for p in pages[:60]]
        parts += [""]

    try:
        log_dir = os.path.join(root, 'tools')
        if log_dir not in sys.path:
            sys.path.insert(0, log_dir)
        import log as log_mod
        entries = log_mod.read_entries(log_mod.log_path(root))[-MAX_LOG_ENTRIES:]
        if entries:
            parts += ["## Attivita' recente", ""]
            for e in entries:
                parts.append("- [{}] {} | {}".format(e['date'], e['kind'], e['title']))
            parts.append("")
    except Exception:  # noqa: BLE001
        pass

    if not pages:
        parts += ["_Wiki vuota: il primo ingest la popolera'._", ""]

    H.emit_context('SessionStart', "\n".join(parts))


if __name__ == '__main__':
    H.safe_main(run)
