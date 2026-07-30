<img src="docs/torchio-lockup.svg" alt="Torchio" width="400">

# Torchio. Principles of a project in the making

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
solutions. The project is open to anyone who wants to join: to review the
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
   the figures here come from the structured data of the latter: of 358 recorded editions, 242 declare a TEI
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

A first survey, to be deepened and corrected. It records architectural
positions, one representative each, not every existing tool.

- **[EVT 2](https://evt.labcd.unipi.it/)** is the most widely used tool in Italy and among the best known
  internationally. It rests on AngularJS, unsupported since 2021. **EVT 3**
  is published as a pre-release (currently 1.0.0-beta), with the migration
  to Angular under way. The tool is continuously
  developed and remains one of the most important visualization projects.
- **[CETEIcean](https://github.com/TEIC/CETEIcean)** (TEI-C) renders every TEI element as a custom element in the
  browser, without conversion: guaranteed rendering, with some limits: no
  apparatus, indices, facsimile, export.
- **[TEI Publisher](https://teipublisher.com/)** (e-editiones) has a static route, but generating it
  still requires a running instance.
- **[TEI Boilerplate](https://github.com/TEI-Boilerplate/TEI-Boilerplate)** (John Walsh) makes a TEI file render itself in the
  browser, through an XSLT stylesheet linked from the document itself: no
  build, no server. It is the earliest statement of the self-rendering
  document, and a direct ancestor of this project's in-browser route.
- **[dse-static-cookiecutter](https://github.com/acdh-oeaw/dse-static-cookiecutter)** (ACDH-CH, Vienna) is the project closest to
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
   edition's repository (CI, continuous integration: the automated checks
   a repository runs at every change).
2. **Behaviour lives on classes, not on tags.** The TEI has more than 500
   elements but organizes them into a few dozen model classes. Rendering
   rules are written per class; elements inherit. The map is generated from
   the official [`p5subset`](https://tei-c.org/Vault/P5/current/xml/tei/odd/p5subset.xml) (P5 4.12.0: 588 elements, 127 model classes, 86
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
10. **Forms before categories.** Built-in analyses operate on attested
    forms (concordances, frequencies), which exist in every written
    tradition. Grouping forms into more abstract units (lemma, stem, root,
    normalized spelling) depends on the language and on editorial choices,
    so it is not built in: each edition declares its own grouping strategy,
    and the press applies it as an adapter.
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
([Faust-Edition](https://faustedition.net/), [Shelley-Godwin
Archive](http://shelleygodwinarchive.org/), the [Thun
correspondence](https://thun-korrespondenz.acdh.oeaw.ac.at/), [Italian
ELTeC](https://github.com/COST-ELTeC/ELTeC-ita), [Italian
DraCor](https://dracor.org/ita), the Digital Latin Library's [Bellum
Alexandrinum](https://github.com/digitallatin/caesar-balex): 7,692 files,
228 distinct elements).

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

## Contributions received outside the repository

Substantive contributions arriving by mail and messaging, before or beside
the repository itself. One line per contribution.

| Who | Date | Contribution | Where it landed |
|---|---|---|---|
| Federico Boschetti (CNR-ILC) | 29-30 July | the founding remark; early feedback | Origin; the apparatus DSL in the agenda |
| Angelo Mario Del Grosso (CNR-ILC) | 30 July | two remarks: web components at the level of fruition behaviours, not TEI elements; extensions only for phenomena the Guidelines do not cover (which led to replacing the test example: `cancellatura`, duplicating `del`, gave way to `salvataggio`) | principle 3; agenda 2 and 7; the test suite |
| Franz Fischer (VeDPH) | 30 July | the complexity question: does the class approach hold for non-standardized TEI? | principle 13 is the standing answer |
| Paolo Monella | 30 July | the "sustainability by design" reading; the live vs one-off architecture question; a per-element rendering override request; offered Orso and Romualdo as test cases (open licence) | USAGE; desiderata; the contrast corpus |
| Peter Robinson (Canterbury Tales Project) | 30 July | offered the [General Prologue](https://talesofcanterbury.org/GP/) transcription and collation materials; pointed to O'Donnell et al. 2019 | the contrast corpus; References |
| Tiziana Mancinelli (VeDPH) | 30 July | proposed connecting [DiScEPT](https://istituto-italiano-di-studi-germanici.github.io/DiScEPT/) (parallel texts and aligned translations) | agenda 6 |
| Giulio Quaresima | 30 July | first star; the source-exposure question; recalled [TEI Boilerplate](https://github.com/TEI-Boilerplate/TEI-Boilerplate), which [ELA](https://ela.unisi.it/) had already used | USAGE; the survey above |
| Christian D'Agata | 30 July | endorsement of versioning and sustainability at design time | — |

## State of the prototype (30 July 2026)

The prototype in this repository: dependency-free XML parser; class map
generated from P5 with ODD overlay and a full-coverage test; deterministic
edition model; multi-page sites (edition, text, front and back matter with
labels taken from the markup, indices, map, data, free Markdown pages with
tables); collections with a sortable, filterable register and one page per
document; structural sections of long texts as pages with a table of
contents; apparatus popup on the lemma; transcription levels, with every
`choice` pair openable on click; margin notes that collapse to their marks
past a density threshold and light the passage they refer to; three themes
with verified contrast; interface in Italian and English; exports of the
model, the entities and the apparatus; reconciliation of places against a
GeoNames gazetteer with the editor in the loop; the same press as a single
self-contained page in the browser. The test suite counts 126 assertions.
Six demonstration editions with verified rights: the Odyssey (Perseus),
thirty Van Gogh letters (Van Gogh Museum and Huygens ING), the Bellum
Alexandrinum (Digital Latin Library, with a three-register critical
apparatus), two editions by Paolo Monella offered by their editor as test
cases (the Chronicon of Romualdus Salernitanus and the graphematic
transcription of Ursus Beneventanus, with its table of signs) and a
constructed Specimen for teaching purposes.

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
   of a single witness derived from the model, and the alignment of parallel
   texts and translations (the [DiScEPT](https://istituto-italiano-di-studi-germanici.github.io/DiScEPT/) line, with T. Mancinelli).
7. **The conformance report** integrated in the CI (strict: the build fails
   on the syntactic layer, requires written confirmation on the semantic
   one).
8. **Tests**: take the TEI of published editions and press them without
   configuration.

## Materials and rights

MIT code. Class data generated from the `p5subset` (TEI Consortium, dual
licence CC BY 3.0 / BSD-2). Demos: Odyssey from the [Perseus Digital Library](https://github.com/PerseusDL/canonical-greekLit)
(CC BY-SA 4.0); [Van Gogh letters](https://vangoghletters.org/) from the Van Gogh Museum and Huygens ING
via [e-editiones](https://github.com/eeditiones/vangogh) (CC BY-NC-SA 4.0). Geographic lookups on data derived from
[GeoNames](https://www.geonames.org/) (CC BY 4.0); map coastlines from [Natural Earth](https://www.naturalearthdata.com/) (public domain); the
map page uses [Leaflet](https://leafletjs.com/) (BSD-2, bundled) and tiles © OpenStreetMap
contributors (ODbL). The contrast corpus is not included in the repository:
the list of the 95 editions and the method are described above and
reproducible.

## References

- Zenzaro, Simone, Angelo Mario Del Grosso, Federico Boschetti, and Graziano
  Ranocchia. 2025. "CoPhiEditor: The DSL-Based DSE Methodology within the
  ERC Advanced Grant 885222-GreekSchools." *Umanistica Digitale* 9 (20):
  31-56. https://doi.org/10.6092/issn.2532-8816/21231.
- O'Donnell, Daniel Paul, Gurpreet Singh, Dot Porter, et al. 2019.
  *Publishing (and Forgetting) the Small or Medium-Sized Scholarly Edition
  or Cultural Heritage Collection as Linked Open Data: Using Zenodo and
  Github to Publish the Visionary Cross Project.*
  https://doi.org/10.5281/ZENODO.3338457. (Suggested by Peter Robinson.)
