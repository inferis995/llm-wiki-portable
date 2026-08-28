#!/usr/bin/env python3
"""
install.py — Installer e updater di LLM Wiki Portable.

E' il motore che la skill `llm-wiki-setup` pilota. Fa tutto in modo
idempotente e non distruttivo: puoi rilanciarlo quante volte vuoi.

Modalita':
  --mode local     nuova wiki in una cartella locale
  --mode usb       nuova wiki su drive USB
  --mode migrate   copia una wiki esistente verso una nuova destinazione
  --mode newpc     wiki gia' esistente: configura solo questo PC
  --mode upgrade   aggiorna un'installazione esistente all'ultima versione
  --mode doctor    diagnostica, non scrive nulla
  --mode uninstall rimuove la configurazione locale (i dati della wiki restano)

Esempi:
  python install.py --mode local --target ~/wiki --template general
  python install.py --mode usb --target /media/usb/wiki --template work --lang it
  python install.py --mode upgrade --target /media/usb/wiki
  python install.py --mode doctor
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import uuid

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, 'tools'))
import wikilib as W  # noqa: E402

BLOCK_BEGIN = "<!-- BEGIN llm-wiki-portable -->"
BLOCK_END = "<!-- END llm-wiki-portable -->"

HOOK_SCRIPTS = {
    'SessionStart': 'session_start.py',
    'UserPromptSubmit': 'user_prompt_submit.py',
    'PostToolUse': 'post_tool_use.py',
    'Stop': 'stop.py',
}

# Copiati sul target: la chiavetta diventa autosufficiente, cosi' su un PC nuovo
# basta lanciare l'install.py che sta sull'USB, senza riclonare il repo.
COPY_TREES = ['web', 'tools', 'hooks', 'skills', 'commands', 'templates', 'plugins']
COPY_FILES = ['sync.py', 'install.py', 'VERSION', 'LICENSE']

TEMPLATES = ['general', 'work', 'business', 'professional', 'research', 'custom']

log_lines = []


def say(message, level='ok'):
    icon = {'ok': '[OK]', 'warn': '[!]', 'err': '[X]', 'info': ' -  ', 'skip': '[--]'}[level]
    line = "{} {}".format(icon, message)
    log_lines.append(line)
    print(line)


def home(*parts):
    return os.path.join(os.path.expanduser('~'), *parts)


def fwd(path):
    return path.replace('\\', '/')


def python_cmd():
    return 'python' if os.name == 'nt' else 'python3'


def interpreter():
    """Interprete da mettere nei comandi degli hook."""
    exe = sys.executable
    return exe if exe and os.path.isfile(exe) else python_cmd()


# ────────────────────────────────────────────────── blocchi idempotenti ──

def write_block(path, content, header_if_new=""):
    """Inserisce/aggiorna un blocco delimitato senza toccare il resto del file.

    Questo e' il fix del bug piu' grave della v1, che sovrascriveva
    integralmente ~/.claude/CLAUDE.md cancellando la memoria dell'utente.
    """
    os.makedirs(os.path.dirname(path), exist_ok=True)
    block = "{}\n{}\n{}".format(BLOCK_BEGIN, content.strip(), BLOCK_END)

    existing = ""
    if os.path.isfile(path):
        existing = W.read_text(path)

    if BLOCK_BEGIN in existing and BLOCK_END in existing:
        start = existing.index(BLOCK_BEGIN)
        end = existing.index(BLOCK_END) + len(BLOCK_END)
        merged = existing[:start] + block + existing[end:]
        action = 'aggiornato'
    elif existing.strip():
        if looks_like_v1_generated(existing):
            backup = path + '.pre-v2.bak'
            shutil.copy2(path, backup)
            merged = block + "\n"
            action = 'convertito da v1 (backup: {})'.format(os.path.basename(backup))
        else:
            merged = existing.rstrip() + "\n\n" + block + "\n"
            action = 'blocco aggiunto (contenuto esistente preservato)'
    else:
        merged = (header_if_new + "\n\n" if header_if_new else "") + block + "\n"
        action = 'creato'

    with open(path, 'w', encoding='utf-8') as f:
        f.write(merged)
    return action


def looks_like_v1_generated(text):
    """Il file e' stato scritto dalla v1, che sovrascriveva tutto?"""
    head = text.strip()[:400]
    return head.startswith('# LLM Wiki Portable —') and 'Wiki Root' in head


def remove_block(path):
    if not os.path.isfile(path):
        return False
    text = W.read_text(path)
    if BLOCK_BEGIN not in text or BLOCK_END not in text:
        return False
    start = text.index(BLOCK_BEGIN)
    end = text.index(BLOCK_END) + len(BLOCK_END)
    cleaned = (text[:start] + text[end:]).strip()
    if cleaned:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(cleaned + "\n")
    else:
        os.remove(path)
    return True


# ─────────────────────────────────────────────────────────── template ──

def load_profile(template_dir, name, custom_folders=None):
    if name == 'custom':
        folders = custom_folders or []
        return {
            'name': 'custom',
            'label': {'it': 'Template personalizzato', 'en': 'Custom template'},
            'folders': [{'dir': f, 'prefix': '', 'desc': {'it': '', 'en': ''}} for f in folders],
            'conventions': {'it': [], 'en': []},
        }
    path = os.path.join(template_dir, name, 'profile.json')
    if not os.path.isfile(path):
        sys.exit("Errore: template sconosciuto '{}' (atteso {})".format(path, ', '.join(TEMPLATES)))
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def render_agent_doc(source_root, profile, target, lang):
    core_path = os.path.join(source_root, 'templates', '_core', 'AGENT.{}.md'.format(lang))
    if not os.path.isfile(core_path):
        core_path = os.path.join(source_root, 'templates', '_core', 'AGENT.it.md')
        lang = 'it'
    text = W.read_text(core_path)

    folders = profile['folders']

    tree = ["{}/".format(fwd(target)), "├── wiki/"]
    for i, folder in enumerate(folders):
        branch = "│   └──" if i == len(folders) - 1 else "│   ├──"
        prefix = folder.get('prefix') or ''
        tree.append("{} {}/{}".format(branch, folder['dir'], (prefix + '*.md') if prefix else '*.md'))
    tree += [
        "├── raw/                  # originali, mai modificati",
        "│   └── assets/",
        "├── web/index.html        # dashboard grafo 3D",
        "├── tools/                # search, lint, log, ingest, sync",
        "└── AGENT-WIKI.md         # queste istruzioni (fonte unica)",
    ]

    header = ("| Cartella | Prefisso | Contenuto |" if lang == 'it'
              else "| Folder | Prefix | Holds |")
    table = [header, "|---|---|---|"]
    for folder in folders:
        table.append("| `wiki/{}/` | `{}` | {} |".format(
            folder['dir'],
            folder.get('prefix') or '—',
            (folder.get('desc') or {}).get(lang, '')))

    conventions = (profile.get('conventions') or {}).get(lang, [])
    conv_text = "\n".join("- {}".format(c) for c in conventions)

    replacements = {
        '{wiki-root}': fwd(target),
        '{TEMPLATE}': profile['name'],
        '{VERSION}': W.VERSION,
        '{PY}': python_cmd(),
        '{FOLDER_TREE}': "\n".join(tree),
        '{FOLDER_TABLE}': "\n".join(table),
        '{CONVENTIONS}': conv_text,
    }
    for key, value in replacements.items():
        text = text.replace(key, value)
    return text


# ─────────────────────────────────────────────────────── struttura wiki ──

def create_structure(target, profile, lang):
    created = []
    for folder in profile['folders']:
        path = os.path.join(target, 'wiki', folder['dir'])
        if not os.path.isdir(path):
            os.makedirs(path, exist_ok=True)
            created.append(folder['dir'])
        gitkeep = os.path.join(path, '.gitkeep')
        if not os.path.exists(gitkeep):
            open(gitkeep, 'w').close()

    for path in (os.path.join(target, 'raw', 'assets'), os.path.join(target, 'web', 'lib')):
        os.makedirs(path, exist_ok=True)

    index_path = os.path.join(target, 'wiki', 'index.md')
    if not os.path.isfile(index_path):
        lines = [W.dump_frontmatter({'created': W.today(), 'updated': W.today(), 'tags': ['index']}).rstrip('\n'),
                 '', '# Wiki Index', '']
        for folder in profile['folders']:
            lines += ['## {}'.format(folder['dir']), '']
        with open(index_path, 'w', encoding='utf-8') as f:
            f.write("\n".join(lines) + "\n")
        created.append('index.md')

    log_file = os.path.join(target, 'wiki', 'log.md')
    if not os.path.isfile(log_file):
        with open(log_file, 'w', encoding='utf-8') as f:
            f.write("# Wiki Log\n")
        created.append('log.md')

    return created


def copy_runtime(source_root, target):
    """Copia web/, tools/, hooks/ e gli script di root sul target."""
    if os.path.abspath(source_root) == os.path.abspath(target):
        say("sorgente e destinazione coincidono, copia runtime saltata", 'skip')
        return

    for tree in COPY_TREES:
        src = os.path.join(source_root, tree)
        if not os.path.isdir(src):
            continue
        dst = os.path.join(target, tree)
        for root, _dirs, files in os.walk(src):
            rel = os.path.relpath(root, src)
            out_dir = os.path.join(dst, rel) if rel != '.' else dst
            os.makedirs(out_dir, exist_ok=True)
            for name in files:
                if name in ('data.js', 'data.json', '.last-sync'):
                    if os.path.exists(os.path.join(out_dir, name)):
                        continue  # non sovrascrivere i dati generati dell'utente
                if name.endswith(('.pyc',)):
                    continue
                shutil.copy2(os.path.join(root, name), os.path.join(out_dir, name))

    for name in COPY_FILES:
        src = os.path.join(source_root, name)
        if os.path.isfile(src):
            shutil.copy2(src, os.path.join(target, name))

    say("runtime copiato: {}".format(', '.join(COPY_TREES + COPY_FILES)))


def init_git(target):
    """git init + primo commit: la distillazione riscrive, senza git non si torna indietro."""
    if not shutil.which('git'):
        say("git non trovato — nessun versionamento della wiki", 'warn')
        return False
    if os.path.isdir(os.path.join(target, '.git')):
        say("git gia' inizializzato", 'skip')
        return True
    try:
        subprocess.run(['git', 'init', '-q'], cwd=target, check=True, timeout=30,
                       capture_output=True)
        gitignore = os.path.join(target, '.gitignore')
        if not os.path.isfile(gitignore):
            with open(gitignore, 'w', encoding='utf-8') as f:
                f.write("web/data.js\nweb/data.json\nweb/.last-sync\n"
                        ".DS_Store\nThumbs.db\nSystem Volume Information/\n")
        subprocess.run(['git', 'add', '-A'], cwd=target, timeout=60, capture_output=True)
        subprocess.run(['git', '-c', 'user.name=llm-wiki', '-c', 'user.email=llm-wiki@local',
                        'commit', '-q', '-m', 'wiki: installazione iniziale', '--no-verify'],
                       cwd=target, timeout=60, capture_output=True)
        say("git inizializzato — ogni sessione fara' auto-commit della wiki")
        return True
    except (OSError, subprocess.SubprocessError) as exc:
        say("git init fallito: {}".format(exc), 'warn')
        return False


# ─────────────────────────────────────────────────── configurazione IDE ──

def pointer_block(target, extra=""):
    return (
        "# LLM Wiki Portable\n\n"
        "Knowledge base personale attiva in `{root}`.\n"
        "Istruzioni complete (fonte unica, vive sul drive): `{root}/AGENT-WIKI.md` — leggila "
        "prima di lavorare sulla wiki.\n\n"
        "**Consulta la wiki prima di rispondere** su argomenti che potrebbe coprire; "
        "**salvaci la conoscenza durevole** prima di chiudere una sessione.\n\n"
        "```bash\n"
        "{py} {root}/tools/search.py --query \"<termini>\" --top 5\n"
        "{py} {root}/tools/search.py --list-pages\n"
        "{py} {root}/tools/lint.py\n"
        "```\n{extra}"
    ).format(root=fwd(target), py=python_cmd(), extra=extra)


def configure_claude(target, source_root, no_hooks=False):
    claude_dir = home('.claude')

    action = write_block(
        os.path.join(claude_dir, 'CLAUDE.md'),
        pointer_block(target, "\n@{}/AGENT-WIKI.md\n".format(fwd(target))),
    )
    say("~/.claude/CLAUDE.md {}".format(action))

    skills_src = os.path.join(source_root, 'skills')
    if os.path.isdir(skills_src):
        for skill in sorted(os.listdir(skills_src)):
            src = os.path.join(skills_src, skill)
            if not os.path.isdir(src):
                continue
            dst = os.path.join(claude_dir, 'skills', skill)
            if os.path.isdir(dst):
                shutil.rmtree(dst)
            shutil.copytree(src, dst)
        say("skill installate in ~/.claude/skills/: {}".format(
            ', '.join(sorted(os.listdir(skills_src)))))

    commands_src = os.path.join(source_root, 'commands')
    if os.path.isdir(commands_src):
        dst = os.path.join(claude_dir, 'commands')
        os.makedirs(dst, exist_ok=True)
        for name in sorted(os.listdir(commands_src)):
            if name.endswith('.md') and not name.endswith('-hermes.md'):
                shutil.copy2(os.path.join(commands_src, name), os.path.join(dst, name))
        say("comandi Claude Code installati")

    if not no_hooks:
        configure_claude_hooks(target)


def configure_claude_hooks(target):
    """Registra i 4 hook in ~/.claude/settings.json, mergiando (mai sovrascrivendo)."""
    settings_path = home('.claude', 'settings.json')
    settings = {}
    if os.path.isfile(settings_path):
        try:
            with open(settings_path, 'r', encoding='utf-8') as f:
                settings = json.load(f)
        except ValueError:
            backup = settings_path + '.bak'
            shutil.copy2(settings_path, backup)
            say("settings.json illeggibile, backup in {}".format(backup), 'warn')
            settings = {}

    hooks = settings.setdefault('hooks', {})
    py = interpreter()

    for event, script in HOOK_SCRIPTS.items():
        command = '"{}" "{}"'.format(py, os.path.join(target, 'hooks', 'claude', script))
        entry = {'type': 'command', 'command': command, 'timeout': 30}

        matchers = hooks.setdefault(event, [])
        # Togli le registrazioni precedenti di questo stesso hook (anche da altri path)
        for group in list(matchers):
            group['hooks'] = [
                h for h in group.get('hooks', [])
                if script not in str(h.get('command', ''))
            ]
            if not group['hooks']:
                matchers.remove(group)

        group = {'hooks': [entry]}
        if event == 'PostToolUse':
            group['matcher'] = 'Write|Edit|MultiEdit|NotebookEdit'
        matchers.append(group)

    os.makedirs(os.path.dirname(settings_path), exist_ok=True)
    with open(settings_path, 'w', encoding='utf-8') as f:
        json.dump(settings, f, indent=2, ensure_ascii=False)
        f.write('\n')
    say("hook Claude Code registrati: {}".format(', '.join(HOOK_SCRIPTS)))


def configure_opencode(target, source_root):
    base = home('.config', 'opencode')

    action = write_block(os.path.join(base, 'AGENTS.md'), pointer_block(target))
    say("~/.config/opencode/AGENTS.md {}".format(action))

    config_path = os.path.join(base, 'opencode.json')
    config = {}
    if os.path.isfile(config_path):
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                config = json.load(f)
        except ValueError:
            shutil.copy2(config_path, config_path + '.bak')
            say("opencode.json illeggibile, backup creato", 'warn')
            config = {}

    config.setdefault('$schema', 'https://opencode.ai/config.json')
    agent_doc = fwd(os.path.join(target, 'AGENT-WIKI.md'))
    instructions = [i for i in config.get('instructions', [])
                    if 'AGENT-WIKI.md' not in str(i)]
    instructions.append(agent_doc)
    config['instructions'] = instructions

    os.makedirs(base, exist_ok=True)
    with open(config_path, 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=2, ensure_ascii=False)
        f.write('\n')
    say("opencode.json: istruzioni -> {}".format(agent_doc))

    plugin_src = os.path.join(source_root, 'plugins', 'opencode', 'wiki-sync.js')
    if os.path.isfile(plugin_src):
        plugin_dir = os.path.join(base, 'plugin')
        os.makedirs(plugin_dir, exist_ok=True)
        shutil.copy2(plugin_src, os.path.join(plugin_dir, 'wiki-sync.js'))
        say("plugin OpenCode installato (auto-sync + contesto iniziale)")

    commands_src = os.path.join(source_root, 'commands')
    if os.path.isdir(commands_src):
        for sub in ('command', 'commands'):
            dst = os.path.join(base, sub)
            os.makedirs(dst, exist_ok=True)
            for name in sorted(os.listdir(commands_src)):
                if name.endswith('.md') and not name.endswith('-hermes.md'):
                    shutil.copy2(os.path.join(commands_src, name), os.path.join(dst, name))
        say("comandi OpenCode installati")

    skills_src = os.path.join(source_root, 'skills')
    if os.path.isdir(skills_src):
        for sub in ('skill', 'skills'):
            dst_base = os.path.join(base, sub)
            for skill in sorted(os.listdir(skills_src)):
                src = os.path.join(skills_src, skill)
                if not os.path.isdir(src):
                    continue
                dst = os.path.join(dst_base, skill)
                if os.path.isdir(dst):
                    shutil.rmtree(dst)
                shutil.copytree(src, dst)
        say("skill OpenCode installate")


def configure_hermes(target, agent_doc_text):
    hermes_dir = home('.hermes')
    if not os.path.isdir(hermes_dir) and not shutil.which('hermes'):
        say("Hermes non rilevato, configurazione saltata", 'skip')
        return

    os.makedirs(hermes_dir, exist_ok=True)
    action = write_block(os.path.join(hermes_dir, 'SOUL.md'), agent_doc_text)
    say("~/.hermes/SOUL.md {}".format(action))

    src = os.path.join(HERE, 'commands', 'llm-dashboard-hermes.md')
    if os.path.isfile(src):
        skill_dir = os.path.join(hermes_dir, 'skills', 'llm-dashboard')
        os.makedirs(skill_dir, exist_ok=True)
        shutil.copy2(src, os.path.join(skill_dir, 'SKILL.md'))
        say("skill Hermes /llm-dashboard installata")


# ────────────────────────────────────────────────── rilevamento versione ──

def detect_install(target):
    """Ritorna (stato, versione, marker). Stato: none | v1 | current | older | newer."""
    if not os.path.isdir(target):
        return 'none', None, {}

    marker = W.read_marker(target)
    has_wiki = os.path.isdir(os.path.join(target, 'wiki'))

    if marker:
        found = str(marker.get('version', '0'))
        if found == W.VERSION:
            return 'current', found, marker
        return ('older' if version_tuple(found) < version_tuple(W.VERSION) else 'newer'), found, marker

    if has_wiki and (os.path.isfile(os.path.join(target, 'sync.py'))
                     or os.path.isfile(os.path.join(target, 'CLAUDE.md'))):
        return 'v1', '1.x', {}

    if has_wiki:
        return 'v1', 'sconosciuta', {}

    return 'none', None, {}


def version_tuple(text):
    parts = re.findall(r'\d+', str(text))
    return tuple(int(p) for p in (parts + ['0', '0', '0'])[:3])


def detect_template(target):
    """Deduce il template dalle cartelle esistenti in wiki/."""
    wdir = os.path.join(target, 'wiki')
    if not os.path.isdir(wdir):
        return 'general'
    found = {d for d in os.listdir(wdir)
             if os.path.isdir(os.path.join(wdir, d)) and not d.startswith('.')}

    best, best_score = 'custom', 0
    for name in TEMPLATES:
        if name == 'custom':
            continue
        profile = load_profile(os.path.join(HERE, 'templates'), name)
        dirs = {f['dir'] for f in profile['folders']}
        if not dirs:
            continue
        score = len(found & dirs) / float(len(dirs))
        if score > best_score:
            best, best_score = name, score

    return best if best_score >= 0.5 else 'custom'


# ──────────────────────────────────────────────────────────── migrazione ──

def migrate_content(source, target):
    """Copia wiki/ e raw/ da una installazione esistente verso la nuova."""
    moved = []
    for tree in ('wiki', 'raw'):
        src = os.path.join(source, tree)
        if not os.path.isdir(src):
            continue
        dst = os.path.join(target, tree)
        count = 0
        for root, _dirs, files in os.walk(src):
            rel = os.path.relpath(root, src)
            out_dir = os.path.join(dst, rel) if rel != '.' else dst
            os.makedirs(out_dir, exist_ok=True)
            for name in files:
                out = os.path.join(out_dir, name)
                if not os.path.exists(out):
                    shutil.copy2(os.path.join(root, name), out)
                    count += 1
        moved.append("{}: {} file".format(tree, count))
    say("contenuto migrato ({})".format(', '.join(moved) if moved else 'nulla da migrare'))


def cleanup_v1(target):
    """Ritira gli artefatti v1 che ora sono generati altrove."""
    retired = []
    for name in ('CLAUDE.md', 'AGENTS.md', 'HERMES.md'):
        path = os.path.join(target, name)
        if os.path.isfile(path) and BLOCK_BEGIN not in W.read_text(path):
            backup = path + '.v1.bak'
            shutil.move(path, backup)
            retired.append(name)
    if retired:
        say("file v1 archiviati (.v1.bak): {} — sostituiti da AGENT-WIKI.md".format(
            ', '.join(retired)), 'info')

    legacy = home('.config', 'opencode', 'agents', 'wiki.md')
    if os.path.isfile(legacy):
        shutil.move(legacy, legacy + '.v1.bak')
        say("rimosso il subagent OpenCode v1 (non si attivava mai) -> ora AGENTS.md + plugin", 'info')


# ──────────────────────────────────────────────────────────────── doctor ──

def doctor(target=None):
    print("=== LLM Wiki Portable — diagnostica ===\n")
    print("Installer: v{}".format(W.VERSION))
    print("Python:    {} ({})".format(sys.version.split()[0], sys.executable))
    print("git:       {}".format(shutil.which('git') or 'NON TROVATO'))
    print()

    root = W.find_wiki_root(target)
    if not root:
        say("nessuna wiki trovata (marker .llmwiki-root assente ovunque)", 'err')
        print("\nRimedio: python install.py --mode local --target <path> --template general")
        return 1

    state, version, marker = detect_install(root)
    say("wiki: {}".format(root))
    say("stato: {} (versione {})".format(state, version or 'n/d'),
        'ok' if state == 'current' else 'warn')
    say("template: {}".format(marker.get('template') or detect_template(root)))

    pages = W.resolve_graph(W.load_pages(W.wiki_dir(root)))
    broken = sum(len(p['broken_links']) for p in pages)
    say("{} pagine, {} link rotti".format(len(pages), broken),
        'ok' if not broken else 'warn')

    for label, path in [
        ("~/.claude/CLAUDE.md", home('.claude', 'CLAUDE.md')),
        ("~/.claude/settings.json", home('.claude', 'settings.json')),
        ("~/.config/opencode/AGENTS.md", home('.config', 'opencode', 'AGENTS.md')),
        ("~/.config/opencode/opencode.json", home('.config', 'opencode', 'opencode.json')),
        ("plugin OpenCode", home('.config', 'opencode', 'plugin', 'wiki-sync.js')),
        ("AGENT-WIKI.md", os.path.join(root, 'AGENT-WIKI.md')),
        ("tools/", os.path.join(root, 'tools', 'wikilib.py')),
        ("hooks/", os.path.join(root, 'hooks', 'claude', 'session_start.py')),
    ]:
        exists = os.path.exists(path)
        say("{}: {}".format(label, 'presente' if exists else 'MANCANTE'),
            'ok' if exists else 'warn')

    settings_path = home('.claude', 'settings.json')
    registered = []
    if os.path.isfile(settings_path):
        try:
            with open(settings_path, 'r', encoding='utf-8') as f:
                content = json.dumps(json.load(f))
            registered = [e for e, s in HOOK_SCRIPTS.items() if s in content]
        except ValueError:
            pass
    missing = set(HOOK_SCRIPTS) - set(registered)
    say("hook registrati: {}".format(', '.join(registered) or 'nessuno'),
        'ok' if not missing else 'warn')

    if state != 'current' or missing:
        print("\nRimedio: python install.py --mode upgrade --target \"{}\"".format(root))
        return 1

    print("\nTutto a posto.")
    return 0


def uninstall():
    print("=== Rimozione della configurazione locale ===")
    print("I dati della wiki NON vengono toccati.\n")

    for path in (home('.claude', 'CLAUDE.md'), home('.config', 'opencode', 'AGENTS.md'),
                 home('.hermes', 'SOUL.md')):
        if remove_block(path):
            say("blocco rimosso da {}".format(path))

    settings_path = home('.claude', 'settings.json')
    if os.path.isfile(settings_path):
        try:
            with open(settings_path, 'r', encoding='utf-8') as f:
                settings = json.load(f)
            for event in list(settings.get('hooks', {})):
                groups = settings['hooks'][event]
                for group in list(groups):
                    group['hooks'] = [h for h in group.get('hooks', [])
                                      if 'hooks/claude' not in str(h.get('command', ''))
                                      and 'hooks\\claude' not in str(h.get('command', ''))]
                    if not group['hooks']:
                        groups.remove(group)
                if not groups:
                    del settings['hooks'][event]
            with open(settings_path, 'w', encoding='utf-8') as f:
                json.dump(settings, f, indent=2, ensure_ascii=False)
                f.write('\n')
            say("hook rimossi da settings.json")
        except ValueError:
            say("settings.json illeggibile, hook non rimossi", 'warn')

    plugin = home('.config', 'opencode', 'plugin', 'wiki-sync.js')
    if os.path.isfile(plugin):
        os.remove(plugin)
        say("plugin OpenCode rimosso")

    for base in (home('.claude', 'skills'), home('.config', 'opencode', 'skill'),
                 home('.config', 'opencode', 'skills')):
        for skill in ('llm-wiki', 'llm-wiki-setup'):
            path = os.path.join(base, skill)
            if os.path.isdir(path):
                shutil.rmtree(path)
                say("skill rimossa: {}".format(path))

    print("\nFatto. La wiki e i suoi contenuti sono intatti.")
    return 0


# ─────────────────────────────────────────────────────────────── install ──

def install(args):
    source_root = os.path.abspath(args.source or HERE)
    target = os.path.abspath(os.path.expanduser(args.target)) if args.target else None

    if args.mode in ('local', 'usb', 'migrate') and not target:
        sys.exit("Errore: --target obbligatorio per --mode {}".format(args.mode))

    if args.mode in ('newpc', 'upgrade') and not target:
        target = W.find_wiki_root()
        if not target:
            sys.exit("Errore: nessuna wiki trovata. Passa --target <path>.")
        say("wiki rilevata automaticamente: {}".format(target), 'info')

    state, found_version, marker = detect_install(target)
    print("=== LLM Wiki Portable v{} — modalita' {} ===".format(W.VERSION, args.mode))
    print("Target: {}".format(target))
    print("Stato rilevato: {}{}\n".format(
        state, " (versione {})".format(found_version) if found_version else ""))

    if state == 'newer' and not args.force:
        sys.exit("Il target usa la versione {} (piu' recente di questo installer {}). "
                 "Aggiorna il repo oppure usa --force.".format(found_version, W.VERSION))

    if args.mode in ('local', 'usb') and state in ('v1', 'older', 'current'):
        say("installazione esistente rilevata: procedo come UPGRADE (nessun dato toccato)", 'info')
        args.mode = 'upgrade'

    parent = os.path.dirname(target.rstrip(os.sep))
    if not os.path.isdir(target) and parent and not os.path.isdir(parent):
        sys.exit("Errore: il percorso genitore non esiste: {}\n"
                 "Se e' un drive USB, verifica che sia montato.".format(parent))
    os.makedirs(target, exist_ok=True)

    if not os.access(target, os.W_OK):
        sys.exit("Errore: {} non e' scrivibile.".format(target))

    template = args.template
    if not template:
        template = marker.get('template') or (detect_template(target) if state != 'none' else 'general')
        say("template dedotto: {}".format(template), 'info')

    lang = args.lang or marker.get('lang') or 'it'
    custom_folders = [f.strip() for f in (args.folders or '').split(',') if f.strip()]
    profile = load_profile(os.path.join(source_root, 'templates'), template, custom_folders)

    if args.mode == 'migrate':
        if not args.source_wiki:
            sys.exit("Errore: --mode migrate richiede --source-wiki <path della wiki esistente>")
        source_wiki = os.path.abspath(os.path.expanduser(args.source_wiki))
        if not os.path.isdir(os.path.join(source_wiki, 'wiki')):
            sys.exit("Errore: {} non contiene una cartella wiki/".format(source_wiki))
        create_structure(target, profile, lang)
        migrate_content(source_wiki, target)
    elif args.mode in ('local', 'usb'):
        created = create_structure(target, profile, lang)
        say("struttura creata: {}".format(', '.join(created) or 'gia' + ' presente'))
    else:
        created = create_structure(target, profile, lang)
        if created:
            say("cartelle mancanti create: {}".format(', '.join(created)))

    copy_runtime(source_root, target)

    if state == 'v1':
        cleanup_v1(target)

    agent_doc = render_agent_doc(source_root, profile, target, lang)
    agent_path = os.path.join(target, 'AGENT-WIKI.md')
    with open(agent_path, 'w', encoding='utf-8') as f:
        f.write(agent_doc)
    say("AGENT-WIKI.md generato (fonte unica delle istruzioni, {}/{})".format(template, lang))

    W.write_marker(target, {
        'llm_wiki_portable': True,
        'version': W.VERSION,
        'id': marker.get('id') or str(uuid.uuid4()),
        'template': template,
        'lang': lang,
        'folders': [f['dir'] for f in profile['folders']],
        'created': marker.get('created') or W.today(),
    })
    say("marker .llmwiki-root scritto (v{})".format(W.VERSION))

    W.register_root(target)
    say("wiki registrata in ~/.llm-wiki/roots.json (sopravvive al cambio di lettera del drive)")

    if not args.no_git:
        init_git(target)

    if not args.no_claude:
        configure_claude(target, source_root, no_hooks=args.no_hooks)
    if not args.no_opencode:
        configure_opencode(target, source_root)
    if not args.no_hermes:
        configure_hermes(target, agent_doc)

    sys.path.insert(0, os.path.join(target, 'tools'))
    try:
        import sync as sync_mod
        data = sync_mod.sync(W.wiki_dir(target),
                             os.path.join(target, 'web', 'data.json'),
                             do_rebuild_index=True, quiet=True)
        stats = data['stats']
        say("sync eseguito: {} pagine, {} link".format(stats['total_pages'], stats['total_links']))
    except Exception as exc:  # noqa: BLE001
        say("sync fallito: {} — lancialo a mano piu' tardi".format(exc), 'warn')
        stats = {'total_pages': 0, 'total_links': 0, 'total_broken': 0}

    try:
        import log as log_mod
        log_mod.append_entry(
            log_mod.log_path(target),
            'upgrade' if args.mode == 'upgrade' else 'setup',
            'LLM Wiki Portable v{} ({})'.format(W.VERSION, args.mode),
            ['template: {} · lingua: {}'.format(template, lang),
             'hook e auto-sync configurati'])
    except Exception:  # noqa: BLE001
        pass

    print("\n" + "=" * 62)
    print("Setup completato — v{}".format(W.VERSION))
    print("=" * 62)
    print("Wiki:      {}".format(target))
    print("Template:  {} ({})".format(template, lang))
    print("Contenuto: {} pagine, {} link, {} rotti".format(
        stats['total_pages'], stats['total_links'], stats.get('total_broken', 0)))
    print("""
Attivo da adesso, in qualsiasi directory:
  - a ogni sessione l'agente riceve indice e log della wiki
  - le domande "cosa so su X" consultano la wiki prima di rispondere
  - ogni scrittura in wiki/ risincronizza il grafo da sola
  - a fine sessione la wiki viene committata su git

Comandi:  /llm-wiki-save  /llm-wiki-ask  /llm-wiki-lint  /llm-dashboard
Verifica: python "{}/install.py" --mode doctor""".format(fwd(target)))
    return 0


def main():
    parser = argparse.ArgumentParser(
        description='Installer/updater di LLM Wiki Portable',
        formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--mode', required=True,
                        choices=['local', 'usb', 'migrate', 'newpc', 'upgrade', 'doctor', 'uninstall'])
    parser.add_argument('--target', help='Path della wiki')
    parser.add_argument('--source', help='Path del repo sorgente (default: questo file)')
    parser.add_argument('--source-wiki', help='Wiki esistente da migrare (--mode migrate)')
    parser.add_argument('--template', choices=TEMPLATES)
    parser.add_argument('--folders', help='Cartelle per --template custom, separate da virgola')
    parser.add_argument('--lang', choices=['it', 'en'])
    parser.add_argument('--no-hooks', action='store_true', help='Non registrare gli hook Claude Code')
    parser.add_argument('--no-claude', action='store_true')
    parser.add_argument('--no-opencode', action='store_true')
    parser.add_argument('--no-hermes', action='store_true')
    parser.add_argument('--no-git', action='store_true')
    parser.add_argument('--force', action='store_true')
    args = parser.parse_args()

    if args.mode == 'doctor':
        sys.exit(doctor(args.target))
    if args.mode == 'uninstall':
        sys.exit(uninstall())
    sys.exit(install(args))


if __name__ == '__main__':
    main()
