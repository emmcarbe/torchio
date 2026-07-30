/**
 * Interface strings. Two languages for now: English and Italian.
 * The edition's text language is the TEI's business; this is only the chrome
 * (toolbar, page names, labels). Chosen via manifest "lang"; when absent,
 * derived from the edition's declared language (langUsage), falling back to
 * English.
 */

const STRINGS = {
  en: {
    edition: 'Edition', text: 'Text', indices: 'Indices', data: 'Data',
    reading: 'Reading', diplomatic: 'Diplomatic', apparatus: 'Apparatus',
    aboutFile: 'About this file',
    dse: 'digital scholarly edition',
    responsibility: 'Responsibility', licence: 'Licence', witnesses: 'Witnesses',
    apparatusRegisters: 'Apparatus', revisions: 'Revision history', generator: 'Generator',
    people: 'People', places: 'Places', orgs: 'Organisations',
    occurrenceOne: 'occurrence', occurrenceMany: 'occurrences', entries: 'entries',
    skip: 'Skip to content', publishedWith: 'Published with',
    map: 'Map',
    mapAria: 'Map of the places of the edition',
    mapNote: 'Positional sketch. Filled dots: coordinates declared in the TEI or confirmed by the editor. Hollow dots: gazetteer suggestions awaiting review. Each place links to OpenStreetMap. Coastlines: Natural Earth (public domain).',
    front: 'Introduction', back: 'Appendices',
    sectionsN: 'sections', sectionOne: 'Section', contents: 'Contents',
    bookLabel: 'Book',
    register: 'Register', documentsN: 'documents',
    dateCol: 'Date', fromCol: 'From', toCol: 'To', authorCol: 'Author',
    placeCol: 'Place', titleCol: 'Title', idnoCol: 'Ref.',
    filter: 'Filter\u2026', prev: '\u2039 previous', next: 'next \u203a',
    fullHeader: 'The full header (teiHeader)',
    fullHeaderNote: 'Everything the file declares, rendered as it is.',
    reuse: 'Reuse under the edition licence (see the Edition page).',
    appEntry: 'apparatus entry',
    descrModel: 'the edition model: documents, registries, apparatus (JSON)',
    descrEntities: 'people, places and organisations with occurrence counts and coordinates',
    descrApparatus: 'every apparatus reading with its witnesses, one row per reading',
    descrSource: 'the unmodified TEI source file',
  },
  it: {
    edition: 'Edizione', text: 'Testo', indices: 'Indici', data: 'Dati',
    reading: 'Lettura', diplomatic: 'Diplomatica', apparatus: 'Apparato',
    aboutFile: 'Scheda del file',
    dse: 'edizione scientifica digitale',
    responsibility: 'Responsabilità', licence: 'Licenza', witnesses: 'Testimoni',
    apparatusRegisters: 'Apparati', revisions: 'Storia delle revisioni', generator: 'Generatore',
    people: 'Persone', places: 'Luoghi', orgs: 'Organizzazioni',
    occurrenceOne: 'occorrenza', occurrenceMany: 'occorrenze', entries: 'voci',
    skip: 'Vai al contenuto', publishedWith: 'Pubblicato con',
    map: 'Mappa',
    mapAria: "Mappa dei luoghi dell'edizione",
    mapNote: 'Schizzo posizionale. Punti pieni: coordinate dichiarate nel TEI o confermate dall\u2019editore. Punti vuoti: suggerimenti del gazetteer in attesa di revisione. Ogni luogo rimanda a OpenStreetMap. Coste: Natural Earth (pubblico dominio).',
    front: 'Introduzione', back: 'Appendici',
    sectionsN: 'sezioni', sectionOne: 'Sezione', contents: 'Indice delle sezioni',
    bookLabel: 'Libro',
    register: 'Registro', documentsN: 'documenti',
    dateCol: 'Data', fromCol: 'Mittente', toCol: 'Destinatario', authorCol: 'Autore',
    placeCol: 'Luogo', titleCol: 'Titolo', idnoCol: 'Segn.',
    filter: 'Filtra\u2026', prev: '\u2039 precedente', next: 'successivo \u203a',
    fullHeader: "L'intestazione completa (teiHeader)",
    fullHeaderNote: "Tutto ci\u00f2 che il file dichiara, reso cos\u00ec com'\u00e8.",
    reuse: "Riuso secondo la licenza dell'edizione (vedi la pagina Edizione).",
    appEntry: 'voce di apparato',
    descrModel: "il modello dell'edizione: documenti, registri, apparati (JSON)",
    descrEntities: 'persone, luoghi e organizzazioni con conteggio delle occorrenze e coordinate',
    descrApparatus: 'ogni lezione di apparato con i suoi testimoni, una riga per lezione',
    descrSource: 'il file TEI sorgente, senza modifiche',
  },
};

export function i18n(lang) {
  return STRINGS[lang] || STRINGS.en;
}

/** manifest lang wins; else the edition's first declared language; else English. */
export function resolveLang(manifestLang, model) {
  if (manifestLang && STRINGS[manifestLang]) return manifestLang;
  const first = model?.meta?.languages?.[0] || '';
  return first.toLowerCase().startsWith('it') ? 'it' : 'en';
}
