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
| 2026-07-30 | C18 | Romualdus Salernitanus (ed. Monella), public demo | assignment | front and back matter pages (C4) were not generated when the body is split into section pages (C15): the navigation promised an Introduction that did not exist; the two rules now compose |
| 2026-07-30 | C19 | Ursus Beneventanus (ed. Monella), public demo | assignment | margin notes (C16) do not scale past a density the margin can carry: above a threshold per page they collapse to their anchor marks and open on click, like the apparatus |
| 2026-07-30 | C20 | Ursus Beneventanus (ed. Monella), public demo | extension (open) | an edition that declares its signs in `charDecl`/`glyph` should get the table of signs derived from the header; today the Ursus demo ships it as an annex page built from the editor's CSV, which the press cannot derive |
| 2026-07-30 | C21 | Romualdus Salernitanus (ed. Monella), public demo | assignment | the front and back matter pages were labelled with presumed genres ("Introduction", "Appendices"): a `front` can be a title page, a preface, a dedication, a cast list; the label now comes from the section's own heading when it has one, with a neutral fallback |
| 2026-07-30 | C22 | Ursus Beneventanus (ed. Monella), public demo | extension | `choice` pairs looked interactive (dotted underline) but were not: a click now shows both levels of the pair (abbreviation and expansion, original and regularisation, error and correction), in both views |
| 2026-07-30 | C23 | Bellum Alexandrinum (DLL), public demo | assignment | witness descriptions were truncated at 80 characters and a `ptr` with no text swallowed its URL, leaving a dangling "URL:": the register now carries the full description and pointer targets surface as links |
| 2026-07-30 | C24 | all registers | assignment | the 80-character truncation removed by C23 lived in the model itself and applied to every register (people, places, hands, layers), not only witnesses: the model now keeps labels whole; compactness is a concern of the pages |
| 2026-07-30 | C25 | Ursus Beneventanus (ed. Monella), public demo | assignment | manuscript lineation (`lb`) belongs to the diplomatic level: the reading view flows the prose and `@break="no"` rejoins words split across lines; the base rendering without JavaScript keeps every line break |
| 2026-07-30 | C26 | Canterbury Tales Project (GP), offered by the editor | assignment | `am` and `ex` mark the diplomatic and the reading level even without a `choice` wrapper: the transcription toggle now counts them and shows each on its level |
| 2026-07-30 | C27 | Canterbury Tales Project (GP), offered by the editor | assignment | segment apparatus: adjacent `app` elements with declared token ranges (`@from`/`@to`) render glued; disjoint ranges now imply a separator, derived from the declared positions; apparatus entries typed `lac` read their editorial lemma as a compact scope label |
| 2026-07-30 | C28 | Canterbury Tales Project (GP), offered by the editor | extension | exports become granular in the manifest: each piece (model, entities, apparatus, lemmas, tokens, source) defaults to on and can be switched off alone, for editions whose full model outweighs the site |
| 2026-07-30 | C29 | Canterbury Tales Project (GP), offered by the editor | assignment | registry entries declared in the corpus header were not collected: a collection's `listWit` lives there; the registries now read the corpus header as well |

As of 30 July 2026: 28 corrections applied (21 assignments, 7 extensions, 0
structural changes), 1 open.
