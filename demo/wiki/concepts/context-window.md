---
created: 2026-02-05
updated: 2026-04-20
tags: [architecture, memory, limitation]
---

## Context Window

**Tesi**: la dimensione del context window è il principale fattore limitante dei LLM per task che richiedono elaborazione di documenti lunghi — ma più contesto non significa necessariamente migliore comprensione.

## Evoluzione
- GPT-2: 1024 token
- GPT-3: 4096 token
- GPT-4: 128K token
- Claude 3: 200K token
- Gemini 1.5 Pro: 1M token

## Lost in the Middle
I modelli degradano su informazioni nel mezzo del contesto — le informazioni all'inizio e alla fine sono recuperate meglio. Più contesto non è sempre meglio.

## Correlate
- [[transformer]]
- [[attention-mechanism]]
- [[rag-vs-fine-tuning]]
