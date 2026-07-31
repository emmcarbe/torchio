/**
 * World: the many typologies of naming.
 *
 * Editors mark people and places in more than one way. Some use the dedicated
 * elements (persName, placeName, orgName, geogName, settlement...). Others use
 * a generic <name> or <rs> disambiguated by @type. The tool must recognise the
 * entity in either encoding, so it does not force one typology on the edition
 * (principle 1: no tradition is the default) — and it must NOT guess the kind
 * of a generic mention the editor left untyped.
 *
 * (Dates are a typology too, for timelines; deliberately not covered yet.)
 */

export const meta = {
  id: 'entity-typologies',
  title: 'The many typologies of naming',
  tradition: 'the TEI namesdates module — dedicated and generic, @type-disambiguated markup',
  question:
    'Does the tool recognise a person or a place whether the editor marked it '
    + 'with a dedicated element or with a generic <name>/<rs> plus @type — and '
    + 'does it refuse to guess the kind of a generic mention left untyped?',
  claims: [
    'A generic <name>/<rs> with @type person/place/org is recognised as that entity.',
    'The dedicated elements keep working, and more place elements are covered (region, country...).',
  ],
  forbids: [
    'Forcing one encoding typology by recognising only persName/placeName.',
    'Guessing the kind of a generic <name>/<rs> the editor left untyped.',
  ],
};

const hasLabel = (list, label) => (list || []).some((e) => e.label === label);

export const examples = [
  {
    id: 'generic-name-place',
    kind: 'positive',
    note: 'a place marked with a generic <name type="place">',
    body: '<p>Andò a <name type="place" ref="https://www.geonames.org/3169070">Roma</name>.</p>',
    check(model, h) {
      return [
        { ok: h.has('Roma'), label: 'the mention text is conserved' },
        { ok: hasLabel(model.registries.places, 'Roma'),
          label: 'a generic <name type="place"> is recognised as a place' },
      ];
    },
  },
  {
    id: 'generic-rs-person',
    kind: 'positive',
    note: 'a person marked with a generic <rs type="person">',
    body: '<p>Scrisse <rs type="person" key="cicero">il console</rs>.</p>',
    check(model, h) {
      return [
        { ok: h.has('il console'), label: 'the mention text is conserved' },
        { ok: hasLabel(model.registries.people, 'cicero'),
          label: 'a generic <rs type="person"> is recognised as a person' },
      ];
    },
  },
  {
    id: 'dedicated-region',
    kind: 'positive',
    note: 'a place marked with <region> — a namesdates element beyond placeName',
    body: '<p>La <region key="latium">regione</region>.</p>',
    check(model, h) {
      return [
        { ok: h.has('regione'), label: 'the mention text is conserved' },
        { ok: hasLabel(model.registries.places, 'latium'),
          label: '<region> is recognised as a place, not only placeName' },
      ];
    },
  },
  {
    id: 'untyped-generic',
    kind: 'inference-limit',
    note: 'a generic <name> with @ref but NO @type — the kind is unknown',
    body: '<p>Un certo <name ref="https://example.org/x">X</name>.</p>',
    check(model, h) {
      const anywhere = hasLabel(model.registries.people, 'X')
        || hasLabel(model.registries.places, 'X')
        || hasLabel(model.registries.orgs, 'X');
      return [
        { ok: h.has('X'), label: 'the mention text is conserved' },
        { ok: !anywhere, over: true,
          label: 'an untyped generic <name> is not guessed into a registry',
          detail: 'the editor did not say whether it is a person, a place or an org' },
      ];
    },
  },
];
