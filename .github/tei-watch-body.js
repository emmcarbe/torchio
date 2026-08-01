#!/usr/bin/env node
/**
 * The body of the issue that .github/workflows/tei-watch.yml opens when the
 * TEI Consortium publishes a release this repository is not built from.
 *
 * It lives here, and not inside the workflow, because prose that carries
 * backticks and shell expansions inside a YAML block is what made that file
 * unreadable. Written as a script it can also be run by hand:
 *
 *   LOCAL=4.12.0 REMOTE=4.13.0 node .github/tei-watch-body.js
 */
const local = process.env.LOCAL || 'unknown';
const remote = process.env.REMOTE || 'unknown';

process.stdout.write(`The TEI Consortium has released **P5 ${remote}**. \`data/p5-classes.json\` in
this repository is derived from **P5 ${local}**.

Nothing has been changed automatically: a new edition of the Guidelines is
read, not merged. What to look at, in order:

1. The release notes, for elements added, renamed or deprecated, and for
   changes to the model and attribute classes. New classes matter more than
   new elements: an element inherits, a class decides.
2. Regenerate the class map from the released p5subset
   (\`tools/generate-classes.py\`), pinned to ${remote}, and read the diff. An
   element that changes class changes behaviour without a line of code being
   touched.
3. Run \`npm test\`: the coverage assertion fails when an element resolves to
   no section, which is how a new module announces itself.
4. Press the demonstration editions and compare. If nothing moves, say so in
   \`CORRECTIONS.md\`: a release that changes nothing is a result too.

Opened by \`.github/workflows/tei-watch.yml\`.
`);
