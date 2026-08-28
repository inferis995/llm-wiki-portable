---
created: 2026-02-10
updated: 2026-03-30
tags: [preprocessing, nlp, bpe]
---
# Tokenization

**Tesi**: la scelta del tokenizer ha impatti profondi su performance, efficienza e limitazioni del modello — BPE è lo standard de facto ma ha difetti non ovvi.

## BPE (Byte-Pair Encoding)
- Vocabolario costruito iterativamente fondendo le coppie più frequenti
- GPT-4: ~100K token; Claude: ~100K token
- Problema: caratteri rari = molti token (es. lingue non inglesi, codice)

## Impatti Pratici
- 1 token ≈ 0.75 parole inglesi ≈ 4 caratteri
- Il [[context-window]] è in token, non parole
- Matematica e codice sono spesso tokenizzati in modo subottimale

## Correlate
- [[transformer]]
- [[context-window]]
