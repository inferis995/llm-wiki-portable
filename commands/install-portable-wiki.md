Install or configure the LLM Wiki Portable system on a USB drive or local directory.

## Step 1: Detect target and mode

Ask the user for the target path: "Percorso della wiki portable? (es. D:\, E:\, C:\Users\Nome\wiki-portable)"

Then detect the mode automatically:

**Check if wiki already exists at the target:**
- Look for `{target}/wiki/` directory with .md files
- Look for `{target}/web/index.html`
- Look for `{target}/sync.py`

**If ALL of these exist → MODE: "Configura su nuovo PC"**
The wiki is already on the USB. The user moved to a different PC. Only configure the local system:
- Skip to Step 4 (install MCP)
- Then Step 5 (install CLAUDE.md + AGENTS.md)
- Then Step 6 (install commands)
- Then Step 7 (generate data.js if missing)
- Then Step 8 (report)

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

## Step 4: Install MCP server (always)

Check if RTFM MCP server is installed:
- Run `pip show rtfm-ai`
- If NOT installed: run `pip install rtfm-ai`

Check if RTFM MCP is configured in `~/.claude/mcp.json`:
- Read the file, check if `rtfm` key exists in `mcpServers`
- If NOT present: add the entry (merge with existing, don't overwrite):
```json
{
  "mcpServers": {
    "rtfm": {
      "command": "python",
      "args": ["-m", "rtfm.mcp"]
    }
  }
}
```

Inform the user about MCP status.

## Step 5: Install CLAUDE.md and AGENTS.md (always)

**Always create both files** at `{target}/CLAUDE.md` and `{target}/AGENTS.md`.

Read the templates:
- `C:\Users\Infer\portable-wiki\templates\CLAUDE.md` → `{target}/CLAUDE.md`
- `C:\Users\Infer\portable-wiki\templates\AGENTS.md` → `{target}/AGENTS.md`

If templates don't exist at that path, search for them in:
- `{target}/templates/CLAUDE.md`
- The portable-wiki directory that contains `sync.py`

In the copied files, replace ALL occurrences of `{wiki-root}` with the actual target path using forward slashes (e.g. `D:/` or `E:/my-wiki`).

## Step 6: Install commands (always)

**Claude Code commands** — copy to `~/.claude/commands/`:
- `llm-dashboard.md`

**OpenCode commands** — create in `{target}/.opencode/commands/`:
- `llm-dashboard.md` (with frontmatter `description: Launch LLM Wiki dashboard in browser`)

Read the command templates from:
- `C:\Users\Infer\portable-wiki\templates/.opencode/commands/llm-dashboard.md`
- Or generate them inline if templates not found

The `llm-dashboard` command content:
- Find wiki root (current dir or ask user)
- Check if data.js is older than .md files → run sync.py if needed
- Open web/index.html in browser
- Report page count

## Step 7: Generate data.js (always if missing or outdated)

- If `{target}/web/data.js` doesn't exist OR any .md file is newer than data.js:
  Run: `python "{target}/sync.py" --wiki-dir "{target}/wiki" --output "{target}/web/data.json"`
- This generates both data.json and data.js

## Step 8: Report

Show summary:
- **Mode**: Prima installazione / Configura su nuovo PC
- **Target**: path
- **Pages**: count from data.js
- **MCP RTFM**: già presente / installato ora
- **CLAUDE.md + AGENTS.md**: creati
- **Commands**: installati
- **Dashboard**: `/llm-dashboard` per aprire il graph
- **Usage**: "Apri Claude Code o OpenCode in questa directory per iniziare a usare la wiki"
