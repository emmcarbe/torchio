/**
 * World: genetic substitution.
 *
 * In the genetic tradition (De Biasi; Grésillon 1994; for digital genetic
 * editing, Van Hulle 2022) a <subst> records one editorial act: a reading is
 * deleted and another put in its place, by an agent, in a moment of writing.
 * The engine's task is narrow and exact — record that act where the source
 * marks it, and refuse to invent it where the source does not.
 *
 * The three examples that would fool a naive reading:
 *   - a real substitution by one hand              (recognise the act)
 *   - a <subst> whose members are different hands  (do not fuse the agents)
 *   - a bare <del> beside a bare <add>, no <subst> (do not invent the act)
 * and one that tests the limit of what may be shown:
 *   - a deletion whose hand comes from a <handShift>, not from @hand
 *     (show the hand if you must, but never as if the source attested it)
 */

export const meta = {
  id: 'genetic-substitution',
  title: 'Genetic substitution',
  tradition: 'critique génétique — De Biasi, Grésillon; Van Hulle for the digital line',
  question:
    'When one hand deletes a reading and writes another inside a <subst>, does '
    + 'the model record a single substitution by an attested agent — without '
    + 'reading a substitution into a mere adjacency, and without dressing an '
    + 'inferred hand as an attested one?',
  claims: [
    'A <subst> groups a deletion and its replacement as one act.',
    'The agent of the act is what @hand attests, never a guess.',
  ],
  forbids: [
    'Reading adjacent <del> + <add> outside a <subst> as a substitution.',
    'Attributing one agent to a <subst> whose members carry different hands.',
    'Writing an inferred hand where a reader cannot tell it from an attested one.',
  ],
};

export const examples = [
  {
    id: 'subst-one-hand',
    kind: 'positive',
    note: 'one hand deletes «casa» and writes «dimora» in its place',
    hands: [{ id: 'h1', label: 'main hand' }],
    body: '<p>La <subst><del hand="#h1">casa</del>'
      + '<add hand="#h1" place="above">dimora</add></subst> sul colle.</p>',
    check(model, h) {
      const del = h.ops.find((o) => o.element === 'del');
      const add = h.ops.find((o) => o.element === 'add');
      const reified = !!(h.genetic && Array.isArray(h.genetic.substitutions)
        && h.genetic.substitutions.some((s) => s.deleted && s.added));
      return [
        { ok: h.has('casa') && h.has('dimora'),
          label: 'both the deleted and the added reading survive in the model' },
        { ok: !!h.genetic,
          label: 'the genetic dimension materialises (hand declared, stratum kept)' },
        { ok: !!del && !!add && del.hand === 'h1' && add.hand === 'h1',
          label: 'deletion and addition are attributed to the attested hand h1' },
        { ok: !!del && !!add && del.handInferred === false && add.handInferred === false,
          label: 'that attribution is attested, not inferred' },
        // the one structural gap this world names: the act is not reified.
        { ok: reified, over: false,
          label: 'the substitution is bound as one act (deleted ↔ added)',
          detail: 'the model exposes del and add as two flat operations; nothing '
            + 'records that this deletion was replaced by this addition. A '
            + 'consumer must re-pair them by document order, which fails for '
            + 'nested or multiple substitutions' },
      ];
    },
  },
  {
    id: 'subst-two-hands',
    kind: 'contrastive',
    note: 'a later hand replaces an earlier hand\'s reading, inside one <subst>',
    hands: [{ id: 'h1', label: 'first hand' }, { id: 'h2', label: 'second hand' }],
    body: '<p>La <subst><del hand="#h1">casa</del>'
      + '<add hand="#h2" place="above">dimora</add></subst> sul colle.</p>',
    check(model, h) {
      const del = h.ops.find((o) => o.element === 'del');
      const add = h.ops.find((o) => o.element === 'add');
      const distinct = !!del && !!add && del.hand === 'h1' && add.hand === 'h2';
      return [
        { ok: distinct, over: true,
          label: 'the two members keep their own hands; no single agent is imposed',
          detail: 'if the model collapsed a two-hand <subst> to one agent it '
            + 'would assert an editorial fact the source denies' },
        { ok: !!del && del.handInferred === false && !!add && add.handInferred === false,
          label: 'both hands are attested, so neither is a guess to hide' },
      ];
    },
  },
  {
    id: 'adjacent-no-subst',
    kind: 'contrastive',
    note: 'a deletion beside an addition, with NO <subst> wrapping them',
    hands: [{ id: 'h1', label: 'main hand' }],
    body: '<p>La <del hand="#h1">casa</del> <add hand="#h1">dimora</add> sul colle.</p>',
    check(model, h) {
      const invented = !!(h.genetic && h.genetic.substitutions && h.genetic.substitutions.length);
      return [
        { ok: !invented, over: true,
          label: 'no substitution is read from adjacency alone',
          detail: 'the source places a deletion next to an addition; only the '
            + 'editor\'s <subst> may license reading them as one act' },
        { ok: h.has('casa') && h.has('dimora'),
          label: 'both readings still survive as independent operations' },
      ];
    },
  },
  {
    id: 'hand-from-handshift',
    kind: 'inference-limit',
    note: 'a deletion whose hand is carried by a preceding <handShift>, not by @hand',
    hands: [{ id: 'h2', label: 'the correcting hand' }],
    body: '<p>Testo <handShift new="#h2"/><del>casa</del> seguito.</p>',
    check(model, h) {
      const del = h.ops.find((o) => o.element === 'del');
      const node = h.find((n) => n.element === 'del');
      return [
        { ok: !!del && del.hand === 'h2' && del.handInferred === true, over: true,
          label: 'the hand reaches the operation, but marked inferred',
          detail: 'from <handShift>, not from @hand on the <del>' },
        { ok: !!node && node.atts && node.atts.hand == null, over: true,
          label: 'the inferred hand is NOT written into the attested attributes',
          detail: 'atts.hand must stay empty; the deduction lives in node.inferred' },
        { ok: !!node && node.inferred && node.inferred.hand === '#h2', over: false,
          label: 'the deduction is recorded, with its rule, for any consumer to show honestly' },
      ];
    },
  },
];
