<img src="docs/torchio-lockup.svg" alt="Torchio" width="320">

# Torchio laboratory

Companion to [PRINCIPLES.md](PRINCIPLES.md). The principles describe a small,
conservative engine. This document opens the space beside it where the engine
is put to the test and where riskier ideas are tried, and it draws the line
between the two so the line is never crossed by accident.

## The principle, named

> **Model for the edition, not for the viewer.**
>
> Torchio adapts publication to the edition's model, instead of adapting the
> edition's model to the capabilities of the publication software.

This is the inversion the whole project exists to oppose (PRINCIPLES.md, Why 1),
stated as a rule for the tool. The decisive function is *not* "accept every
tag": rendering 588 elements from a bigger table of pre-programmed cases would
reproduce the same failure at a larger scale. The difference has to be
architectural, a pipeline that never asks the source to change:

```
edition's TEI
      ↓
complete conservative representation      (nothing the edition recorded is lost)
      ↓
standard behaviours                        (assigned by model class)
      ↓
declared specialist interpretations        (the chosen possible world, marked)
      ↓
publication
```

When the engine does not know how to treat a structure, it must say:

> This structure is conserved, but not interpreted. You need not change the
> source. You may add an editorial behaviour.

and never:

> Change the TEI like this, or the function will not appear.

## Two spaces

**Torchio core** is small, rigorous, conservative. It reads TEI, keeps
everything the edition recorded, assigns behaviour by model class, falls back
to a guaranteed base rendering, separates always what the source attests from
what the engine derives, and reports what it did. Nothing tradition-bound and
nothing inferential enters the core disguised as universal. The core is the
part meant to still be readable, and still honest, in ten years.

**Torchio laboratory** is where possible (editorial) worlds, NLP, IIIF, ontologies,
visualizations and frankly eccentric ideas are tried. The laboratory may guess,
may propose, may be wrong; it is where the interpretation lives. Its one
obligation to the core is the discipline of principle 9: whatever it derives is
marked as derived, carries its provenance, and never re-enters the source. A
result graduates from laboratory to core only when it can be stated without a
guess.

The boundary, in one line: **the core may not lie about the document; the
laboratory may not pretend its guesses are the document.**

## The question, not the promise

Torchio does not promise to publish every TEI. Cheap agent-generated code can
already produce, for one edition, a bespoke transformation, a static site, a
component, a pipeline; the market value of a generic "load TEI, get a site" is
falling. What does not age is the empirical question already stated in the
[wager](PRINCIPLES.md#the-wager), after Bauman (2011):

> How much of the editorial behaviour of heterogeneous, real TEI corpora can be
> recovered **without configuration** — using TEI model classes, documentary
> structure and contrastive examples — **without introducing false inferences?**

The answer is not known. It can be measured. It can fail. Either way it produces
reusable data. Torchio is the instrument that runs the experiment, not the
product the experiment sells.

## Seven durable objects

If in three years the renderer is replaced entirely, these seven remain useful.
They, not the generated site, are the scientific output. In a world of
agent-generated renderers a contrastive test corpus gains value, not loses it:
an agent can produce ten renderers, but a verifiable authority is still needed
to say which of them falsifies the text.

1. **The contrastive examples** — constructed positive and negative cases, [`worlds/`](worlds/). Distinct from the sampling frame of real editions (`corpus-frame.csv`) and from the editions actually analysed: see the Method in PRINCIPLES.
2. **A taxonomy of failures** — see below; every failure filed under one cause.
3. **The executable possible (editorial) worlds** — few, well delimited, [`worlds/`](worlds/).
4. **A contrastive philological test suite** — the worlds, run as tests.
5. **A capability report** — per press, what was conserved / rendered / interpreted / inferred.
6. **The provenance model** — source and interpretation kept apart (principle 9; the open cases are named in ROADMAP.md).
7. **A small static engine** — `src/`, which demonstrates the results concretely.

## Possible (editorial) worlds

The same markup means different things in different traditions; no engine reads
that from an element name. So instead of one table `element → meaning`, the
laboratory holds a set of **possible (editorial) worlds**, each a coherent theory
delimited not by abstract rules but by examples and counter-examples. Full
account and rationale in [`worlds/README.md`](worlds/README.md).

Their purpose is not to find the one correct encoding for Torchio. It is to
**stop Torchio imposing a single interpretation.** An `<add>` belongs to
different worlds — a material addition, a genetic phase, an editorial
intervention, an integration, a diplomatic phenomenon — and the element name
picks none of them. So the engine does not ask the editor to re-encode an
`<add>` as something it already knows; it applies the world the source's own
signals declare, and leaves the source intact. The `add-plural-worlds` world
holds the engine to exactly this: a bare `<add>` is conserved and rendered but
read into no world; the same `<add>` enters the genetic world only when the
source attests a hand; a spatial hint alone (`@place`) never manufactures
agency.

Each example is a legitimate TEI fragment and a check on the model. Three kinds:

- **positive** — this is the phenomenon; recognise it.
- **contrastive** — this looks the same and is *not* it; do not read it in.
- **inference-limit** — here the engine may show a derived fact but must never
  dress it as attested.

Run them:

```
node worlds/run.js            # all worlds
node worlds/run.js genetic    # worlds whose id contains "genetic"
```

A failed assertion is a debt with a name, not a broken build. Two kinds, and
the distinction is the whole point:

- an **over-reading** — the engine infers more than the source attests. This is
  what makes a page lie. It is reported first and it is the one that must stop
  the automatism.
- a **gap** — the engine under-models; an honest shortfall, filed and waited on.

The first world, `genetic-substitution`, currently holds 11 assertions with one
named gap (a `<subst>` is not yet reified as a single act) and no over-readings.
The gap is a debt; the absence of over-readings is the property that matters.

## The Guidelines' own examples, as tests

The hand-written worlds cover the traditions with judgement; beneath them
belongs a systematic layer with no judgement at all: **every example the TEI
Guidelines themselves give.** The Guidelines document each element and each
attribute with `<exemplum>` fragments and attribute tables (value lists,
datatypes); these are the specification's own authoritative witnesses of what a
construct looks like. Pressing all of them measures coverage against the
canon, element by element and attribute by attribute.

This stays inside principle 3: the examples are **test cases, not the
specification.** Behaviour is never derived from them; they are pressed to
measure what the engine, whose behaviour comes from the class system, does with
the specification's own cases — completed / conserved-generic / interpreted,
and never over-read.

The examples are machine-readable in one licensed file, the official
`p5subset.xml` (TEI Consortium, CC BY / BSD) — the same source the class map in
`data/p5-classes.json` already derives from. The plan: fetch it once, extract
every `<egXML>` exemplum from every `<elementSpec>`, `<classSpec>` and
`<macroSpec>`, and every `<attDef>` with its `<valList>`; wrap each fragment in
a minimal document; press it; and emit a capability ledger across the whole of
P5. The extractor and the ledger tool live in
[`tools/exempla.js`](tools/exempla.js); they run against a provided
`p5subset.xml`, so the one gated step is the download, nothing after it.

## Taxonomy of failures

When a real edition does not press cleanly, the failure is filed under exactly
one cause. The taxonomy is the second durable object; it turns "it broke" into
data.

1. **Syntactic diversity** — the same phenomenon encoded in structurally
   different but equivalent ways. In principle recoverable by the engine.
2. **Local semantics** — a `@type`, `@subtype` or project vocabulary whose
   meaning is local to the edition. Recoverable only if declared.
3. **Editorial-tradition difference** — the construct belongs to a tradition
   the engine does not yet speak. A world to be written, not a bug.
4. **Incomplete markup** — the edition did not encode the distinction the
   behaviour would need. Not the engine's to invent.
5. **Unresolvable ambiguity** — the source genuinely underdetermines the
   reading. The honest output is to preserve, not to choose.
6. **Engine limit** — the engine could and should do better. The only category
   that is a debt against Torchio itself.

Only category 6 is a fault of the tool. Distinguishing the six is what keeps a
low score from being read as "the tool is broken" when it may mean "the corpus
is heterogeneous in ways no tool resolves."

## The deciding measurement

Not all 95 editions at once. A **stratified sample**, one of each editorial
kind, is enough to decide whether to continue:

critical edition · documentary · genetic · correspondence · manuscript with
facsimile · linguistic corpus · dictionary · drama · project with local
customization · a relatively simple TEI project.

For each, eight measures:

1. Does the engine complete the transformation?
2. Does all the text remain available?
3. How much markup receives sensible behaviour?
4. How much stays only generically conserved?
5. How many configurations were necessary?
6. How many false interpretations were produced?
7. Is the resulting page actually usable?
8. Does an expert correctly recognise the editorial model?

Thresholds, declaredly conventional, fixed before the measurement so the result
cannot be reinterpreted after the fact:

| Result | Decision |
|---|---|
| **> 70%** press to a faithful base reading with no edition-specific code | continue as a generalizable engine |
| **40–70%** | keep the core, present it as an experimental framework and benchmark |
| **< 40%** | drop the universal-engine promise; publish the corpus, the tests and the negative result |
| **many outputs look right but carry false inferences** | stop the interpretive automatism at once, whatever the percentage |

The criterion is not "the page does not break." It is:

> **The page does not lie about the document.**

Measure 6 (false interpretations) can veto the whole regardless of the others:
a high completion rate built on quiet over-readings is a worse result than an
honest failure, because it is the failure that hides.

## Standing laboratory experiments

Ideas parked here explicitly as laboratory, not core, until they earn their way
across the boundary.

- **A repository helper on a local, open model.** A GitHub-side assistant
  (issue triage, first-pass review of a submitted edition against the worlds)
  run on an open model such as Ollama, kept off any closed API. Honest
  constraint: hosted CI runners carry no local model, so this is a self-hosted
  runner or a documented local loop, not a free hosted bot. Its value is not
  the model; it is that the contrastive worlds give any such helper a verifiable
  authority to check its own output against.
- **NLP, IIIF, ontologies, visualization.** Each a laboratory line with the
  same rule: it may derive, it must declare, it may not re-enter the source.

## Status

Laboratory opened alongside the beta. The worlds harness runs; five worlds
are written (`genetic-substitution`, `add-plural-worlds`,
`mention-reference`, `canonical-reference`, `entity-typologies`: 39
assertions held, one named gap — the substitution not yet reified as a
single act — and no over-readings). The exempla harness has run against the
p5subset: all 1981 extracted Guidelines examples press to completion, and
1673 of the 1710 that carry text keep at least half of it (the harness's
declared threshold, not exact conservation: an example whose text is
partly editorial apparatus legitimately renders shorter). None fired the
engine's one declared inference rule, which is the hand derived from a
handShift: this is a narrow claim about that channel, not a proof that the
model never asserts more than an example attests. The stratified measurement over the contrast corpus is designed and
not yet taken. When it is taken, the figures and the decision go into
[PRINCIPLES.md](PRINCIPLES.md) beside the wager, whichever way they fall.
