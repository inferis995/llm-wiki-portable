#!/usr/bin/env python3
"""
_hookutil.py — Base condivisa degli hook di Claude Code.

Regola non negoziabile: un hook non deve MAI rompere la sessione.
Ogni errore viene ingoiato e l'hook esce 0.
"""

import json
import os
import sys

HOOK_DIR = os.path.dirname(os.path.abspath(__file__))


def tools_dir():
    """La cartella tools/ e' sorella di hooks/ nella wiki root installata."""
    candidates = [
        os.path.join(os.path.dirname(os.path.dirname(HOOK_DIR)), 'tools'),
        os.path.join(os.path.dirname(HOOK_DIR), 'tools'),
    ]
    env_root = os.environ.get('LLM_WIKI_ROOT')
    if env_root:
        candidates.insert(0, os.path.join(os.path.expanduser(env_root), 'tools'))
    for path in candidates:
        if os.path.isfile(os.path.join(path, 'wikilib.py')):
            return path
    return None


def load_wikilib():
    path = tools_dir()
    if not path:
        return None
    if path not in sys.path:
        sys.path.insert(0, path)
    try:
        import wikilib
        return wikilib
    except ImportError:
        return None


def read_input():
    try:
        raw = sys.stdin.read()
        return json.loads(raw) if raw.strip() else {}
    except (ValueError, OSError):
        return {}


def emit_context(event_name, text):
    """Inietta testo nel contesto della sessione."""
    if not text:
        sys.exit(0)
    json.dump({
        'hookSpecificOutput': {
            'hookEventName': event_name,
            'additionalContext': text,
        }
    }, sys.stdout)
    sys.stdout.write('\n')
    sys.exit(0)


def state_dir(session_id):
    base = os.path.join(os.path.expanduser('~'), '.llm-wiki', 'sessions')
    os.makedirs(base, exist_ok=True)
    safe = ''.join(c for c in str(session_id or 'default') if c.isalnum() or c in '-_')[:64]
    return os.path.join(base, safe or 'default')


def read_state(session_id):
    try:
        with open(state_dir(session_id), 'r', encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def write_state(session_id, state):
    try:
        with open(state_dir(session_id), 'w', encoding='utf-8') as f:
            json.dump(state, f)
    except OSError:
        pass


def safe_main(fn):
    """Esegue fn ingoiando qualsiasi eccezione."""
    try:
        fn()
    except SystemExit:
        raise
    except BaseException:  # noqa: BLE001 - un hook non deve mai rompere la sessione
        if os.environ.get('LLM_WIKI_HOOK_DEBUG'):
            import traceback
            traceback.print_exc(file=sys.stderr)
        sys.exit(0)
