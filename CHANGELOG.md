# Changelog

Releases, newest first. The fine grain is in
[CORRECTIONS.md](CORRECTIONS.md).

## 0.2.0-beta.2 (2026-08-01)

First release deposited for a DOI. The test suite passes 184 assertions.

Engine:
- Margin notes fill both margins, each note taking the side that carries it
  closest to its mark; the economy rule is per note, not per page (C88).
- Georeferencing output now reaches the press: `georef.json` is applied like
  the reconciliation file; Pleiades takes precedence over GeoNames for the
  ancient world, and a pre-Columbian `notAfter` drops candidates in the
  Americas (C87).
- The browser press locates ancient places offline against a compact
  Pleiades index fetched beside the page (C89).
- Simple pages: full Markdown (underscore emphasis, fenced code, rules,
  deep headings) and local images carried in the edition's `images/`
  folder; an external image URL is linked, never loaded (C85, C86).
- Facsimile surfaces with no text render as nothing instead of empty boxes
  (C83); the collated-tradition lexicon opens per witness, without the
  merged view (C84).
- The dead `genre` manifest field is removed (C90).

Found by pressing real editions never seen before (the first of the contrast
corpus) and by a day review:
- Every popup in every pressed edition was quoting text with the letter "s"
  removed: six regular expressions lost a backslash on their way through the
  template that builds the interactive layer (C99).
- An apparatus entry inside running prose broke the line, so a prose edition
  arrived in fragments (C100); external references and addresses written into
  notes were not links (C101).
- An edition that declared its pages in the manifest silently lost its
  indices, map, lexicon and lemmas (C91).
- An edition whose parts live in sibling folders could not be pressed at all;
  the press now descends when the surface holds no TEI, and the texts and the
  registries that belong together arrive together (C106).
- A large archive could not be exported: the model and the token stream now
  travel as a box that points at other files, keeping both the archive's level
  and each document's (C107).
- Recorded open, not fixed: `meeting` unread in editions of proceedings
  (C105), an archive whose items are themselves editions as a structural type
  (C108), noisy gazetteer matches on early modern German (C104), and the six
  found by specialist review (C93 to C98).

Record:
- The corrections register was verified against the code: six early entries
  counted as applied were not in the engine and are now open, two partly
  (C2, C3, C5, C7, C8, C9, C10, C11); totals recomputed from the table.
- Principles 2, 3, 5 and 6 rewritten;
  the survey extended; the contrast corpus declared as a dataset (`corpus.csv`, 95 editions).
- `CITATION.cff`, `.zenodo.json`, this changelog, and [COMPLEX.md](COMPLEX.md)
  on archives, collections and editions inside editions.
- The sampling frame rebuilt from both catalogues of the field
  (`corpus-frame.csv`: 1156 editions, of which 124 appear in both), with the
  tools that fetch and measure it (`tools/catalogues.js`, `tools/harvest.js`,
  `tools/measure-corpus.js`) and the first results (`corpus-results.csv`).

## 0.2.0-beta.1 (2026-07-31)

The state after the first machine audits: the "possible (editorial) worlds"
harness (five worlds, the 1981 Guidelines examples pressed), the Lab
section (lexicon, concordance, frequencies, indices, map), per-document
lexicon for collections, the two-register apparatus fixes, and the first
82 corrections.
