#!/usr/bin/env python3
"""
UserPromptSubmit hook — consulta la wiki al posto dell'agente.

Risolve: "non consulta la wiki". Quando il prompt somiglia a una domanda di
conoscenza, questo hook fa la ricerca e inietta i risultati PRIMA che il
modello risponda. Non e' piu' una scelta del modello: la wiki e' gia' li'.

Traccia anche i turni della sessione per il nudge dello Stop hook.
"""

import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _hookutil as H  # noqa: E402

# Prompt che devono far scattare una consultazione
QUERY_PATTERNS = re.compile(
    r"""(
    \bcosa\s+(so|sappiamo|sai)\b | \bche\s+cosa\s+so\b |
    \bnella?\s+wiki\b | \bsecondo\s+la\s+wiki\b | \bdalla\s+wiki\b |
    \bricordi\b | \bti\s+ricordi\b | \babbiamo\s+gia\b | \bavevamo\s+detto\b |
    \bcome\s+avevo\b | \bdove\s+avevo\b | \bcosa\s+avevo\b |
    \bkn?owledge\s*base\b | \bwhat\s+do\s+(i|we)\s+know\b | \bdo\s+you\s+remember\b |
    \bfrom\s+(my|the)\s+wiki\b | \bin\s+my\s+notes\b |
    \bmie\s+note\b | \bappunti\b
    )""",
    re.IGNORECASE | re.VERBOSE,
)

# Prompt che indicano una richiesta di salvataggio
SAVE_PATTERNS = re.compile(
    r"(\bsalva\b|\baggiungi\s+alla\s+wiki\b|\bingest\b|\bingerisci\b|"
    r"\bmemorizza\b|\bricordati\b|\bannota\b|\bsave\s+(this|it)\b|\bremember\s+this\b)",
    re.IGNORECASE,
)

MAX_SNIPPET = 700
MAX_RESULTS = 4


def run():
    data = H.read_input()
    prompt = (data.get('prompt') or '').strip()
    session_id = data.get('session_id')

    if not prompt:
        sys.exit(0)

    W = H.load_wikilib()
    if W is None:
        sys.exit(0)

    root = W.find_wiki_root(scan_drives=False)
    if not root:
        sys.exit(0)

    state = H.read_state(session_id)
    state['turns'] = state.get('turns', 0) + 1
    state['root'] = root
    if SAVE_PATTERNS.search(prompt):
        state['save_requested'] = True
    H.write_state(session_id, state)

    is_query = bool(QUERY_PATTERNS.search(prompt))
    is_save = bool(SAVE_PATTERNS.search(prompt))

    if not (is_query or is_save):
        sys.exit(0)

    tools = os.path.join(root, 'tools')
    if tools not in sys.path:
        sys.path.insert(0, tools)

    parts = []

    if is_save:
        parts += [
            "# LLM Wiki — richiesta di salvataggio rilevata",
            "",
            "Applica il metodo: **riscrivi** le pagine esistenti distillando vecchio + nuovo "
            "(non appendere), crea le pagine mancanti, poi aggiorna log e index.",
            "Verifica gli slug esistenti prima di scrivere `[[link]]`:",
            "`python {}/tools/search.py --list-pages`".format(root),
            "",
        ]

    if is_query:
        try:
            import search as search_mod
            pages = search_mod.drop_meta(W.load_pages(W.wiki_dir(root)))
            results = search_mod.bm25_search(pages, prompt, MAX_RESULTS)
        except Exception:  # noqa: BLE001
            results = []
            pages = []

        parts.append("# LLM Wiki — consultazione automatica")
        parts.append("")
        if results:
            parts.append("Pagine rilevanti gia' nella tua wiki (`{}`). "
                         "**Basa la risposta su queste e cita con `[[slug]]`**; "
                         "leggi il file completo se serve piu' contesto.".format(root))
            parts.append("")
            for score, _matched, p in results:
                content = re.sub(r'\s+', ' ', p['content'])[:MAX_SNIPPET]
                parts += [
                    "## [[{}]] — {}".format(p['slug'], p['title']),
                    "file: `{}`".format(p['path']),
                    content + ("…" if len(p['content']) > MAX_SNIPPET else ""),
                    "",
                ]
            parts.append("Se la wiki non basta a rispondere, dillo esplicitamente "
                         "e proponi di creare la pagina mancante.")
        else:
            parts.append("Nessuna pagina rilevante trovata in `{}` ({} pagine totali)."
                         .format(root, len(pages)))
            parts.append("Rispondi con le tue conoscenze, di' chiaramente che la wiki "
                         "non copre ancora l'argomento, e proponi di crearne la pagina.")
        parts.append("")

    H.emit_context('UserPromptSubmit', "\n".join(parts))


if __name__ == '__main__':
    H.safe_main(run)
