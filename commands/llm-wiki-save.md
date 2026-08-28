---
description: Salva nella wiki la conoscenza durevole emersa in questa sessione
agent: build
---

Distilla nella knowledge base quello che questa sessione ha prodotto e che
servira' di nuovo. Argomento opzionale: $ARGUMENTS (se vuoto, decidi tu cosa
merita di essere salvato).

## 1. Trova la wiki

```bash
python3 -c "import sys,os;sys.path.insert(0,os.path.expanduser('~/.claude'));" 2>/dev/null
```
Piu' semplice: usa gli script sotto `<root>/tools/`, che risolvono la root da
soli. Se rispondono "wiki non trovata", dillo e fermati.

## 2. Decidi cosa e' durevole

Salva: decisioni e il loro perche', fatti verificati, soluzioni a problemi non
banali, contesto su persone/progetti/strumenti che tornera' utile.

Non salvare: chiacchiere, passaggi intermedi, output riproducibile in un secondo,
cose gia' presenti in wiki in forma migliore.

Se non c'e' nulla di durevole, dillo in una riga e fermati. Meglio niente che
rumore.

## 3. Guarda cosa esiste gia'

```bash
python3 "<root>/tools/search.py" --list-pages
python3 "<root>/tools/search.py" --query "<argomento>" --top 5
```

## 4. Scrivi

- Pagina esistente -> **riscrivila** distillando vecchio + nuovo. Piu' precisa,
  non piu' lunga. Mai append.
- Pagina nuova -> creala nella cartella giusta del template, con frontmatter
  completo (`created`, `updated`, `verified`, `confidence`, `tags`).
- Collegala ad almeno una pagina esistente in entrambe le direzioni: le orfane
  si perdono.
- Usa solo slug verificati al punto 3.

## 5. Chiudi

```bash
python3 "<root>/tools/sync.py" --rebuild-index
python3 "<root>/tools/log.py" --append ingest --title "<cosa hai salvato>" --detail "Creato: [[...]]"
```

## 6. Riferisci

Elenca in due righe le pagine create e quelle riscritte, con i loro `[[slug]]`.
