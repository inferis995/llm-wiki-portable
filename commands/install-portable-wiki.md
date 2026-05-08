Installa e configura LLM Wiki Portable su USB o directory locale, con MCP RTFM e ricerca semantica funzionante al 100%.

---

## Step 0: Parametri

Chiedi all'utente:

1. **Percorso di destinazione della wiki:**
   `"Dove vuoi installare la wiki portable? (es. D:\, E:\, /media/usb, ~/wiki-portable)"`
   Salva come `TARGET` (usa sempre forward slash, es. `D:/wiki-portable`).

2. **Modalità di setup:**
   - **Classica** — Solo wiki + web UI + sync.py + comandi. Niente MCP, niente ricerca semantica.
   - **Completa** — Tutto sopra + MCP RTFM con embedding + `~/.claude/CLAUDE.md` globale + agente OpenCode globale.

   Salva come `MODE` = `"classica"` o `"completa"`.

---

## Step 1: Rileva stato esistente

Controlla se esiste già una wiki:
- `{TARGET}/wiki/` con file .md
- `{TARGET}/web/index.html`
- `{TARGET}/sync.py`

**Se TUTTI esistono → "Configura su nuovo PC"** (wiki già sull'USB, nuovo PC)
- MODE classica: vai a Step 6 → Step 7 → Step 8
- MODE completa: vai a Step 4 → Step 5 → Step 6 → Step 7 → Step 8

**Se mancano → "Prima installazione"**
Chiedi: nuova wiki vuota o importa wiki esistente?

---

## Step 2: Trova il template sorgente

Il template (web/, sync.py, templates/) si trova nel repo clonato. Trovalo così:

1. Controlla se esiste un path `llm-wiki-portable` o `portable-wiki` vicino a `~/.claude/commands/`:
   - `~/llm-wiki-portable/`
   - `~/portable-wiki/`
   - `~/Desktop/llm-wiki-portable/`
   - directory corrente
2. Un modo affidabile: cerca `sync.py` + `web/index.html` + `templates/CLAUDE.md` insieme.
3. Se non trovi: chiedi `"Dove hai clonato il repo llm-wiki-portable? (path della cartella)"`

Salva come `TEMPLATE_SRC`.

---

## Step 3: Crea struttura (solo prima installazione)

Crea le directory:
```
{TARGET}/wiki/sources/
{TARGET}/wiki/entities/
{TARGET}/wiki/concepts/
{TARGET}/wiki/comparisons/
{TARGET}/raw/assets/
{TARGET}/web/lib/
```

**Se "Nuova wiki vuota":**
- Crea `{TARGET}/wiki/index.md`:
  ```markdown
  ---
  created: {TODAY}
  updated: {TODAY}
  tags: [index]
  ---

  # Wiki Index

  ## Sources
  ## Entities
  ## Concepts
  ## Comparisons
  ```
- Crea `{TARGET}/wiki/log.md`:
  ```markdown
  # Wiki Log
  ```

**Se "Importa wiki esistente":**
- Chiedi: `"Percorso della wiki esistente da importare?"`
- Copia tutti i .md preservando la struttura delle sottodirectory
- Se c'è una `raw/` chiedi se copiarla

**Sempre:**
Copia da `{TEMPLATE_SRC}/`:
- `web/index.html` → `{TARGET}/web/index.html`
- `web/app.js` → `{TARGET}/web/app.js`
- `web/styles.css` → `{TARGET}/web/styles.css`
- `web/lib/*.js` → `{TARGET}/web/lib/`
- `sync.py` → `{TARGET}/sync.py`

---

## Step 4: Python e rtfm-ai (solo MODE completa)

### 4a. Rileva Python

Prova in ordine finché uno funziona:
```bash
python3 --version
python --version
```

Se nessuno funziona: informa l'utente e offri di continuare in MODE classica.

Salva come `PY_CMD` (es. `python3`) e `PIP_CMD` (es. `pip3`).
Su Windows usa `python` e `pip` (o `python -m pip`).

### 4b. Installa rtfm-ai con embeddings

Controlla se embeddings già disponibili:
```bash
{PY_CMD} -c "import rtfm; from sentence_transformers import SentenceTransformer; print('ok')"
```

Se fallisce, installa:
```bash
{PIP_CMD} install "rtfm-ai[embeddings]"
```

Verifica di nuovo dopo l'installazione. Se ancora fallisce:
```bash
{PIP_CMD} install sentence-transformers
```

Se dopo tutto ancora fallisce, continua ma avvisa: "Ricerca semantica non disponibile — rtfm userà keyword search."

### 4c. Crea indice RTFM

Crea la directory `{TARGET}/.rtfm/`.

Crea `{TARGET}/.rtfm/config.json`:
```json
{
  "sources": [
    {
      "path": "{TARGET}/wiki",
      "corpus": "wiki",
      "extensions": ".md"
    }
  ]
}
```
Usa forward slash anche su Windows.

Esegui la prima indicizzazione:

**Linux/macOS:**
```bash
RTFM_DB="{TARGET}/.rtfm/library.db" {PY_CMD} -m rtfm.cli sync --force
```

**Windows (cmd):**
```cmd
set RTFM_DB={TARGET}/.rtfm/library.db && {PY_CMD} -m rtfm.cli sync --force
```

**Windows (PowerShell):**
```powershell
$env:RTFM_DB="{TARGET}/.rtfm/library.db"; {PY_CMD} -m rtfm.cli sync --force
```

Riporta il numero di chunk indicizzati. Se 0 chunk e ci sono pagine .md, controlla il path.

### 4d. Verifica che la ricerca funzioni

Esegui un test concreto:

**Linux/macOS:**
```bash
RTFM_DB="{TARGET}/.rtfm/library.db" {PY_CMD} -m rtfm.cli search "wiki"
```

**Windows (PowerShell):**
```powershell
$env:RTFM_DB="{TARGET}/.rtfm/library.db"; {PY_CMD} -m rtfm.cli search "wiki"
```

Se ottieni risultati → "Ricerca semantica funzionante!"
Se errore → diagnostica:
- DB non trovato: controlla il path `{TARGET}/.rtfm/library.db`
- `ModuleNotFoundError`: reinstalla con `{PIP_CMD} install "rtfm-ai[embeddings]"`
- Nessun risultato ma ci sono pagine: rirunna il sync con `--force`

### 4e. Configura MCP in Claude Code

**IMPORTANTE: il file corretto è `~/.claude/settings.json`, NON `mcp.json`.**

Leggi `~/.claude/settings.json` (crea `{}` se non esiste). Aggiungi/aggiorna la chiave `mcpServers.rtfm`:

```json
{
  "mcpServers": {
    "rtfm": {
      "command": "{PY_CMD}",
      "args": ["-m", "rtfm.mcp"],
      "env": {
        "RTFM_DB": "{TARGET}/.rtfm/library.db",
        "RTFM_MCP_PROFILE": "admin"
      }
    }
  }
}
```

Usa sempre forward slash nel path anche su Windows (es. `D:/.rtfm/library.db`).

Scrivi il file aggiornato (merge — non sovrascrivere altre chiavi).

Usa questo snippet Python per la scrittura sicura:
```python
import json, os
path = os.path.expanduser("~/.claude/settings.json")
data = {}
if os.path.exists(path):
    with open(path) as f:
        data = json.load(f)
data.setdefault("mcpServers", {})["rtfm"] = {
    "command": "{PY_CMD}",
    "args": ["-m", "rtfm.mcp"],
    "env": {
        "RTFM_DB": "{TARGET}/.rtfm/library.db",
        "RTFM_MCP_PROFILE": "admin"
    }
}
with open(path, "w") as f:
    json.dump(data, f, indent=2)
print("settings.json aggiornato")
```

### 4f. Configura MCP in OpenCode

Leggi `~/.config/opencode/opencode.json` (crea `{}` se non esiste). Aggiungi/aggiorna `mcp.rtfm`:

```json
{
  "mcp": {
    "rtfm": {
      "type": "local",
      "command": ["{PY_CMD}", "-m", "rtfm.mcp"],
      "enabled": true,
      "environment": {
        "RTFM_DB": "{TARGET}/.rtfm/library.db",
        "RTFM_MCP_PROFILE": "admin"
      }
    }
  }
}
```

### 4g. Riavvio MCP

**IMPORTANTE**: Avvisa l'utente:

> "MCP RTFM configurato. **Devi riavviare Claude Code** per attivare il server MCP.
> Dopo il riavvio potrai usare `rtfm_search` direttamente nelle conversazioni.
> Per testare: chiedi a Claude 'cerca nella wiki: [qualcosa]'."

---

## Step 5: Istruzioni globali per Claude (solo MODE completa)

**CRITICO**: CLAUDE.md e AGENTS.md vanno installati sul **PC locale** (non sull'USB) in modo che Claude possa trovare la wiki da qualsiasi directory.

### 5a. Genera `~/.claude/CLAUDE.md` (globale)

Leggi il template da `{TEMPLATE_SRC}/templates/CLAUDE.md`.
Sostituisci **tutte** le occorrenze di `{wiki-root}` con `{TARGET}` (forward slash).

Genera il contenuto con questa struttura minima garantita:

```markdown
# LLM Wiki Portable — {TARGET}

Sei il maintainer di una knowledge base personale su drive portable.

## Wiki Root
`{TARGET}` — usa questo path per tutte le operazioni sui file.

## Struttura

```
{TARGET}/
├── wiki/
│   ├── sources/src-*.md      ← Riassunti di fonti
│   ├── entities/*.md         ← Tool, aziende, persone
│   ├── concepts/*.md         ← Idee, pattern, protocolli
│   ├── comparisons/*.md      ← A vs B
│   ├── index.md              ← Catalogo di tutte le pagine
│   └── log.md                ← Changelog append-only
├── raw/                      ← File originali (non modificare mai)
│   └── assets/
├── web/index.html            ← UI 3D (apri nel browser)
├── .rtfm/library.db          ← Database ricerca semantica
└── sync.py                   ← Esegui dopo ogni modifica
```

## Ricerca Semantica (RTFM MCP)

**Metodo PRIMARIO per TUTTE le query** — usa sempre `rtfm_search` prima di leggere file.

| Tool | Uso |
|------|-----|
| `rtfm_search` | Cerca (corpus: `"wiki"`) — SEMPRE PRIMA |
| `rtfm_expand` | Ottieni contesto completo intorno a un risultato |
| `rtfm_sync`   | Re-indicizza dopo ogni salvataggio |

Database: `{TARGET}/.rtfm/library.db`

## Operazioni

### Ingest (l'utente fornisce una fonte)
1. Salva in `{TARGET}/raw/` se è un file
2. Leggi l'intera fonte
3. Discuti i punti chiave con l'utente
4. Crea pagine wiki:
   - `{TARGET}/wiki/sources/src-{nome}.md`
   - Aggiorna pagine `entities/` e `concepts/` correlate
   - Usa `[[wikilinks]]` per i cross-reference
5. Aggiorna `{TARGET}/wiki/index.md`
6. Appendi a `{TARGET}/wiki/log.md`
7. Esegui: `python {TARGET}/sync.py --wiki-dir {TARGET}/wiki --output {TARGET}/web/data.json`
8. Esegui: `rtfm_sync` (re-indicizza)

### Query (l'utente fa una domanda)
1. `rtfm_search(query, corpus="wiki")` — **sempre primo**
2. `rtfm_expand` sui risultati migliori per contesto completo
3. Leggi pagine specifiche se necessario
4. Rispondi con `[[citazioni]]`

### Lint
1. Scansiona pagine orfane, link rotti, contraddizioni
2. Riporta e correggi

## Formato pagina

```markdown
---
created: YYYY-MM-DD
updated: YYYY-MM-DD
sources: [[src-nome]]
tags: [tag1, tag2]
---

# Titolo Pagina

Contenuto con [[wikilinks]] ad altre pagine.

## Punti Chiave
- Punto 1

## Correlate
- [[pagina-correlata]]
```

## Convenzioni

- `[[wikilinks]]` per tutti i cross-reference
- `wiki/sources/src-*` per riassunti fonti
- `wiki/entities/` per tool, aziende, persone
- `wiki/concepts/` per idee, pattern, protocolli
- `wiki/comparisons/` per confronti
- Conciso: bullet point > paragrafi
- Sempre cita con `[[link]]`
- Lingua: segui la lingua dell'utente

## Dopo ogni modifica

1. Aggiorna `{TARGET}/wiki/index.md`
2. Appendi a `{TARGET}/wiki/log.md`
3. `python {TARGET}/sync.py --wiki-dir {TARGET}/wiki --output {TARGET}/web/data.json`
4. `rtfm_sync`
```

Scrivi questo contenuto in `~/.claude/CLAUDE.md`.
Scrivi anche una copia in `{TARGET}/CLAUDE.md` come backup sull'USB.

### 5b. Genera `~/.config/opencode/agents/wiki.md` (globale)

Crea la directory `~/.config/opencode/agents/` se non esiste.

```markdown
---
description: LLM Wiki Portable — knowledge base su {TARGET} con ricerca semantica
mode: subagent
tools:
  write: true
  edit: true
  bash: true
  read: true
---

# LLM Wiki Portable — {TARGET}

[stesso contenuto di CLAUDE.md ma formattato per OpenCode]
```

Sostituisci `{TARGET}` con il path effettivo.
Scrivi anche una copia in `{TARGET}/AGENTS.md`.

---

## Step 6: Installa comandi (sempre)

**Claude Code** — crea in `~/.claude/commands/`:
- `llm-dashboard.md` (contenuto: vedi `{TEMPLATE_SRC}/commands/llm-dashboard.md`)

**OpenCode globale** — crea in `~/.config/opencode/commands/`:
- `llm-dashboard.md` con frontmatter:
  ```markdown
  ---
  description: Apri la dashboard LLM Wiki nel browser
  agent: build
  ---
  ```
  seguito dallo stesso contenuto del comando Claude Code.

---

## Step 7: Genera data.js (sempre)

Se `{TARGET}/web/data.js` non esiste O qualche .md è più recente di data.js:

```bash
python "{TARGET}/sync.py" --wiki-dir "{TARGET}/wiki" --output "{TARGET}/web/data.json"
```

Questo genera sia `data.json` che `data.js`.

---

## Step 8: Report finale

### Se MODE = "classica"

```
✅ Setup Classica completato

Target:     {TARGET}
Pagine:     {N} pagine, {L} link
Comandi:    /install-portable-wiki  /llm-dashboard

Uso: /llm-dashboard per aprire il grafo 3D.
     Apri Claude Code nella cartella {TARGET} per usare la wiki.
```

### Se MODE = "completa"

```
✅ Setup Completa completato

Target:          {TARGET}
Pagine:          {N} pagine, {L} link
Python:          {PY_CMD} {versione}
rtfm-ai:         installato (con embeddings)
Ricerca semant.: ✅ {N} chunk indicizzati  /  ⚠️ solo keyword
MCP RTFM:        ~/.claude/settings.json aggiornato ← riavvia Claude Code!
CLAUDE.md:       ~/.claude/CLAUDE.md creato (globale)
OpenCode agent:  ~/.config/opencode/agents/wiki.md creato
Comandi:         /install-portable-wiki  /llm-dashboard

⚠️  RIAVVIA CLAUDE CODE per attivare il server MCP RTFM.

Dopo il riavvio:
  - Da qualsiasi directory: Claude trova automaticamente la wiki in {TARGET}
  - Usa rtfm_search per cercare nella wiki
  - /llm-dashboard per aprire il grafo 3D
  - OpenCode: @wiki per invocare l'agente
```
