# Demo

Edizioni dimostrative generate con Torchio dai sorgenti in `demo-src/`.
Per rigenerarle: `node tools/press.js --site demo-src/odissea/odissea.xml docs/odissea`
e `node tools/press.js --site demo-src/vangogh docs/vangogh`.

## Materiali e diritti

- **Odissea** (`demo-src/odissea/`): Homer, *Odyssey*, testo greco dalla
  [Perseus Digital Library](https://github.com/PerseusDL/canonical-greekLit)
  (`tlg0012.tlg002.perseus-grc2`), licenza CC BY-SA 4.0. La demo derivata è
  distribuita alla stessa condizione.
- **Lettere di Van Gogh** (`demo-src/vangogh/`): 30 lettere da
  [Vincent van Gogh, The Letters](https://vangoghletters.org/) (Van Gogh Museum
  e Huygens ING, a cura di Leo Jansen, Hans Luijten e Nienke Bakker), file TEI
  dal repository [eeditiones/vangogh](https://github.com/eeditiones/vangogh),
  licenza CC BY-NC-SA 4.0. La demo derivata è distribuita alla stessa
  condizione, per soli usi non commerciali.
- **Bellum Alexandrinum** (`demo-src/bellum/`): edizione critica di Cynthia
  Damon et al., [Digital Latin Library](https://github.com/digitallatin/caesar-balex),
  licenza CC BY-SA 4.0; i file sono dichiarati dagli autori versione beta in
  attesa della peer review della Society for Classical Studies. Uso
  temporaneo, a scopo di prova. La demo derivata è distribuita alla stessa
  condizione (CC BY-SA 4.0).
- **Specimen** (`demo-src/specimen/`): micro-edizione costruita a scopo
  dimostrativo (testimoni immaginari, varianti didattiche, dichiarati nel
  frontespizio); testo base: incipit dell'Odissea nella traduzione di
  Ippolito Pindemonte (pubblico dominio); codifica CC0.
- Le ricerche geografiche usano dati derivati da [GeoNames](https://www.geonames.org/) (CC BY 4.0).

Il codice di Torchio resta MIT; le licenze qui sopra riguardano i contenuti
delle demo.
