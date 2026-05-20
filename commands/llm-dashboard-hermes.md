---
name: llm-dashboard
description: >
  Use when the user asks to open the wiki dashboard, view the 3D knowledge graph,
  launch the LLM Wiki Portable web UI, or visualize wiki pages.
  Also activate for: "open the graph", "show the wiki", "open dashboard".
---

Open the LLM Wiki Portable 3D knowledge graph in the browser.

## Steps

1. Read `~/.claude/CLAUDE.md` or `~/.hermes/SOUL.md` to find the `wiki-root` path (look for the path replacing `{wiki-root}`)
2. The dashboard file is at `{wiki-root}/web/index.html`
3. Check if `{wiki-root}/web/data.json` exists and is up to date:
   - If missing or any `.md` file in `{wiki-root}/wiki/` is newer than `data.json`, run:
     ```
     python "{wiki-root}/sync.py" --wiki-dir "{wiki-root}/wiki" --output "{wiki-root}/web/data.json"
     ```
4. Open `{wiki-root}/web/index.html` in the default browser:
   - Linux: `xdg-open "{wiki-root}/web/index.html"`
   - macOS: `open "{wiki-root}/web/index.html"`
   - Windows: `start "" "{wiki-root}/web/index.html"`
5. Confirm: "Dashboard opened — {N} pages, {L} links"

If Python is not available, open the file directly and warn the user the graph data may be outdated.
