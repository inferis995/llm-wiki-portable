---
created: 2026-01-05
updated: 2026-04-01
tags: [method, knowledge-base, karpathy]
title: Karpathy LLM Wiki Method
---

## Karpathy LLM Wiki Method

**Tesi**: usare un LLM come compilatore incrementale di una knowledge base strutturata è più efficace di qualsiasi sistema RAG con embedding.

## Punti Chiave
- L'LLM legge direttamente i file markdown — nessun vector DB
- Le pagine vengono **riscritte** (distillate), non accumulate
- Struttura: `sources/`, `entities/`, `concepts/`, `comparisons/`
- Il grafo 3D con wikilinks rende visibile la struttura della conoscenza
- Portabile: funziona su USB, qualsiasi PC, senza server

## Correlate
- [[andrej-karpathy]]
- [[llm-wiki-method]]
- [[rag-vs-fine-tuning]]
