/**
 * World: a mention surfaces its reference.
 *
 * A name, an rs, a term may carry what the source declares about it: a type,
 * a key, a reference to an authority. The reader must be able to see that the
 * source said it — not only when the reference is an external URL that becomes
 * a link, but also for an internal reference (#id), a key, a bare type. And
 * the engine must surface only what the source declares: never an invented
 * gloss where the markup gives none (attestation, not inference).
 *
 * This is a visualization choice, so the assertions are on the rendered page,
 * not only on the model: the page is where the reference must be visible.
 *
 *   - internal @ref / @type      → the attribute is shown (a title), no link
 *   - external @ref (a URL)      → a real link, as before
 *   - a bare mention, no atts    → nothing surfaced, nothing invented
 */

export const meta = {
  id: 'mention-reference',
  title: 'A mention surfaces its reference',
  tradition: 'named-entity and semantic markup — the reference is the editor\'s claim, shown as such',
  question:
    'Does a mention show the reference the source declares — a type, a key, an '
    + 'internal #id — and not only an external link? And does it invent nothing '
    + 'where the markup gives no reference?',
  claims: [
    'A mention carrying @type / @ref / @key surfaces it to the reader, without a script.',
    'An external @ref is a link; an internal reference is shown but is not a link.',
  ],
  forbids: [
    'Showing a reference only when it is an external URL, hiding internal ones.',
    'Inventing a gloss for a mention the source left bare.',
  ],
};

export const examples = [
  {
    id: 'mention-internal-ref',
    kind: 'positive',
    note: 'an rs with an internal @ref and a @type — the reference the source declares',
    body: '<p>Scrisse <rs ref="#per1" type="person">il console</rs> a Roma.</p>',
    check(model, h) {
      const html = h.render();
      return [
        { ok: h.has('il console'), label: 'the mention text is conserved' },
        { ok: /title="[^"]*ref: #per1/.test(html) || /title="[^"]*#per1/.test(html),
          label: 'the internal reference is surfaced to the reader (a title), not only in data-*',
          detail: 'before the fix only an external URL did anything; an internal #ref was invisible' },
        { ok: /title="[^"]*type: person/.test(html),
          label: 'the declared type is shown too' },
      ];
    },
  },
  {
    id: 'mention-external-ref',
    kind: 'positive',
    note: 'a persName whose @ref is an authority URL — a real link',
    body: '<p>Scrisse <persName ref="https://viaf.org/viaf/12345">Cicerone</persName>.</p>',
    check(model, h) {
      const html = h.render();
      return [
        { ok: h.has('Cicerone'), label: 'the mention text is conserved' },
        { ok: /href="https:\/\/viaf\.org\/viaf\/12345"/.test(html),
          label: 'the external authority @ref is a working link' },
      ];
    },
  },
  {
    id: 'term-with-key',
    kind: 'positive',
    note: 'a term with a @key — now covered, so its key is shown',
    body: '<p>La <term key="Q176737">clinamen</term> di Lucrezio.</p>',
    check(model, h) {
      const html = h.render();
      return [
        { ok: h.has('clinamen'), label: 'the term text is conserved' },
        { ok: /title="[^"]*Q176737/.test(html),
          label: 'the term surfaces its key (term is now a mention element)' },
      ];
    },
  },
  {
    id: 'mention-bare',
    kind: 'inference-limit',
    note: 'a name with no reference at all — nothing to surface, nothing to invent',
    body: '<p>Un certo <name>Tirone</name> lo copiò.</p>',
    check(model, h) {
      const html = h.render();
      const invented = /<[^>]*title="[^"]*"[^>]*>Tirone/.test(html);
      return [
        { ok: h.has('Tirone'), label: 'the mention text is conserved' },
        { ok: !invented, over: true,
          label: 'no title is invented for a mention the source left bare',
          detail: 'the source declares no type, key or reference: the engine adds none' },
      ];
    },
  },
];
