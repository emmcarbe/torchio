# Roadmap

The development agenda is organized in three registers: what is urgent, what
is possible, and the research directions the project exists for. Many of the
first two derive from advice, reviews, and audits contributed by others; the
third is the author's own.

The principles and method are documented in [PRINCIPLES.md](PRINCIPLES.md),
the experimental setup in [LABORATORY.md](LABORATORY.md), corrections in
[CORRECTIONS.md](CORRECTIONS.md), how archives and collections are handled in
[COMPLEX.md](COMPLEX.md), and proposed features in
[DESIDERATA.md](DESIDERATA.md). An item leaves this file when it is
implemented and recorded in the corrections register, or when it is discarded
with an explicit reason.

## Urgent

### Data model documentation

Document the internal data model independently of its implementation,
including:

- documents;
- entity registries;
- witnesses;
- hands;
- textual and genetic layers;
- typed apparatuses;
- identifiers;
- provenance;
- relationships between these objects.

Where possible, publish machine-readable schemas for the export formats. The
code and the current outputs must not remain the only specification of the
model.

### Versioning and compatibility

Version the manifest schema, the data model, and the generated export
formats. Define which changes are backward-compatible and provide explicit
migration procedures when an edition created with an earlier version requires
them. Every generated site must record the versions of the engine and schemas
used to build it.

### Secure processing

Treat every imported edition as untrusted input.

- Disable unsafe external entity resolution.
- Constrain XInclude and filesystem access. Done for the command line: a
  reference outside the edition is refused by where the file really is, so a
  link cannot lead out, and raw HTML pages require an explicit choice. The
  browser press does neither yet.
- Limit document expansion and recursion depth.
- Test malformed and adversarial XML.
- Prevent imported paths from escaping the permitted source directories.
- Ensure that the browser and CLI apply the same security policy.

### Reproducible builds

Given the same source files, manifest, enrichment layers, and engine version,
the browser and CLI must produce equivalent models and outputs. Add fixtures
that compare the two build paths. Record checksums where they are useful for
verifying reproducibility.

### Release criteria

Define explicit conditions for beta and stable releases, including:

- all required tests passing;
- known limitations documented;
- accessibility checks completed;
- equivalent browser and CLI output;
- archival deposit completed;
- citation metadata generated correctly;
- no unresolved defects that cause data loss;
- version and schema information recorded in the generated edition.

### User documentation

Provide:

- a minimal end-to-end tutorial;
- annotated manifest examples;
- annotated ODD examples;
- a description of generated files and directories;
- troubleshooting guidance;
- documentation of warnings and press reports;
- instructions for running Torchio through both the CLI and the browser.

Every diagnostic message should identify the source file and, where possible,
the relevant element, identifier, or line.

### Measurement over the contrast corpus

The sampling frame is now `corpus-frame.csv`, built from both catalogues of
the field. It contains 1,156 editions, of which 124 appear in both
catalogues. The chain for fetching and measuring the corpus already exists:

- `tools/catalogues.js`;
- `tools/harvest.js`;
- `tools/measure-corpus.js`.

Its first results are recorded in `corpus-results.csv`. What remains is to
run the process at scale:

1. determine where each edition's XML is stored;
2. fetch what can be fetched without placing an unreasonable load on external
   services;
3. process the available sources with Torchio;
4. record failures and their causes;
5. publish the resulting dataset and methodology.

The resulting figure, whichever way it falls, must be reported beside the
wager in `PRINCIPLES.md`.

### Integrity reporting

The press now reports what it could not do and stops on anything that would
publish an incomplete edition, unless `--lenient` is given. What remains is
the integrity block proper: dangling pointers counted and identified,
including:

- undeclared witness sigla;
- references to missing identifiers;
- targets that resolve nowhere;
- unresolved external resources;
- broken relationships between registries and occurrences.

The status "Pressed" must never be readable as equivalent to "valid".

## Open defects: engine

### Input handling

- A non-UTF-8 file must stop the press instead of silently replacing
  characters.
- Excessive recursion depth must fail with the relevant file named.
- A truncated review sheet must not cause the browser to hang.

### Declared pages

- `manifest.warnings` is collected but never displayed.

### Witness data

- The agreement table counts the edited text as a witness of itself.
- Shared lacunae are counted as agreement.
- The hierarchy of `listWit` is flattened.
- Declared sigla are not used in the interface.

### Apparatus

Apparatus notes do not enter the model or the exports.

### Genetic layer

- Inferred hands are recorded as though they had been declared in the source.
- Nested operations inherit the wrong hand.
- Operations without a declared hand are dropped.

### Open rows in the corrections register

- `prefixDef` resolution (`C2`);
- spanning variants (`C3`);
- `fw` according to view (`C5`);
- `alt`, `join`, and `move` (`C7`);
- witness lacunae (`C8`);
- `classDecl` facets (`C9`);
- `refsDecl` and `citeStructure` (`C10`);
- the declared index (`C11`);
- the signs table derived from `charDecl` (`C20`);
- nested corpora being dropped (`C93`);
- a self-documenting edition being interpreted as a schema (`C94`);
- nested XInclude resolving against the wrong base (`C95`);
- the class tie-break placing elements outside their family (`C96`);
- foreign-namespace metadata entering the registries (`C97`);
- six unreachable keys in the section map (`C98`).

The final six defects were identified on 1 August during specialist review.

### Complex structural cases

An archive whose individual objects are themselves scholarly editions is not
a single structural type. Pressing ALIM's documentary and literary sources
together produced one edition out of many (`C108`).

The `meeting` structure is currently unreadable: a register of dated sessions
therefore displays shelf marks instead of meaningful session information
(`C105`).

Both cases are described in [COMPLEX.md](COMPLEX.md).

### Gazetteer matching

Gazetteer matching has no concept of language. When applied to early modern
German, it proposed towns for common words (`C104`).

### Classes and rendering

Class membership assigns a handling family and section, not an exact visual
behaviour. The claim has been narrowed accordingly. A first web subset of the
TEI Processing Model now executes explicit `model`/`modelGrp` rules,
`behaviour`, common predicates, parameters, `cssClass`, and safe
`outputRendition`, with browser/CLI equivalence tests. The resolver now applies
edition ODD rules first, conservative Torchio contracts over TEI All elements
and classes second, and lossless structural rendering last. TEI All itself is
not described as a rendering profile. Still open:

- `modelSequence` and arbitrary XPath predicates;
- wider behaviour and parameter coverage;
- replacing the remaining element-name dispatch with explicit contracts.

### Memory

Pressing currently uses approximately one hundred times the size of the
source data in memory. The main causes are:

- parse trees retained alongside the model;
- a map from every node identifier to its page;
- the complete site retained as strings before being written.

A 100 MB archive cannot currently be pressed.

### Browser and CLI divergence

The browser press and the CLI have diverged:

- the CLI applies `georef.json`, the browser does not;
- the manifest schema is defined separately in three places;
- the report and the strict behaviour exist only in the CLI: the browser
  presses to explore, but it should still say what it skipped.

The colophon no longer diverges: the browser bundle carries its own build
and stamps it, and the suite asserts that both declare the same engine.

### Tokenization

Open tokenization problems include:

- Latin enclitics;
- ornate capitals that split words;
- editorial notes attached to tokens.

### NLP workflow

Reviewed lemmas supplied by the editor are not reused during entity-candidate
identification. The system runs UDPipe again without incorporating the
emendations. In addition:

- part-of-speech information is computed but not persisted;
- collections are aggregated across the entire corpus;
- no per-document view is available.

The redesign is specified in the section on the derived layer below.

### Right-to-left writing

Logical CSS properties are required before an Arabic edition can be used
adequately.

### Output

- The output directory is never cleaned.
- `data/source/` copies every neighbouring `.json` file.

## Accessibility and conformance

- Provide keyboard access to every family of interactive components.
- Define accessible semantics for `del` and `ins`.
- Restore folio numbers to the accessibility tree.
- Ensure that the apparatus remains visible below 1,180 pixels.
- Implement correct focus management for popups and dialogs.
- Test composed contrast tokens.
- Prepare an AgID accessibility statement.
- Provide an OSM/GDPR notice for map tiles.
- Add manual tests for focus order, keyboard navigation, screen-reader
  behaviour, reflow, and zoom.
- Distinguish accessibility properties guaranteed by Torchio from
  requirements that depend on editorial content.

## Possible

Much of the following agenda derives from advice and review contributed by
others.

### Facsimile

Represent zones as SVG overlays on the page image. Each zone should function
as a link, with `:target` highlighting the corresponding line in the
transcription. Define an explicit position on IIIF:

- manifests are consumed client-side;
- an image server is not required when images are available as files.

The first implementation slice will be developed on Ursus.

### Search

Index the model rather than the HTML, so that every occurrence retains
information about its:

- textual level;
- witness;
- hand;
- layer;
- document;
- editorial status.

`staticSearch`, developed by the Endings Project, is the precedent for
serverless search. Torchio's addition would be a model-aware index.

### Parallel texts and collated traditions

- Parallel texts and facing translations, which are currently flattened.
- A witness synopsis for collated traditions.

### Derived layer

The derived layer is specified separately. Linguistic and semantic
annotations should be recorded per occurrence in per-document sidecar files
built over a frozen text projection. The proposed architecture follows the
two-layer store used in the CWB/CQPweb tradition, materialized as static
JSON. Opera Graeca Adnotata provides a precedent for standoff annotation.

Under this model:

- one document is a view;
- a subcorpus is a set of documents;
- statistics are composed in the browser;
- entity pages have stable, dereferenceable URIs;
- `@ana`, `listRelation`, and JSON-LD are supported.

Adapters may include:

- UDPipe;
- specialized NER systems;
- gazetteers;
- possibly a local open model.

Adapters propose annotations. Verification must remain independent of the
system that produced the proposal. Every accepted result must be materialized
with its provenance. No linguistic or semantic analysis should run at press
time.

### Institutional ODDs

Stress-test the class-based approach against institutional ODDs, including:

- EpiDoc;
- DTA-Basisformat.

### TEI release compatibility

Compare Torchio against the official TEI Stylesheets regression suite.

### Local open model

A local open model may be used as a template proposer, tested against the
possible editorial worlds. It must not be applied to constructs that carry
interpretative decisions.

### Continuous integration

- Add CI that re-presses the demos and fails when the committed output
  differs from the generated output.
- Derive the number of open corrections from execution rather than updating
  it manually.
- Test browser and CLI equivalence.
- Run schema and migration tests against previous manifest versions.

### Additional output formats

- Print output.
- ePub output.
- Intake for TEI P4 and older P5 versions.

### Community files

- `CONTRIBUTING.md`;
- issue templates;
- `SECURITY.md`;
- `EXIT.md`, documenting what remains readable and recoverable if development
  stops.

## Research directions

These are the research directions for which the project exists. 
None has yet been implemented, and each constitutes a research programme
before it can become a feature.

### Provenance model

The first direction concerns a model capable of recording separately, rather
than collapsing into a single undifferentiated layer: sources,
representations, observations, derivations, claims, evidence,
counter-evidence, hypotheses, decisions, responsibility, and manifestations.

The model must preserve the distinction between attested data, observation,
and derived information: what the source states, what someone observes in it,
and what is inferred from it.

Its first domain of application is authorial philology (*filologia
d'autore*), including born-digital dossiers.

### Born-digital and forensic philology

An author's digital archive is not a text file: it is a disk, a filesystem, a
history of writing, and a body of material that may have been deleted and
recovered through forensic methods.

The distinctions required by a born-digital dossier, the forensic image, the
file, the recovered fragment, and the environment that produced them, are not
the same as those required to describe a printed witness. A model designed
only for the latter cannot adequately represent the former.

### Publication profiles

An edition is not a single object intended for a single audience. The
profiles to be supported include:

- **open**: full text, images, apparatus, TEI, and dataset;
- **licensed**: publication governed by contract, with specified users,
  duration, territories, and materials;
- **restricted**: full access for authorized users only, within a
  public-facing shell;
- **variants-only**: the system of variants, its categories, relationships
  between textual states, phases, and authorized quotations, without
  publication of the full text;
- **quantitative**: aggregate data, statistics, graphs, timelines, heatmaps,
  and models that do not permit reconstruction of the text;
- **dark**: a complete but encrypted corpus and model, accompanied by a
  public component that can be cited and assessed;
- **time-locked**: access beginning on a scheduled future date, following an
  embargo, authorization, or the expiry of rights.

An apparatus is not automatically publishable. Before it is released, the
system must support an assessment of whether it contains substantial portions
of the text, permits the work to be reconstructed, functions as an economic
substitute for the edition, or exposes unauthorized material. Publication is
governed not only by provenance, but also by granularity and
reconstructability.

### The dark vault

The complete edition is preserved in encrypted form and used to generate
authorized public packages.

This makes it possible to edit and cite a work that remains under copyright:
the scholarly work exists and can be verified without making the protected
text publicly available. Encryption keys are managed separately for each
recipient.

### Observatory of philological worlds

This is an autonomous and later research direction: an observatory collecting
definitions, examples, counter-examples, bibliographies, methodological
conflicts, and experimental formalizations.

It is not a prerequisite for any other part of the project.

### The assistant

An optional and replaceable module for bibliographic retrieval, comparison of
definitions, formulation of questions, explanation of data, production of
structured outputs, detection of inconsistencies, and transformation of
decisions already made.

It must not exercise philological authority.
