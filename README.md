<img src="docs/torchio-lockup.svg" alt="Torchio" width="400">

# Torchio

Torchio turns TEI P5 encoded texts into static digital scholarly editions:
multi-page sites with reading text, critical apparatus, indices, maps and
data exports, published from a git repository (GitHub Pages or any static
host), with no server and no database.

Demo editions: <https://emmcarbe.github.io/torchio/>

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
   hosting, versioning and CI belong to the edition's repository.
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

MIT. Geographic lookups use data derived from
[GeoNames](https://www.geonames.org/) (CC BY 4.0).
