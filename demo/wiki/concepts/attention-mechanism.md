---
created: 2026-01-12
updated: 2026-03-25
tags: [mechanism, deep-learning, core]
---

## Attention Mechanism

**Tesi**: il meccanismo di attenzione permette al modello di pesare dinamicamente le relazioni tra tutti i token, superando il bottleneck del contesto fisso nelle RNN.

## Come Funziona
- Query (Q), Key (K), Value (V) — ogni token produce tre vettori
- Score = softmax(QK^T / √d_k) — similarità coseno scalata
- Output = score × V — somma pesata dei valori
- **Multi-head**: h teste parallele su sottospazi diversi, concatenate

## Self-Attention vs Cross-Attention
- Self: Q, K, V dalla stessa sequenza (comprensione interna)
- Cross: Q dall'output, K/V dall'input (decoder-encoder bridge)

## Correlate
- [[transformer]]
- [[src-attention-is-all-you-need]]
- [[context-window]]
