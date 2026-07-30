<img src="docs/torchio-lockup.svg" alt="Torchio" width="400">

# How to use Torchio

There are two roads to a pressed edition, with one engine behind both:

- **In your hands.** Press on your machine (command line, Node 18 or later,
  nothing to install) or directly
  [in the browser](https://emmcarbe.github.io/torchio/press/), with no
  machine setup at all. You get a folder of static files to open, keep or
  host anywhere.
- **In the repository.** The edition lives in a GitHub repository; on every
  push, GitHub Actions presses it again and GitHub Pages publishes the
  result. Nobody runs anything by hand: the repository is the edition. See
  [the repository presses itself](#the-repository-presses-itself) below.

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
| `app` / `lem` / `rdg`, `listWit` (also in the corpus header of a collection) | critical apparatus (popup on the lemma), witnesses table with full descriptions, `apparatus.csv` |
| adjacent `app` segments with `@from`/`@to` | separators between segments, computed from the declared token positions |
| `choice` (`orig`/`reg`, `abbr`/`expan`, `sic`/`corr`), `am`/`ex` even without a `choice` wrapper, `add`/`del` | reading / diplomatic toggle; every pair opens on click showing both levels |
| `lb`, with `@break` where the line splits a word | lineation in the diplomatic view; the reading view flows the prose and rejoins split words |
| `listPerson` / `listPlace` / `listOrg` entries referenced from the text (`ref="#id"`) | indices of persons, places, organisations |
| `geo` coordinates inside `place`/`location` (or a reviewed `reconcile.json`, see below) | map page, confirmed and suggested places drawn differently |
| `note` in the text, inline or standoff (`@target`) | margin notes while the margin can carry them; past a density threshold, anchor marks that open on click; either way the passage the note refers to lights up |
| many input files, or a `teiCorpus` | register of documents, sortable and filterable |
| a shared `@n` across the documents of a collection, named in the manifest (`align`) | canonical alignment: the entity index (`alignment.json`), witness sigla that jump to the same passage in each witness, and the classical apparatus band under the document the manifest names |
| several structural `div`s in the body of a long text | one page per book or section, with a table of contents |
| `front` and `back` matter | their own pages, labelled by their own heading when they have one (neutral fallback otherwise) |
| `l` elements with `@n` | verse numbers |
| `w` elements with `@lemma` (or a reviewed `lemmas.json`, see below) | index of lemmas: frequencies, forms, concordance (KWIC), `lemmas.csv` |
| `revisionDesc` | the revision history on the edition page (long histories scroll in place) |
| pipe tables in extra Markdown pages | real tables (used for a table of signs, for instance) |

Unknown or custom elements are never dropped: they receive a base rendering.

## The repository presses itself

The edition can be a GitHub repository that presses its own site. Put the
TEI files (and `torchio.json`, if any) in a folder called `edition/`, then
add this workflow as `.github/workflows/press.yml`:

    name: press
    on:
      push:
        branches: [main]
    permissions:
      contents: write
    jobs:
      press:
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v4
          - uses: actions/checkout@v4
            with:
              repository: emmcarbe/torchio
              path: torchio
          - run: node torchio/tools/press.js edition --site --out docs
          - run: |
              git config user.name github-actions
              git config user.email github-actions@users.noreply.github.com
              git add docs
              git commit -m "Press" || echo "nothing new"
              git push

Then enable Pages in the repository settings (Settings, Pages, deploy from
branch, `main`, `/docs`). From that moment every push of the XML presses
and publishes the edition again; the site's address appears in the Pages
settings.

## An archive, not only an edition

A folder of TEI files is a collection, and a collection can be a whole
digital library in the shape of ALIM, ELA or Biblioteca Italiana: press
the folder and the site is the archive (register of documents with
sorting and filtering, one page per document, corpus-wide indices, map,
lemmas and concordance across the whole corpus, the token table of
everything). Both roads carry it: the browser press takes the same
folder as a drop (63 documents press in about two seconds), and on path
B the archive is a repository that presses itself on every push, so
adding a text is committing a file.

An archive presents the project, never one text's header: its home page
is an aggregated card (number of documents, span of years, languages,
token count, contributors with their number of interventions from the
headers' `respStmt` and `revisionDesc`, ORCIDs linked) plus the licence
policy: a licence shared by every document surfaces once; otherwise
each document declares its own, on its own page, where its full header
always travels. The archive's name and description come from the
manifest (or the corpus header of a `teiCorpus`), never from the first
file that happens to sort first.

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

- `align`: canonical alignment for collections whose documents share a
  numbering. Declares which elements carry it, how to normalise their `@n`
  to one key, and (optionally) under which document the classical apparatus
  band is derived:

        "align": {
          "elements": ["l", "app"],
          "strip": "^.*line=",
          "apparatusUnder": "ms-Edition"
        }

  The press then writes `alignment.json` (entity to passage, per document),
  makes every witness siglum in the band jump to that witness's own verse,
  and prints the band in the classical form (lemma] variant sigla).
- `exports`: `true`, `false`, or an object switching off single pieces,
  each true by default: `"exports": { "model": false, "source": false }`
  (pieces: `model`, `entities`, `apparatus`, `lemmas`, `tokens`, `source`).
  Useful when one export outweighs the site: the rest of the data stays.
- `lang`: `en` or `it` (interface language; otherwise derived from the
  edition's `langUsage`).
- `labels`: interface words the edition's tradition wants otherwise, as
  string overrides of the interface keys: `"labels": { "reading":
  "Costituito" }`. The defaults already follow each interface language's
  own tradition (English: Reading / Diplomatic; Italian: Interpretativa /
  Diplomatica); no tradition is the default (principle 14).
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

## Lemmas: concordances and frequencies

Concordances and frequency lists make no philological sense on raw forms
("errò" and "errare" are one word, not two), so the Lemmas page appears
only when the edition carries lemmas, and it declares their provenance and
coverage. Two ways in:

- the markup decides: `<w lemma="...">` is used as is;
- otherwise, a reviewed `lemmas.json` next to the TEI:

      node tools/lemmatize.js path/to/edition.xml

  The language of every token is the markup's decision: the nearest
  ancestor with `xml:lang`, falling back to the header's `langUsage`
  (ISO 639-2 and 639-1 are read as one declaration: `lat` is `la`). A
  multilingual edition is lemmatized per language, and the index groups
  and declares coverage per language. The tool picks the matching UDPipe
  model (Latin, ancient Greek, Italian, Dutch, French, German, English,
  Spanish, Portuguese); for Latin, the date of the text (`creation` in
  the header) chooses between classical and post-classical. `--lang=` and
  `--model=` override everything; `--conllu=file` works fully offline
  from any local pipeline. If no model is known for a declared language
  the tool says so and skips it: never a silent guess in the wrong
  language.

### When the lemmatizer is wrong (it will be)

Every entry is written as `suggested`; where the tagger disagreed with
itself the entry says `review` and lists the alternatives: the homograph
is the editor's call. Next to `lemmas.json` the tool writes
`lemmas-review.csv`, the same content for a spreadsheet, sorted by what
deserves the eye first: doubted entries, then frequency. Zipf pays: on a
real corpus a few hundred types cover half the tokens, so a bounded
session of review carries most of the text. Fix a lemma or set the
status (`confirmed` / `rejected`), then import the decisions back:

    node tools/lemmatize.js path/to/edition --import=lemmas-review.csv

An edited lemma counts as a decision even if the status column is left
alone. Your decisions survive every re-run, and the pressed page counts
what is still pending. Corrections are by type (a form everywhere in the
edition); per-occurrence overrides for true homographs are a declared
limit of v0.

Traditions that are not lemmatized are not forced into this: without
lemmas there simply is no Lemmas page, and nothing else changes.

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
