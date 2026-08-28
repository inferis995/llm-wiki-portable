---
created: 2026-02-01
updated: 2026-04-15
tags: [prompting, reasoning, technique]
title: Chain-of-Thought Prompting
---
# Chain-of-Thought Prompting

**Tesi**: spingere l'LLM a ragionare step-by-step prima della risposta finale migliora drammaticamente performance su task complesse — soprattutto matematica e logica.

## Varianti
- **Few-shot CoT**: esempi con ragionamento esplicito nel prompt
- **Zero-shot CoT**: "Let's think step by step"
- **Tree of Thoughts**: esplorazione di rami multipli di ragionamento
- **o1/o3** (OpenAI): CoT interno durante pretraining — non nel prompt

## Perché Funziona
L'[[attention-mechanism]] può distribuire compute su token intermedi di ragionamento, effettivamente aumentando la "profondità computazionale" del modello.

## Correlate
- [[transformer]]
- [[attention-mechanism]]
- [[context-window]]
