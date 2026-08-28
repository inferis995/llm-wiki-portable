# Formato delle pagine

## Struttura

```markdown
---
created: 2026-08-21
updated: 2026-08-21
verified: 2026-08-21
confidence: high
sources: [[src-nome-fonte]]
tags: [docker, networking]
---

# Docker Networking

Una o due righe che dicono subito la cosa piu' importante.

## Punti Chiave
- Le bridge network isolano i container sullo stesso host
- [[kubernetes-cni]] risolve lo stesso problema a livello di cluster

## Superato
- 2026-03-01: si riteneva che `--link` fosse la via consigliata — deprecato da [[src-docker-docs-2026]]

## Correlate
- [[docker-compose]]
- [[vs-docker-podman]]
```

## Campi del frontmatter

| Campo | Obbligatorio | Significato |
|---|---|---|
| `created` | si' | data di creazione, non cambia mai |
| `updated` | si' | ultima modifica del contenuto |
| `verified` | consigliato | ultima volta che il contenuto e' stato ricontrollato; il lint segnala le pagine ferme da oltre 180 giorni |
| `confidence` | consigliato | `high` / `medium` / `low` |
| `sources` | per le pagine derivate da fonti | `[[src-...]]` |
| `tags` | si' | minuscolo, senza spazi |
| `supersedes` | quando serve | pagina che questa sostituisce |

## Confidence

- **high** — piu' fonti indipendenti concordi, oppure verifica diretta
- **medium** — una fonte solida, non contraddetta
- **low** — fonte singola, non verificata, o informazione volatile

Tre livelli, mai punteggi numerici: un numero dà alle affermazioni un'autorita'
che le prove non giustificano.

## Supersessione invece di cancellazione

Quando una nuova fonte smentisce qualcosa, **non cancellare e basta**. Il claim
vecchio va sotto `## Superato` con la data e il link alla fonte che lo smentisce.
Fra sei mesi, sapere *perche'* una posizione e' cambiata vale quanto la posizione
stessa.

## Nomi dei file

Minuscolo, trattini, niente accenti: `docker-networking.md`.

Non e' estetica: i drive USB in exFAT sono case-insensitive, quindi `Docker.md` e
`docker.md` sono lo stesso file e uno dei due sovrascrive l'altro. Lo slug
corretto lo puoi ottenere con:

```bash
python3 -c "import sys;sys.path.insert(0,'<root>/tools');import wikilib;print(wikilib.slugify('Il Mio Titolo'))"
```

## Prefissi per cartella

Ogni template ha i suoi (`src-` per le fonti, `prj-` per i progetti, `cli-` per i
clienti…). Il file `AGENT-WIKI.md` nella wiki root ha la tabella esatta del
template installato.
