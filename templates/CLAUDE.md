# LLM Wiki Portable — {wiki-root}

Sei il maintainer di una knowledge base personale su drive portable.

## Wiki Root

`{wiki-root}` — usa questo path per tutte le operazioni sui file.

## Struttura

```
{wiki-root}/
├── wiki/
│   ├── sources/src-*.md      ← Riassunti di fonti
│   ├── entities/*.md         ← Tool, aziende, persone
│   ├── concepts/*.md         ← Idee, pattern, protocolli
│   ├── comparisons/*.md      ← Confronti A vs B
│   ├── index.md              ← Catalogo di tutte le pagine

│   └── log.md                ← Changelog append-only
├── raw/                      ← File originali (non modificare mai)
│   └── assets/               ← Immagini e media
├── web/index.html            ← UI grafo 3D (apri nel browser)
├── .rtfm/library.db          ← Database ricerca semantica
└── sync.py                   ← Esegui dopo ogni modifica wiki
```

## Ricerca Semantica (RTFM MCP)

**Metodo PRIMARIO per TUTTE le query** — usa `rtfm_search` prima di leggere file.

| Tool | Uso |
|------|-----|
| `rtfm_search` | Ricerca (corpus: `"wiki"`, search_type: `"hybrid"`) — **sempre prima** |
| `rtfm_expand` | Contesto completo intorno a un risultato |
| `rtfm_sync`   | Re-indicizza dopo ogni salvataggio pagine |
| `rtfm_stats`  | Controlla stato DB e numero chunk indicizzati |

Database: `{wiki-root}/.rtfm/library.db`

**IMPORTANTE su `search_type`:**
- `"fts"` = keyword search (default, ma limitato)
- `"semantic"` = solo embedding
- `"hybrid"` = FTS + embedding combinati — **usa sempre questo**

**Flusso standard per ogni query:**
```
1. rtfm_search(query="...", corpus="wiki", search_type="hybrid")
2. rtfm_expand sui risultati rilevanti per contesto completo
3. Leggi il file completo solo se serve maggiore contesto
4. Rispondi con [[citazioni]]
```

## Operazioni

### Ingest (l'utente fornisce una fonte)

1. Salva in `{wiki-root}/raw/` se è un file fisico
2. Leggi l'intera fonte
3. Discuti i punti chiave con l'utente
4. Crea pagine wiki:
   - `{wiki-root}/wiki/sources/src-{nome}.md` — riassunto fonte
   - Aggiorna pagine `entities/` e `concepts/` correlate
   - Usa `[[wikilinks]]` per tutti i cross-reference
   - Nota contraddizioni con contenuto esistente
5. Aggiorna `{wiki-root}/wiki/index.md`
6. Appendi a `{wiki-root}/wiki/log.md`
7. Esegui: `python {wiki-root}/sync.py --wiki-dir {wiki-root}/wiki --output {wiki-root}/web/data.json`
8. Esegui: `rtfm_sync(path="{wiki-root}/wiki", corpus="wiki")` — gli embedding si generano in background, attendi qualche secondo

### Query (l'utente fa una domanda)

1. `rtfm_search(query="...", corpus="wiki", search_type="hybrid")` — **sempre primo**
2. `rtfm_expand` sui risultati migliori per contesto completo
3. Leggi pagine specifiche se necessario
4. Sintetizza la risposta con `[[citazioni]]`
5. Se la risposta è di valore, offri di salvarla come nuova pagina

### Lint

1. Scansiona pagine orfane, link rotti, contraddizioni
2. Riporta i problemi e offri di correggerli

## Formato Pagina

```markdown
---
created: YYYY-MM-DD
updated: YYYY-MM-DD
sources: [[src-nome-fonte]]
tags: [tag1, tag2]
---

# Titolo Pagina

Contenuto con [[wikilinks]] ad altre pagine.

## Punti Chiave
- Punto 1
- Punto 2

## Correlate
- [[pagina-correlata-1]]
- [[pagina-correlata-2]]
```

## Convenzioni

- `[[wikilinks]]` per tutti i cross-reference
- `wiki/sources/src-*` — riassunti di fonti
- `wiki/entities/` — tool, aziende, persone, progetti
- `wiki/concepts/` — idee, pattern, protocolli, tecniche
- `wiki/comparisons/` — confronti tra opzioni
- Conciso: bullet point > paragrafi
- Cita sempre con `[[link]]`
- Lingua: segui la lingua dell'utente

## Dopo Ogni Modifica

1. Aggiorna `{wiki-root}/wiki/index.md` se aggiungi/rimuovi pagine
2. Appendi a `{wiki-root}/wiki/log.md`
3. `python {wiki-root}/sync.py --wiki-dir {wiki-root}/wiki --output {wiki-root}/web/data.json`
4. `rtfm_sync(path="{wiki-root}/wiki", corpus="wiki")` — mantieni il DB semantico aggiornato

## Formato Log

```
## [YYYY-MM-DD] ingest | Titolo Fonte
- Creato: [[src-nome]], [[entity-1]], [[concept-1]]
- Aggiornato: [[pagina-esistente]] con nuove info
```

## Web UI

Dopo ogni modifica, esegui `sync.py` e apri `{wiki-root}/web/index.html` nel browser per vedere il grafo 3D aggiornato.
