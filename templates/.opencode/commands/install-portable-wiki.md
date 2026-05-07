---
description: Install or configure LLM Wiki Portable on USB or local directory
---

Install or configure the LLM Wiki Portable system on a USB drive or local directory.

## Step 1: Detect target and mode

Ask the user for the target path: "Percorso della wiki portable? (es. D:\, E:\, C:\Users\Nome\wiki-portable)"

Then detect the mode automatically:

**Check if wiki already exists at the target:**
- Look for `{target}/wiki/` directory with .md files
- Look for `{target}/web/index.html`
- Look for `{target}/sync.py`

**If ALL of these exist → MODE: "Configura su nuovo PC"**
The wiki is already on the USB. Only configure the local system:
- Skip to Step 4 (install MCP)
- Then Step 5 (install CLAUDE.md + AGENTS.md)
- Then Step 6 (install commands)
- Then Step 7 (generate data.js if missing)
- Then Step 8 (report)

**If NONE or SOME exist → MODE: "Prima installazione"**
Ask: Nuova wiki vuota or Importa wiki esistente?
Continue with all steps.

## Step 2: Create directory structure (first install only)
Create: wiki/sources/, wiki/entities/, wiki/concepts/, wiki/comparisons/, raw/assets/, web/lib/

## Step 3: Copy wiki files (first install only)
Copy web UI (index.html, app.js, styles.css, lib/*.js), sync.py, and either empty seed files or imported .md files.

## Step 4: Install MCP server (always)
Check and install rtfm-ai if needed. Configure in Claude Code mcp.json if needed.

## Step 5: Install CLAUDE.md and AGENTS.md (always)
Copy templates, replace {wiki-root} with actual target path.

## Step 6: Install commands (always)
- Claude Code: ~/.claude/commands/llm-dashboard.md
- OpenCode: {target}/.opencode/commands/llm-dashboard.md

## Step 7: Generate data.js (always if missing or outdated)
Run sync.py if data.js missing or .md files are newer.

## Step 8: Report
Show mode, target, pages, MCP status, dashboard command.
