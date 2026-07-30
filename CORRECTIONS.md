<img src="docs/torchio-lockup.svg" alt="Torchio" width="400">

# Corrections register

Register required by principle 13 of [PRINCIPLES.md](PRINCIPLES.md). Every
correction demanded by a real edition is recorded with date, edition and
type.

Types:

- **assignment**: addition or correction of an entry in the
  classes-to-behaviours table;
- **extension**: addition of a function, with no changes to existing ones;
- **structural change**: modification of an existing engine behaviour.

Falsification conditions for the thesis (principle 13): frequent structural
changes, or corrections that do not decrease with use within the same
editorial genre.

| Date | # | Demanded by | Type | Correction |
|---|---|---|---|---|
| 2026-07-30 | C1 | Faust-Edition, Shelley-Godwin | assignment | hands as a first-class dimension (`handNote` is the most frequent element in the contrast corpus) |
| 2026-07-30 | C2 | Bellum Alexandrinum (DLL) | extension | pointer resolution via `prefixDef` (private URI schemes) |
| 2026-07-30 | C3 | Faust-Edition, Shelley-Godwin | extension | spanning variants (`addSpan`/`delSpan`/`damageSpan` with `@spanTo`) |
| 2026-07-30 | C4 | four cases out of six | assignment | title page and paratexts (`titlePage`, `front`/`back`), missing from the first draft |
| 2026-07-30 | C5 | Faust-Edition | assignment | `fw` (running titles): hidden in reading view, visible in diplomatic |
| 2026-07-30 | C6 | Faust-Edition | assignment | composite texts (`group`, `floatingText`) |
| 2026-07-30 | C7 | Faust-Edition, Shelley-Godwin | assignment | genetic operations beyond layers (`transpose`, `alt`, `join`, `move`) |
| 2026-07-30 | C8 | Bellum Alexandrinum (DLL) | assignment | witness lacunae (`lacunaStart`/`lacunaEnd`): deriving a witness's text must know where the witness is silent |
| 2026-07-30 | C9 | DraCor, Shelley-Godwin | assignment | facets derived from declared taxonomies (`classDecl`) |
| 2026-07-30 | C10 | Bellum Alexandrinum (DLL) | extension | canonical citation (`refsDecl`, `citeStructure`) |
| 2026-07-30 | C11 | Thun correspondence | assignment | the declared index (`index`) to be merged with derived indices |
| 2026-07-30 | C12 | Shelley-Godwin | extension | XInclude resolution (`xi:include`) |
| 2026-07-30 | C13 | Shelley-Godwin | extension | non-canonical TEI roots (`surface` as root) |
| 2026-07-30 | C14 | Odyssey (Perseus), public demo | assignment | verse numbers (`@n` on `l`) were not displayed: every fifth line now carries its number in the margin |
| 2026-07-30 | C15 | Odyssey (Perseus), public demo | assignment | the structural partitions of the body (book or section `div`) become pages with a table of contents and navigation, instead of a single page |
| 2026-07-30 | C16 | Bellum Alexandrinum (DLL), public demo | assignment | notes (`note`) interrupted the prose as blocks: they are now margin notes where the screen allows it, with an anchor mark in the text and a toolbar toggle |
| 2026-07-30 | C17 | Ursus Beneventanus (ed. Monella), public demo | assignment | whitespace inside word-level elements (`w`, `m`, `c`) and between the children of element-only content (`choice`, `subst`, `app`, `rdgGrp`) is source formatting, not text: it is now dropped; word separation comes from `pc` and element boundaries |

As of 30 July 2026: 17 corrections (12 assignments, 5 extensions, 0
structural changes).
