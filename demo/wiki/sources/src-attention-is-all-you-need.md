---
created: 2026-01-10
updated: 2026-03-15
tags: [paper, transformer, attention]
sources: []
title: Attention Is All You Need
---
# Attention Is All You Need

**Tesi**: il meccanismo di [[attention-mechanism]] è sufficiente a costruire modelli di sequenza potenti, eliminando la necessità di reti ricorrenti o convolutive.

## Punti Chiave
- Propone l'architettura [[transformer]] basata interamente su self-attention
- Multi-head attention permette al modello di focalizzarsi su posizioni diverse contemporaneamente
- Positional encoding sostituisce la sequenzialità delle RNN
- Parallelizzabile: training molto più veloce delle LSTM

## Impatto
Ogni modello LLM moderno — [[gpt-4]], [[claude]], [[gemini]] — è basato su questa architettura.

## Correlate
- [[transformer]]
- [[attention-mechanism]]
- [[google-deepmind]]
