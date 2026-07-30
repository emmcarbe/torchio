<img src="docs/torchio-lockup.svg" alt="Torchio" width="400">

# Corrections register

Register required by principle 14 of [PRINCIPLES.md](PRINCIPLES.md). Every
correction demanded by a real edition is recorded with date, edition and
type.

Types:

- **assignment**: addition or correction of an entry in the
  classes-to-behaviours table;
- **extension**: addition of a function, with no changes to existing ones;
- **structural change**: modification of an existing engine behaviour.

Falsification conditions for the thesis (principle 14): frequent structural
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
| 2026-07-30 | C30 | Canterbury Tales Project (GP), offered by the editor | extension | canonical alignment, declared in the manifest (`align`): one key derived from `@n` identifies a passage across the documents of a collection; the press writes the entity index (`alignment.json`), derives the classical apparatus band under the document the manifest names, and every witness siglum in the band jumps to that witness's own verse |
| 2026-07-30 | C31 | Eurasian Latin Archive, public demo | assignment | contributor references that are bare authority identifiers (an ORCID in `@who`, with no name anywhere in the file) resolve through the reconciliation file: the editor confirms the name once, every page shows the person |
| 2026-07-30 | C32 | Eurasian Latin Archive, public demo | structural change | a loose collection (many files, no corpus header) borrowed the first document's `teiHeader` as the edition's identity: many documents mean many headers and none speaks for the whole. The archive home now presents the project (the ALIM/ELA/BibIt grammar); `teiCorpus` and single documents unchanged |
| 2026-07-30 | C33 | Eurasian Latin Archive, public demo | extension | the archive home aggregates what its documents declare: document count, span of years, union of languages, total tokens, contributors with their number of interventions (`revisionDesc/@who`, `respStmt`; ORCIDs linked), and the licence policy (uniform licence shown once, otherwise each document declares its own on its page) |
| 2026-07-30 | C34 | Eurasian Latin Archive, public demo | assignment | document cards read `@when-iso` (and `@notBefore`) in `creation`/`origDate`: the archive's span of years was missing most dates (and mislabelled a 4th-century text) |
| 2026-07-30 | C35 | demanded by the supervising editor | extension | concordances and frequencies only where lemmas exist (forms alone make no philological sense in flective traditions): lemmas from `w/@lemma` or a reviewed `lemmas.json` in the reconciliation pattern; per-language lemmatization from `xml:lang` with `langUsage` fallback; the review as a frequency-sorted spreadsheet whose edited rows count as decisions; for Latin the date of the text picks the model |
| 2026-07-30 | C36 | Eurasian Latin Archive, public demo | extension | the token stream as data (`tokens.csv`): one row per token of the reading layer, position without markers, anchor back into the markup: quantitative work without re-parsing the TEI |
| 2026-07-30 | C37 | Eurasian Latin Archive, public demo | extension | a mention whose `@ref` is an external authority URI (VIAF, Wikidata, GeoNames, Pleiades) renders as a real link opening in its own tab, and mentions sharing the URI are one entity in the registries, no `listPerson` needed |
| 2026-07-30 | C38 | Eurasian Latin Archive, public demo | assignment | `@key` declares identity too: mentions sharing a canonical-name key ("Figueredo, Thomas de") are one entity, labelled by the key, feeding the indices; a key alone never fakes a link |
| 2026-07-30 | C39 | demanded by the supervising editor | extension | the ODD is recognized on its own (a document carrying `schemaSpec` is a schema, not a text) in directory input and in the browser drop, `--odd=` for single files; without an ODD the edition is read against the whole of P5 (`tei_all`) and the report says so |

| 2026-07-30 | C40 | demanded by the supervising editor | assignment | the Italian interface called the edited level "Lettura", a calque of the English "reading text": the canonical pair of the Italian philological tradition is diplomatica / interpretativa, and the toggle now says so (the English pair, current in documentary and genetic editing, stands) |
| 2026-07-30 | C41 | Canterbury Tales Project (GP), offered by the editor | assignment | a document whose body consists of collation entries (`ab` holding only `app`) is an apparatus, and rendering only its lemmata hid its content: it now renders expanded as a variant map, every reading with its witnesses and count, lacunae declared with their sigla |

| 2026-07-30 | C42 | Eurasian Latin Archive, public demo | assignment | the source reuses one ORCID across two people's changes (and a placeholder across more): counting interventions by `@who` mis-attributed one person's work to another. The change's own prose names its agent ("I. Volpi: transcription") and that declaration wins; unambiguous name-identifier co-occurrences become aliases for identifier-only changes; an identifier seen with two names is never trusted |
| 2026-07-30 | C43 | Canterbury Tales Project (GP), offered by the editor | extension | word-level apparatus from the declared positions: the words an `app` covers (`@from`/`@to`) become triggers in the text, with the same popup as everywhere else; witness sigla open the witness's passage in a small window instead of leaving the page; long lemmata abbreviate in the classical way; the register lists apparatus documents apart from the texts |

| 2026-07-30 | C44 | Eurasian Latin Archive, public demo | assignment | keyed mentions were underlined but mute: the entity card now opens on `@key` too, led by the canonical form the key declares ("Figueredo, Thomas de"), with the text's own form and the occurrence count below; mentions whose `@ref` is an external URI stay plain links (C37), never a double behaviour |
| 2026-07-30 | C45 | Eurasian Latin Archive, public demo | assignment | the register wore the correspondence shape (from-to) on an archive of works: two shapes now exist and the majority of the markup decides (documents with authors read author-title-year); a collection's text page is called Texts; the manifest (and the browser panel) chooses the register's columns among the fields the headers populate, and the title column, the way into the documents, always stays |
| 2026-07-30 | C45 | Canterbury Tales Project (GP), offered by the editor | extension | the apparatus is reachable from every witness page: a verse aligned by the canonical key opens its variant entry, fetched from the collation document, in the same small window; nothing is added to the witness pages themselves |
| 2026-07-30 | C46 | Canterbury Tales Project (GP), offered by the editor | assignment | with word-level triggers in place, the band printed under every verse duplicated the apparatus and buried the text: the band stays in the page as the data the popups read, invisible; the apparatus opens on the word or on the verse, and the toolbar switch silences it |
| 2026-07-30 | C47 | Canterbury Tales Project (GP), offered by the editor | assignment | apparatus documents are not texts: they leave the register and live under their own page in the navigation |

| 2026-07-30 | C48 | Romualdus Salernitanus (ed. Monella), public demo | assignment | an endnotes chapter ("Adnotationes criticae") pressed as a reading page is unreadable: standoff notes follow their targets, each pressed on the page of the passage it annotates, where the margin machinery pairs them; a section left with nothing but its heading never becomes a page, and the contents no longer promise it |
| 2026-07-30 | C49 | Eurasian Latin Archive, public demo | assignment | long indices open with an index of the indices: one line of anchors (index of names, of places...) with the count of each section, derived, shown only when there is more than one section and enough entries |
| 2026-07-30 | C50 | Canterbury Tales Project (GP), offered by the editor | assignment | the press guessed the tokenization behind `@from`/`@to`; the edition's own model (the JSON collation overtext) declares it: standalone punctuation is not a token, a word split by line or abbreviation is one, and the declared lemma anchors the alignment where the counts drift |
| 2026-07-30 | C51 | first machine audit (three assistants in parallel) | structural change | editorial data could become executable code: one escaping function served both text and attributes and left the quotes untouched, so an attribute value could close its own attribute. Escaping now covers quotes; data serialized into a script has its markup characters neutralized; map popups take a text node; the in-browser preview is sandboxed and accepts messages only from its own frame; includes and extra pages cannot leave the edition's directory; the preview server binds to loopback and confines paths canonically; two hostile fixtures assert the invariant |
| 2026-07-30 | C52 | Canterbury Tales Project (GP), offered by the editor | assignment | the edited text was collated with itself: its siglum appeared among the variants of its own readings. The document the manifest names as the edited text is now marked as such in the variant map and never counted as a witness of its own reading |
| 2026-07-30 | C53 | Canterbury Tales Project (GP), offered by the editor | assignment | on a verse without an apparatus band the alignment branch swallowed the click, so editorial note marks stopped opening: notes take precedence over every verse-level behaviour |

As of 30 July 2026: 53 corrections applied (36 assignments, 15 extensions, 2
structural changes), 1 open.