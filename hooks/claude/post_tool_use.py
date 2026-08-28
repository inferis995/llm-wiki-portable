#!/usr/bin/env python3
"""
PostToolUse hook — auto-sync dopo ogni scrittura dentro wiki/.

Risolve alla radice "si dimentica di eseguire sync.py": non e' piu' un
compito del modello. Debounce a 3s per non risincronizzare N volte durante
un ingest che tocca 10 pagine.
"""

import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _hookutil as H  # noqa: E402

DEBOUNCE_SECONDS = 3
WRITE_TOOLS = {'Write', 'Edit', 'MultiEdit', 'NotebookEdit'}


def touched_path(data):
    tool_input = data.get('tool_input') or {}
    for key in ('file_path', 'path', 'notebook_path', 'filePath'):
        if tool_input.get(key):
            return str(tool_input[key])
    return None


def run():
    data = H.read_input()

    if data.get('tool_name') not in WRITE_TOOLS:
        sys.exit(0)

    path = touched_path(data)
    if not path or not path.endswith('.md'):
        sys.exit(0)

    W = H.load_wikilib()
    if W is None:
        sys.exit(0)

    root = W.find_wiki_root(start=os.path.dirname(os.path.abspath(path)), scan_drives=False)
    if not root:
        sys.exit(0)

    wdir = os.path.abspath(W.wiki_dir(root))
    if not os.path.abspath(path).startswith(wdir + os.sep):
        sys.exit(0)

    stamp = os.path.join(root, 'web', '.last-sync')
    now = time.time()
    try:
        if os.path.isfile(stamp) and now - os.path.getmtime(stamp) < DEBOUNCE_SECONDS:
            sys.exit(0)
    except OSError:
        pass

    tools = os.path.join(root, 'tools')
    if tools not in sys.path:
        sys.path.insert(0, tools)
    import sync as sync_mod

    result = sync_mod.sync(wdir, os.path.join(root, 'web', 'data.json'), quiet=True)

    os.makedirs(os.path.join(root, 'web'), exist_ok=True)
    with open(stamp, 'w', encoding='utf-8') as f:
        f.write(str(now))

    stats = result['stats']
    message = "wiki sincronizzata: {} pagine, {} link".format(
        stats['total_pages'], stats['total_links'])
    if stats['total_broken']:
        message += " — {} LINK ROTTI (python {}/tools/lint.py --only broken)".format(
            stats['total_broken'], root)

    json.dump({
        'hookSpecificOutput': {
            'hookEventName': 'PostToolUse',
            'additionalContext': message,
        }
    }, sys.stdout)
    sys.exit(0)


if __name__ == '__main__':
    H.safe_main(run)
