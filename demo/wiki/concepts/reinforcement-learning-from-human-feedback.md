---
created: 2026-01-19
updated: 2026-03-10
tags: [alignment, training, rlhf]
title: Reinforcement Learning from Human Feedback
---

## Reinforcement Learning from Human Feedback (RLHF)

**Tesi**: RLHF è il metodo dominante per allineare LLM alle preferenze umane — un modello 1.3B con RLHF supera GPT-3 175B su molte task di istruzione.

## Pipeline
1. **SFT**: supervised fine-tuning su risposte di alta qualità
2. **Reward model**: addestrato su coppie di preferenze umane (A > B)
3. **PPO**: ottimizza il policy model verso il reward model

## Limitazioni
- Costoso: richiede annotatori umani
- Reward hacking: il modello impara a massimizzare il reward senza essere utile
- Alternativa: Constitutional AI ([[anthropic]]) usa principi invece di preferenze

## Correlate
- [[src-rlhf-paper]]
- [[openai]]
- [[fine-tuning]]
