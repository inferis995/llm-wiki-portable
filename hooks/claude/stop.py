#!/usr/bin/env python3
"""
Stop hook — versionamento automatico + promemoria di salvataggio.

Due compiti:
 1. auto-commit git della wiki. Il metodo Karpathy RISCRIVE le pagine:
    senza git una distillazione sbagliata e' persa per sempre.
 2. una sola volta per sessione, se l'utente ha chiesto di salvare qualcosa
    e nessuna pagina e' stata scritta, blocca lo stop e lo fa notare.

Il blocco e' protetto da un flag di stato: non puo' entrare in loop.
"""

import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _hookutil as H  # noqa: E402


def git(root, *args, **kwargs):
    return subprocess.run(
        ['git', '-C', root] + list(args),
        capture_output=True, text=True, timeout=30, **kwargs)


def auto_commit(root):
    """Committa le modifiche a wiki/ e raw/. Silenzioso se git non e' inizializzato."""
    if not os.path.isdir(os.path.join(root, '.git')):
        return None
    try:
        status = git(root, 'status', '--porcelain', '--', 'wiki', 'raw')
        if status.returncode != 0 or not status.stdout.strip():
            return None

        changed = [line[3:] for line in status.stdout.strip().split('\n')][:6]
        git(root, 'add', '--', 'wiki', 'raw')

        summary = ", ".join(os.path.basename(c) for c in changed)
        message = "wiki: auto-commit ({} file){}".format(
            len(status.stdout.strip().split('\n')),
            "\n\n" + summary if summary else "")

        commit = git(root, '-c', 'user.name=llm-wiki',
                     '-c', 'user.email=llm-wiki@local',
                     'commit', '-m', message, '--no-verify')
        return len(changed) if commit.returncode == 0 else None
    except (OSError, subprocess.SubprocessError):
        return None


def wiki_dirty(root, W):
    """C'e' stata una scrittura in wiki/ piu' recente dell'ultimo sync?"""
    stamp = os.path.join(root, 'web', '.last-sync')
    if not os.path.isfile(stamp):
        return False
    try:
        base = os.path.getmtime(stamp)
    except OSError:
        return False
    for full, _rel in W.walk_md_files(W.wiki_dir(root)):
        try:
            if os.path.getmtime(full) > base:
                return True
        except OSError:
            continue
    return False


def run():
    data = H.read_input()
    session_id = data.get('session_id')

    if data.get('stop_hook_active'):
        sys.exit(0)

    W = H.load_wikilib()
    if W is None:
        sys.exit(0)

    state = H.read_state(session_id)
    root = state.get('root') or W.find_wiki_root(scan_drives=False)
    if not root:
        sys.exit(0)

    committed = auto_commit(root)

    if state.get('save_requested') and not state.get('nudged'):
        state['nudged'] = True
        H.write_state(session_id, state)

        if not wiki_dirty(root, W) and committed is None:
            json.dump({
                'decision': 'block',
                'reason': (
                    "In questa sessione e' stato chiesto di salvare qualcosa nella wiki "
                    "ma nessuna pagina in `{}/wiki/` risulta scritta.\n\n"
                    "Se c'e' conoscenza durevole da conservare, salvala ora:\n"
                    "1. `python {}/tools/search.py --list-pages` per gli slug esistenti\n"
                    "2. riscrivi le pagine correlate distillando, crea quelle mancanti\n"
                    "3. `python {}/tools/log.py --append ingest --title \"...\"`\n\n"
                    "Se invece non c'era nulla di durevole da salvare, dillo in una riga "
                    "e concludi — questo avviso non si ripetera'."
                ).format(root, root, root),
            }, sys.stdout)
            sys.exit(0)

    H.write_state(session_id, state)
    sys.exit(0)


if __name__ == '__main__':
    H.safe_main(run)
