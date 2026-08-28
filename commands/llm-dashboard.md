---
description: Apri la dashboard 3D della wiki nel browser
agent: build
---

## 1. Trova la wiki e sincronizza

```bash
python3 "<root>/tools/sync.py" --rebuild-index
```

Gli script risolvono la wiki root da soli (marker `.llmwiki-root`, `$LLM_WIKI_ROOT`
o registro `~/.llm-wiki/roots.json`). Se rispondono "wiki non trovata", il drive
non e' montato: dillo e fermati.

## 2. Apri

- Linux: `xdg-open "<root>/web/index.html"`
- macOS: `open "<root>/web/index.html"`
- Windows: `start "" "<root>/web/index.html"`

## 3. Riferisci

Numero di pagine e di link dall'output del sync. Se ci sono link rotti o pagine
orfane, dillo e ricorda che il pannello **Health** della dashboard li elenca, e
che `/llm-wiki-lint` li corregge.

Scorciatoie: `/` cerca, `Esc` torna al grafo, `h` apre Health.
