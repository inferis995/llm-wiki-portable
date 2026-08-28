---
name: llm-wiki-setup
description: >
  Installa, ripara o aggiorna LLM Wiki Portable — la knowledge base personale
  persistente con grafo 3D, portabile su USB o cartella locale, per Claude Code,
  OpenCode e Hermes Agent. Usa questa skill quando l'utente vuole: installare o
  creare una wiki personale, spostarla su una chiavetta USB, configurare un nuovo
  PC su una wiki esistente, aggiornare una versione vecchia, capire perche'
  l'agente non usa o non trova la wiki, o disinstallare la configurazione.
  Trigger: "installa la wiki", "setup wiki", "wiki su USB", "nuovo PC",
  "aggiorna llm wiki", "la wiki non funziona", "l'agente non salva nella wiki",
  "install llm wiki", "upgrade wiki", "wiki doctor".
---

# LLM Wiki Portable — Setup e Aggiornamento

Installa la knowledge base e la aggancia agli agenti in modo che **la usino
davvero**: hook che iniettano la wiki in ogni sessione, consultazione automatica
sulle domande di conoscenza, auto-sync a ogni scrittura, auto-commit git.

Tutto il lavoro pesante lo fa `install.py`. Il tuo compito e' capire la
situazione, fare le domande giuste e lanciare il comando corretto.

---

## Step 0 — Trova il repo sorgente

Ti serve la cartella del repo `llm-wiki-portable` (quella con `install.py`).
Cerca in quest'ordine e fermati al primo risultato valido:

```bash
for d in . ~/llm-wiki-portable ~/Desktop/llm-wiki-portable ~/portable-wiki ~/Downloads/llm-wiki-portable; do
  [ -f "$d/install.py" ] && [ -d "$d/templates/_core" ] && echo "SORGENTE: $(cd "$d" && pwd)" && break
done
```

Se non lo trovi, chiedi: *"Dove hai clonato llm-wiki-portable?"*. Se l'utente non
l'ha ancora clonato:

```bash
git clone https://github.com/inferis995/llm-wiki-portable ~/llm-wiki-portable
```

Salva il path come `SRC`.

---

## Step 1 — Diagnostica PRIMA di chiedere qualsiasi cosa

**Non fare domande al buio.** Guarda cosa c'e' gia':

```bash
python3 "$SRC/install.py" --mode doctor
```

Interpreta l'esito e salta direttamente al ramo giusto:

| Esito del doctor | Cosa fare |
|---|---|
| `nessuna wiki trovata` | -> **Step 2: prima installazione** |
| `stato: current` e nessun MANCANTE | -> **Step 5: e' gia' tutto a posto** |
| `stato: older` oppure `v1` | -> **Step 4: aggiornamento** |
| `stato: current` ma qualcosa MANCANTE | -> **Step 4: riparazione** (stesso comando) |
| `stato: newer` | La wiki e' piu' recente del repo. Fai `git pull` in `$SRC` e ripeti. |

Riferisci all'utente in una riga cosa hai trovato, poi procedi.

---

## Step 2 — Prima installazione: le domande

Fanne poche e concrete, una alla volta.

### Domanda 1 — Dove?

```
1. Cartella locale     — sul disco di questo PC (piu' veloce, non portatile)
2. Chiavetta USB       — portatile: la porti su qualsiasi PC
3. Cartella cloud      — Dropbox / OneDrive / iCloud / Drive: sincronizzata tra PC
```

- **locale** -> `MODE=local`. Chiedi il path (proponi `~/wiki`).
- **USB** -> `MODE=usb`. Chiedi il path del drive. Verifica che sia montato:
  ```bash
  ls -la "<PATH_USB>"    # Windows: dir D:\
  ```
  Se non risponde, il drive non e' inserito: dillo e fermati, non creare la
  cartella altrove.
- **cloud** -> `MODE=local` con il path della cartella sincronizzata.
  **Avvisa**: nel template `professional` la cartella `raw/` puo' contenere
  documenti riservati, che finirebbero su un servizio di terze parti.

Usa sempre forward slash (`D:/wiki`, non `D:\wiki`).

### Domanda 2 — Per farci cosa?

| Template | Per chi | Cartelle |
|---|---|---|
| `general` | Studio, note, ricerca personale — Karpathy originale | sources / entities / concepts / comparisons |
| `work` | Freelance: progetti e clienti | projects / clients / meetings / tasks / resources |
| `business` | Knowledge aziendale, SOP, decisioni | departments / processes / people / decisions / documents / meetings |
| `professional` | Avvocato, commercialista, consulente, medico | clients / matters / deadlines / contacts |
| `research` | Ricercatore, giornalista, dottorando, analista | sources / insights / topics / people / output |
| `custom` | Qualsiasi altro dominio | le definisci tu |

Se sceglie **custom**, fai due domande:
1. *"Che tipo di lavoro gestisce questa wiki?"*
2. *"Elenca 4-6 cose che gestisci ogni giorno (clienti, macchine, esperimenti, ricette…)"*

Deriva 4-6 nomi di cartella brevi in minuscolo e **falli confermare** prima di procedere.

### Domanda 3 — Lingua delle pagine?

`it` o `en` (default `it`). Determina la lingua delle istruzioni per l'agente.

### Domanda 4 — Hai gia' una wiki da importare?

Se l'utente ha gia' una cartella di note markdown o una wiki v1 da spostare:
`MODE=migrate` con `--source-wiki <path esistente>`.

---

## Step 3 — Installa

```bash
python3 "$SRC/install.py" --mode <local|usb|migrate> \
  --target "<TARGET>" \
  --template <general|work|business|professional|research|custom> \
  --lang <it|en>
```

Argomenti aggiuntivi quando servono:
- `--folders "clienti,macchine,interventi,ricambi"` con `--template custom`
- `--source-wiki "<path>"` con `--mode migrate`
- `--no-git` se l'utente non vuole il versionamento (sconsigliato: il metodo
  riscrive le pagine, senza git una distillazione sbagliata non si recupera)
- `--no-hooks` solo se l'utente rifiuta esplicitamente l'automazione — di' pero'
  chiaramente che senza hook l'agente tornera' a dimenticarsi della wiki

Se qualcosa fallisce, l'errore e' esplicito (drive non montato, path non
scrivibile, template sconosciuto): riportalo all'utente cosi' com'e'.

---

## Step 4 — Aggiornamento / riparazione

Una sola modalita' copre entrambi i casi ed **e' sempre sicura**: non tocca
`wiki/` ne' `raw/`, aggiorna solo runtime e configurazione.

```bash
python3 "$SRC/install.py" --mode upgrade --target "<TARGET_RILEVATO>"
```

Se il doctor non ha trovato il target, ometti `--target`: viene rilevato da solo.

Cosa fa arrivando da una **v1**:
- rileva il template dalle cartelle esistenti (non ti fa ridichiarare nulla)
- converte `~/.claude/CLAUDE.md` da file interamente sovrascritto (bug v1) a
  blocco delimitato, con backup `.pre-v2.bak`
- ritira `CLAUDE.md` / `AGENTS.md` / `HERMES.md` dal drive in `.v1.bak` e li
  sostituisce con `AGENT-WIKI.md`, unica fonte
- rimuove il subagent OpenCode v1 (`agents/wiki.md`), che non si attivava mai,
  in favore di `AGENTS.md` + `opencode.json` + plugin
- installa `tools/`, `hooks/`, le skill e i comandi
- scrive il marker `.llmwiki-root` e registra la wiki per il resolver portatile
- inizializza git se manca, e risincronizza il grafo

Alla fine **riverifica sempre**:

```bash
python3 "$SRC/install.py" --mode doctor
```

---

## Step 5 — Nuovo PC su wiki esistente

L'utente ha gia' la wiki (USB o cloud) e vuole solo configurare questa macchina:

```bash
python3 "$SRC/install.py" --mode newpc --target "<PATH_WIKI>"
```

I dati non vengono toccati: si configurano solo `~/.claude/`,
`~/.config/opencode/` e, se presente, `~/.hermes/`.

---

## Step 6 — Report finale

Mostra il riepilogo dell'installer e aggiungi cosa e' cambiato **concretamente**:

```
Wiki:      <target>  (template <t>, <n> pagine)
Attivo ora, da qualsiasi cartella:
  - ogni sessione riceve indice + attivita' recente della wiki
  - "cosa so su X" consulta la wiki prima che io risponda
  - ogni scrittura in wiki/ risincronizza il grafo da sola
  - a fine sessione la wiki viene committata su git

Comandi:  /llm-wiki-save  /llm-wiki-ask  /llm-wiki-lint  /llm-dashboard
```

**Gli hook di Claude Code partono alla sessione successiva**: dillo esplicitamente
e suggerisci di riavviare Claude Code adesso.

---

## Risoluzione problemi

| Sintomo | Causa | Rimedio |
|---|---|---|
| "L'agente ignora la wiki" | hook non registrati o sessione non riavviata | `--mode doctor`, poi `--mode upgrade`, poi riavvia il tool |
| "wiki non trovata" con USB inserita | lettera del drive cambiata | `--mode newpc --target <nuovo path>`: il resolver si riallinea |
| Il grafo non si aggiorna | data.js piu' vecchio dei .md | `python3 <root>/tools/sync.py --rebuild-index` |
| Link rotti nel grafo | wikilink verso pagine inesistenti | `python3 <root>/tools/lint.py --only broken` |
| Python assente | non nel PATH | installa Python 3.8+; senza, restano solo le pagine markdown |
| Si vuole tornare indietro | — | `python3 "$SRC/install.py" --mode uninstall` (i dati restano) |

---

## Regole

1. **Doctor prima di tutto.** Mai chiedere path o template senza aver guardato.
2. **Mai sovrascrivere configurazioni.** L'installer usa blocchi delimitati: non
   modificare a mano `~/.claude/CLAUDE.md` o `settings.json`.
3. **Non creare la wiki altrove** se il drive USB non e' montato: fermati e dillo.
4. **Un solo target.** Piu' installazioni parallele confondono il resolver; per
   spostare una wiki si usa `--mode migrate`, non una seconda installazione.
5. **Verifica sempre alla fine** con `--mode doctor` prima di dire "fatto".
