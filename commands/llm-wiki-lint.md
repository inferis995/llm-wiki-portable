---
description: Health check della wiki e correzione dei problemi trovati
agent: build
---

## 1. Esegui il check

```bash
python3 "<root>/tools/lint.py"
```

Filtrabile: `--only broken,orphans,duplicates,bloated,thin,frontmatter,stale,raw`

## 2. Riporta

Riassumi in poche righe: quanti errori, quanti warning, quali categorie.
Non incollare l'output grezzo se e' lungo.

## 3. Correggi (chiedi conferma se le modifiche sono molte)

| Problema | Azione |
|---|---|
| **link rotti** | crea la pagina mancante se il concetto ha senso, altrimenti correggi o togli il link |
| **orfani** | collega dalla pagina correlata piu' vicina; se non c'e' nulla a cui collegarli, la pagina probabilmente va fusa o eliminata |
| **troppo lunghe** | dividi in due pagine piu' precise, con link reciproci |
| **troppo sottili** | fondi con la correlata piu' vicina e aggiorna i link entranti |
| **duplicati** | fondi in una sola pagina; l'altra sparisce e i link entranti vanno aggiornati |
| **frontmatter** | completa `created`/`updated`/`tags` |
| **stale** | rileggi la pagina, verifica che regga ancora, aggiorna `verified:` |
| **note grezze** | distilla il contenuto, oppure sposta il file in `raw/` |

Modifica i file davvero. Segnalare e basta non e' fare il lint.

## 4. Chiudi

```bash
python3 "<root>/tools/sync.py" --rebuild-index
python3 "<root>/tools/log.py" --append lint --title "Health check" --detail "<cosa hai corretto>"
```

Riferisci il prima/dopo: quanti problemi c'erano, quanti ne restano e perche'.
