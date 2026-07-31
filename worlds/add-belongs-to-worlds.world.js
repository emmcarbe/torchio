/**
 * World: one <add>, several worlds.
 *
 * The point of the worlds is not to find the one correct encoding for Torchio.
 * It is to stop Torchio imposing a single reading. The same <add> lives in
 * different worlds — a material addition, a genetic phase, an editorial
 * intervention, an integration, a diplomatic phenomenon — and the element name
 * decides none of them. What decides is the signal the source declares.
 *
 * So the engine must not say "re-encode this as something I already know."
 * It must say, in effect: this addition is conserved; where you declared a
 * signal (a hand, a campaign) I read the world you declared; where you did
 * not, I keep it and render it, and I do not invent a world for it. The source
 * is never asked to change so a function will appear.
 *
 * These examples hold the engine to that. The same <add>, three contexts:
 *   - no signal          → conserved and rendered, NOT read as a genetic act
 *   - @hand attested     → the genetic world, by the signal the source gave
 *   - @place but no hand → a spatial hint is not agency; still not a genetic act
 */

export const meta = {
  id: 'add-plural-worlds',
  title: 'One <add>, several worlds',
  tradition: 'the plurality itself — no single tradition owns <add> (Pierazzo 2011 on the transcription threshold)',
  question:
    'Does the element name <add> decide its editorial reading, or do the signals '
    + 'the source declares? Where no signal is present, does the engine conserve '
    + 'the addition without forcing it into one world?',
  claims: [
    'The world an <add> belongs to is read from declared signals (@hand, @change, <handShift>), not from the tag.',
    'Absent a signal, the addition is conserved and rendered, never read into a specialist world.',
  ],
  forbids: [
    'Reading a bare <add> as a genetic operation.',
    'Manufacturing agency from a spatial hint (@place) with no hand.',
    'Requiring the source to be re-encoded before an addition is shown.',
  ],
};

export const examples = [
  {
    id: 'add-bare',
    kind: 'inference-limit',
    note: 'an <add> with no signal at all — the tag alone must not pick a world',
    body: '<p>Nel testo <add>parola</add> aggiunta.</p>',
    check(model, h) {
      const node = h.find((n) => n.element === 'add');
      return [
        { ok: h.has('parola'),
          label: 'the addition is conserved in the model' },
        { ok: !!node && !!node.section, over: false,
          label: 'and it is rendered by class, not discarded',
          detail: node ? `resolves to section "${node.section}"` : 'add node missing' },
        { ok: !h.genetic, over: true,
          label: 'the bare <add> is NOT read as a genetic operation',
          detail: 'the element name is not a genetic signal; reading a world '
            + 'into it would force one interpretation the source never declared' },
      ];
    },
  },
  {
    id: 'add-hand-attested',
    kind: 'positive',
    note: 'the same <add>, now carrying an attested @hand — a declared genetic signal',
    hands: [{ id: 'h1', label: 'correcting hand' }],
    body: '<p>Nel testo <add hand="#h1">parola</add> aggiunta.</p>',
    check(model, h) {
      const op = h.ops.find((o) => o.element === 'add');
      return [
        { ok: !!h.genetic && !!op && op.hand === 'h1',
          label: 'now it enters the genetic world, attributed to h1',
          detail: 'the signal the editor declared, not the tag, placed it there' },
        { ok: !!op && op.handInferred === false,
          label: 'and the attribution is attested, not a guess' },
      ];
    },
  },
  {
    id: 'add-place-no-hand',
    kind: 'contrastive',
    note: 'an <add> with a spatial hint (@place) but no hand — looks genetic, is not',
    body: '<p>Nel testo <add place="margin">parola</add> aggiunta.</p>',
    check(model, h) {
      const node = h.find((n) => n.element === 'add');
      return [
        { ok: !h.genetic, over: true,
          label: 'a spatial hint alone does not manufacture a genetic operation',
          detail: '@place says where, not by whom or in which campaign; without a '
            + 'hand or change there is no attributed act to record' },
        { ok: !!node && node.atts && node.atts.place === 'margin',
          label: 'yet @place is conserved on the addition, for whoever reads it' },
      ];
    },
  },
];
