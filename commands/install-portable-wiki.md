---
description: Installa, ripara o aggiorna LLM Wiki Portable (USB o cartella locale)
agent: build
---

Usa la skill **llm-wiki-setup**, che contiene la procedura completa e
version-aware (prima installazione, migrazione, nuovo PC, aggiornamento da v1,
diagnostica).

Se la skill non fosse disponibile, il percorso minimo e':

```bash
# 1. diagnostica: guarda cosa c'e' gia' prima di chiedere qualsiasi cosa
python3 <repo>/install.py --mode doctor

# 2a. prima installazione (chiedi prima: dove, quale template, quale lingua)
python3 <repo>/install.py --mode local --target ~/wiki --template general --lang it
python3 <repo>/install.py --mode usb   --target /media/usb/wiki --template work --lang it

# 2b. installazione esistente: aggiorna o ripara (non tocca wiki/ e raw/)
python3 <repo>/install.py --mode upgrade

# 2c. wiki gia' esistente, PC nuovo
python3 <repo>/install.py --mode newpc --target <path>

# 3. verifica sempre
python3 <repo>/install.py --mode doctor
```

Template: `general`, `work`, `business`, `professional`, `research`, `custom`
(con `--folders "a,b,c"`).

Ricorda all'utente che **gli hook si attivano al riavvio** di Claude Code o
OpenCode.
