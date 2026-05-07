Launch the LLM Wiki Portable dashboard (web UI) in the browser.

## Steps

### 1. Find the wiki root
Look for a `wiki/` directory in the current working directory. If not found, ask the user: "Percorso della wiki portable? (es. D:\, E:\, C:\Users\Nome\wiki-portable)"

### 2. Check if sync is needed
- Check if `web/data.js` exists
- If it exists, compare its modification time with the newest .md file in `wiki/`:
  - Run: `python -c "import os; js=os.path.getmtime('{wiki-root}/web/data.js'); md=max(os.path.getmtime(os.path.join(dp,f)) for dp,_,fns in os.walk('{wiki-root}/wiki') for f in fns if f.endswith('.md')); print('sync_needed' if md > js else 'ok')"`
  - If `sync_needed`: inform the user "Le pagine wiki sono più recenti di data.js. Eseguo sync..." then run `python "{wiki-root}/sync.py" --wiki-dir "{wiki-root}/wiki" --output "{wiki-root}/web/data.json"`
- If `data.js` does NOT exist: run sync.py to generate it

### 3. Launch in browser
Open `{wiki-root}/web/index.html` in the default browser:
- Windows: `start "" "{wiki-root}/web/index.html"`
- macOS: `open "{wiki-root}/web/index.html"`
- Linux: `xdg-open "{wiki-root}/web/index.html"`

### 4. Report
Tell the user: "Dashboard aperta nel browser. {N} pagine, {L} link."
