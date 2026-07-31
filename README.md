<img src="docs/torchio-lockup.svg" alt="Torchio" width="400">

# Torchio

*Model for the edition, not for the viewer.*

Torchio turns XML-TEI P5 encoded texts into static digital scholarly editions:
multi-page sites with reading text, critical apparatus, indices, maps and
data exports, published from a git repository (GitHub Pages or any static
host), with no server and no database.

Project home: <https://emmcarbe.github.io/torchio/>, where the press runs in
the browser and wishes can be filed.

Demo editions: <https://emmcarbe.github.io/torchio-demos/>, kept in their own
repository, [emmcarbe/torchio-demos](https://github.com/emmcarbe/torchio-demos),
so that materials with limited rights stay apart from the engine.

Status: prototype under development. How to use it: [USAGE.md](USAGE.md).
The principles, the method and the origin of the project are in
[PRINCIPLES.md](PRINCIPLES.md); corrections required by real editions are
recorded in [CORRECTIONS.md](CORRECTIONS.md); wishes go in
[DESIDERATA.md](DESIDERATA.md).

## Design constraints

1. Every well-formed TEI document is always displayed in full. Unknown or
   custom constructs receive a base rendering.
2. Rendering behaviour is assigned to TEI model classes, not to individual
   elements. The class data is generated from the official `p5subset`
   (currently 588 elements, 127 model classes); coverage of the whole P5
   element set is checked by the test suite at every TEI release.
3. The edition's ODD customization is the configuration. Custom elements
   declared `memberOf` a TEI class inherit its behaviour. Following the
   Guidelines' conformance chapter, extensions concern phenomena P5 does not
   already cover.
4. The engine produces a documented data model (JSON); pages and exports
   (XML, CSV, JSON) are generated from the model, not from ad hoc
   transformations of the XML.
5. No runtime services. The same code runs in the browser and in Node;
   hosting, versioning and CI (continuous integration, the automated checks
   a repository runs at every change) belong to the edition's repository.
6. The markup decides which pages and functions exist; the optional manifest
   (`torchio.json`) decides their presence, order and labels.
7. Generated pages meet WCAG AA contrast (asserted per theme in the test
   suite) and are keyboard-accessible.
8. Interface language: English or Italian, set in the manifest or derived
   from the edition's `langUsage`.

## Layout

- `src/xml.js` — XML parser (no dependencies; validation belongs to the edition's CI)
- `src/classes.js`, `data/p5-classes.json` — element → class → behaviour resolution, with ODD overlay
- `src/odd.js` — ODD reader
- `src/model.js` — the edition model: documents, cards, registries, apparatus
- `src/render.js`, `src/site.js`, `src/themes.js` — base rendering, site pages, themes
- `src/interact.js` — reader-side functions (apparatus, entity cards, transcription levels)
- `src/reconcile.js` — entity reconciliation (GeoNames gazetteer; authority identifiers)
- `tools/` — press CLI, gazetteer builder, reconciliation
- `docs/`, `demo-src/` — demonstration editions, with rights in `docs/README.md`

## Development

```
npm test
```

No dependencies, ES modules, Node >= 18.

## Licence

The engine is MIT. It bundles or draws on a few external things, each under
its own terms; only the first is redistributed with the code.

- **[Leaflet](https://leafletjs.com/)** (BSD-2), vendored in `data-assets/`
  and copied into any pressed site that has a map. Its licence travels with
  it (`data-assets/leaflet/LICENSE`).
- **[GeoNames](https://www.geonames.org/)** (CC BY 4.0): the place gazetteer
  built by `tools/build-gazetteer.py`, including the historical and Latin
  forms from its alternate-names file. Not in the repository (regenerable);
  attribution required wherever its coordinates appear.
- **[Natural Earth](https://www.naturalearthdata.com/)** (public domain):
  the coastlines of the dependency-free map sketch.
- **OpenStreetMap** contributors (ODbL): the map tiles, loaded from the OSM
  servers when a reader opens a map page, not stored.
- **[UDPipe](https://lindat.mff.cuni.cz/services/udpipe/)** (Charles
  University, Prague; models CC BY-NC-SA): the optional lemmatizer sends the
  edition's text to that service when the editor asks for dictionary forms.
  It is never called by the press itself, and the editor is told before the
  text leaves the machine.

## Credits

Torchio is designed and maintained by
[Emmanuela Carbé](https://www.unive.it/persone/emmanuela.carbe)
(Ca' Foscari University of Venice,
[DSU-VeDPH](https://www.unive.it/pag/39287)). Contributions received
outside the repository are recorded in [PRINCIPLES.md](PRINCIPLES.md).
Anyone who wants to collaborate or give feedback is welcome.
