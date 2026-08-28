---
name: llm-wiki
description: >
  Usa, consulta e mantieni LLM Wiki Portable — la knowledge base personale
  persistente dell'utente (metodo Karpathy) con pagine markdown, wikilink e
  grafo 3D. Usa questa skill quando l'utente vuole: salvare o memorizzare
  qualcosa nella wiki, ingerire un documento/PDF/URL/immagine, chiedere cosa sa
  gia' su un argomento, cercare nei propri appunti, verificare la salute della
  wiki, o quando la risposta dipende da conoscenza accumulata in sessioni
  precedenti. Trigger: "salva nella wiki", "aggiungi alla wiki", "ingerisci
  questo", "cosa so su X", "cosa avevamo detto", "ricordi", "cerca nei miei
  appunti", "lint della wiki", "knowledge base", "base di conoscenza".
---

# LLM Wiki — Uso quotidiano

La wiki e' la memoria dell'utente. Tu sei il suo **compilatore**: non aggiungi
appunti, distilli conoscenza.

## Prima di tutto: dove sei

```bash
python3 -c "import sys;sys.path.insert(0,'tools');import wikilib;print(wikilib.find_wiki_root())"
```

Piu' semplicemente: ogni tool sotto `<root>/tools/` trova la wiki da solo.
Se un comando risponde *"wiki non trovata"*, il drive non e' montato o la wiki
non e' installata -> dillo, e proponi la skill `llm-wiki-setup`.
Da qui in poi `$W` e' la wiki root.

```bash
python3 "$W/tools/log.py" --tail 10        # cosa e' successo di recente
```

---

## Le due regole

1. **Consulta prima di rispondere** se la domanda tocca qualcosa che la wiki
   potrebbe coprire.
2. **Salva prima di chiudere** se la sessione ha prodotto conoscenza durevole.
   Quello che non scrivi, e' perso.

---

## WORKFLOW: QUERY — "cosa so su X?"

```bash
python3 "$W/tools/search.py" --query "<termini>" --top 5
```

1. Leggi **per intero** le pagine trovate (non fermarti allo snippet).
2. Segui i `[[link]]` per massimo 2 livelli.
3. Rispondi **prendendo posizione**, citando con `[[slug]]`. Sintetizza, non
   elencare tutto quello che hai trovato.
4. Se la wiki non copre l'argomento, **dillo esplicitamente** invece di far finta
   che la risposta venga da li'.
5. Se la risposta ha rivelato un buco, colmalo subito.

Utile: `search.py --backlinks <slug>` per sapere cosa dipende da una pagina.

---

## WORKFLOW: INGEST — "aggiungi questo alla wiki"

### 1. Estrai e archivia

```bash
python3 "$W/tools/ingest.py" --file "<path>"     # pdf, docx, txt, md, immagine
python3 "$W/tools/ingest.py" --url "<url>"       # pagina web
```

L'originale finisce in `raw/` e non si tocca mai piu'. Per le immagini, lo script
archivia e ti dice il path: leggila con lo strumento immagini e descrivila.

### 2. Guarda cosa esiste gia'

```bash
python3 "$W/tools/search.py" --list-pages
```

**Obbligatorio.** Gli slug che scrivi nei `[[link]]` devono venire da qui. Un
wikilink inventato e' un buco nel grafo.

### 3. Discuti, poi scrivi

Per fonti importanti o ambigue, concorda con l'utente i 3-5 punti chiave prima di
scrivere. Per una fonte piccola e chiara, procedi e riassumi cosa hai fatto.

Poi:
- **Riscrivi** le pagine esistenti correlate distillando vecchio + nuovo. Devono
  uscire piu' precise, non piu' lunghe. **Non appendere.**
- Crea le pagine mancanti per concetti ed entita' nuovi.
- Collega in **entrambe** le direzioni.
- Fonti in contraddizione: scegli la posizione piu' solida, motivala in una riga,
  registra quella superata sotto `## Superato` con la data.
- Massimo ~15 pagine per ingest. Fonte enorme -> proponi di dividerla.

Formato pagina: vedi `references/page-format.md`.

### 4. Chiudi

```bash
python3 "$W/tools/sync.py" --rebuild-index
python3 "$W/tools/log.py" --append ingest --title "<fonte>" \
  --detail "Creato: [[x]], [[y]]" --detail "Distillato: [[z]]"
```

Se gli hook sono attivi il sync avviene da solo: il log no, quello scrivilo.

---

## WORKFLOW: SAVE — "salva questa cosa"

L'utente vuole conservare qualcosa emerso dalla conversazione (una decisione, una
soluzione, un fatto).

1. Individua **cosa** e' durevole. Il contesto usa-e-getta non va in wiki.
2. `search.py --query` per capire se esiste gia' una pagina che la copre.
3. Se esiste -> **riscrivila** integrando. Se non esiste -> creala nella cartella
   giusta secondo il template della wiki.
4. Collegala ad almeno una pagina esistente: le pagine orfane si perdono.
5. Log.

---

## WORKFLOW: LINT — manutenzione

```bash
python3 "$W/tools/lint.py"
python3 "$W/tools/lint.py" --only broken,orphans     # mirato
```

**Correggi davvero, non limitarti a segnalare:**

| Problema | Azione |
|---|---|
| link rotti | crea la pagina mancante oppure correggi il link |
| orfani | collega da una pagina esistente, oppure fondi/elimina |
| troppo lunghe (>500 parole) | dividi in due pagine piu' precise |
| troppo sottili | fondi con la correlata piu' vicina |
| duplicati | fondi in una pagina sola |
| stale | rivedi il contenuto e aggiorna `verified:` |
| note grezze in wiki/ | distilla, oppure sposta in `raw/` |

Chiudi con `sync.py --rebuild-index` e una voce di log.

---

## WORKFLOW: DASHBOARD

```bash
python3 "$W/tools/sync.py" --rebuild-index
```
poi apri `$W/web/index.html` (`xdg-open` / `open` / `start`).
Grafo 3D, ricerca, e pannello **Health** con link rotti e orfani.

---

## Regole non negoziabili

1. **Mai inventare un wikilink** — verifica con `--list-pages`.
2. **`raw/` e' immutabile** — gli originali non si modificano mai.
3. **Zero note grezze in `wiki/`** — cio' che non e' distillato sta in `raw/`.
4. **Distilla, non accumulare** — se una pagina si allunga a ogni ingest, stai
   sbagliando metodo.
5. **Prendi posizione** — la wiki riflette la comprensione dell'utente, non e'
   una rassegna neutrale.
6. **Cita sempre** con `[[slug]]`.
7. **Logga ogni operazione** — il log e' cio' che la prossima sessione leggera'.
8. **Lingua**: quella dell'utente.

## Riferimenti

- `references/page-format.md` — frontmatter, provenance, supersessione
- `references/troubleshooting.md` — quando qualcosa non funziona
