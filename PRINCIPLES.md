# Torchio. Principles of a project in the making

First document, 30 July 2026. It records the state of the project at the
moment of its publication on GitHub and opens the phase of collaboration,
revision and implementation.

## Origin

The idea was born on the afternoon of 29 July 2026 at the VeDPH, out of one
of the countless conversations of Emmanuela Carbé with Federico Boschetti and
then with Angelo Mario Del Grosso (CNR-ILC «A. Zampolli»). That evening
Emmanuela Carbé tried to work out some principles for a simple, reusable
project that would address some problems of the main visualization systems
for digital editions. She built a prototype with the assistance of Claude
(Anthropic), model Fable 5; on the morning of 30 July Del Grosso proposed
some substantial adjustments, which were adopted and are documented below.
With this publication the ball passes to Boschetti and Del Grosso, and to
anyone who wants to join: to review the principles, contest them, improve
them. The working language of the project is English, so that collaboration
is not restricted to Italian speakers; the founding conversations took place
in Italian.

## Why

1. **Tools are dictating editorial practice.** Many digital scholarly
   editions are encoded with an eye to what the viewer can display, that is,
   to the list of tags the tool accepts. The relationship is upside down:
   the data model should govern the interface, not the other way round.
2. **Sustainability is the open problem.** Editions published on application
   servers die with their servers. From the census of the Catalogue of
   Digital Editions (Franzini): of 358 recorded editions, 242 declare a TEI
   transcription, but only 104 publish the source XML, and 95 are still
   online. Two TEI editions out of three do not provide their source.
   -> This figure comes from a census run with Claude, and should therefore
   be verified. The sustainability problem is in any case familiar to
   everyone working in this field.
3. **The classic pipeline is a funnel.** TEI to XSLT to HTML: the stylesheet
   destroys the model at the border. Months of semantic encoding flattened
   into presentational markup that can no longer be queried. The resulting
   HTML is a dead end: readable, but dead as data.

## What already exists

A first survey, to be deepened and corrected.

- **EVT 2** is the most widely used tool in Italy and among the best known
  internationally. It rests on AngularJS, unsupported since 2021. **EVT 3**
  is in beta, with the migration under way. The tool is continuously
  developed and remains one of the most important visualization projects.
- **CETEIcean** (TEI-C) renders every TEI element as a custom element in the
  browser, without conversion: guaranteed rendering, with some limits: no
  apparatus, indices, facsimile, export.
- **TEI Publisher** (e-editiones) has a static route, but generating it
  still requires a running instance.
- **dse-static-cookiecutter** (ACDH-CH, Vienna) is the project closest to
  this one: XSLT plus GitHub Actions plus Pages, with indices and maps, used
  for dozens of editions. It requires a developer's toolchain, though; the
  interface comes from templates to be adapted, and there is no reusable
  data model.

## The principles

1. **Nothing is ever invisible.** Every well-formed TEI document must be
   preserved in the visualization too, because every sign represents a
   precise choice. Unknown constructs fall back on a guaranteed base
   rendering, and yet they are not discarded. On an invalid document the
   engine degrades, it does not break: validation belongs to the CI of the
   edition's repository.
2. **Behaviour lives on classes, not on tags.** The TEI has more than 500
   elements but organizes them into a few dozen model classes. Rendering
   rules are written per class; elements inherit. The map is generated from
   the official `p5subset` (P5 4.12.0: 588 elements, 127 model classes, 86
   attribute classes, 35 datatypes) and full coverage is an automated test,
   re-runnable at every TEI release. Never example-driven development:
   examples are test cases, not the specification.
3. **The ODD decides, not the tool.** The edition's ODD customization is its
   configuration: the modules included, the elements excluded, and above all
   the custom elements, which, once declared `memberOf` a TEI class, inherit
   its behaviour without a line of code. Conformance has two layers: the
   syntactic one can be decided mechanically; the semantic one (an extension
   is legitimate only for phenomena P5 does not cover) requires judgement,
   and the tool must flag it.
4. **The edition is the model.** The engine turns the TEI into a documented
   data model (documents, entity registries, witnesses, hands, layers, typed
   apparatuses); every page and every export (XML, CSV, JSON) is a
   projection of the model. Same XML, same model, byte for byte.
5. **No backend.** The repository is the edition: git for versions, CI for
   validation, static hosting for publication, an archive with a DOI for
   preservation. The same code runs in the browser and in Node. Whoever
   publishes can of course clone.
6. **The markup decides existence; the manifest decides the optional
   settings.** Pages and functions exist if the markup substantiates them
   (an edition without an apparatus has no apparatus button; a registry
   without occurrences generates no index). A small optional `torchio.json`
   decides presence, order, labels, theme, language, free pages in Markdown.
7. **The ladder of four rungs.** The visualizations of all possible TEI
   universes cannot be established in advance. The system holds because it
   degrades: base rendering (guaranteed), class behaviour (most cases),
   designed pieces (apparatus, indices, maps...), and, for the tail, a
   suggester that proposes. Every automatic proposal materializes into an
   explicit rule approved by the editor, with declared provenance: never
   decisions at reading time.
8. **The editor in the loop.** Entity reconciliation (places with GeoNames,
   people and institutions with authority identifiers) produces a file of
   proposals next to the TEI: the machine proposes, the editor confirms,
   corrects or rejects, and editorial decisions survive regeneration.
   Coordinates declared in the TEI always win; every datum carries its
   provenance, visibly too.
9. **Accessibility.** WCAG AA contrast asserted in the test suite for every
   theme, keyboard access to every function, landmarks and dialog semantics.
   A generated edition must be publishable by a public institution as it is.
10. **Forms before categories.** The internal, universal analyses concern
    forms (concordances, frequencies), valid for every language. The lemma
    is not a universal: not all languages lemmatize. Every grouping of forms
    (lemma, stem, root, graphic normalization) is an adapter that declares
    its strategy per edition.
11. **Curation above, completeness below.** Pages expose curated summaries
    (the edition record, the register of documents), but the full data
    always remains reachable: the TEI header is rendered in its entirety,
    with labels derived from the markup, so that new metadata appear without
    any change to the interface.
12. **Everything is reversible and attributed.** MIT code, data sources
    declared, contributions acknowledged.
13. **The thesis is falsifiable.** The project bets that the corrections
    required by new editions will decrease with use, genre by genre, and
    that they will remain assignment corrections or extensions, without
    repeated changes to existing engine behaviour. There is no need to
    believe it: it is measured. Every correction is recorded in
    [CORRECTIONS.md](CORRECTIONS.md) with date, edition and type. If, after
    a reasonable number of editions of a genre, the corrections for that
    genre do not decrease, or if structural changes become frequent, the
    thesis is falsified, and it will be written here.

## The method

**The specification comes from the class system; the corpus corrects it.**
The classes-to-behaviours table was written starting from the Guidelines and
the `p5subset`, never from examples.

Examples were collected to form a kind of **contrast corpus**: from the
Catalogue of Digital Editions, 95 TEI editions with downloadable XML still
online were filtered; six cases were downloaded and analysed in full
(Faust-Edition, Shelley-Godwin Archive, the Thun correspondence, Italian
ELTeC, Italian DraCor, the Digital Latin Library's Bellum Alexandrinum:
7,692 files, 228 distinct elements).

The contrast produced thirteen corrections to the specification, among them:
hands as a first-class dimension (the most frequent element in the whole
corpus is `handNote`); the title page and paratexts, missing from the first
draft; witness lacunae, without which "every witness is a derivable text"
would constitute texts that do not exist; canonical citation; XInclude
resolution; non-canonical TEI roots.

**The workflow** proceeds by phases, each with a verifiable result:
specification; engine (parser, classes, ODD, model); composition (pages,
themes, manifest); pieces (apparatus, entities, levels, indices, maps,
exports); packaging (template repository and in-browser configurator); real
cases; scholarly publication.

## The adjustments of Angelo Mario Del Grosso (30 July, morning)

1. **Web components are abstract behaviours of fruition**, not TEI elements:
   reusable components (popup, toggle, synopsis, facsimile) that any markup
   can activate. No per-tag granularity.
2. **Conformance must be judged on two layers.** A custom element can be
   syntactically legitimate (own namespace, declared in the ODD) and
   semantically illegitimate if it duplicates a phenomenon P5 already
   covers. The first example used in the tests (`cancellatura`, which
   duplicated `del`) was exactly this mistake: it was replaced with
   `salvataggio`, the autosave layer in born-digital manuscripts, which P5
   does not cover. The error lands on the editor at press time, never on the
   reader.

## State of the prototype (30 July 2026)

The prototype in this repository: dependency-free XML parser; class map
generated from P5 with ODD overlay and a full-coverage test; deterministic
edition model; multi-page sites (edition, text, front and back matter,
indices, map, data, free pages); collections with a sortable, filterable
register and one page per document; structural sections of long texts as
pages with a table of contents; apparatus popup on the lemma; transcription
levels; three themes with verified contrast; interface in Italian and
English; exports of the model, the entities and the apparatus;
reconciliation of places against a GeoNames gazetteer with the editor in the
loop. The test suite counts 108 assertions. Four demonstration editions with
verified rights: the Odyssey (Perseus), thirty Van Gogh letters (Van Gogh
Museum and Huygens ING), the Bellum Alexandrinum (Digital Latin Library,
with a three-register critical apparatus) and a constructed Specimen for
teaching purposes.

## Agenda

1. **The in-browser configurator**: drop your TEI files, choose pages, theme
   and pieces with immediate preview, download the ready repository. No
   upload to any server.
2. **The plugin API** as web components of fruition (from Del Grosso), with
   the manifest declaring them.
3. **The apparatus DSL** (Euporia line): the apparatus written in the
   compact notation of the print tradition, compiled into the model. Input
   is not only XML: the model is the pivot, serializations are adapters.
4. **The suggester** (RAG): for constructs without behaviour, retrieval from
   the glosses and examples of the `p5subset`, from the specification and
   from the corpus, with proposals of renderings; for semantic conformance,
   flagging of likely duplicates by comparing the ODD descriptions with
   those of the 588 P5 elements. Always at composition time, always
   materialized, always with provenance.
5. **Concordances and frequencies of forms** (native Unicode tokenization),
   with grouping strategies declared per edition.
6. **Advanced collections**: timelines, networks, witness synopses, the text
   of a single witness derived from the model.
7. **The conformance report** integrated in the CI (strict: the build fails
   on the syntactic layer, requires written confirmation on the semantic
   one).
8. **Tests**: take the TEI of published editions and press them without
   configuration.

## Materials and rights

MIT code. Class data generated from the `p5subset` (TEI Consortium, dual
licence CC BY 3.0 / BSD-2). Demos: Odyssey from the Perseus Digital Library
(CC BY-SA 4.0); Van Gogh letters from the Van Gogh Museum and Huygens ING
via e-editiones (CC BY-NC-SA 4.0). Geographic lookups on data derived from
GeoNames (CC BY 4.0); map coastlines from Natural Earth (public domain); the
map page uses Leaflet (BSD-2, bundled) and tiles © OpenStreetMap
contributors (ODbL). The contrast corpus is not included in the repository:
the list of the 95 editions and the method are described above and
reproducible.
