---
created: 2026-01-11
updated: 2026-04-08
tags: [architecture, deep-learning, foundational]
title: Transformer Architecture
---
# Transformer Architecture

**Tesi**: l'architettura Transformer basata su self-attention è la base universale di tutti i moderni LLM, superiore a RNN e CNN per sequenze.

## Componenti Core
- **Self-attention**: ogni token attende a tutti gli altri
- **Multi-head attention**: attenzione parallela su sottospazi diversi
- **Feed-forward layers**: trasformazione non-lineare per posizione
- **Positional encoding**: iniezione dell'ordine sequenziale
- **Layer normalization** + residual connections: stabilità training

## Varianti
- Encoder-only (BERT) — comprensione
- Decoder-only (GPT) — generazione
- Encoder-decoder (T5) — traduzione/riassunto

## Correlate
- [[src-attention-is-all-you-need]]
- [[attention-mechanism]]
- [[context-window]]
- [[tokenization]]
