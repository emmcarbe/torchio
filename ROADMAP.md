# Roadmap

Development agenda, in two registers: what is urgent, and what is possible,
much of it from others' advice and audits. Principles and method are in
[PRINCIPLES.md](PRINCIPLES.md), the experimental setup in
[LABORATORY.md](LABORATORY.md), corrections in
[CORRECTIONS.md](CORRECTIONS.md), wishes in [DESIDERATA.md](DESIDERATA.md).
An item leaves this file when it lands in the corrections register or is
discarded with a stated reason.

## Urgent

- Release and archiving: enable the Zenodo integration, tag and release
  0.2.0-beta.2, concept DOI in the README; Software Heritage archival, with
  the SWHID in the colophon beside the commit.
- `COPYING` with the GPL texts in the demos repository (Romualdus GPL 3.0,
  Ursus GPL 2.0: distributing GPL-derived content requires the licence
  text), and a root LICENSE for that repository.
- A "How to cite" block generated into pressed sites (author, title,
  version, date, URL, a `doi` slot in the manifest).
- The measurement over the contrast corpus. The sampling frame is now
  [`corpus-frame.csv`](corpus-frame.csv), built from both catalogues of the
  field (1156 editions, of which 124 appear in both); the chain that fetches
  and measures it exists (`tools/catalogues.js`, `tools/harvest.js`,
  `tools/measure-corpus.js`) and its first results are in
  [`corpus-results.csv`](corpus-results.csv). What remains is to run it at
  scale: find where each edition's XML lives, fetch what may politely be
  fetched, press, and publish the dataset. The figure, whichever way it
  falls, goes beside the wager in PRINCIPLES.
- Integrity block in the press report: dangling pointers counted and named
  (undeclared witness sigla, targets that resolve nowhere), so that
  "Pressed" never reads as "valid".

## Open defects (engine)

- Input handling: a non-UTF-8 file must stop the press instead of silently
  replacing characters; recursion depth must fail with the file named; a
  truncated review sheet must not hang the browser.
- Declared pages: `KNOWN_PAGES` misses `apparatus`, `genesis`, `lexicon`;
  `manifest.warnings` is collected and never shown.
- Witness data: the agreement table counts the edited text as a witness of
  itself and counts shared lacunae as agreement; `listWit` hierarchy is
  flattened; declared sigla are not used in the interface.
- Apparatus notes do not enter the model or the exports.
- Genetic layer: inferred hands recorded as if declared by the source;
  nested operations inheriting the wrong hand; operations with no declared
  hand dropped.
- The register's open rows: `prefixDef` resolution (C2), spanning variants
  (C3), `fw` by view (C5), `alt`/`join`/`move` (C7), witness lacunae (C8),
  `classDecl` facets (C9), `refsDecl`/`citeStructure` (C10), the declared
  `index` (C11), the signs table from `charDecl` (C20), and the six found
  on 1 August by specialist review: nested corpora dropped (C93), a
  self-documenting edition read as a schema (C94), nested XInclude
  resolving against the wrong base (C95), the class tie-break filing
  elements outside their family (C96), foreign-namespace metadata entering
  the registries (C97), six unreachable keys in the section map (C98).
- An archive whose items are themselves scholarly editions is not a
  structural type: pressing ALIM's documentary and literary sources together
  made one edition out of many (C108). `meeting` is unread, so a register of
  dated sessions shows shelf numbers (C105). Both are described in
  [COMPLEX.md](COMPLEX.md).
- Gazetteer matching has no notion of language: on early modern German it
  proposed towns for common words (C104).
- Sections are assigned but barely consumed: rendering keys on the element
  name almost everywhere, so a custom element declared `memberOf` a class
  inherits its section and not its appearance. Either sections become a
  rendering contract with a test, or the claim is narrowed further.
- Memory: pressing scales at roughly a hundred times the source size (parse
  trees kept beside the model, a map from every node id to its page, the
  whole site held as strings before writing). A 100 MB archive does not
  press today.
- The browser press and the CLI have drifted: the CLI applies `georef.json`
  and stamps the colophon, the browser does neither, and the manifest
  schema is written out three times.
- Tokenization: Latin enclitics, ornate capitals splitting words, editorial
  notes glued to tokens.
- NLP flow: the editor's reviewed lemmas are not reused by entity-candidate
  finding, which re-runs UDPipe without the emendations; POS is computed
  and never persisted; a collection is aggregated corpus-wide with no
  per-document view. Redesign specified in the derived-layer work below.
- RTL: logical CSS properties are needed before an Arabic edition is
  usable.
- Output: the output folder is never cleaned; `data/source/` copies every
  neighbouring `.json`.

## Accessibility and conformance

- Keyboard reachability for every interactive element family.
- `del`/`ins` semantics for screen readers.
- Folio numbers restored to the accessibility tree.
- Apparatus visible under 1180px.
- Popup focus management; composed contrast tokens tested.
- AgID accessibility declaration; OSM/GDPR notice for map tiles.

## Possible (much of it from others' advice)

- Facsimile: zones as SVG over the page image, every zone a link,
  `:target` lighting the transcription line; a declared position on IIIF
  (manifests consumed client-side, no image server when images are files).
  First slice on the Ursus.
- Search: index the model rather than the HTML, so an occurrence knows its
  level, witness, hand and layer. staticSearch (Endings) is the prior art
  for serverless search; the addition here is the model-aware index.
- Parallel text (facing translation), today flattened; witness synopsis
  for collated traditions.
- The derived layer, specified separately: linguistic and semantic
  annotation per occurrence in per-document sidecar files over a frozen
  text projection (two-layer store in the CWB/CQPweb tradition,
  materialized as static JSON; Opera Graeca Adnotata is the standoff
  precedent), so that a single document is a view, a subcorpus is a set of
  documents, and statistics compose in the browser. Entity pages with
  stable dereferenceable URIs; `@ana`, `listRelation`, JSON-LD. Adapters
  (UDPipe, specialized NER, gazetteers, possibly a local open model)
  propose; verification is independent of the proposer; everything is
  materialized with provenance; nothing runs at press time.
- The class approach stressed against institutional ODDs: EpiDoc,
  DTA-Basisformat.
- The official TEI Stylesheets regression suite compared before any claim
  about per-release testing.
- A local open model as template proposer, checked against the possible
  (editorial) worlds; not applicable to interpretation-bearing constructs.
- CI that re-presses the demos and fails when the committed output
  diverges; `npm test` running the worlds; open-count derived from
  execution.
- Print/ePub output; P4 and older P5 intake.
- Community files: `CONTRIBUTING.md`, issue templates, `SECURITY.md`,
  `EXIT.md` (what stays readable if the project stops).
- Naming: "TorchIO" exists in medical imaging; a disambiguator may be
  needed in title/DOI metadata.
