# Changelog

## [2.0.0] — 2026-08-21

Riscrittura del meccanismo di aggancio agli agenti. La v1 metteva le istruzioni
in un file di contesto e sperava che il modello le seguisse. La v2 le rende
automatiche: hook, consultazione forzata, auto-sync, auto-commit.

L'aggiornamento e' non distruttivo: `python install.py --mode upgrade` rileva la
v1, ne conserva i dati e migra la configurazione.

### Bug corretti

- **`~/.claude/CLAUDE.md` non viene piu' sovrascritto.** La v1 lo riscriveva per
  intero, cancellando la memoria globale dell'utente. Ora si usa un blocco
  delimitato idempotente; in upgrade il vecchio file viene convertito con backup
  `.pre-v2.bak`.
- **I link rotti non spariscono piu' in silenzio.** `resolve_link()` scartava i
  wikilink non risolti: non comparivano da nessuna parte. Ora sono in
  `data.json`, nel lint e nel pannello Health della dashboard.
- **Il rilevamento degli orfani funziona.** L'`index.md` linka ogni pagina, quindi
  contava come backlink e nessuna pagina risultava mai orfana.
- **La configurazione OpenCode ora si attiva.** La v1 scriveva un `mode: subagent`
  in `agents/wiki.md`, che non viene mai invocato automaticamente: OpenCode di
  fatto non vedeva mai la wiki. Sostituito da `AGENTS.md` globale +
  `opencode.json` `instructions` + plugin.
- **Slug sicuri su exFAT.** Nomi normalizzati in minuscolo ASCII: su FAT/exFAT
  `Docker.md` e `docker.md` sono lo stesso file e uno sovrascriveva l'altro.
- **`index.md` non genera piu' link fantasma** nei riassunti che rigenera.

### L'agente non dimentica piu'

Quattro hook di Claude Code, registrati mergiando `settings.json` senza mai
sovrascriverlo:

| Hook | Effetto |
|---|---|
| `SessionStart` | inietta indice della wiki e ultime operazioni dal log |
| `UserPromptSubmit` | su "cosa so su X", "ricordi", "nella wiki" cerca e inietta le pagine rilevanti prima della risposta |
| `PostToolUse` | ogni scrittura in `wiki/` risincronizza il grafo (debounce 3s) |
| `Stop` | auto-commit git della wiki; se e' stato chiesto di salvare e non e' stato scritto nulla, lo segnala una volta sola |

Equivalente OpenCode: plugin `wiki-sync.js` (`chat.params` + `tool.execute.after`).

### Nuovo

- **Due skill installabili**: `llm-wiki-setup` (installa, ripara, aggiorna,
  rileva la versione esistente) e `llm-wiki` (ingest, query, lint quotidiani).
- **`install.py`**: installer/updater unico con `--mode local|usb|migrate|newpc|
  upgrade|doctor|uninstall`, idempotente e non distruttivo.
- **Resolver portatile**: marker `.llmwiki-root` + registro `~/.llm-wiki/roots.json`
  + scansione dei mount point. La wiki si trova anche se il drive USB cambia
  lettera — la v1 falliva in silenzio.
- **La chiavetta e' autosufficiente**: `install.py`, skill, comandi, template e
  tool vengono copiati sul drive. Su un PC nuovo non serve riclonare il repo.
- **`tools/search.py`**: ricerca BM25 con titoli e tag pesati, `--list-pages`
  (la fonte di verita' per non inventare wikilink), `--backlinks`.
- **`tools/lint.py`**: health check eseguibile — link rotti, orfani, pagine
  troppo lunghe o troppo sottili, frontmatter, duplicati, pagine stale, note
  grezze finite in `wiki/`. Con `--json` e `--strict` per la CI.
- **`tools/ingest.py`**: PDF (pdftotext/pypdf), DOCX (zero dipendenze), URL,
  immagini; archiviazione automatica in `raw/`.
- **`tools/log.py`**: changelog strutturato, `--tail` alimenta il SessionStart.
- **`sync.py --rebuild-index`**: `index.md` generato in modo deterministico,
  invece di essere mantenuto a mano dall'LLM.
- **Git nella wiki**: `git init` all'installazione e auto-commit a fine sessione.
  Il metodo Karpathy riscrive le pagine: senza versionamento una distillazione
  sbagliata era irrecuperabile.
- **Provenance**: `confidence: high|medium|low`, `verified:`, e supersessione
  (`## Superato`) invece della cancellazione. Il lint segnala le pagine ferme da
  oltre 180 giorni.
- **Dashboard**: pannello Health (tasto `h`) con link rotti e orfani, filtro per
  tag, badge di confidence, link "Apri in Obsidian" e al file locale.
- **Comandi**: `/llm-wiki-save`, `/llm-wiki-ask`, `/llm-wiki-lint` oltre a
  `/llm-dashboard` e `/install-portable-wiki`.
- **Test e CI**: 42 test unittest su Linux/macOS/Windows e Python 3.8/3.12, piu'
  lint della wiki demo e smoke test di installazione.
- **Wiki demo riproducibile**: le 22 pagine di GitHub Pages vivono in `demo/` e
  la CI verifica che `web/data.js` sia allineato.

### Modificato

- **Template**: 15 file quasi identici (5 template x CLAUDE/AGENTS/HERMES)
  sostituiti da 2 core (`it`/`en`) + 5 `profile.json`. Le istruzioni vengono
  generate in un unico `AGENT-WIKI.md` sul drive, a cui puntano Claude Code,
  OpenCode e Hermes: una sola fonte, nessuna divergenza.
- **Lingua selezionabile** in installazione (`--lang it|en`).
- **Colori del grafo stabili**: seguono l'ordine dichiarato dal template, non
  l'ordine alfabetico che li faceva cambiare a ogni cartella aggiunta.
- `sync.py` alla root resta come shim: l'implementazione e' in `tools/sync.py`.

## [1.x] — 2026

Prima versione: grafo 3D, 5 template verticali, comandi
`/install-portable-wiki` e `/llm-dashboard`, `sync.py` a dipendenze zero.
