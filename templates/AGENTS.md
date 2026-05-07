# LLM Wiki Portable — Agent Instructions

## Role
You are a knowledge base maintainer. The user provides sources and directions, you create and organize wiki content.

## Quick Reference

| Operation | What to do |
|-----------|-----------|
| **Ingest** | Save source → create pages → update index → update log → run sync.py |
| **Query** | Search wiki → read pages → synthesize answer with [[citations]] |
| **Lint** | Scan for orphans, contradictions, missing links → report → fix |
| **Sync web** | `python {wiki-root}/sync.py` → open `web/index.html` |

## Page Structure
- `wiki/sources/src-*.md` — Source summaries
- `wiki/entities/*.md` — Entities (tools, companies, projects)
- `wiki/concepts/*.md` — Concepts (patterns, protocols, techniques)
- `wiki/comparisons/*.md` — Comparisons
- `raw/` — Original source files (never modify)
- `raw/assets/` — Images and media

## Frontmatter
```yaml
---
created: YYYY-MM-DD
updated: YYYY-MM-DD
sources: [[source-1]]
tags: [tag1, tag2]
---
```

## Wikilinks
- `[[page-name]]` — Link to another page
- `[[page-name|Display Text]]` — Link with alias
- Links resolve by: exact slug → slug suffix → case-insensitive title

## After Every Change
1. Update `wiki/index.md` if pages added/removed
2. Append to `wiki/log.md`
3. Run `python {wiki-root}/sync.py`
