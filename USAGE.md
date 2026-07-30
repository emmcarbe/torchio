<img src="docs/torchio-lockup.svg" alt="Torchio" width="400">

# How to use Torchio

The current prototype runs from the command line with Node (version 18 or
later). There is nothing to install: no dependencies, no `npm install`.

## Quick start

Clone or download this repository, then press a TEI file into a site:

    node tools/press.js --site path/to/edition.xml output-folder

Or press a whole folder of TEI files (each file becomes a document of a
collection, with a register page):

    node tools/press.js --site path/to/folder/ output-folder

Open `output-folder/index.html` in a browser. Everything works locally from
the file system; only the map tiles are loaded from OpenStreetMap when a map
page exists.

Without `--site`, a single standalone HTML page is produced instead of a
multi-page site.

## In the browser, without installing anything

The same engine runs in a single self-contained page:
[the press in the browser](https://emmcarbe.github.io/torchio/press/).
Choose the files of an edition (one or more TEI XML files; include the ODD
if the edition has one, it is recognized automatically), read the report,
then take every
composition decision in the panel: title, language, theme, which pages and
which labels, pieces on or off, and your own simple pages written in
Markdown right there (an introduction, credits, a bibliography). The page
writes `torchio.json` for you and ships it inside the archive, next to the
pressed site: keep it with your XML and every future pressing, browser or
command line, repeats your decisions.

Everything happens on your machine: nothing is uploaded anywhere. The page
also works offline, saved locally and opened from `file://`.

The page is generated from the engine modules by
`node tools/build-browser.js`; the suite proves that the generated engine
presses byte-identically to the modular one.

## What the press derives

The direction matters: the edition declares, the press derives. Nothing in
this table prescribes how to encode: encoding is governed by the TEI
Guidelines and by your own editorial tradition. The table only documents
what the current prototype knows how to derive from what an edition already
declares; where it derives nothing from something your edition declares,
that is a gap of the tool, to be filed in
[CORRECTIONS.md](CORRECTIONS.md).

| The edition declares | The press derives |
|---|---|
| `app` / `lem` / `rdg`, `listWit` | critical apparatus (popup on the lemma, margin notes, `apparatus.csv`) |
| `choice` (`orig`/`reg`, `abbr`/`expan`, `sic`/`corr`), `add`/`del` | reading / diplomatic toggle |
| `listPerson` / `listPlace` / `listOrg` entries referenced from the text (`ref="#id"`) | indices of persons, places, organisations |
| `geo` coordinates inside `place`/`location` (or a reviewed `reconcile.json`, see below) | map page |
| `note` in the text, inline or standoff (`@target`) | margin notes with leader lines |
| many input files, or a `teiCorpus` | register of documents |
| several structural `div`s in the body of a long text | one page per book or section, with a table of contents |
| `front` and `back` matter | Introduction and Appendices pages |
| `l` elements with `@n` | verse numbers |

Unknown or custom elements are never dropped: they receive a base rendering.

## Where the ODD goes

Next to the TEI, like everything else. An edition without an ODD is read
against the whole of P5 (that is, `tei_all`). An edition with one gets it
recognized on its own: a document carrying a `schemaSpec` is a schema, not
a text, so in directory input (and in the browser drop) the ODD is simply
picked up from among the files. With a single-file input, pass it
explicitly:

    node tools/press.js --site edition.xml out --odd=schema.odd.xml

Custom elements declared `memberOf` a TEI class in the ODD inherit that
class's behaviour with zero code; deleted elements and modules narrow the
schema, never the rendering (nothing becomes invisible).

## The manifest (optional)

A `torchio.json` file next to the TEI adjusts presentation. All fields are
optional:

    {
      "title": "My edition",
      "subtitle": "a subtitle shown under the title",
      "lang": "en",
      "theme": "savi",
      "pages": [
        { "id": "index", "label": "Edition" },
        { "id": "text", "label": "Text" }
      ],
      "extra": [
        { "id": "about", "label": "About", "file": "about.md" }
      ],
      "pieces": { "apparatus": true, "entities": true, "choice": true },
      "exports": true,
      "parent": { "href": "../", "label": "Home" }
    }

- `lang`: `en` or `it` (interface language; otherwise derived from the
  edition's `langUsage`).
- `theme`: `savi` (default), `pergamena`, `moderno`.
- `pages`: which pages appear, in which order, with which labels. Known ids:
  `index`, `front`, `text`, `back`, `indices`, `map`, `data`, plus the ids of
  your extra pages. A page whose data does not exist in the markup is
  skipped.
- `extra`: free pages written in Markdown, files resolved next to the
  manifest.
- `pieces`: switch off interactive layers (the base rendering always stays).
- `exports`: set to `false` to omit the Data page.
- `parent`: an optional link back to a parent site, shown first in the
  navigation.

## Reconciling places, people, organisations

To propose coordinates for places (and prepare authority identifiers for
people and organisations):

    python3 tools/build-gazetteer.py          # once: downloads GeoNames (CC BY)
    node tools/reconcile.js path/to/edition.xml

This writes `reconcile.json` next to the input. Review it: set each entry's
`status` to `confirmed` (correcting values if needed) or `rejected`; fill in
entries marked `missing`. Your decisions survive re-runs. At the next press,
confirmed and suggested coordinates feed the map and the indices; the map
shows unreviewed suggestions as hollow dots. Coordinates declared in the TEI
always win.

## Publishing on GitHub Pages

Press into a `docs/` folder of a repository, push, then in the repository
settings enable Pages from the `main` branch, folder `/docs`. Any other
static hosting works the same way: the output is plain files.

## Tests

    npm test
