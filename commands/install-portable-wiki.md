---
description: Install or configure LLM Wiki Portable on a USB drive or local directory
agent: build
---

Installa e configura LLM Wiki Portable su USB o directory locale.

---

## Step 0: Parametri

Chiedi all'utente:

**1. Percorso di destinazione della wiki:**
`"Dove vuoi installare la wiki portable? (es. D:\, E:\, /media/usb, ~/wiki-portable)"`
Salva come `TARGET` (usa sempre forward slash, es. `D:/wiki-portable`).

**2. Template:**
`"Che uso vuoi farne?"`
- **general** — Uso generico, studio, note, ricerca personale — metodo Karpathy originale (`sources / entities / concepts / comparisons`)
- **work** — Progetti e clienti (`projects / clients / meetings / tasks / resources`)
- **business** — Knowledge aziendale (`departments / processes / people / decisions / documents / meetings`)
- **professional** — Avvocato, commercialista, consulente, medico (`clients / matters / deadlines / contacts`)
- **research** — Ricercatore, giornalista, studente PhD, analista (`sources / insights / topics / people / output`)
- **custom** — Crea un template personalizzato per il tuo caso d'uso specifico

Salva come `TEMPLATE` = `"general"`, `"work"`, `"business"`, `"professional"`, `"research"` o `"custom"`.

---

## Step 1: Rileva stato esistente

Controlla se esiste già una wiki:
- `{TARGET}/wiki/` con file .md
- `{TARGET}/web/index.html`
- `{TARGET}/sync.py`

**Se TUTTI esistono → "Configura su nuovo PC"** (wiki già sull'USB, nuovo PC)
- Vai a Step 4 → Step 5 → Step 6
- (TEMPLATE viene usato solo per aggiornare CLAUDE.md se non esiste già)

**Se mancano → "Prima installazione"**
Chiedi: nuova wiki vuota o importa wiki esistente?

---

## Step 2: Trova il template sorgente

Il template (web/, sync.py, templates/) si trova nel repo clonato. Trovalo così:

1. Controlla questi path:
   - `~/llm-wiki-portable/`
   - `~/portable-wiki/`
   - `~/Desktop/llm-wiki-portable/`
   - directory corrente
2. Cerca `sync.py` + `web/index.html` + `templates/general/CLAUDE.md` insieme.
3. Se non trovi: chiedi `"Dove hai clonato il repo llm-wiki-portable? (path della cartella)"`

Salva come `TEMPLATE_SRC`.
Il path del template scelto è `{TEMPLATE_SRC}/templates/{TEMPLATE}/`.

---

## Step 3: Crea struttura (solo prima installazione)

Le cartelle dipendono dal template scelto:

**general:**
```
{TARGET}/wiki/sources/
{TARGET}/wiki/entities/
{TARGET}/wiki/concepts/
{TARGET}/wiki/comparisons/
```

**work:**
```
{TARGET}/wiki/projects/
{TARGET}/wiki/clients/
{TARGET}/wiki/meetings/
{TARGET}/wiki/tasks/
{TARGET}/wiki/resources/
```

**business:**
```
{TARGET}/wiki/departments/
{TARGET}/wiki/processes/
{TARGET}/wiki/people/
{TARGET}/wiki/decisions/
{TARGET}/wiki/documents/
{TARGET}/wiki/meetings/
```

**professional:**
```
{TARGET}/wiki/clients/
{TARGET}/wiki/matters/
{TARGET}/wiki/deadlines/
{TARGET}/wiki/contacts/
```

**research:**
```
{TARGET}/wiki/sources/
{TARGET}/wiki/insights/
{TARGET}/wiki/topics/
{TARGET}/wiki/people/
{TARGET}/wiki/output/
```

**custom** — se TEMPLATE è `"custom"`, prima di creare le cartelle:

Fai 3 domande all'utente:
1. `"Che tipo di lavoro gestisce questa wiki? (es. studio, agenzia, studio legale, officina, laboratorio...)"` → salva come `CUSTOM_TYPE`
2. `"Elenca 5-7 cose che gestisci quotidianamente (es. clienti, progetti, fatture, macchine, esperimenti...)"` → salva come `CUSTOM_ITEMS` (lista)
3. `"C'è una terminologia specifica del tuo settore che vuoi usare? (opzionale)"` → salva come `CUSTOM_TERMS`

Poi genera il template su misura:
- Deriva 4-6 cartelle dai `CUSTOM_ITEMS` (nomi brevi, snake_case)
- Genera un prefisso 3-4 lettere per ogni cartella (es. `cli-`, `prj-`, `doc-`)
- Crea le cartelle in `{TARGET}/wiki/`
- Genera `{TARGET}/templates-custom/CLAUDE.md`:
  - Header: "Sei il knowledge manager di una wiki per {CUSTOM_TYPE}."
  - CRITICO: elenca le cartelle e i prefissi obbligatori
  - Sezioni: Ingest, Query, Lint — stesso metodo Karpathy degli altri template
  - Convenzioni specifiche per il settore (usa `CUSTOM_TERMS` se forniti)
- Genera `{TARGET}/templates-custom/AGENTS.md` (stessa struttura, versione compatta)
- Usa questi file come `{TEMPLATE_SRC}/templates/custom/CLAUDE.md` e `AGENTS.md` per gli step 4a e 4b

**Sempre (tutti i template):**
```
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
  ```
  (aggiungi una sezione `##` per ogni cartella del template scelto)
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

## Step 4: Istruzioni globali per Claude

**CRITICO**: CLAUDE.md e AGENTS.md vanno installati sul **PC locale** (non sull'USB) in modo che Claude trovi la wiki da qualsiasi directory.

### 4a. Genera `~/.claude/CLAUDE.md` (globale)

Leggi il template da `{TEMPLATE_SRC}/templates/{TEMPLATE}/CLAUDE.md`.
Sostituisci **tutte** le occorrenze di `{wiki-root}` con `{TARGET}` (forward slash).
Scrivi il contenuto in `~/.claude/CLAUDE.md`.
Scrivi anche una copia in `{TARGET}/CLAUDE.md` come backup sull'USB.

### 4b. Genera `~/.config/opencode/agents/wiki.md` (globale)

Crea la directory `~/.config/opencode/agents/` se non esiste.
Leggi il template da `{TEMPLATE_SRC}/templates/{TEMPLATE}/AGENTS.md`.
Sostituisci **tutte** le occorrenze di `{wiki-root}` con `{TARGET}` (forward slash).

Scrivi il file con questo frontmatter aggiunto in cima:

```markdown
---
description: LLM Wiki Portable ({TEMPLATE}) — {TARGET}
mode: subagent
tools:
  write: true
  edit: true
  bash: true
  read: true
---
```

seguito dal contenuto del template AGENTS.md.
Scrivi anche una copia in `{TARGET}/AGENTS.md`.

---

## Step 5: Installa comandi

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

## Step 6: Genera data.js

Controlla se Python è disponibile:
```bash
python3 --version || python --version
```

Se Python è disponibile e `{TARGET}/web/data.js` non esiste O qualche .md è più recente di data.js:
```bash
python "{TARGET}/sync.py" --wiki-dir "{TARGET}/wiki" --output "{TARGET}/web/data.json"
```

Se Python non è disponibile: avvisa l'utente che dovrà eseguire sync.py manualmente prima di aprire la dashboard.

---

## Step 7: Report finale

```
✅ Setup completato

Target:     {TARGET}
Template:   {TEMPLATE}
Pagine:     {N} pagine, {L} link
CLAUDE.md:  ~/.claude/CLAUDE.md creato (globale)
OpenCode:   ~/.config/opencode/agents/wiki.md creato
Comandi:    /install-portable-wiki  /llm-dashboard

Uso:
  /llm-dashboard     — Apri il grafo 3D nel browser
  Ingest: "leggi questo [file/testo] e aggiungilo alla wiki"
  Query:  "cosa so su [argomento]?"
  Lint:   "controlla la wiki per link rotti e contraddizioni"

Da qualsiasi directory Claude trova automaticamente la wiki in {TARGET}.
```
