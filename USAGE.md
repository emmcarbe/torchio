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

## What appears, and why

Pages and functions exist only if the markup provides the data:

| You get | If the TEI has |
|---|---|
| critical apparatus (popup on the lemma, margin notes, `apparatus.csv`) | `app` / `lem` / `rdg`, `listWit` |
| reading / diplomatic toggle | `choice` (`orig`/`reg`, `abbr`/`expan`, `sic`/`corr`), `add`/`del` |
| indices of persons, places, organisations | `listPerson` / `listPlace` / `listOrg` entries referenced from the text (`ref="#id"`) |
| map page | `geo` coordinates inside `place`/`location` (or a reviewed `reconcile.json`, see below) |
| margin notes with leader lines | `note` in the text, inline or standoff (`@target`) |
| register of documents | many input files, or a `teiCorpus` |
| one page per book or section, with a table of contents | several structural `div`s in the body of a long text |
| Introduction and Appendices pages | `front` and `back` matter |
| verse numbers | `l` elements with `@n` |

Unknown or custom elements are never dropped: they receive a base rendering.
Custom elements declared `memberOf` a TEI class in the edition's ODD inherit
that class's behaviour (loading the ODD from the CLI is being wired; the
engine already supports it).

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
