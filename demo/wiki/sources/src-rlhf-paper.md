---
created: 2026-01-18
updated: 2026-03-01
tags: [paper, rlhf, alignment]
title: InstructGPT — Training Language Models to Follow Instructions
---

## InstructGPT

**Tesi**: il [[reinforcement-learning-from-human-feedback]] (RLHF) allinea i modelli alle intenzioni umane molto più efficacemente del semplice fine-tuning supervisionato.

## Punti Chiave
- SFT (supervised fine-tuning) su prompt selezionati
- Reward model addestrato su preferenze umane
- PPO per ottimizzare il policy model verso il reward model
- Un modello 1.3B RLHF supera GPT-3 175B su molte task

## Correlate
- [[reinforcement-learning-from-human-feedback]]
- [[openai]]
- [[fine-tuning]]
