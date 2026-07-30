# Demos

Demonstration editions generated with Torchio from the sources in
`demo-src/`. To regenerate, for example:
`node tools/press.js --site demo-src/odissea/odissea.xml docs/odissea`
and `node tools/press.js --site demo-src/vangogh docs/vangogh`.

## Materials and rights

- **Odyssey** (`demo-src/odissea/`): Homer, *Odyssey*, Greek text from the
  [Perseus Digital Library](https://github.com/PerseusDL/canonical-greekLit)
  (`tlg0012.tlg002.perseus-grc2`), CC BY-SA 4.0. The derived demo is
  distributed under the same licence.
- **Van Gogh letters** (`demo-src/vangogh/`): 30 letters from
  [Vincent van Gogh, The Letters](https://vangoghletters.org/) (Van Gogh
  Museum and Huygens ING, ed. Leo Jansen, Hans Luijten and Nienke Bakker),
  TEI files from the [eeditiones/vangogh](https://github.com/eeditiones/vangogh)
  repository, CC BY-NC-SA 4.0. The derived demo is distributed under the
  same licence, for non-commercial use only.
- **Bellum Alexandrinum** (`demo-src/bellum/`): critical edition by Cynthia
  Damon et al., [Digital Latin Library](https://github.com/digitallatin/caesar-balex),
  CC BY-SA 4.0; the files are declared by their authors a beta version
  pending peer review by the Society for Classical Studies. Temporary test
  sample. The derived demo is distributed under the same licence (CC BY-SA
  4.0).
- **Romualdus Salernitanus, Chronicon** (`demo-src/romualdo/`): digital
  scholarly edition by Paolo Monella, ALIM Project, from the
  [paolomonella/romualdus](https://github.com/paolomonella/romualdus)
  repository, GPL 3.0. Offered by the editor as a test case. The derived
  demo is distributed under the same licence.
- **Ursus Beneventanus, Adbreviatio artis grammaticae** (`demo-src/orso/`):
  digital scholarly edition (section *De nomine*, Codex Casanatensis 1086)
  by Paolo Monella, ALIM Project, from the
  [paolomonella/ursus](https://github.com/paolomonella/ursus) repository,
  GPL 2.0. Offered by the editor as a test case. The derived demo is
  distributed under the same licence.
- **Specimen** (`demo-src/specimen/`): a micro-edition constructed for
  demonstration purposes (imaginary witnesses, didactic variants, declared
  as such on the title page); base text: the opening of the Odyssey in
  Ippolito Pindemonte's translation (public domain); CC0 encoding.
- Geographic lookups use data derived from
  [GeoNames](https://www.geonames.org/) (CC BY 4.0); map coastlines from
  [Natural Earth](https://www.naturalearthdata.com/) (public domain). The
  map page uses [Leaflet](https://leafletjs.com/) (BSD-2, bundled) and tiles
  © OpenStreetMap contributors (ODbL), loaded from the OSM servers when the
  page is viewed.

Torchio's code remains MIT; the licences above concern the contents of the
demos.
