---
description: Launch LLM Wiki dashboard in browser
---

Launch the LLM Wiki Portable dashboard (web UI) in the browser.

## Steps

### 1. Find the wiki root
Look for a `wiki/` directory in the current working directory. If not found, ask the user: "Percorso della wiki portable?"

### 2. Check if sync is needed
Compare modification time of `web/data.js` with the newest `.md` file in `wiki/`:
- If data.js is older than any .md file: inform "Sincronizzo..." then run `python "{wiki-root}/sync.py" --wiki-dir "{wiki-root}/wiki" --output "{wiki-root}/web/data.json"`
- If data.js doesn't exist: run sync.py to generate it

### 3. Launch in browser
Open `{wiki-root}/web/index.html` in the default browser.

### 4. Report
Tell the user: "Dashboard aperta nel browser. {N} pagine, {L} link."
