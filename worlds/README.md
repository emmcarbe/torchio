# Possible (editorial) worlds

Torchio does not hold one universal interpretation of TEI. The same markup can
belong to different editorial traditions and mean different things in each. A
`<add>` is a genetic intervention in one world, a documentary addition in
another, an editorial integration in a third. No engine can read that from the
element name.

So instead of a table `element → meaning`, this directory holds a set of
**possible (editorial) worlds**, each a coherent theory of what a tradition treats as
significant and how it reads the markup, delimited not by abstract rules but by
**examples and counter-examples**.

Three things, kept distinct:

- **The possible (editorial) world** (`*.world.js`): the claims a tradition makes, the TEI
  signals that express them, and — decisively — the inferences it forbids.
- **The contrastive corpus**: for each world, positive examples (this is the
  phenomenon), contrastive examples (this looks similar but is *not* it), and
  inference-limit examples (here the software must not conclude more than the
  source attests).
- **The edition profile** (a manifest): the composition of worlds a project
  chooses. One edition can be documentary for the manuscript, critical for the
  variants, semantic for the names, all at once.

## Why contrastive

A positive example alone teaches what to recognise. A contrastive example
teaches what **not** to infer, which is where an automatic reading goes wrong.

```
<subst><del hand="#h1">casa</del><add hand="#h1">dimora</add></subst>
```

is a substitution by one hand. But

```
<del hand="#h1">casa</del><add hand="#h2">dimora</add>
```

adjacent, no `<subst>`, two hands — must NOT be read as a substitution by one
agent. The surface is almost the same; the philology is not. The contrastive
example is what says so.

## Executable

Every example is a test. Run:

```
node worlds/run.js
```

Each example builds a Torchio model from its source and asserts what the model
must contain and what it must not. An example that fails is a debt with a name:
either the engine infers too much, or it does not yet model enough. A world is
not a promise that the engine passes it — it is a statement of what a faithful
reading requires, against which the engine is measured.

## Provenance

An example is not a universal truth. It states: *in this tradition, under these
conditions, this configuration reads this way.* So each carries its tradition,
its source in the literature where possible, and what it explicitly does not
claim. The worlds are a comparative corpus of editorial practice as much as a
test suite.
