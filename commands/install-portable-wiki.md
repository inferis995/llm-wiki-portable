Install or configure the LLM Wiki Portable system on a USB drive or local directory.

## Step 0: Choose setup mode

Ask the user:
"Percorso della wiki portable? (es. D:\, E:\, C:\Users\Nome\wiki-portable)"

Then ask which setup mode:
1. **Classica** — Solo wiki base: directory, file wiki, web UI, sync.py, comandi. Niente MCP, niente ricerca semantica, niente config globale.
2. **Completa** — Wiki + MCP RTFM con ricerca semantica + CLAUDE.md globale per Claude Code + agente OpenCode globale + comandi. Tutto configurato per funzionare da qualsiasi directory.

Based on the choice, set `MODE_SETUP = "classica"` or `"completa"`.

## Step 1: Detect target state

**Check if wiki already exists at the target:**
- Look for `{target}/wiki/` directory with .md files
- Look for `{target}/web/index.html`
- Look for `{target}/sync.py`

**If ALL of these exist → MODE: "Configura su nuovo PC"**
The wiki is already on the USB. The user moved to a different PC. Only configure the local system:
- If MODE_SETUP = "classica": skip to Step 6 (commands only) → Step 7 → Step 8
- If MODE_SETUP = "completa": skip to Step 4 → Step 5 → Step 6 → Step 7 → Step 8

**If NONE or SOME exist → MODE: "Prima installazione"**
Ask the user to choose:
- **Nuova wiki vuota** — Full setup from scratch
- **Importa wiki esistente** — Full setup + copy existing MD files

Continue with all steps below.

## Step 2: Create directory structure (first install only)

Create these directories at the target location:
```
{target}/wiki/sources/
{target}/wiki/entities/
{target}/wiki/concepts/
{target}/wiki/comparisons/
{target}/raw/assets/
{target}/web/lib/
```

## Step 3: Copy wiki files (first install only)

**If "Nuova wiki vuota":**
- Create `{target}/wiki/index.md` with empty index template
- Create `{target}/wiki/log.md` with empty log template

**If "Importa wiki esistente":**
- Ask: "Percorso della wiki esistente da importare? (es. C:\Users\Infer\wiki\wiki)"
- Copy all .md files from that directory to `{target}/wiki\` preserving subdirectory structure
- If source has `raw/`, ask if they want to copy that too
- Copy web UI files from the source portable-wiki template to `{target}/web\`:
  `index.html`, `app.js`, `styles.css`, `lib/*.js`
- Copy `sync.py` to `{target}/sync.py`

**If "Nuova wiki vuota":**
- Copy web UI files from the source portable-wiki template to `{target}/web\`:
  `index.html`, `app.js`, `styles.css`, `lib/*.js`
- Copy `sync.py` to `{target}/sync.py`

The source portable-wiki template is at `C:\Users\Infer\portable-wiki\` (or wherever this tool was originally set up). Look for `portable-wiki/web/` and `portable-wiki/sync.py`.

## Step 4: Install MCP server + semantic search (only if MODE_SETUP = "completa")

### 4a. Install rtfm-ai with embeddings
- Run `pip show rtfm-ai`
- If NOT installed: run `pip install "rtfm-ai[embeddings]"`
- If installed but without embeddings: run `pip install "rtfm-ai[embeddings]"`

### 4b. Configure RTFM MCP in ~/.claude/mcp.json
- Read the file, check if `rtfm` key exists in `mcpServers`
- If NOT present: add the entry (merge with existing, don't overwrite).
  Always include `env` with `RTFM_DB` pointing to `{target}/.rtfm/library.db` and `RTFM_MCP_PROFILE: "admin"`:
```json
{
  "mcpServers": {
    "rtfm": {
      "command": "python",
      "args": ["-m", "rtfm.mcp"],
      "env": {
        "RTFM_DB": "{target}/.rtfm/library.db",
        "RTFM_MCP_PROFILE": "admin"
      }
    }
  }
}
```
Use forward slashes in the path (e.g. `D:/.rtfm/library.db`).

### 4c. Initialize RTFM index for semantic search
- Create `{target}/.rtfm/` directory if not exists
- Create `{target}/.rtfm/config.json` pointing to the wiki:
```json
{
  "sources": [
    {
      "path": "{target}/wiki",
      "corpus": "wiki",
      "extensions": ".md"
    }
  ]
}
```
Use forward slashes in the path.
- Run initial sync: `cd {target} && RTFM_DB="{target}/.rtfm/library.db" python -m rtfm.cli sync --force`
- If embeddings fail, install: `pip install "rtfm-ai[embeddings]"` and re-run sync

Inform the user about MCP + semantic search status.

### 4d. Configure RTFM MCP for OpenCode
- Read `~/.config/opencode/opencode.json`
- Check if `rtfm` key exists in `mcp`
- If NOT present: add the entry (merge with existing, don't overwrite):
```json
{
  "mcp": {
    "rtfm": {
      "type": "local",
      "command": ["python", "-m", "rtfm.mcp"],
      "enabled": true,
      "environment": {
        "RTFM_DB": "{target}/.rtfm/library.db",
        "RTFM_MCP_PROFILE": "admin"
      }
    }
  }
}
```
Use forward slashes in the path.

## Step 5: Install global instructions (only if MODE_SETUP = "completa")

### 5a. Claude Code — ~/.claude/CLAUDE.md (global)
Create `~/.claude/CLAUDE.md` with the wiki instructions. This makes the wiki accessible from any directory in Claude Code.

The content MUST include a **Semantic Search (RTFM MCP)** section with:
- `rtfm_search` (corpus `wiki`) as primary search method for ALL queries
- `rtfm_expand` for full context around search results
- `rtfm_sync` to re-index after every page save
- Database path: `{target}/.rtfm/library.db`

Other required sections:
- Wiki root path (`{target}/` with forward slashes)
- Structure overview (including `.rtfm/` directory)
- Operations (Ingest, Query, Lint) — all using rtfm_search as first step
- Page format with frontmatter
- Conventions (wikilinks, directories, naming)
- Log format
- After every change: update index, update log, run sync.py, run rtfm_sync

Replace ALL path placeholders with the actual target path using forward slashes.

### 5b. OpenCode agent — ~/.config/opencode/agents/wiki.md (global)
Create `~/.config/opencode/agents/wiki.md` with proper frontmatter:

```markdown
---
description: LLM Wiki Portable — knowledge base maintainer on {target} with semantic search
mode: subagent
tools:
  write: true
  edit: true
  bash: true
  read: true
---
```

The content MUST include the same **Semantic Search (RTFM MCP)** section as CLAUDE.md, with rtfm_search as primary search, rtfm_expand for context, and rtfm_sync after saves.

This makes the wiki accessible via `@wiki` from any project in OpenCode.
Use forward slashes for all paths.

### 5c. Also create local copies on the USB
Create `{target}/CLAUDE.md` and `{target}/AGENTS.md` on the USB drive as reference copies.
These must also include the semantic search instructions.
These are useful if someone uses the USB on a different machine.

## Step 6: Install commands (always)

**Claude Code commands** — create in `~/.claude/commands/`:
- `llm-dashboard.md`

**OpenCode commands** — create in `~/.config/opencode/commands/` (GLOBAL):
- `llm-dashboard.md` with frontmatter:
```markdown
---
description: Launch LLM Wiki dashboard in browser
agent: build
---
```

**OpenCode commands** — also create in `{target}/.opencode/commands/` (project-level backup):
- `llm-dashboard.md` (same content)

The `llm-dashboard` command content:
- Find wiki root (`{target}/` or ask user)
- Check if data.js is older than .md files → run sync.py if needed
- Open web/index.html in browser
- Report page count

## Step 7: Generate data.js (always if missing or outdated)

- If `{target}/web/data.js` doesn't exist OR any .md file is newer than data.js:
  Run: `python "{target}/sync.py" --wiki-dir "{target}/wiki" --output "{target}/web/data.json"`
- This generates both data.json and data.js

## Step 8: Report

Show summary:

**If MODE_SETUP = "classica":**
- **Mode**: Prima installazione / Configura su nuovo PC
- **Setup**: Classica
- **Target**: path
- **Pages**: count from data.js
- **Commands**: installati
- **Dashboard**: `/llm-dashboard` (Claude Code) o `/llm-dashboard` (OpenCode) per aprire il graph
- **Usage**: "Apri Claude Code nella directory della wiki per usarla."

**If MODE_SETUP = "completa":**
- **Mode**: Prima installazione / Configura su nuovo PC
- **Setup**: Completa
- **Target**: path
- **Pages**: count from data.js
- **MCP RTFM**: già presente / installato ora
- **Ricerca semantica**: attiva (X chunks indicizzati) / errore
- **CLAUDE.md globale**: ~/.claude/CLAUDE.md creato
- **OpenCode agent globale**: ~/.config/opencode/agents/wiki.md creato
- **OpenCode command globale**: ~/.config/opencode/commands/llm-dashboard.md creato
- **Commands**: installati
- **Dashboard**: `/llm-dashboard` per aprire il graph
- **OpenCode**: `@wiki` per invocare l'agente, `/llm-dashboard` per la dashboard
- **Usage**: "La wiki è accessibile globalmente da qualsiasi directory. Apri Claude Code o OpenCode ovunque per usarla."
