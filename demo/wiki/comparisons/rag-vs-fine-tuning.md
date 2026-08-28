---
created: 2026-03-10
updated: 2026-04-28
tags: [comparison, architecture, rag]
title: RAG vs Fine-Tuning — Confronto
---

## RAG vs Fine-Tuning

**Posizione**: per la maggior parte dei casi d'uso aziendali, RAG è la scelta corretta — aggiornabile in tempo reale, senza training. Fine-tuning solo quando serve stile/comportamento specifico, non conoscenza.

## Quando RAG
- Dati aggiornati frequentemente
- Knowledge base grande e variabile
- Nessuna GPU disponibile
- Serve citare le fonti esatte

## Quando Fine-Tuning
- Formato di output molto specifico
- Stile o tono da modellare
- Task narrow ben definita con molti esempi
- Latenza critica (no retrieval overhead)

## LLM Wiki come Alternativa
[[llm-wiki-method]] è un approccio ibrido: nessun vector DB, l'LLM legge direttamente i file markdown con contesto ampio.

## Correlate
- [[fine-tuning]]
- [[context-window]]
- [[llm-wiki-method]]
