# Troubleshooting

## "wiki non trovata"

Il resolver cerca in quest'ordine: `--root` -> `$LLM_WIKI_ROOT` -> marker
`.llmwiki-root` nella cartella corrente e nei suoi antenati -> registro
`~/.llm-wiki/roots.json` -> scansione dei punti di mount.

Se fallisce tutto:
1. Il drive USB e' inserito? `ls /media /mnt /Volumes` (Windows: `wmic logicaldisk get name`)
2. La wiki e' installata? Il file `.llmwiki-root` deve esistere nella sua root.
3. Lettera del drive cambiata? `python3 <src>/install.py --mode newpc --target <nuovo path>`
4. Scorciatoia: `export LLM_WIKI_ROOT=/percorso/wiki`

## L'agente non usa la wiki

1. `python3 <src>/install.py --mode doctor`
2. Se gli hook risultano mancanti: `--mode upgrade`
3. **Riavvia Claude Code / OpenCode**: gli hook si caricano all'avvio.
4. Verifica manuale del blocco: `grep -c "llm-wiki-portable" ~/.claude/CLAUDE.md`

## Il grafo non si aggiorna

```bash
python3 <root>/tools/sync.py --rebuild-index
```
La dashboard legge `web/data.js` (funziona con `file://`). Se il browser mostra
dati vecchi, e' cache: ricarica forzato (Ctrl+Shift+R).

## Link rotti

```bash
python3 <root>/tools/lint.py --only broken
```
Nella v1 sparivano in silenzio; ora compaiono nel lint, in `data.json` e nel
pannello Health della dashboard.

## Il PDF non si estrae

`ingest.py` prova `pdftotext`, poi `pypdf`, poi `PyPDF2`.

```bash
pip install pypdf              # multipiattaforma
apt install poppler-utils      # Linux
brew install poppler           # macOS
```
In alternativa: apri il PDF e incolla il testo.

## Conflitti su exFAT / FAT32

Niente maiuscole nei nomi file, niente `: ? * " < > |`, niente symlink.
`wikilib.slugify()` normalizza tutto: usalo quando generi nomi di pagina.

## Recuperare una pagina rovinata

La distillazione riscrive: se una riscrittura ha perso qualcosa, c'e' git.

```bash
cd <root>
git log --oneline -- wiki/concepts/pagina.md
git show <commit>:wiki/concepts/pagina.md
git checkout <commit> -- wiki/concepts/pagina.md
```

## Disinstallare

```bash
python3 <src>/install.py --mode uninstall
```
Rimuove hook, blocchi di configurazione, plugin e skill. **I dati della wiki
restano intatti.**
