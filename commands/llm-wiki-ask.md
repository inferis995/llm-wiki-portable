---
description: Interroga la knowledge base personale e rispondi citando le pagine
agent: build
---

Rispondi a: $ARGUMENTS — basandoti sulla wiki dell'utente.

## 1. Cerca

```bash
python3 "<root>/tools/search.py" --query "$ARGUMENTS" --top 5
```

Se non trova nulla, riprova con i sinonimi o i termini piu' generali della
domanda prima di dichiarare che la wiki non copre l'argomento.

## 2. Leggi davvero

Apri **per intero** le pagine trovate: lo snippet della ricerca non basta.
Segui i `[[wikilink]]` per massimo 2 livelli di profondita'.

Utile per capire il contesto di una pagina:
```bash
python3 "<root>/tools/search.py" --backlinks <slug>
```

## 3. Rispondi

- **Prendi posizione.** La wiki e' opinionata, la risposta anche.
- Cita ogni affermazione con `[[slug]]`.
- Sintetizza: non elencare tutto quello che hai trovato.
- Se la wiki copre solo in parte la domanda, di' quale parte viene dalla wiki e
  quale dalle tue conoscenze generali. **Non confondere le due cose.**
- Se non copre nulla, dillo chiaramente.

## 4. Chiudi il ciclo

Se rispondere ha rivelato un buco — un concetto citato senza pagina, una
contraddizione tra due pagine, un'informazione vecchia — proponi di colmarlo e,
se l'utente conferma, fallo subito.
