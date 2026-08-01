<img src="docs/torchio-lockup.svg" alt="Torchio" width="400">

# Torchio. Principles of a project in the making

*Model for the edition, not for the viewer.*

First document, 30 July 2026. It records the state of the project at the
moment of its publication on GitHub and opens the phase of collaboration,
revision and implementation.

Contents:
[Origin](#origin) ·
[Why](#why) ·
[What already exists](#what-already-exists) ·
[The principles](#the-principles) ·
[Contributions](#contributions-received-outside-the-repository) ·
[State of the prototype](#state-of-the-prototype-30-july-2026) ·
[Agenda](#agenda) ·
[Audits](#audits) ·
[Materials and rights](#materials-and-rights) ·
[References](#references)

## Origin

The idea was born on the afternoon of 29 July 2026 at the VeDPH, out of one
of the countless conversations of Emmanuela Carbé with Federico Boschetti and
then with Angelo Mario Del Grosso (CNR-ILC «A. Zampolli»). That evening
Emmanuela Carbé tried to work out some principles for a simple, reusable
project that would address some problems of the main visualization systems
for digital editions. She built a prototype with the assistance of Claude
(Anthropic), model Fable 5; on the morning of 30 July Del Grosso raised
two pointed remarks, recorded with the other contributions below.
At 14:51 on 30 July a presentation mail went out to the VeDPH team, and the
first feedback arrived within the hour (see the contributions table below);
at 15:30 a brief call with Boschetti and Del Grosso sketched further
solutions. On Saturday, 1 August, the first phase of the project is completed and a DOI is assigned.
The project is open to anyone who wants to join: to review the
principles, contest them, improve them.

## Why

1. **Tools are dictating editorial practice.** Many digital scholarly
   editions are encoded with an eye to what the viewer can display, that is,
   to the list of tags the tool accepts. The relationship is upside down:
   the data model should govern the interface, not the other way round.
2. **Sustainability is the open problem.** Editions published on application
   servers die with their servers. The field is charted by two catalogues,
   Sahle's [Catalog of Digital Scholarly Editions](https://www.digitale-edition.de/)
   and Franzini's [Catalogue of Digital Editions](https://github.com/gfranzini/digEds_cat);
   the figures here come from the structured data of the latter (commit
   `7ddf229`, 29 May 2026): of 358 recorded editions, 242 declare a TEI
   transcription, and of those only 104 publish the source XML. Three TEI
   editions out of five do not provide their source. Of the 104, 95 are
   still reachable: those are the ones a tool can actually be tested
   against, and they are the contrast corpus described in the Method. The
   census has since been recounted from the catalogue's CSV and the figures
   hold. The sustainability problem is in any case familiar to everyone
   working in this field.
3. **The classic pipeline is a funnel.** TEI to XSLT to HTML: the stylesheet
   destroys the model at the border. Months of  encoding are flattened
   into presentational markup that, if not properly designed, risks limiting
   the edition’s visualization and usability.
    The resulting HTML may thus become a dead end: readable, but dead as data.
   
## What already exists

A first survey, to be deepened and corrected. It records architectural
positions, one representative each, not every existing tool.

- **[EVT](https://evt.labcd.unipi.it/)** is the most widely used tool in Italy and among the best known
  internationally, and the reference for the bond between text and image:
  hotspots derived from `zone` and `@facs`, a magnifying lens, synchronized
  views, IIIF, three levels of transcription, a witness view, internal search.
  It is a mature, full-featured viewer, and the text-image binding at its
  centre is exactly what this project does not yet do.
- **[CETEIcean](https://github.com/TEIC/CETEIcean)** (TEI-C) renders every TEI element as a custom element in the
  browser, without conversion: guaranteed rendering, and nothing is lost because
  nothing is transformed. It renders `graphic`, which this project does not yet
  do. It is a library for behaviours, not a publisher of editions: no apparatus,
  no indices, no export, and each edition writes its own behaviours.
- **[TEI Publisher](https://teipublisher.com/)** (e-editiones) implements the
  **TEI Processing Model** (Turska, Cummings and Rahtz, 2016), where the ODD
  carries not only the schema but the behaviour: `<model behaviour="...">`
  declares how a construct is to be rendered, and the tool executes it. This
  is the direct ancestor of principle 4, and the position Torchio has to
  distinguish itself from. The differences are three: behaviour is assigned
  to model classes rather than to individual elements, so an edition
  inherits without declaring anything; coverage of the whole P5 is asserted
  by the test suite rather than promised; and there is no runtime, since the
  static route of TEI Publisher (a static generator has existed since 2022, and
  version 10 makes it central) still requires a running instance to
  generate it.
- **[TEI Boilerplate](https://github.com/TEI-Boilerplate/TEI-Boilerplate)** (John Walsh) makes a TEI file render itself in the
  browser, through an XSLT stylesheet linked from the document itself: no
  build, no server. It is the earliest statement of the self-rendering
  document, and a direct ancestor of this project's in-browser route.
- **[dse-static-cookiecutter](https://github.com/acdh-oeaw/dse-static-cookiecutter)** (ACDH-CH, Vienna) is the project closest to
  this one: XSLT plus GitHub Actions plus Pages, with indices, maps and
  faceted search (Typesense), used for dozens of editions, and now argued
  in print (Andorfer 2026). It requires a developer's toolchain, though;
  rendering is assigned per element in XSLT partials; the interface comes
  from templates to be adapted, and there is no reusable data model.
- **The [Endings Project](https://endings.uvic.ca/)** (University of Victoria) is the
  prior statement of the static-longevity principle this project builds on:
  formal principles for digital longevity (data, products, processing,
  documentation, release management) and the reconstruction of complex
  database-driven projects as fully static sites (Holmes and Takeda 2023).
  Its **[staticSearch](https://endings.uvic.ca/staticSearch/docs/)** solves
  serverless full-text search: indices built at build time, queried
  client-side. Endings staticizes individual projects with a bespoke
  toolchain; it does not offer a generic TEI engine or a data model, which
  is where this project differs.
- **[TAPAS](https://tapasproject.org/)** (Northeastern; Flanders and Hamlin
  2013) addressed the same constituency, editors with TEI and no
  infrastructure, with the opposite architecture: a centralized hosted
  service. Its platform was retired in January 2025 with the end of life of
  the software stack beneath it, and a rebuild is under way.
- **Minimal computing** (Risam and Gil 2022; the Ed. and Wax generators of
  the minicomp group) is the theoretical frame of the no-server position:
  constraint as method, maintenance as the measure. Its edition tooling is
  not TEI-native (Markdown sources), which is the gap this project sits in.
- **[LEAF](https://www.leaf-vre.org/)** (LEAF-Writer, the LEAF Commons
  tool suite) serves the low-infrastructure constituency from the editing
  side: in-browser TEI and entity annotation without local installation.
  It is an authoring environment, not a publisher of editions; the two
  concerns meet but do not overlap.

## The reflection

Bauman (2011) argued that the interoperability of arbitrary TEI documents is impossible in the general case, a widely shared position. Torchio attempts to reconstruct the model at the level of classes, since it is through these classes that the Guidelines already indicate the nature of a given construct. The measure has been defined but not yet taken: the proportion of 95 editions in a contrast corpus that can be processed without any configuration. A high figure would constitute a partial refutation supported by quantitative evidence; a low figure would instead represent a negative result.

## The principles

1. **Traditions are respected, not imposed.** Torchio does not treat any particular conception of the scholarly edition as universal. Every edition emerges from a philological tradition and an editorial practice that shape its categories, terminology, textual levels, and forms of representation. The tool must respect these differences rather than silently reducing them to a single model.
The project is grounded in situated knowledge: its developer trained at Pavia and has direct knowledge of the Italian tradition of authorial philology. This expertise is a point of departure, not a model to be imposed on other editions. The categories of authorial philology, as well as those of documentary, genetic, critical, and other editorial practices, must be treated in their specificity and explicitly declared whenever they determine the behaviour of the interface.
The core of the engine must therefore be limited to what can be derived from the markup and the data model. Terminology, levels of visualization, and behaviours associated with a particular editorial theory must be defined by the edition itself or through explicit profiles. The rule is simple: Torchio adapts to the edition’s tradition; the edition must not adapt to categories presupposed by the tool.
The objective is transparency: to make it clear at all times which choices derive from the data, which from the editor, and which from a specific philological profile. When Torchio is not yet able to represent an editorial practice adequately, the limitation belongs to the tool and must be recorded as such, rather than becoming a constraint imposed on the edition.
2. **Nothing is lost.** The digital representation of the source is necessarily selective: deciding which phenomena to record, how to distinguish them, and to what level of detail they should be described is an interpretative act performed by the editor. Torchio must not erase, reduce, or render invisible the distinctions produced by that act. Everything the edition has chosen to record must be preserved, because every encoded element represents an editorial decision already made.
Today, this principle can be verified at the level of the model: everything recorded from the source enters the data model and the exports. On the page, however, it operates as preservation, though not always as interpretation: an unknown construct falls back on a guaranteed base rendering, remains visible, and is never discarded; nevertheless, a construct that the engine is not yet able to interpret displays less than the markup contains. The register documents each such case.
When faced with an invalid document, the engine degrades gracefully rather than breaking: validation is handled by CI processes, or continuous integration, that is, the set of automated checks run by a repository whenever a change is made.
3. **Behaviour lives on classes, not on tags.** Behaviour lives on classes, not on tags. TEI contains more than 500 elements, but organizes them into a few dozen model classes. The map is generated from the official [`p5subset`](https://tei-c.org/Vault/P5/current/xml/tei/odd/p5subset.xml) (P5 4.12.0: 588 elements, 127 model classes, 86 attribute classes, and 35 datatypes), while full coverage is verified through an automated test that can be rerun with every TEI release.
The current state of the system must be described precisely, distinguishing what it already does from what remains to be implemented. At present, class membership determines assignment: it establishes which section of the page a construct belongs to and which family of handling it receives. An element the engine has never encountered before, or a custom element declared memberOf a class, is therefore placed according to its class rather than being discarded.
Per-class rendering rules, in which the class rather than the individual element determines the full visual behaviour, currently exist only for a minority of sections. Extending them across the entire map remains ongoing work, and this claim should be stated in the present tense only when the code actually supports it.
Development should not, however, be driven by examples, because examples are test cases, not the specification.
4. **The ODD decides, not the tool.** The edition’s ODD customization constitutes its configuration: it defines the modules included, the elements excluded, and, above all, the custom elements, which, once declared `memberOf` a TEI class, inherit its behaviour without requiring a single line of code. Conformance operates on two levels. The syntactic level can be checked mechanically; the semantic level, by contrast, requires judgement, since an extension is legitimate only when it concerns phenomena not covered by P5. The tool must therefore flag cases that require editorial review, without claiming to resolve them automatically.
5. **The edition is the model.** The engine transforms the TEI into a data model — documents, entity registries, witnesses, hands, layers, and typed apparatuses — and every page and every export, whether XML, CSV, or JSON, is a projection of that model. The same XML must deterministically produce the same model. The model’s written documentation is an acknowledged debt: at present, the model is defined by the code and the exports rather than by a standalone document.
6. **No required backend.** The repository constitutes the canonical and reproducible package of the edition: git preserves its version history, CI performs validation and other automated checks, while static hosting enables publication without dependence on an application server. For preservation, a version of the edition is deposited in an archive that assigns it a DOI; since GitHub is a commercial platform, the code and repository history are also archived in Software Heritage, with the SWHID placed alongside the DOI. The same engine can run both in the browser and in Node, making the edition clonable, reproducible, and verifiable independently of the published site. The principle that static technologies support the longevity of digital editions is not new, and Torchio does not claim it as such: it has been systematically articulated by the Endings Project. Torchio’s specific contribution is to provide a generic engine and a data model capable of generating the static site directly from the encoded edition.
7. **The markup determines what is available; the manifest configures its presentation.** Pages and functions are generated only when the markup provides the data that substantiates them: an edition without an apparatus does not display apparatus-related functions; a registry without occurrences does not generate an index. The optional torchio.json manifest does not create structures that are absent from the data, but configures their visibility, order, labels, theme, and language, and allows editorial pages written in Markdown to be added.
8. **The four-rung ladder.** It is not possible to determine in advance how every possible TEI universe should be visualized. The system remains robust because it degrades gracefully across four levels: a guaranteed base rendering; class-based behaviour, applicable to most cases; specifically designed components, such as apparatuses, indices, and maps; and, finally, for the remaining cases, a suggestion system that proposes possible solutions. Every automated proposal must be materialized as an explicit rule, approved by the editor and accompanied by a declaration of provenance. No decision is made automatically at reading time.
9. **The editor remains in the decision loop.** Entity reconciliation — for example, matching places with GeoNames and people or institutions with authority identifiers — produces a file of proposals alongside the TEI. The machine proposes; the editor confirms, corrects, or rejects. The TEI itself is not modified: editorial decisions are recorded in an external file that serves as a persistent enrichment layer and is reused in subsequent regenerations. Data declared in the TEI always take precedence over data obtained from external sources: for example, coordinates supplied by the edition override those retrieved during reconciliation. Every added datum retains a record of its provenance, which must also be accessible through the interface.
10.  **Accessibility.** Accessibility. Editions generated by Torchio must be designed to conform to WCAG 2.2 at level AA. This includes the semantic structure of the HTML, heading hierarchy, landmarks, reading order, keyboard navigation, focus management, contrast, content resizing, and the accessible behaviour of interactive components, including apparatuses, tables, dialogs, and maps. Information must not rely exclusively on colour, visual layout, or pointer-based interaction. Requirements that can be checked automatically are tested for every theme and with every change to the code. These checks must be supplemented by manual testing of keyboard navigation, focus order, use with assistive technologies, and rendering across different screen sizes. Torchio can verify the accessibility of the structures and components it generates, but not that of all content supplied by the edition. Alternative texts, transcriptions, descriptions, and language information must therefore be required and, where possible, validated; when they are missing, the tool must flag their absence without generating them automatically. The aim is to produce an edition that can be published by a public institution without requiring the interface to be redesigned, accompanied by an accessibility statement distinguishing automated checks, manual verification, and any limitations arising from the edition’s content.
11.  **Forms before categories.** Built-in analyses should operate first on attested forms, for example in concordances and frequency counts. Grouping those forms into more abstract units — such as lemmas, stems, roots, or normalized spellings — depends on the language and on editorial decisions and should therefore not be imposed by the core system. Each edition may declare its own grouping strategy, which Torchio can apply through an adapter.
12.   **Curation does not replace completeness.** Pages may present curated summaries, such as the edition record or the document register, but these do not replace the underlying data. The complete metadata remain accessible, and the TEI header is rendered beyond the fields selected for the summary. Labels are derived from the markup wherever possible, allowing previously unseen metadata to appear without requiring changes to the interface.
13. **Everything is reversible and attributed.** Everything is reversible and attributed. Torchio does not overwrite the source TEI. Transformations, enrichments, and editorial decisions are stored separately and remain traceable to their sources, so that generated outputs can be reproduced, inspected, or discarded without altering the edition’s primary data. The code is released under the MIT License; external data sources and licences are declared; and contributions are acknowledged.
14. **The thesis may turn out to be wrong.** The project advances a testable hypothesis: as more editions are processed, the corrections required by the engine should decrease within each genre and should consist mainly of assignment corrections or extensions, without requiring repeated changes to existing behaviour.
There is no need to assume that this hypothesis is correct: it must be measured. Every correction is recorded in CORRECTIONS.md, together with the date, the edition concerned, and the type of intervention. The evaluation protocol will define the minimum number of editions and the criteria used to measure how the number and type of corrections change over time.
If, once that threshold has been reached, corrections within a genre do not decrease, or if structural changes to the engine become frequent, the thesis will be considered wrong and the result will be stated in this document.

## The method

## The specification and the empirical cases

**The specification is derived from the class system; empirical cases revise it.** The classes-to-behaviours table was developed from the *Guidelines* and the official `p5subset`, rather than inferred from a collection of examples. Real editions are then used to test the specification, identify omissions, and determine where it must be corrected or extended.

Three different objects have previously been described as the *contrast corpus*. They are distinguished here as follows.

### Sampling frame

The **sampling frame** is the list of candidate editions extracted from the catalogues. In July 2026, the initial frame contained 95 editions from the *Catalogue of Digital Editions*. The current `corpus-frame.csv` contains 1,156 records drawn from both catalogues, with only 124 editions represented in both.

The editions in this frame have not yet been processed with Torchio. The frame identifies the candidates for the empirical measurement described in *The wager*; it is not itself the set of editions already analysed.

### Analysed cases

The **analysed cases** are the six editions that were downloaded and analysed as complete corpora, through computational analysis and targeted manual inspection:

* [Faust-Edition](https://faustedition.net/)
* [Shelley-Godwin Archive](http://shelleygodwinarchive.org/)
* [Thun correspondence](https://thun-korrespondenz.acdh.oeaw.ac.at/)
* [Italian ELTeC](https://github.com/COST-ELTeC/ELTeC-ita)
* [Italian DraCor](https://dracor.org/ita)
* the Digital Latin Library’s [*Bellum Alexandrinum*](https://github.com/digitallatin/caesar-balex)

Together, they comprise 8,292 XML files and 228 distinct elements, recounted on 1 August 2026.

Only two of these editions — the *Faust-Edition* and the Thun correspondence — belong to the original sampling frame. The other four were selected because their XML sources were available and suitable for analysis. The analysed cases and the sampling frame therefore overlap, but neither set contains the other.

### Contrastive examples

The **contrastive examples** are constructed fixtures representing possible editorial worlds. They are designed as test cases and are not editions. Their purpose is to test specific structures and behaviours that may not occur in the analysed cases.

### Corrections to the specification

The analysis of the six real editions produced thirteen corrections to the first version of the specification. These include:

* treating hands as a first-class dimension: `handNote` is the most frequent element in the analysed corpus;
* adding title pages and paratexts, which were absent from the first draft;
* representing witness lacunae, without which the claim that “every witness is a derivable text” would generate texts that do not exist;
* supporting canonical citation structures;
* resolving XInclude;
* handling non-canonical TEI roots.

These corrections do not make the examples the specification. The specification continues to derive from the TEI class system; empirical cases test its adequacy and reveal where it must be revised.

## Development workflow

The work proceeds through successive phases, each associated with a verifiable result:

1. **Specification:** definition of the classes-to-behaviours map and its constraints.
2. **Engine:** parser, class system, ODD processing, and data model.
3. **Composition:** pages, themes, and manifest.
4. **Components:** apparatuses, entities, textual levels, indices, maps, and exports.
5. **Packaging:** template repository and in-browser configurator.
6. **Real cases:** processing and evaluation of existing editions.
7. **Scholarly publication:** documentation, results, and assessment of the project’s claims.

## Contributions received outside the repository

Substantive contributions arriving by mail and messaging, before or beside
the repository itself. One line per contribution.


| Who                                       | Date       | Contribution                                                                                                                                                                                                                                                                                                                      | Where it landed                                                                    |
| ----------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Federico Boschetti (CNR-ILC)              | 29–30 July | the founding observation and early feedback                                                                                                                                                                                                                                                                                       | Origin; the apparatus DSL in the agenda                                            |
| Angelo Mario Del Grosso (CNR-ILC)         | 30 July    | two observations: web components should operate at the level of user-facing behaviours, not individual TEI elements; extensions are legitimate only for phenomena not covered by the *Guidelines*. The latter prompted the replacement of the test example: `cancellatura`, which duplicated `del`, was replaced by `salvataggio` | principle 4; agenda items 2 and 6; the test suite                                  |
| Franz Fischer (VeDPH)                     | 30 July    | the complexity question: does the class-based approach hold for non-standardized TEI documents?                                                                                                                                                                                                                                   | principle 14 provides the standing answer                                          |
| Paolo Monella                             | 30 July    | a reflection on the project in light of his work on *Orso* and *Romualdo*, particularly concerning sustainability by design, the relationship between live architecture and one-off generation, and the possibility of overriding the rendering of individual elements                                                            | USAGE; desiderata; reflection on the case studies                                  |
| Peter Robinson (Canterbury Tales Project) | 30 July    | proposed testing Torchio on materials from the Canterbury Tales Project, beginning with the [*General Prologue*](https://talesofcanterbury.org/GP/) transcription and its collation materials; he also pointed to O’Donnell et al. 2019                                                                                           | real-world cases; the contrast corpus; References                                  |
| Tiziana Mancinelli (VeDPH)                | 30 July    | proposed a connection with [DiScEPT](https://istituto-italiano-di-studi-germanici.github.io/DiScEPT/) for parallel texts and aligned translations                                                                                                                                                                                 | agenda item 5                                                                      |
| Giulio Quaresima                          | 30 July    | raised the question of source exposure and recalled [TEI Boilerplate](https://github.com/TEI-Boilerplate/TEI-Boilerplate), previously used by [ELA](https://ela.unisi.it/)                                                                                                                                                        | USAGE; the survey above                                                            |
| Federico Boschetti (CNR-ILC)              | 31 July    | reviewed the product together with the project author, prompting further reflection on the NLP workflow and on possible pipeline errors when the editor modifies Excel files produced or used during the different processing stages                                                                                              | NLP workflow; pipeline control; tracking and validation of editorial interventions |


## State of the prototype (1 August 2026)

The prototype in this repository: dependency-free XML parser; class map
generated from P5 with ODD overlay and a full-coverage test; deterministic
edition model; multi-page sites (edition, text, front and back matter with
labels taken from the markup, indices, map, data, free Markdown pages with
tables and local images); collections with a sortable, filterable register
and one page per document; structural sections of long texts as pages with a
table of contents; apparatus popup on the lemma; transcription levels, with
every `choice` pair openable on click; notes that fill both margins, each
taking the side that carries it closest to its mark, collapsing to their
marks only where the margins cannot hold them; an analytical section (Lab)
with lexicon, total concordance, frequencies, indices, lemmas and map; three
themes with verified contrast; interface in Italian and English; exports of
the model, the entities and the apparatus, which for a large archive become a
box that points at one file per document so that both levels stay legible;
georeferencing of places against GeoNames and Pleiades with the editor in the
loop, every coordinate a suggestion carrying its source; canonical alignment
across the documents of a collection, with the classical apparatus band
derived under the edited text; the same press as a single self-contained page
in the browser, which locates ancient places offline against a compact
Pleiades index. An edition whose parts live in sibling folders is gathered as
one. The test suite is run at every change, and the assertions it counts are
recorded with each release in [CHANGELOG.md](CHANGELOG.md): a number that
moves several times a day does not belong in a document meant to be cited.

Nine demonstration editions with rights verified or granted: the Odyssey
(Perseus), thirty Van Gogh letters (Van Gogh Museum and Huygens ING), the
Bellum Alexandrinum (Digital Latin Library, with a three-register critical
apparatus), two editions by Paolo Monella offered by their editor as test
cases (the Chronicon of Romualdus Salernitanus and the graphematic
transcription of Ursus Beneventanus, with its table of signs), the General
Prologue of the Canterbury Tales (54 witnesses and the full collation,
offered by Peter Robinson as a temporary test case), a volume of the
Frankenstein notebooks (Shelley-Godwin Archive, a documentary transcription
with hands and writing operations), texts from the Eurasian Latin Archive
(University of Siena) and a constructed Specimen for teaching purposes.

Beyond the demonstrations, the sampling frame has been rebuilt from both
catalogues of the field (`corpus-frame.csv`: 1156 editions, of which 124
appear in both), and the chain that fetches and measures it is in place
(`tools/catalogues.js`, `tools/harvest.js`, `tools/measure-corpus.js`). The
first editions taken from it and pressed without configuration, none of them
seen before by the engine, are recorded in `corpus-results.csv`, where every
row states that the verification was done by machine, with the date and the
version that did it.

## Agenda

The day-to-day development agenda, with its open debts, lives in
[ROADMAP.md](ROADMAP.md); how archives and collections are handled, and what
is not yet handled, in [COMPLEX.md](COMPLEX.md). The longer arcs:

1. **The in-browser configurator**: published (the press at
   <https://emmcarbe.github.io/torchio/press/>): drop your TEI files, choose
   pages, theme and pieces with immediate preview, download the ready
   repository. No upload to any server. What remains of it is refinement,
   recorded in the roadmap.
2. **The archive as a structural type**: an archive whose items are
   themselves scholarly editions, each with its own editor and its own
   apparatus, is the shape of ALIM, of the Eurasian Latin Archive and of
   much else. Indexing the first level, descending into the second and
   connecting the two is what makes it possible to take in large existing
   archives rather than one edition at a time.
3. **The plugin API** as web components of fruition (from Del Grosso), with
   the manifest declaring them.
4. **The apparatus DSL** (Euporia line): the apparatus written in the
   compact notation of the print tradition, compiled into the model. Input
   is not only XML: the model is the pivot, serializations are adapters.
5. **The derived layer**: linguistic and semantic annotation kept per
   occurrence, in files beside the edition, so that a single document is a
   view, a subcorpus is a set of documents, and quantitative results
   compose. Entity pages with stable identifiers; the semantics the edition
   already declares (`@ana`, `listRelation`) rendered rather than dropped.
6. **The suggester** (RAG): for constructs without behaviour, retrieval from
   the glosses and examples of the `p5subset`, from the specification and
   from the corpus, with proposals of renderings; for semantic conformance,
   flagging of likely duplicates by comparing the ODD descriptions with
   those of the 588 P5 elements. Always at composition time, always
   materialized, always with provenance.
7. **Advanced collections**: timelines, networks, witness synopses, the text
   of a single witness derived from the model, and the alignment of parallel
   texts and translations (the [DiScEPT](https://istituto-italiano-di-studi-germanici.github.io/DiScEPT/) line, with T. Mancinelli).
8. **The conformance report** integrated in the CI (strict: the build fails
   on the syntactic layer, requires written confirmation on the semantic
   one).
9. **The measurement**: take the TEI of published editions and press them
   without configuration. The frame and the chain exist; what remains is to
   run it at scale and publish the figure.

## Audits

**30 July 2026, 22:00. First machine audit**, run in parallel by four
assistants (GPT-5.6 Sol, GPT-5.5, Claude Opus 5, Claude Sonnet 5) reading the public
repository, and verified here by reproducing each claim against the code
before touching anything.

The three reports converge on one finding, and it is real: **editorial data
could become executable code**. Reproduced with a TEI file whose attributes
carry a `&quot;`: the value escaped its HTML attribute and the pressed page
gained a working event handler. The cause was one escaping function used for
both text and attributes, escaping `&`, `<` and `>` but not the quotes. This
had been true of every edition pressed until now.

Fixed the same evening:

- escaping covers quotes as well, so an attribute value cannot close its own
  attribute (this alone closes the reproduced path);
- data serialized into a `<script>` block has `<`, `>` and the line
  separators neutralized, so a `</script>` inside a place name cannot close
  the block;
- map popups receive a text node, not a string of HTML;
- the in-browser press runs its preview in a sandboxed frame with no
  same-origin access, and accepts navigation messages only from that frame;
- an XInclude or an extra page cannot point outside the edition's own
  directory, and remote references are refused;
- the local preview server binds to the loopback interface only and confines
  paths by canonical root, not by string prefix;
- two hostile fixtures joined the test suite, asserting the invariant that
  states the matter better than any patch: **editorial data stays data,
  never code**.

**Second round, the same night**, with the repository cloned and run. It
confirmed the first finding and added three that are as much editorial as
technical: the TEI structure was leaving as undifferentiated `div`s, so a
heading was a heading only by the look of it (C55); the brackets of an
integration and the mark of a lacuna were drawn by the stylesheet, so they
disappeared from copied text and from screen readers (C56); and URLs taken
from the edition reached `href` unchecked (C57). The first two are the ones
that matter here: the layer that survives longest is the markup of the page
itself, and it was the one not being used.

**Third round**, the deepest, went through the TEI conformance of the
apparatus and found what matters most to an edition: a conjecture has no
witness, and its authority (`@source`, `@resp`) was being dropped, so 373
attributed readings of the Bellum Alexandrinum arrived anonymous (C58);
readings grouped in `rdgGrp`, and readings in an `app` with no `lem`, were
not shown at all, which is the first principle broken on known elements
rather than unknown ones (C59). It also caught the register's own
bookkeeping: two rows shared a number and the totals no longer matched the
table (C63). Fixed, with the numbering now derived from the table.

**Fourth round, 1 August 2026**, by machine again: specialist agents, all
automatic, each reading the working tree with a different brief:
architecture, code, the literature of the field, TEI conformance, the
semantic layer, typography, the language of the documents, teaching,
preservation, philology. Their findings were verified here against the code
before anything was changed. The worst was invisible until named: six
regular expressions lost a backslash on their way through the template that
builds the interactive layer, so the routine meant to normalize whitespace
was deleting the letter "s" from every text it quoted.

The review also found the register itself counting intentions as
realizations: six early entries were recorded as applied and were not in the
engine, and they are now open, each with what the verification found. One
sentence of the laboratory overstated its own measurement, saying that 1710
of the Guidelines' examples conserved their text exactly, where 1710 is the
number of examples that carry text at all, the test is a declared threshold
of one half, and the examples conserving their text exactly are three (C92).
The term "contrast corpus" was naming three different things, and they are
now named apart (C102).

Pressing real editions produced what curated demonstrations could not. An
edition whose parts live in sibling folders could not be pressed at all, and
the press now gathers what is below when the surface holds no TEI: the
Akademieprotokolle went from a partial pressing with no people to 253
sessions with 2830 persons and 272 places (C106). A large archive could not
be exported at all, and the model and the token stream now travel as a box
that points at one file per document, so that the archive's level and each
document's both survive (C107, found on ALIM's 403 literary works). Recorded
open: `meeting` unread, so a register of dated sessions shows shelf numbers
(C105); an archive whose items are themselves editions is not yet a
structural type (C108); gazetteer matching has no notion of language, and on
early modern German it proposed towns for common words (C104).

What the audits raise and remains open: the XML parser is deliberately
minimal and its supported profile should be stated rather than implied;
validation of the TEI against the ODD belongs in the edition's CI and is not
performed by the press; the CLI is tolerant where CI should be strict;
facsimiles are not yet rendered; behaviour is assigned by class but the
section a class resolves to does not yet carry rendering of its own;
pressing scales at roughly a hundred times the size of the source, so a very
large archive still needs care; the browser press and the command line have
drifted apart in what each applies. These are recorded here, not resolved.

## Materials and rights

MIT code. Class data generated from the `p5subset` (TEI Consortium, dual
licence CC BY 3.0 / BSD-2). Demos: Odyssey from the [Perseus Digital Library](https://github.com/PerseusDL/canonical-greekLit)
(CC BY-SA 4.0); [Van Gogh letters](https://vangoghletters.org/) from the Van Gogh Museum and Huygens ING
via [e-editiones](https://github.com/eeditiones/vangogh) (CC BY-NC-SA 4.0). Geographic lookups on data derived from
[GeoNames](https://www.geonames.org/) (CC BY 4.0) and [Pleiades](https://pleiades.stoa.org/) (CC BY) for the ancient world;
map coastlines from [Natural Earth](https://www.naturalearthdata.com/) (public domain); the
map page uses [Leaflet](https://leafletjs.com/) (BSD-2, bundled) and tiles © OpenStreetMap
contributors (ODbL). The contrast corpus is declared as a dataset and not
redistributed. The sampling frame is [`corpus-frame.csv`](corpus-frame.csv):
1156 editions merged from the two catalogues of the field, the *Catalogue of
Digital Editions* (Greta Franzini et al., CC BY-SA) and the *Catalog of
Digital Scholarly Editions* (Patrick Sahle et al., CC BY 4.0), of which 124
appear in both; [`corpus.csv`](corpus.csv) keeps the earlier selection of 95
editions with downloadable XML, extracted on 29 July 2026 from the first
catalogue alone. Where an edition has been fetched and pressed, the outcome
is in [`corpus-results.csv`](corpus-results.csv), each row stating that the
verification was made by machine, with the date and the version that made
it. The editions' own files are not redistributed here: each stays under its
own rights, at its own address.

## References

- Andorfer, Peter. 2026. "Digitale Editionen als statische Webseiten. Zur
  nachhaltigen Publikation TEI-XML-basierter Editionen mit dem
  dse-static-cookiecutter." *Zeitschrift für digitale Geisteswissenschaften*
  11. https://doi.org/10.17175/2026_003.
- Bauman, Syd. 2011. "Interchange vs. Interoperability." In *Proceedings of
  Balisage: The Markup Conference 2011*. Balisage Series on Markup
  Technologies 7. https://doi.org/10.4242/BalisageVol7.Bauman01.
- Cummings, James. 2019. "A World of Difference: Myths and Misconceptions
  about the TEI." *Digital Scholarship in the Humanities* 34
  (Supplement 1): i58-i79. https://doi.org/10.1093/llc/fqy071.
- Flanders, Julia, and Scott Hamlin. 2013. "TAPAS: Building a TEI Publishing
  and Repository Service." *Journal of the Text Encoding Initiative* 5.
  https://doi.org/10.4000/jtei.788.
- Holmes, Martin, and Joey Takeda. 2023. "From Tamagotchis to Pet Rocks: On
  Learning to Love Simplicity through the Endings Principles." *Digital
  Humanities Quarterly* 17 (1).
  https://www.digitalhumanities.org/dhq/vol/17/1/000668/000668.html.
- O'Donnell, Daniel Paul, Gurpreet Singh, Dot Porter, Roberto Rosselli Del
  Turco, Marco Callieri, Matteo Dellepiane, and Roberto Scopigno. 2019.
  *Publishing (and Forgetting) the Small or Medium-Sized Scholarly Edition
  or Cultural Heritage Collection as Linked Open Data: Using Zenodo and
  GitHub to Publish the Visionary Cross Project*. Slides.
  https://doi.org/10.5281/zenodo.3338457.
- Pierazzo, Elena. 2011. "A Rationale of Digital Documentary Editions."
  *Literary and Linguistic Computing* 26 (4): 463-477.
  https://doi.org/10.1093/llc/fqr033.
- Risam, Roopika, and Alex Gil. 2022. "Introduction: The Questions of
  Minimal Computing." *Digital Humanities Quarterly* 16 (2).
  https://doi.org/10.63744/b49fzhuz9hhz.
- Turska, Magdalena. 2017. "TEI Simple Processing Model: An Abstraction
  Layer for XML Processing." In *Advances in Digital Scholarly Editing:
  Papers Presented at the DiXiT Conferences in The Hague, Cologne, and
  Antwerp*, edited by Peter Boot, Anna Cappellotto, Wout Dillen, Franz
  Fischer, Aodhán Kelly, Andreas Mertgens, Anna-Maria Sichani, Elena
  Spadini, and Dirk Van Hulle, 361-364. Leiden: Sidestone Press.
  https://cceh.uni-koeln.de/wp-content/uploads/2021/06/Advances-in-Digital-Scholarly-Editing-2017.pdf.
- Turska, Magdalena, James Cummings, and Sebastian Rahtz. 2016. "Challenging
  the Myth of Presentation in Digital Editions." *Journal of the Text
  Encoding Initiative* 9. https://doi.org/10.4000/jtei.1453.
- Zenzaro, Simone, Angelo Mario Del Grosso, Federico Boschetti, and Graziano
  Ranocchia. 2025. "CoPhiEditor: The DSL-Based DSE Methodology within the
  ERC Advanced Grant 885222-GreekSchools." *Umanistica Digitale* 9 (20):
  31-56. https://doi.org/10.6092/issn.2532-8816/21231.
