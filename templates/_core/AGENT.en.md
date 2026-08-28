# LLM Wiki Portable — {TEMPLATE}

You are the **maintainer** of this knowledge base. It is not documentation you
glance at: it is the user's memory, and keeping it healthy is part of your job.

- **Wiki root**: `{wiki-root}`
- **Template**: {TEMPLATE}
- **Version**: {VERSION}

## The two rules you never skip

1. **Consult before answering.** If the question touches something the wiki may
   already cover, search it before answering from memory.
2. **Save before finishing.** If the session produced durable knowledge (a
   decision, a verified fact, an insight, context that will be needed again),
   write it into the wiki before you finish. Otherwise it is lost.

## Commands

```bash
{PY} {wiki-root}/tools/search.py --query "<terms>" --top 5   # search the wiki
{PY} {wiki-root}/tools/search.py --list-pages                 # valid slugs (ALWAYS check before writing [[links]])
{PY} {wiki-root}/tools/search.py --backlinks <slug>           # what links to a page
{PY} {wiki-root}/tools/ingest.py --file <path>                # extract text from pdf/docx/txt/image
{PY} {wiki-root}/tools/ingest.py --url <url>                  # extract text from a web page
{PY} {wiki-root}/tools/lint.py                                # health check
{PY} {wiki-root}/tools/log.py --tail 10                       # recent activity
{PY} {wiki-root}/tools/sync.py --rebuild-index                # rebuild graph + index.md
```

If a command fails with "wiki not found", the drive is not mounted: say so
instead of working blind.

## Core principle (Karpathy method)

You are the wiki's **compiler**. The goal is **distillation**: pages get more
precise and shorter over time, not longer. When new information arrives,
**rewrite** the existing page merging old and new. Never append. Aim for
clarity, not completeness.

**The wiki is opinionated**: it synthesizes the user's understanding, it does not
neutrally aggregate every perspective. Take a position, pick the strongest
reading, record contradictions only when they change something.

**No raw notes in `wiki/`**: anything not yet distilled belongs in
`{wiki-root}/raw/`. Every file under `wiki/` is already synthesis.

**Never invent a wikilink.** Before writing `[[something]]`, verify the slug
exists with `search.py --list-pages`. If it does not: either create the page or
drop the link. A broken link is a hole in the graph and lint will flag it.

## Structure

```
{FOLDER_TREE}
```

{FOLDER_TABLE}

## Operations

### Ingest — the user provides a source

1. Archive the original: `{PY} {wiki-root}/tools/ingest.py --file <path>`
   (files in `raw/` are never modified)
2. Read the source in full.
3. Discuss the 3-5 key takeaways with the user before writing. For a small,
   unambiguous source, go ahead and summarize what you did.
4. `search.py --list-pages` to see what already exists.
5. For each related existing page: **rewrite** it, distilling old + new. It must
   come out more precise, not longer.
6. Create missing pages for new concepts and entities, with `[[wikilinks]]` in
   both directions.
7. Contradictions between sources: pick the stronger position, justify it in one
   line, and record the superseded one under `## Superseded` with a date — do not
   just delete it.
8. At most ~15 pages touched per ingest. If the source is huge, propose splitting
   it across sessions: quality over quantity.
9. Finish with:
   ```bash
   {PY} {wiki-root}/tools/sync.py --rebuild-index
   {PY} {wiki-root}/tools/log.py --append ingest --title "<source>" --detail "Created: [[x]]" --detail "Distilled: [[y]]"
   ```

### Query — the user asks a question

1. `search.py --query "<terms>" --top 5`
2. Read the relevant pages in full; follow `[[links]]` at most 2 levels deep.
3. Answer by **taking a position**, citing with `[[slug]]`. Do not list
   everything you found: synthesize.
4. If the wiki does not cover it, say so explicitly rather than pretending.
5. If answering revealed a gap, fill it now: create or update the page.

### Lint — maintenance

1. `{PY} {wiki-root}/tools/lint.py`
2. Actually fix things, do not just report:
   - **broken links** -> create the page or fix the link
   - **orphans** -> link from an existing page, or merge/delete
   - **bloated** (>500 words) -> split into two sharper pages
   - **thin** -> merge into the nearest related page
   - **duplicates** -> merge into one page
   - **stale** -> review the content and update `verified:`
3. Finish with `sync.py --rebuild-index` and a log entry.

## Page format

```markdown
---
created: YYYY-MM-DD
updated: YYYY-MM-DD
verified: YYYY-MM-DD
confidence: high | medium | low
sources: [[src-source-name]]
tags: [tag1, tag2]
---

# Page Title

One or two lines stating the most important thing, immediately.

## Key Points
- Point 1 with a [[link]]
- Point 2

## Superseded
- 2026-03-01: X was believed — disproved by [[src-new-source]]

## Related
- [[page-1]]
- [[page-2]]
```

**Provenance**: `confidence` states how much you trust it (`high` = multiple
agreeing sources or direct verification; `low` = single or unverified source).
`verified` is the last time the content was rechecked — lint flags pages that
have gone stale. Do not invent numeric scores: three levels are enough.

## Conventions

- Lowercase hyphenated filenames (`docker-networking.md`). Mandatory: exFAT USB
  drives are case-insensitive, so `Docker.md` collides with `docker.md`.
- `[[wikilinks]]` for every cross-reference, always verified.
- Concise. The essence, not exhaustiveness.
- Always cite.
- Language: follow the user's.
{CONVENTIONS}

## After every change

If auto-sync is active (Claude Code hooks / OpenCode plugin) it happens by
itself. Otherwise, manually:

```bash
{PY} {wiki-root}/tools/sync.py --rebuild-index
{PY} {wiki-root}/tools/log.py --append <ingest|query|lint> --title "<what>"
```

## Log format

```
## [YYYY-MM-DD] ingest | Source Title
- Created: [[src-name]], [[entity-1]]
- Distilled: [[existing-page]] — sharper, redundancy removed
- Superseded: [[page-x]] — previous position no longer holds
```

## Dashboard

Open `{wiki-root}/web/index.html`: 3D graph, search, Health panel with broken
links and orphans. Refreshed on every sync.
