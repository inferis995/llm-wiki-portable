# LLM Wiki Portable

<p align="center">
  <img src="screenshot.webp" alt="LLM Wiki Portable — 3D Knowledge Graph" width="700">
</p>

<p align="center">
  <a href="https://github.com/inferis995/llm-wiki-portable/stargazers"><img src="https://img.shields.io/github/stars/inferis995/llm-wiki-portable?style=social" alt="Stars"></a>
  <a href="https://github.com/inferis995/llm-wiki-portable/blob/master/LICENSE"><img src="https://img.shields.io/github/license/inferis995/llm-wiki-portable?color=blue" alt="License"></a>
  <img src="https://img.shields.io/github/last-commit/inferis995/llm-wiki-portable?color=orange" alt="Last Commit">
  <img src="https://img.shields.io/github/repo-size/inferis995/llm-wiki-portable?color=green" alt="Repo Size">
  <img src="https://img.shields.io/badge/python-3.8+-blue?logo=python&logoColor=white" alt="Python">
  <img src="https://img.shields.io/badge/platform-USB%20%7C%20Local-blueviolet" alt="Platform">
  <img src="https://img.shields.io/badge/works%20offline-yes-success" alt="Offline">
</p>

Your personal AI-powered knowledge base — on a USB stick or any folder.

Based on the [Karpathy LLM Wiki method](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f). Works with **Claude Code** and **OpenCode**. Write markdown pages with `[[wikilinks]]`, visualize them as a 3D graph, and carry everything on a USB drive. Ask Claude to ingest sources, query your knowledge base, and generate new pages automatically.

## Features

- **3D Knowledge Graph** — Interactive force-directed graph, color-coded by category
- **AI-Powered** — Claude Code or OpenCode read, write, and query the wiki for you
- **USB Portable** — Plug into any PC, run one command, done
- **Markdown + Wikilinks** — `[[page-links]]` like Obsidian, backlinks auto-generated
- **Offline** — Static HTML/JS, works with `file://`, no server needed
- **Python 3.8+** — No external dependencies beyond Python for the core

## Dashboard

<p align="center">
  <img src="docs/dashboard.webp" alt="Dashboard — 3D Knowledge Graph with sidebar navigation" width="700">
</p>

Interactive 3D graph with color-coded categories: **Fonti** (blue), **Entità** (green), **Concetti** (amber), **Confronti** (purple). Click any node to read the page. Sidebar with live search (searches titles, tags, and content). Keyboard: `/` to search, `Esc` to go back.

## Quick Start

### Step 1 — Clone the repo

```bash
git clone https://github.com/inferis995/llm-wiki-portable
cd llm-wiki-portable
```

### Step 2 — Install commands

```bash
# Linux / macOS
bash install-commands.sh

# Windows (PowerShell)
powershell -File install-commands.ps1
```

This copies the slash commands to Claude Code and OpenCode.

### Step 3 — Set up your wiki

Open **Claude Code** or **OpenCode** and run:

```
/install-portable-wiki
```

Claude will ask:
1. **Where** to put the wiki (USB drive path or any folder)
2. **Which template** to use:

| Template | Use case | Folders |
|----------|----------|---------|
| `personal` | Study, notes, research | sources / entities / concepts / comparisons |
| `work` | Projects & clients | projects / clients / meetings / tasks / resources |
| `business` | Company knowledge base | departments / processes / people / decisions / documents / meetings |

Then Claude will:
- Copy the web UI and sync script
- Write `~/.claude/CLAUDE.md` globally so Claude finds your wiki from any directory
- Create the folder structure for your chosen template

<details>
<summary>OpenCode with commands</summary>

<p align="center">
  <img src="docs/opencode-commands.webp" alt="OpenCode with LLM Wiki Portable commands" width="600">
</p>

</details>

### Step 4 — Use it

```
/llm-dashboard    ← Open the 3D graph in your browser
```

Then talk to Claude:
- *"Ingest this PDF"* → Claude creates wiki pages with wikilinks
- *"What do I know about Docker networking?"* → Claude reads the wiki and answers
- *"Show me everything related to [[kubernetes]]"* → Claude reads the graph

> **After setup:** Claude finds your wiki from **any directory** — you don't need to open a terminal in the wiki folder. The global `~/.claude/CLAUDE.md` points to your USB/folder path.

## Templates

| Template | Use case | Folders |
|----------|----------|---------|
| `personal` | Study, notes, personal research | `sources / entities / concepts / comparisons` |
| `work` | Freelance / professional project management | `projects / clients / meetings / tasks / resources` |
| `business` | Company knowledge base, SOPs, decisions | `departments / processes / people / decisions / documents / meetings` |

All templates use the same Karpathy method: ingest → query → lint. Only the folder structure and CLAUDE.md instructions differ. The 3D graph colors are assigned automatically from the actual folders in your wiki.

## How It Works

Based on the Karpathy method — the LLM acts as a "compiler" that incrementally builds a structured wiki from raw sources. Claude reads markdown files directly; no embedding server or vector database needed.

```
~/.claude/CLAUDE.md          ← Global AI instructions (points to your USB path)
~/.config/opencode/agents/wiki.md  ← OpenCode global agent

USB Drive (or any folder)/
├── wiki/                    ← Your pages (markdown with wikilinks)
│   ├── sources/src-*.md     ← Source summaries
│   ├── entities/            ← Tools, companies, people
│   ├── concepts/            ← Ideas, protocols, patterns
│   └── comparisons/         ← A vs B
├── raw/                     ← Original files (PDFs, images) — never modified
├── web/                     ← Static web UI (open index.html in browser)
│   └── data.js              ← Auto-generated by sync.py
└── sync.py                  ← Regenerates graph data from markdown
```

### The Workflow

1. **You give Claude a source** (PDF, URL, paste text)
2. **Claude creates wiki pages** with `[[wikilinks]]` and cross-references
3. **Claude runs `sync.py`** to rebuild the graph
4. **You open `/llm-dashboard`** to see the 3D graph
5. **You ask questions** — Claude reads the wiki files and answers with `[[citations]]`

### Moving to Another PC

Plug the USB into a new computer → open Claude Code or OpenCode → run `/install-portable-wiki`. The command detects the existing wiki and only configures the local system (global CLAUDE.md, commands). Your data stays on the USB.

## Page Format

```markdown
---
created: 2026-05-08
updated: 2026-05-08
sources: [[src-my-source]]
tags: [tag1, tag2]
---

# Page Title

Content with [[wikilinks]] to other pages.

## Key Points
- Point 1

## Related
- [[other-page]]
```

## Requirements

| Requirement | Notes |
|-------------|-------|
| **Claude Code** or **OpenCode** | AI assistant that runs the commands |
| **Python 3.8+** | For `sync.py` (generates the 3D graph data) |
| **USB drive or folder** | Any writable path works |
| **Browser** | For the 3D graph UI |

> Python must be in your system PATH before running `install-commands.sh`.

## Commands

| Command | Description |
|---------|-------------|
| `/install-portable-wiki` | Install wiki on USB or configure on a new PC |
| `/llm-dashboard` | Open the 3D graph in browser (auto-syncs if pages changed) |

## Tech Stack

- **Web UI**: Vanilla HTML/CSS/JS (no framework, no build step)
- **Graph**: [3d-force-graph](https://github.com/vasturiano/3d-force-graph) + Three.js + D3.js
- **Markdown**: [marked.js](https://marked.js.org/)
- **Sync**: `sync.py` — zero dependencies, Python 3.8+

## License

MIT
