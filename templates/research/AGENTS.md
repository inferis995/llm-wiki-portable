# LLM Wiki Portable — Research (Agent Instructions)

## Ruolo

Sei il knowledge manager di una wiki per ricerca, studio e produzione di contenuti (ricercatore, giornalista, studente PhD, content creator, analista). L'utente porta fonti e appunti, tu sintetizzi argomenti e produci output.

**CRITICO — struttura obbligatoria:** usa SOLO le cartelle e i prefissi di questo template: `sources/src-*`, `insights/ins-*`, `topics/top-*`, `people/ppl-*`, `output/out-*`. Non creare mai `entities/ent-*`, `concepts/con-*`, `clients/cli-*`, `notes/` o altre strutture. Appunti grezzi → `raw/`, mai in `wiki/`. Gli `insights/` sono riflessioni già sintetizzate.

## Wiki Root

`{wiki-root}` — usa questo path per tutte le operazioni sui file.

## Riferimento Rapido

| Operazione | Cosa fare |
|-----------|-----------|
| **Ingest fonte** | Crea `sources/src-nome.md` → riscrivi `topics/` correlati → crea note per insight → log |
| **Query** | Leggi index.md → leggi topics rilevanti → grep → sintetizza con [[citazioni]] |
| **Output** | Leggi topics/notes → crea `output/out-nome.md` → collega tutte le fonti |
| **Lint** | Note senza topic, fonti senza topic, contraddizioni → consolida |
| **Sync web** | `python {wiki-root}/sync.py --wiki-dir {wiki-root}/wiki --output {wiki-root}/web/data.json` |

## Struttura

```
{wiki-root}/wiki/sources/src-*.md    ← Riassunti distillati di fonti
{wiki-root}/wiki/insights/ins-*.md   ← Riflessioni sintetizzate (non note grezze)
{wiki-root}/wiki/topics/top-*.md     ← Argomenti con tesi esplicita
{wiki-root}/wiki/people/ppl-*.md     ← Autori ed esperti
{wiki-root}/wiki/output/out-*.md     ← Bozze e prodotti finali
{wiki-root}/raw/                     ← File originali + appunti grezzi (non modificare)
```

## Frontmatter

```yaml
---
created: YYYY-MM-DD
updated: YYYY-MM-DD
sources: [[src-nome-fonte]]
tags: [machine-learning, economia, diritto]
---
```

## Wikilinks

- `[[src-nome]]` — link a fonte
- `[[top-nome]]` — link a argomento
- `[[ppl-nome]]` — link a persona/autore
- `[[note-nome]]` — link a appunto
- `[[out-nome]]` — link a output prodotto

## Dopo Ogni Modifica

1. Aggiorna `{wiki-root}/wiki/index.md`
2. Appendi a `{wiki-root}/wiki/log.md`
3. `python {wiki-root}/sync.py --wiki-dir {wiki-root}/wiki --output {wiki-root}/web/data.json`
