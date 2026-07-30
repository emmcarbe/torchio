# Torchio

Torchio trasforma testi codificati in TEI P5 in edizioni scientifiche digitali
statiche: siti a più pagine con testo di lettura, apparato critico, indici,
mappe ed export dei dati, pubblicati da un repository git (GitHub Pages o
qualunque hosting statico), senza server e senza database.


Stato: prototipo in sviluppo. I principi, il metodo e
la genesi del progetto sono in [PRINCIPI.md](PRINCIPI.md).

## Vincoli di progetto

1. Ogni documento TEI ben formato viene sempre visualizzato per intero. I costrutti sconosciuti o custom ricevono una resa di base.
2. I comportamenti di resa sono assegnati alle classi di modello TEI, non ai
   singoli elementi. I dati delle classi sono generati dal `p5subset`
   ufficiale (oggi 588 elementi, 127 classi di modello); la copertura
   dell'intero insieme P5 è verificata dalla suite di test a ogni release TEI.
3. La personalizzazione ODD dell'edizione è la configurazione. Gli elementi
   custom dichiarati `memberOf` di una classe TEI ne ereditano il
   comportamento. Come da capitolo sulla conformance delle Guidelines, le
   estensioni riguardano fenomeni che P5 non copre già.
4. Il motore produce un modello di dati documentato (JSON); pagine ed export
   (XML, CSV, JSON) sono generati dal modello, non da trasformazioni ad hoc
   dell'XML.
5. Nessun servizio a runtime. Lo stesso codice gira nel browser e in Node;
   hosting, versioni e CI appartengono al repository dell'edizione.
6. Il markup decide l'esistenza di pagine e funzioni; il manifesto
   (`torchio.json`, facoltativo) ne decide presenza, ordine ed etichette.
7. Le pagine generate rispettano il contrasto WCAG AA (asserito per ogni tema
   nella suite) e sono accessibili da tastiera.
8. Lingua dell'interfaccia: italiano o inglese, dal manifesto o derivata dal
   `langUsage` dell'edizione.

## Struttura

- `src/xml.js` — parser XML (nessuna dipendenza; la validazione appartiene alla CI dell'edizione)
- `src/classes.js`, `data/p5-classes.json` — risoluzione elemento → classe → comportamento, con overlay ODD
- `src/odd.js` — lettore di ODD
- `src/model.js` — il modello dell'edizione: documenti, schede, registri, apparati
- `src/render.js`, `src/site.js`, `src/themes.js` — resa di base, pagine del sito, temi
- `src/interact.js` — funzioni lato lettore (apparato, schede delle entità, livelli di trascrizione)
- `src/reconcile.js` — riconciliazione delle entità (gazetteer GeoNames; identificatori d'autorità)
- `tools/` — CLI di stampa, costruzione del gazetteer, riconciliazione
- `docs/`, `demo-src/` — edizioni dimostrative (Odissea; lettere di Van Gogh), con diritti in `docs/README.md`

## Sviluppo

```
npm test
```

Nessuna dipendenza, moduli ES, Node >= 18.

## Licenza

MIT. Come citare: `CITATION.cff`.
Le ricerche geografiche usano dati derivati da [GeoNames](https://www.geonames.org/) (CC BY 4.0).
