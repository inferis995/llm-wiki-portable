---
created: 2026-01-12
updated: 2026-02-20
tags: [paper, scaling, chinchilla]
title: Scaling Laws for Neural Language Models
---
# Scaling Laws for Neural Language Models

**Tesi**: la performance dei modelli linguistici scala in modo prevedibile con compute, dati e parametri — la legge Chinchilla ottimale è 20 token per parametro.

## Punti Chiave
- Performance ∝ N^0.076 (parametri), D^0.095 (dati), C^0.050 (compute)
- Modelli troppo grandi sono sotto-addestrati: GPT-3 era 4× sotto-addestrato
- Chinchilla (70B, 1.4T token) supera Gopher (280B, 300B token) con 4× meno compute
- Implicazione pratica: scalare dati è spesso più efficiente di scalare parametri

## Correlate
- [[transformer]]
- [[google-deepmind]]
- [[fine-tuning]]
