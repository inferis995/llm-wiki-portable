---
name: llm-dashboard
description: Apri la dashboard 3D della wiki nel browser
---

# /llm-dashboard

## 1. Sincronizza

```bash
python3 "<root>/tools/sync.py" --rebuild-index
```

La wiki root viene risolta automaticamente (marker `.llmwiki-root`,
`$LLM_WIKI_ROOT`, o registro `~/.llm-wiki/roots.json`). Se il comando risponde
"wiki non trovata", il drive non e' montato.

## 2. Apri

- Linux: `xdg-open "<root>/web/index.html"`
- macOS: `open "<root>/web/index.html"`
- Windows: `start "" "<root>/web/index.html"`

## 3. Riferisci

Pagine, link, e — se presenti — link rotti e orfani dal pannello Health.
Scorciatoie: `/` cerca, `Esc` torna al grafo, `h` apre Health.
