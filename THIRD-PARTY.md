# Componenti di terze parti

## Fathom Starmap

`web/starmap.js` deriva da **Fathom Starmap**, un plugin Obsidian che disegna un
vault come una galassia in Canvas 2D.

- Progetto: https://github.com/dryweather-2544/fathom-starmap
- Autore: Ariel Bowyer
- Licenza: MIT

Cosa è stato ripreso: la proiezione 3D→2D, il modello di forze e i magneti di
forma della galassia, la nebulosa a sbuffi additivi renderizzata a risoluzione
ridotta, i contorni delle costellazioni tramite inviluppo convesso, i nomi delle
costellazioni su anelli orbitali inclinati con le loro dissolvenze (affollamento,
profondità, inclinazione, ribaltamento agganciato), e la selezione a livelli
delle etichette delle note.

Cosa è stato adattato: qui le note sono pagine markdown di una wiki statica
lette da `web/data.js`, non l'indice dei link di Obsidian; le costellazioni sono
le cartelle della wiki; le supernove sono le pagine aggiornate di recente; il
replay temporale usa il campo `created` del frontmatter.

Testo della licenza:

```
MIT License

Copyright (c) 2026 Ariel Bowyer

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## marked.js

`web/lib/marked.min.js` — parser markdown, licenza MIT.
https://github.com/markedjs/marked
