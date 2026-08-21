---
created: 2026-02-15
updated: 2026-04-22
tags: [training, adaptation, lora]
title: Fine-Tuning
---

## Fine-Tuning

**Tesi**: il fine-tuning su dati di dominio specifico è il metodo più efficace per adattare un LLM a task specializzate — ma richiede dati di qualità, non quantità.

## Approcci
- **Full fine-tuning**: aggiornamento di tutti i parametri — costoso
- **LoRA**: aggiornamento di matrici a basso rango — efficiente, quality comparabile
- **QLoRA**: LoRA + quantizzazione 4-bit — addestrabile su consumer GPU
- **SFT**: supervised fine-tuning su coppie input/output

## Quando Usarlo vs RAG
Vedi [[rag-vs-fine-tuning]] per il confronto dettagliato.

## Correlate
- [[reinforcement-learning-from-human-feedback]]
- [[rag-vs-fine-tuning]]
- [[openai]]
