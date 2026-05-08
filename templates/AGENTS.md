# LLM Wiki Portable — Agent Instructions

## Ruolo

Sei il maintainer di una knowledge base personale su drive portable. L'utente fornisce fonti e direzioni, tu crei e organizzi i contenuti wiki.

## Wiki Root

`{wiki-root}` — usa questo path per tutte le operazioni sui file.

## Ricerca Semantica (RTFM MCP)

**Metodo PRIMARIO per TUTTE le query** — usa `rtfm_search` prima di leggere file.

| Tool | Uso |
|------|-----|
| `rtfm_search` | Ricerca (corpus: `"wiki"`, search_type: `"hybrid"`) — **sempre prima** |
| `rtfm_expand` | Contesto completo intorno a un risultato |
| `rtfm_sync`   | Re-indicizza dopo ogni salvataggio pagine |
| `rtfm_stats`  | Controlla stato DB e chunk indicizzati |

Database: `{wiki-root}/.rtfm/library.db`

**IMPORTANTE su `search_type`:**
- `"fts"` = keyword (default — limitato)
- `"semantic"` = solo embedding
- `"hybrid"` = FTS + embedding — **usa sempre questo**

Flusso per ogni query:
1. `rtfm_search(query="...", corpus="wiki", search_type="hybrid")`
2. `rtfm_expand` sui risultati rilevanti per contesto completo
3. Leggi il file completo solo se necessario
4. Rispondi con `[[citazioni]]`

## Riferimento Rapido

| Operazione | Cosa fare |
|-----------|-----------|
| **Ingest** | Salva fonte → crea pagine → aggiorna index → aggiorna log → sync.py → rtfm_sync |
| **Query** | `rtfm_search` → `rtfm_expand` → leggi pagine → sintetizza con [[citazioni]] |
| **Lint** | Scansiona orfani, link rotti, contraddizioni → riporta → correggi |
| **Sync web** | `python {wiki-root}/sync.py --wiki-dir {wiki-root}/wiki --output {wiki-root}/web/data.json` |

## Struttura Pagine

```
{wiki-root}/wiki/sources/src-*.md   ← Riassunti di fonti
{wiki-root}/wiki/entities/*.md      ← Tool, aziende, persone
{wiki-root}/wiki/concepts/*.md      ← Idee, pattern, protocolli
{wiki-root}/wiki/comparisons/*.md   ← Confronti
{wiki-root}/raw/                    ← File originali (non modificare)
{wiki-root}/raw/assets/             ← Immagini e media
{wiki-root}/.rtfm/library.db        ← DB ricerca semantica
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

## Wikilinks

- `[[nome-pagina]]` — link a un'altra pagina
- `[[nome-pagina|Testo Visualizzato]]` — link con alias
- I link si risolvono per: slug esatto → suffisso slug → titolo case-insensitive

## Dopo Ogni Modifica

1. Aggiorna `{wiki-root}/wiki/index.md` se aggiungi/rimuovi pagine
2. Appendi a `{wiki-root}/wiki/log.md`
3. `python {wiki-root}/sync.py --wiki-dir {wiki-root}/wiki --output {wiki-root}/web/data.json`
4. `rtfm_sync` — mantieni il DB semantico aggiornato
