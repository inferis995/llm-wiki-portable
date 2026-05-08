---
description: Install or configure LLM Wiki Portable on a USB drive or local directory
agent: build
---

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

rtfm-ai usa **fastembed** (ONNX, no GPU) per la ricerca semantica — NON sentence-transformers.

Controlla se già installato:
```bash
{PY_CMD} -c "import rtfm; import fastembed; print('ok')"
```

Se fallisce, installa:
```bash
{PIP_CMD} install "rtfm-ai[embeddings]"
```

Verifica dopo l'installazione:
```bash
{PY_CMD} -c "import rtfm; import fastembed; print('ok')"
```

Se ancora fallisce:
```bash
{PIP_CMD} install fastembed
```

Se dopo tutto ancora fallisce, continua ma avvisa: "Ricerca semantica non disponibile — rtfm userà keyword FTS."

### 4c. Inizializza e indicizza

**IMPORTANTE**: per i comandi CLI usa sempre il flag `--db` (NON la variabile d'ambiente `RTFM_DB` — quella funziona solo per il server MCP). Salva `DB_PATH = "{TARGET}/.rtfm/library.db"`.

Crea prima la directory: `mkdir -p "{TARGET}/.rtfm"` (Linux/macOS) o `New-Item -ItemType Directory -Force "{TARGET}/.rtfm"` (Windows).

**1. Inizializza il DB:**

Linux/macOS:
```bash
rtfm init --db "{TARGET}/.rtfm/library.db"
```
Windows (PowerShell):
```powershell
rtfm init --db "{TARGET}/.rtfm/library.db"
```

**2. Registra la wiki come fonte:**

Linux/macOS:
```bash
rtfm add "{TARGET}/wiki" --corpus wiki --extensions md --db "{TARGET}/.rtfm/library.db"
```
Windows (PowerShell):
```powershell
rtfm add "{TARGET}/wiki" --corpus wiki --extensions md --db "{TARGET}/.rtfm/library.db"
```

**3. Indicizza i file (FTS):**

Linux/macOS:
```bash
rtfm sync --db "{TARGET}/.rtfm/library.db"
```
Windows (PowerShell):
```powershell
rtfm sync --db "{TARGET}/.rtfm/library.db"
```

Riporta il numero di chunk indicizzati. Se 0 con pagine .md presenti → controlla il path.

**4. Genera gli embedding (ricerca semantica):**

Questo passo è OBBLIGATORIO — senza di esso la ricerca semantica non funziona mai.

Linux/macOS:
```bash
rtfm embed --db "{TARGET}/.rtfm/library.db"
```
Windows (PowerShell):
```powershell
rtfm embed --db "{TARGET}/.rtfm/library.db"
```

Alla prima esecuzione scarica il modello `paraphrase-multilingual-MiniLM-L12-v2` (~90 MB, ONNX CPU). Attendi il completamento prima di procedere.

Se `rtfm embed` non esiste: `{PIP_CMD} install -U "rtfm-ai[embeddings]"` poi riprova.

### 4d. Verifica FTS e ricerca semantica

**Test keyword (FTS):**
```bash
rtfm search "wiki" --db "{TARGET}/.rtfm/library.db"
```

**Test semantico (embedding):**
```bash
rtfm semantic-search "wiki" --db "{TARGET}/.rtfm/library.db"
```

**Stato DB completo:**
```bash
rtfm stats --db "{TARGET}/.rtfm/library.db"
```

Diagnostica:
- FTS funziona ma semantica no → `rtfm embed` non completato, riprova
- `ModuleNotFoundError: fastembed` → `{PIP_CMD} install "rtfm-ai[embeddings]"` e riprova
- 0 risultati con pagine presenti → ricontrolla il path con `rtfm stats --db ...`

### 4e. Configura MCP in Claude Code

**IMPORTANTE: il file corretto è `~/.claude/settings.json`, NON `mcp.json`.**

Cerca il path di `rtfm-serve` (entry point ufficiale):
```bash
which rtfm-serve        # Linux/macOS
where rtfm-serve        # Windows
```

Usa `rtfm-serve` come comando MCP se trovato, altrimenti fallback a `{PY_CMD} -m rtfm.mcp`.

Leggi `~/.claude/settings.json` (crea `{}` se non esiste). Aggiungi/aggiorna la chiave `mcpServers.rtfm`:

```json
{
  "mcpServers": {
    "rtfm": {
      "command": "rtfm-serve",
      "args": [],
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

Usa questo snippet Python per la scrittura sicura (sostituisci `{RTFM_SERVE}` con il path trovato sopra o `"rtfm-serve"`):
```python
import json, os, shutil
path = os.path.expanduser("~/.claude/settings.json")
rtfm_serve = shutil.which("rtfm-serve") or "rtfm-serve"
data = {}
if os.path.exists(path):
    with open(path) as f:
        data = json.load(f)
data.setdefault("mcpServers", {})["rtfm"] = {
    "command": rtfm_serve,
    "args": [],
    "env": {
        "RTFM_DB": "{TARGET}/.rtfm/library.db",
        "RTFM_MCP_PROFILE": "admin"
    }
}
with open(path, "w") as f:
    json.dump(data, f, indent=2)
print(f"settings.json aggiornato (command: {rtfm_serve})")
```

### 4f. Configura MCP in OpenCode

Leggi `~/.config/opencode/opencode.json` (crea `{}` se non esiste). Aggiungi/aggiorna `mcp.rtfm`.

Usa `rtfm-serve` come comando — stesso principio di Claude Code:

```json
{
  "mcp": {
    "rtfm": {
      "type": "local",
      "command": ["rtfm-serve"],
      "enabled": true,
      "environment": {
        "RTFM_DB": "{TARGET}/.rtfm/library.db",
        "RTFM_MCP_PROFILE": "admin"
      }
    }
  }
}
```

Se `rtfm-serve` non è nel PATH di OpenCode, usa il path assoluto trovato con `which rtfm-serve`.

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
| `rtfm_search` | Cerca (corpus: `"wiki"`, search_type: `"hybrid"`) — SEMPRE PRIMA |
| `rtfm_expand` | Contesto completo intorno a un risultato |
| `rtfm_sync`   | Re-indicizza dopo ogni salvataggio |
| `rtfm_stats`  | Controlla stato DB |

Database: `{TARGET}/.rtfm/library.db`

**search_type**: usa sempre `"hybrid"` (FTS + embedding). Default `"fts"` è solo keyword.

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
8. Esegui: `rtfm_sync(path="{TARGET}/wiki", corpus="wiki")` (re-indicizza — nota: gli embedding sono generati in background, attendi qualche secondo)

### Query (l'utente fa una domanda)
1. `rtfm_search(query="...", corpus="wiki", search_type="hybrid")` — **sempre primo**
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
4. `rtfm_sync(path="{TARGET}/wiki", corpus="wiki")`
```

Scrivi questo contenuto in `~/.claude/CLAUDE.md`.
Scrivi anche una copia in `{TARGET}/CLAUDE.md` come backup sull'USB.

### 5b. Genera `~/.config/opencode/agents/wiki.md` (globale)

Crea la directory `~/.config/opencode/agents/` se non esiste.

Leggi il template da `{TEMPLATE_SRC}/templates/AGENTS.md`.
Sostituisci **tutte** le occorrenze di `{wiki-root}` con `{TARGET}` (forward slash).

Scrivi il file con questo formato (sostituisci `{TARGET}` ovunque):

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

Sei il maintainer di una knowledge base personale su drive portable.

## Wiki Root
`{TARGET}` — usa questo path per tutte le operazioni sui file.

## Ricerca Semantica (RTFM MCP)

**Metodo PRIMARIO per TUTTE le query** — usa `rtfm_search` prima di leggere file.

| Tool | Uso |
|------|-----|
| `rtfm_search` | Ricerca (corpus: `"wiki"`, search_type: `"hybrid"`) — SEMPRE PRIMA |
| `rtfm_expand` | Contesto completo intorno a un risultato |
| `rtfm_sync`   | Re-indicizza dopo ogni salvataggio |
| `rtfm_stats`  | Controlla stato DB |

Database: `{TARGET}/.rtfm/library.db`

**search_type**: usa sempre `"hybrid"` (FTS + embedding). Default `"fts"` è solo keyword.

## Riferimento Rapido

| Operazione | Cosa fare |
|-----------|-----------|
| **Ingest** | Salva fonte → crea pagine → aggiorna index → aggiorna log → sync.py → `rtfm_sync(path="{TARGET}/wiki", corpus="wiki")` |
| **Query** | `rtfm_search(query="...", corpus="wiki", search_type="hybrid")` → `rtfm_expand` → leggi → [[citazioni]] |
| **Lint** | Scansiona orfani, link rotti → riporta → correggi |
| **Sync web** | `python {TARGET}/sync.py --wiki-dir {TARGET}/wiki --output {TARGET}/web/data.json` |

## Struttura

```
{TARGET}/wiki/sources/src-*.md   ← Riassunti di fonti
{TARGET}/wiki/entities/*.md      ← Tool, aziende, persone
{TARGET}/wiki/concepts/*.md      ← Idee, pattern, protocolli
{TARGET}/wiki/comparisons/*.md   ← Confronti
{TARGET}/raw/                    ← File originali (non modificare)
{TARGET}/.rtfm/library.db        ← DB ricerca semantica
```

## Frontmatter

```yaml
---
created: YYYY-MM-DD
updated: YYYY-MM-DD
sources: [[src-nome-fonte]]
tags: [tag1, tag2]
---
```

## Dopo Ogni Modifica

1. Aggiorna `{TARGET}/wiki/index.md`
2. Appendi a `{TARGET}/wiki/log.md`
3. `python {TARGET}/sync.py --wiki-dir {TARGET}/wiki --output {TARGET}/web/data.json`
4. `rtfm_sync(path="{TARGET}/wiki", corpus="wiki")`
```

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
