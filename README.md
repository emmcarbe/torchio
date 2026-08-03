<img src="docs/torchio-lockup.svg" alt="Torchio" width="400">

[![DOI 10.5281/zenodo.21740661](docs/doi.svg)](https://doi.org/10.5281/zenodo.21740661)

# Torchio

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
[PRINCIPLES.md](PRINCIPLES.md); the experimental setup (worlds, exempla,
the taxonomy of failures) in [LABORATORY.md](LABORATORY.md); corrections
required by real editions are recorded in [CORRECTIONS.md](CORRECTIONS.md);
the development agenda in [ROADMAP.md](ROADMAP.md); how archives,
collections and editions inside editions are handled in
[COMPLEX.md](COMPLEX.md); wishes go in [DESIDERATA.md](DESIDERATA.md).

## How to cite

Cite the version you used. Every release has its own DOI; the one above
represents Torchio itself and always resolves to the most recent.

> Carbé, Emmanuela. *Torchio: a press for static digital scholarly editions*.
> Version 0.2.0-beta.2, 2026. https://doi.org/10.5281/zenodo.21740662

Machine-readable metadata is in [CITATION.cff](CITATION.cff).

The code is archived in two places and for two reasons: Zenodo keeps the
release, its files frozen and citable; [Software Heritage](https://archive.softwareheritage.org/browse/snapshot/e669f6863ec01e2366bcc1383b738b91d2324fe3/)
keeps the history, which is where the corrections register and the record of
what changed actually live.

    swh:1:snp:e669f6863ec01e2366bcc1383b738b91d2324fe3

## Design constraints

1. Every well-formed TEI document is always displayed in full. Unknown or
   custom constructs receive a base rendering.
2. TEI model classes assign a construct to a handling family and page section;
   they do not by themselves determine every visual detail. The class data is generated from the official `p5subset`
   (currently 588 elements, 127 model classes); coverage of the whole P5
   element set is checked by the test suite at every TEI release.
3. The edition's ODD customization is the configuration. Custom elements
   declared `memberOf` a TEI class inherit its handling family. Exact visual
   behaviour can be declared with the supported TEI Processing Model subset
   (`model`, web `modelGrp`, `behaviour`, common predicates, parameters,
   `cssClass`, and `outputRendition`); unsupported sequences are reported. This project also
   holds, as its own design maxim rather than as a rule of the Guidelines,
   that an extension should concern phenomena P5 does not already cover.
4. Rendering resolution is explicit and records its provenance: a matching
   processing model in the edition ODD wins; otherwise Torchio uses a small,
   conservative contract attached to a TEI All element or model class; if no
   safe contract exists, it preserves the construct through structural base
   rendering. TEI All supplies the vocabulary and class graph, not a canonical
   visualization profile: the fallback contracts are Torchio's and never
   override an edition ODD.
5. The engine produces a data model (JSON), documented by the code and the
   exports rather than by a written specification, which is a declared debt;
   pages and exports (XML, CSV, JSON) are generated from the model, not
   from ad hoc transformations of the XML.
6. No runtime services. The same code runs in the browser and in Node;
   hosting, versioning and CI (continuous integration, the automated checks
   a repository runs at every change) belong to the edition's repository.
7. The markup decides which pages and functions exist; the optional manifest
   (`torchio.json`) decides their presence, order and labels.
8. Generated pages meet WCAG AA contrast (asserted per theme in the test
   suite) and are keyboard-accessible.
9. Interface language: English or Italian, set in the manifest or derived
   from the edition's `langUsage`.

## Layout

- `src/xml.js`: XML parser (no dependencies; validation belongs to the edition's CI)
- `src/classes.js`, `data/p5-classes.json`: element to class to handling-family resolution, with ODD overlay (`src/odd.js` reads processing rules from the ODD)
- `src/model.js`: the edition model (documents, cards, registries, apparatus); `src/analyze.js` the coverage report
- `src/render.js`, `src/site.js`, `src/page-shell.js`, `src/themes.js`: base rendering, site pages, page chrome, themes; page builders in `src/*-page.js` (register, lexicon, lemmas, map, genesis)
- `src/interact.js`: reader-side functions (apparatus, entity cards, transcription levels, margin notes)
- `src/reconcile.js`, `src/georef.js`: entity reconciliation and georeferencing (GeoNames and Pleiades gazetteers; authority identifiers; every coordinate a suggestion the editor confirms)
- `src/lemmas.js`, `src/exports.js`, `src/md.js`, `src/zip.js`: lemma layer, data exports, Markdown for the editor's pages, the archive writer
- `tools/`: the press CLI (`press.js`), the browser press builder (`build-browser.js`), gazetteer builders, georeferencing, lemmatization (UDPipe), the Guidelines-examples harness (`exempla.js`)
- `worlds/`: the possible (editorial) worlds, contrastive corpora run as tests (see [LABORATORY.md](LABORATORY.md))
- `docs/`: the project site (the in-browser press and the Specimen edition; see `docs/README.md`)

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
