/**
 * World: a canonical reference survives.
 *
 * A <ref> can point not at a URL but at a locus in another text, by a
 * canonical citation: a CTS urn, a Keil volume-and-page, a chapter-and-verse.
 * That pointer is the alignment the edition declares between its text and a
 * source; if the press drops it, the alignment is lost and the reference
 * becomes a bare word. So @cRef (and @target) must reach the page.
 *
 * The debt this world names was real: an edition of Ursus (orso) carried 61
 * <ref type="source" cRef="urn:cts:..."> pointers to Priscian in Keil, and the
 * pressed refs kept no cRef at all.
 */

export const meta = {
  id: 'canonical-reference',
  title: 'A canonical reference survives',
  tradition: 'canonical citation and text alignment (CTS; the classical citation systems)',
  question:
    'When a <ref> points at a locus by a canonical citation (@cRef) rather than '
    + 'a URL, does that pointer reach the page, so the alignment the edition '
    + 'declared is not lost?',
  claims: [
    'A @cRef on a <ref> is preserved on the page, as the locus it names.',
  ],
  forbids: [
    'Dropping @cRef because it is neither text nor an external link.',
  ],
};

export const examples = [
  {
    id: 'ref-cref-preserved',
    kind: 'positive',
    note: 'a source reference by CTS urn, the alignment to Priscian in Keil',
    body: '<p>come nota <ref type="source" cRef="urn:cts:latinLit:stoa0234a.stoa001:2.53.8">Prisc.</ref>.</p>',
    check(model, h) {
      const html = h.render();
      return [
        { ok: h.has('Prisc.'), label: 'the reference text is conserved' },
        { ok: /urn:cts:latinLit:stoa0234a\.stoa001:2\.53\.8/.test(html), over: false,
          label: 'the canonical citation (@cRef) reaches the page',
          detail: 'so the locus the edition aligns to is not lost from the reference' },
      ];
    },
  },
  {
    id: 'ref-target-internal',
    kind: 'positive',
    note: 'a reference by internal @target — the pointer must also survive',
    body: '<p>vedi <ref target="#n12">nota 12</ref>.</p>',
    check(model, h) {
      const html = h.render();
      return [
        { ok: h.has('nota 12'), label: 'the reference text is conserved' },
        { ok: /#n12/.test(html),
          label: 'the internal target reaches the page' },
      ];
    },
  },
];
