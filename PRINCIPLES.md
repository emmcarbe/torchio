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
   destroys the model at the border. Months of semantic encoding flattened
   into presentational markup that can no longer be queried. The resulting
   HTML is a dead end: readable, but dead as data.

## What already exists

A first survey, to be deepened and corrected. It records architectural
positions, one representative each, not every existing tool.

- **[EVT 2](https://evt.labcd.unipi.it/)** is the most widely used tool in Italy and among the best known
  internationally. It rests on AngularJS, unsupported since 2021. **[EVT 3](https://github.com/evt-project/evt-viewer-angular)**
  is published as a pre-release (currently 1.0.0-beta), with the migration
  to Angular under way. The tool is continuously
  developed and remains one of the most important visualization projects.
- **[CETEIcean](https://github.com/TEIC/CETEIcean)** (TEI-C) renders every TEI element as a custom element in the
  browser, without conversion: guaranteed rendering, with some limits: no
  apparatus, indices, facsimile, export.
- **[TEI Publisher](https://teipublisher.com/)** (e-editiones) implements the
  **TEI Processing Model** (Turska, Cummings and Rahtz, 2016), where the ODD
  carries not only the schema but the behaviour: `<model behaviour="...">`
  declares how a construct is to be rendered, and the tool executes it. This
  is the direct ancestor of principle 4, and the position Torchio has to
  distinguish itself from. The differences are three: behaviour is assigned
  to model classes rather than to individual elements, so an edition
  inherits without declaring anything; coverage of the whole P5 is asserted
  by the test suite rather than promised; and there is no runtime, since the
  static route of TEI Publisher still requires a running instance to
  generate it.
- **[TEI Boilerplate](https://github.com/TEI-Boilerplate/TEI-Boilerplate)** (John Walsh) makes a TEI file render itself in the
  browser, through an XSLT stylesheet linked from the document itself: no
  build, no server. It is the earliest statement of the self-rendering
  document, and a direct ancestor of this project's in-browser route.
- **[dse-static-cookiecutter](https://github.com/acdh-oeaw/dse-static-cookiecutter)** (ACDH-CH, Vienna) is the project closest to
  this one: XSLT plus GitHub Actions plus Pages, with indices and maps, used
  for dozens of editions. It requires a developer's toolchain, though; the
  interface comes from templates to be adapted, and there is no reusable
  data model.

## The wager

Bauman (2011) argued that interoperability of arbitrary TEI documents is
impossible in the general case, and that position has held the field for
fifteen years. This project is an empirical answer to it: what cannot be
recovered at the level of elements may be recoverable at the level of model
classes, because a class is where the Guidelines already say what a
construct is like. The measure is stated and not yet taken: the share of
the 95 editions of the contrast corpus that press without configuration.
A high number is a partial refutation with figures; a low one is a negative
result, and nobody has measured it either way.

## The principles

1. **No tradition is the default.** A scholarly edition is not a neutral
   object: it is the product of an editorial tradition, a community with
   its own method, its own vocabulary, and its own idea of what an edition
   is. The levels a tradition distinguishes are theoretical positions, not
   synonyms: the Italian tradition opposes *edizione diplomatica* and
   *edizione interpretativa*; anglophone documentary and genetic editing
   speaks of *diplomatic transcription* and *reading text*; between and
   beyond them live semi-diplomatic transcriptions, *Lesetexte*,
   constituted texts, and the distinct apparatus cultures that come with
   them. A viewer that silently imposes one vocabulary imports one
   tradition’s theory into every edition it renders: it is the same
   inversion this project exists to oppose (tools dictating editorial
   practice: see Why, 1), moved from the encoding to the reading surface.
   Hence the rule, stated first because every other principle answers to
   it: the tool adapts to the tradition, never the reverse. This is not
   neutrality, which does not exist here: it is a discipline the tool
   imposes on itself. Whatever it renders, names or derives must be
   answerable to the tradition the edition belongs to, and nothing
   tradition-bound may enter the core disguised as universal. Where a
   generic surface cannot do a tradition justice, the tool must go
   further and decline itself into that tradition: a declension for
   Italian textual criticism, another for documentary and genetic
   editing, others for the communities that claim their own forms — and
   every declension is explicit and declared, in the interface and in
   the record of the edition, never assumed silently. Universality, here,
   does not mean one form for everyone: it means the capacity to take
   the form of each tradition, saying openly which form is being worn;
   and where the tool cannot yet speak a tradition’s language, that is a
   correction to file in the register, never a constraint on the
   edition.
2. **Nothing is lost a second time.** Transcription is necessarily
   selective: where to stop is the editor's decision, taken while encoding
   (Pierazzo 2011). The press does not get to lower that threshold again.
   Whatever the edition chose to record must survive into the pages, because
   every sign there represents a decision already taken. Unknown constructs fall back on a guaranteed base
   rendering, and yet they are not discarded. On an invalid document the
   engine degrades, it does not break: validation belongs to the CI of the
   edition's repository (CI, continuous integration: the automated checks
   a repository runs at every change).
3. **Behaviour lives on classes, not on tags.** The TEI has more than 500
   elements but organizes them into a few dozen model classes. Rendering
   rules are written per class; elements inherit. The map is generated from
   the official [`p5subset`](https://tei-c.org/Vault/P5/current/xml/tei/odd/p5subset.xml) (P5 4.12.0: 588 elements, 127 model classes, 86
   attribute classes, 35 datatypes) and full coverage is an automated test,
   re-runnable at every TEI release. Never example-driven development:
   examples are test cases, not the specification.
4. **The ODD decides, not the tool.** The edition's ODD customization is its
   configuration: the modules included, the elements excluded, and above all
   the custom elements, which, once declared `memberOf` a TEI class, inherit
   its behaviour without a line of code. Conformance has two layers: the
   syntactic one can be decided mechanically; the semantic one (an extension
   is legitimate only for phenomena P5 does not cover) requires judgement,
   and the tool must flag it.
5. **The edition is the model.** The engine turns the TEI into a documented
   data model (documents, entity registries, witnesses, hands, layers, typed
   apparatuses); every page and every export (XML, CSV, JSON) is a
   projection of the model. Same XML, same model, byte for byte.
6. **No backend.** The repository is the edition: git for versions, CI for
   validation, static hosting for publication, an archive with a DOI for
   preservation. The same code runs in the browser and in Node. Whoever
   publishes can of course clone.
7. **The markup decides existence; the manifest decides the optional
   settings.** Pages and functions exist if the markup substantiates them
   (an edition without an apparatus has no apparatus button; a registry
   without occurrences generates no index). A small optional `torchio.json`
   decides presence, order, labels, theme, language, free pages in Markdown.
8. **The ladder of four rungs.** The visualizations of all possible TEI
   universes cannot be established in advance. The system holds because it
   degrades: base rendering (guaranteed), class behaviour (most cases),
   designed pieces (apparatus, indices, maps...), and, for the tail, a
   suggester that proposes. Every automatic proposal materializes into an
   explicit rule approved by the editor, with declared provenance: never
   decisions at reading time.
9. **The editor in the loop.** Entity reconciliation (places with GeoNames,
   people and institutions with authority identifiers) produces a file of
   proposals next to the TEI: the machine proposes, the editor confirms,
   corrects or rejects, and editorial decisions survive regeneration.
   Coordinates declared in the TEI always win; every datum carries its
   provenance, visibly too.
10. **Accessibility.** WCAG AA contrast asserted in the test suite for every
   theme, keyboard access to every function, landmarks and dialog semantics.
   A generated edition must be publishable by a public institution as it is.
11. **Forms before categories.** Built-in analyses operate on attested
    forms (concordances, frequencies), which exist in every written
    tradition. Grouping forms into more abstract units (lemma, stem, root,
    normalized spelling) depends on the language and on editorial choices,
    so it is not built in: each edition declares its own grouping strategy,
    and the press applies it as an adapter.
12. **Curation above, completeness below.** Pages expose curated summaries
    (the edition record, the register of documents), but the full data
    always remains reachable: the TEI header is rendered in its entirety,
    with labels derived from the markup, so that new metadata appear without
    any change to the interface.
13. **Everything is reversible and attributed.** MIT code, data sources
    declared, contributions acknowledged.
14. **The thesis is falsifiable.** The project bets that the corrections
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
| Angelo Mario Del Grosso (CNR-ILC) | 30 July | two remarks: web components at the level of fruition behaviours, not TEI elements; extensions only for phenomena the Guidelines do not cover (which led to replacing the test example: `cancellatura`, duplicating `del`, gave way to `salvataggio`) | principle 4; agenda 2 and 6; the test suite |
| Franz Fischer (VeDPH) | 30 July | the complexity question: does the class approach hold for non-standardized TEI? | principle 14 is the standing answer |
| Paolo Monella | 30 July | the "sustainability by design" reading; the live vs one-off architecture question; a per-element rendering override request; offered Orso and Romualdo as test cases (open licence) | USAGE; desiderata; the contrast corpus |
| Peter Robinson (Canterbury Tales Project) | 30 July | offered the [General Prologue](https://talesofcanterbury.org/GP/) transcription and collation materials; pointed to O'Donnell et al. 2019 | the contrast corpus; References |
| Tiziana Mancinelli (VeDPH) | 30 July | proposed connecting [DiScEPT](https://istituto-italiano-di-studi-germanici.github.io/DiScEPT/) (parallel texts and aligned translations) | agenda 5 |
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
GeoNames gazetteer with the editor in the loop; canonical alignment across
the documents of a collection, with the classical apparatus band derived
under the edited text; the same press as a single self-contained page in
the browser. The test suite counts 174 assertions.
Eight demonstration editions with rights verified or granted: the Odyssey (Perseus),
thirty Van Gogh letters (Van Gogh Museum and Huygens ING), the Bellum
Alexandrinum (Digital Latin Library, with a three-register critical
apparatus), two editions by Paolo Monella offered by their editor as test
cases (the Chronicon of Romualdus Salernitanus and the graphematic
transcription of Ursus Beneventanus, with its table of signs), the General
Prologue of the Canterbury Tales (54 witnesses and the full collation,
offered by Peter Robinson as a temporary test case), texts from the
Eurasian Latin Archive (University of Siena) and a constructed
Specimen for teaching purposes.

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
5. **Advanced collections**: timelines, networks, witness synopses, the text
   of a single witness derived from the model, and the alignment of parallel
   texts and translations (the [DiScEPT](https://istituto-italiano-di-studi-germanici.github.io/DiScEPT/) line, with T. Mancinelli).
6. **The conformance report** integrated in the CI (strict: the build fails
   on the syntactic layer, requires written confirmation on the semantic
   one).
7. **Tests**: take the TEI of published editions and press them without
   configuration.

## Audits

**30 July 2026, 22:00. First machine audit**, run in parallel by three
assistants (GPT-5.6 Sol, GPT-5.5, Claude Sonnet 5) reading the public
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
heading was a heading only by the look of it (C54); the brackets of an
integration and the mark of a lacuna were drawn by the stylesheet, so they
disappeared from copied text and from screen readers (C55); and URLs taken
from the edition reached `href` unchecked (C56). The first two are the ones
that matter here: the layer that survives longest is the markup of the page
itself, and it was the one not being used.

**Third round**, the deepest, went through the TEI conformance of the
apparatus and found what matters most to an edition: a conjecture has no
witness, and its authority (`@source`, `@resp`) was being dropped, so 373
attributed readings of the Bellum Alexandrinum arrived anonymous (C57);
readings grouped in `rdgGrp`, and readings in an `app` with no `lem`, were
not shown at all, which is the first principle broken on known elements
rather than unknown ones (C58). It also caught the register's own
bookkeeping: two rows shared a number and the totals no longer matched the
table (C62). Fixed, with the numbering now derived from the table.

What the audits raise and remains open: the XML parser is deliberately
minimal and its supported profile should be stated rather than implied;
validation of the TEI against the ODD belongs in the edition's CI and is not
performed by the press; the CLI is tolerant where CI should be strict;
facsimiles are not yet rendered; behaviour is assigned by
class but the section a class resolves to does not yet carry rendering of
its own; the press has no tagged release, so an edition that presses itself
from this repository follows the branch instead of a fixed version. These
are recorded here, not resolved.

The register of corrections is the standing answer: what an audit finds is a
correction like any other, and it is filed.

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

- Bauman, Syd. 2011. "Interchange vs. Interoperability." *Proceedings of
  Balisage: The Markup Conference* 7. https://doi.org/10.4242/BalisageVol7.Bauman01.
- Pierazzo, Elena. 2011. "A Rationale of Digital Documentary Editions."
  *Literary and Linguistic Computing* 26 (4): 463-77.
  https://doi.org/10.1093/llc/fqr033.
- Turska, Magdalena, James Cummings, and Sebastian Rahtz. 2016. "Challenging
  the Myth of Presentation in Digital Editions." *Journal of the Text
  Encoding Initiative* 9. https://doi.org/10.4000/jtei.1453.
- Turska, Magdalena. 2017. "TEI Simple Processing Model: An Abstraction Layer
  for XML Processing." In *Advances in Digital Scholarly Editing*. Leiden:
  Sidestone Press.
- Zenzaro, Simone, Angelo Mario Del Grosso, Federico Boschetti, and Graziano
  Ranocchia. 2025. "CoPhiEditor: The DSL-Based DSE Methodology within the
  ERC Advanced Grant 885222-GreekSchools." *Umanistica Digitale* 9 (20):
  31-56. https://doi.org/10.6092/issn.2532-8816/21231.
- O'Donnell, Daniel Paul, Gurpreet Singh, Dot Porter, et al. 2019.
  *Publishing (and Forgetting) the Small or Medium-Sized Scholarly Edition
  or Cultural Heritage Collection as Linked Open Data: Using Zenodo and
  Github to Publish the Visionary Cross Project.*
  https://doi.org/10.5281/ZENODO.3338457. (Suggested by Peter Robinson.)
