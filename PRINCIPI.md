# Torchio. Principi di un progetto in fieri

Primo documento, 30 luglio 2026. Fotografa lo stato del progetto al
momento della pubblicazione su GitHub e apre la fase di collaborazione, revisione, implementazione. 

## Origine

L'idea nasce il 29 luglio 2026 pomeriggio al VeDPH da una delle innumerevoli conversazioni di Emmanuela Carbé con
Federico Boschetti e poi con Angelo Mario Del Grosso (CNR-ILC «A. Zampolli»). In serata
Emmanuela Carbé ha cercato di elaborare alcuni principi per realizzare un progetto semplice,
riusabile, che risolvesse alcuni problemi dei principali sistemi di visualizzazione di edizioni digitali.
Costruisce un prototipo con l'assistenza di Claude (Anthropic), modello Fable 5; il 30 luglio mattina Del
Grosso ha proposto alcuni aggiustamenti sostanziali, recepiti e documentati
più sotto. Con questa pubblicazione la palla passa a Boschetti e Del Grosso,
e a chiunque voglia entrare: per rivedere i principi, contestarli,
migliorarli. La lingua provvisoria decisa per questi documenti è l'italiano,
perché è la lingua madre delle persone coinvolte e aiuta a condividere le idee con più precisione.

## Perché

1. **Gli strumenti stanno dettando l'ecdotica.** Molte edizioni scientifiche
   digitali si codificano pensando a ciò che il viewer sa mostrare, cioè alla
   lista di tag che lo strumento accetta. È il rapporto rovesciato: il
   modello dei dati dovrebbe comandare sull'interfaccia, non il contrario.
2. **La sostenibilità è il problema aperto.** Le edizioni pubblicate su
   server applicativi muoiono con i loro server. Dal censimento del Catalogue
   of Digital Editions (Franzini): su 358 edizioni censite, 242 dichiarano
   trascrizione TEI, ma solo 104 pubblicano l'XML sorgente, e 95 risultano
   ancora online. Due edizioni TEI su tre non danno il sorgente. -> questo rilievo numerico è stato tratto da un censimento con Claude, e dunque andrebbe verificato. Il principio di sostenibilità e il problema è però ovviamente chiaro a tutti coloro che lavorano in questo campo. 
3. **La pipeline classica è un imbuto.** TEI verso XSLT verso HTML: il foglio
   di stile distrugge il modello alla frontiera. Mesi di codifica semantica
   schiacciati in markup presentazionale, non più interrogabile. L'HTML
   prodotto è un vicolo cieco: leggibile, ma morto come dato.

## Che cosa esiste già

Prima ricognizione, da approfondire e correggere.

- **EVT 2** è lo strumento più usato in Italia e tra i più conosciuti a livello internazionale. Poggia 
  su AngularJS, fuori supporto dal 2021. **EVT 3** è in beta, con migrazione
 in corso. Lo strumento è in fase di continua implementazione e rappresenta uno dei progetti più importanti di visualizzazione.
- **CETEIcean** (TEI-C) rende ogni elemento TEI come custom element nel
  browser, senza conversione: resa garantita, con qualche limite: niente apparato, indici, facsimile, export.
- **TEI Publisher** (e-editiones) ha una via statica, ma per generarla serve
  comunque un'istanza in esecuzione.
- **dse-static-cookiecutter** (ACDH-CH, Vienna) è il progetto più prossimo a questo:
  XSLT più GitHub Actions più Pages, con indici e mappe, usato per decine di
  edizioni. Richiede però una toolchain da sviluppatori, l'interfaccia viene
  da template da adattare, e non c'è un modello dei dati riusabile.

## I principi

1. **Nulla è mai invisibile.** Ogni documento TEI ben formato deve essere preservato anche nella visualizzazione: perché ogni segno rappresenta una scelta precisa. I
   costrutti sconosciuti cadono su una resa di base garantita, e tuttavia non vengono
   scartati. Sul documento invalido il motore degrada, non si rompe: la
   validazione appartiene alla CI del repository dell'edizione.
2. **I comportamenti stanno sulle classi, non sui tag.** La TEI ha oltre 500
   elementi ma li organizza in poche decine di classi di modello. Le regole
   di resa si scrivono per classe; gli elementi ereditano. La mappa è
   generata dal `p5subset` ufficiale (P5 4.12.0: 588 elementi, 127 classi di
   modello, 86 classi di attributo, 35 datatype) e la copertura totale è un
   test automatico, rieseguibile a ogni release TEI. Mai sviluppo guidato
   dagli esempi: gli esempi sono casi di test, non specifica.
3. **L'ODD decide, non lo strumento.** La personalizzazione ODD dell'edizione
   è la sua configurazione: i moduli inclusi, gli elementi esclusi, e
   soprattutto gli elementi custom, che dichiarati `memberOf` di una classe
   TEI ne ereditano il comportamento senza una riga di codice. La conformità
   ha due strati: quello
   sintattico è decidibile meccanicamente; quello semantico (l'estensione è
   lecita solo per fenomeni che P5 non copre) richiede giudizio, e lo
   strumento deve segnalare.
4. **L'edizione è il modello.** Il motore trasforma il TEI in un modello di
   dati documentato (documenti, registri di entità, testimoni, mani, strati,
   apparati tipizzati); ogni pagina e ogni export (XML, CSV, JSON) è una
   proiezione del modello. Stesso XML, stesso modello, byte per byte.
5. **Niente backend.** Il repository è l'edizione: git le versioni, la CI la
   validazione, l'hosting statico la pubblicazione, l'archivio con DOI la
   conservazione. Lo stesso codice gira nel browser e in Node. Chi pubblica
   può ovviamente clonare.
6. **Il markup decide l'esistenza, il manifesto decide le modalità facoltative.** Pagine e
   funzioni esistono se il markup le sostanzia (un'edizione senza apparato
   non ha il bottone dell'apparato; un registro senza occorrenze non genera
   un indice). Un piccolo `torchio.json` facoltativo decide presenza, ordine,
   etichette, tema, lingua, pagine libere in Markdown.
7. **La scala dei quattro gradini.** Non si possono stabilire in anticipo le
   visualizzazioni di tutti gli universi TEI possibili. Il sistema regge
   perché degrada: resa di base (garantita), comportamento di classe (la
   maggioranza dei casi), pezzi progettati (apparato, indici, mappe...), e
   per la coda un suggeritore che propone. Ogni proposta automatica si
   materializza in regola esplicita approvata dall'editore, con provenienza
   dichiarata: mai decisioni a tempo di lettura.
8. **L'editore nel circuito.** La riconciliazione delle entità (luoghi con
   GeoNames, persone e istituzioni con identificatori d'autorità) produce un
   file di proposte accanto al TEI: la macchina propone, l'editore conferma,
   corregge o rifiuta, e le sue decisioni sopravvivono alle rigenerazioni.
   Le coordinate dichiarate nel TEI vincono sempre; ogni dato porta la sua
   provenienza, anche visivamente.
9. **L'accessibilità.** Contrasto WCAG AA
   asserito nella suite per ogni tema, accesso da tastiera a ogni funzione,
   landmark e semantica dei dialoghi. Un'edizione generata deve poter essere
   pubblicata da un ente pubblico così com'è.
10. **Le forme prima delle categorie.** Le analisi universali interne
    riguardano le forme (concordanze, frequenze), valide per ogni lingua. Il
    lemma non è un universale: non tutte le lingue si lemmatizzano. Ogni
    raggruppamento di forme (lemma, stemma, radice, normalizzazione grafica)
    è un adattatore che dichiara la propria strategia per edizione.
11. **La cura sopra, la completezza sotto.** Le pagine espongono sintesi
    curate (la scheda dell'edizione, il registro dei documenti), ma il dato
    integrale resta sempre raggiungibile: l'intestazione TEI si rende per
    intero, con le etichette derivate dal markup, così i metadati nuovi
    compaiono senza toccare l'interfaccia.
12. **Tutto è reversibile e attribuito.** Codice MIT, citazione con
    CITATION.cff, fonti dei dati dichiarate, contributi riconosciuti.
13. **La tesi è falsificabile.** Il progetto scommette che le correzioni
    richieste dalle edizioni nuove calino con l'uso, genere per genere, e che
    restino assegnazioni dentro una tabella finita o estensioni additive, mai
    chirurgia sul motore. Non serve crederci: si misura. Ogni correzione è
    registrata in [CORREZIONI.md](CORREZIONI.md) con data, edizione che l'ha
    imposta e natura. Se dopo un numero ragionevole di edizioni di un genere
    le correzioni per quel genere non calano, o se diventa ricorrente la
    chirurgia sul motore, la tesi è falsificata, e sarà scritto qui.

## Il metodo

**La specifica viene dal sistema di classi, il corpus la corregge.** La
tabella classi verso comportamenti è stata scritta a partire dalle Guidelines
e dal `p5subset`, mai dagli esempi. 

Sono stati raccolti degli esempi per formare una sorta di **corpus di
contrasto**: dal Catalogue of Digital Editions sono state filtrate 95
edizioni TEI con XML scaricabile ancora online; sei casi sono stati scaricati
e analizzati per intero (Faust-Edition, Shelley-Godwin Archive, carteggio
Thun, ELTeC italiano, DraCor italiano, Bellum Alexandrinum della Digital
Latin Library: 7.692 file, 228 elementi distinti).

Il contrasto ha prodotto tredici correzioni alla specifica, tra cui: le mani
come dimensione di prima classe (l'elemento più frequente dell'intero corpus
è `handNote`); il frontespizio e i paratesti, assenti dalla prima stesura; le
lacune dei testimoni, senza le quali "ogni testimone è un testo derivabile"
costituirebbe testi inesistenti; la citazione canonica; la risoluzione di
XInclude; le radici TEI non canoniche.

**Il flusso di lavoro** procede per fasi, ognuna con un risultato
verificabile: specifica; motore (parser, classi, ODD, modello); composizione
(pagine, temi, manifesto); pezzi (apparato, entità, livelli, indici, mappe,
export); confezione (template repository e configuratore nel browser); casi
reali; pubblicazione scientifica.

## Gli aggiustamenti di Angelo Mario Del Grosso (30 luglio mattina)

1. **I web components sono comportamenti di fruizione astratti**, non
   elementi TEI: componenti riusabili (comparsa, commutatore, sinossi,
   facsimile) che qualunque markup attiva. Niente granularità per tag.
2. **La conformità va giudicata su due strati.** Un elemento custom può
   essere sintatticamente lecito (namespace proprio, dichiarato nell'ODD) e
   semanticamente illegittimo se duplica un fenomeno che P5 già copre. Il
   primo esempio usato nei test (`cancellatura`, che duplicava `del`) era
   esattamente questo errore: è stato sostituito con `salvataggio`, lo strato
   di salvataggio automatico nei manoscritti born-digital, che P5 non copre.
   L'errore va addosso all'editore al momento della stampa, mai al lettore.

## Stato del prototipo (30 luglio 2026)

Il prototipo in questo repository: parser XML senza dipendenze; mappa delle
classi generata da P5 con overlay ODD e test di copertura totale; modello
dell'edizione deterministico; siti a più pagine (edizione, testo, front e
back matter, indici, mappa, dati, pagine libere); collezioni con registro
ordinabile e filtrabile e una pagina per documento; apparato a comparsa sul
lemma; livelli di trascrizione; tre temi con contrasto verificato; interfaccia
in italiano e inglese; export del modello, delle entità e dell'apparato;
riconciliazione dei luoghi su gazetteer GeoNames con l'editore nel circuito.
La suite conta 108 asserzioni. Quattro edizioni dimostrative con diritti
verificati: l'Odissea (Perseus), trenta lettere di Van Gogh (Van Gogh Museum
e Huygens ING), il Bellum Alexandrinum (Digital Latin Library, con apparato
critico a tre registri) e uno Specimen costruito a scopo didattico.

## Agenda

1. **Il configuratore nel browser** (strada A): trascini i TEI, scegli
   pagine, tema e pezzi con anteprima immediata, scarichi il repository
   pronto. Nessun caricamento verso alcun server.
2. **L'API dei plugin** come web components di fruizione (da Del Grosso), con
   il manifesto che li dichiara.
3. **Il DSL d'apparato** (linea Euporia): l'apparato scritto nella notazione
   compatta della tradizione a stampa, compilato nel modello. L'ingresso non
   è solo XML: il modello è il perno, le serializzazioni sono adattatori.
4. **Il suggeritore** (RAG): per i costrutti senza comportamento, recupero da
   glosse e esempi del p5subset, dalla specifica e dal corpus, e proposta di
   rese; per la conformità semantica, segnalazione dei probabili duplicati
   confrontando le descrizioni dell'ODD con quelle dei 588 elementi P5.
   Sempre a tempo di composizione, sempre materializzato, sempre con
   provenienza.
5. **Concordanze e frequenze delle forme** (tokenizzazione Unicode nativa),
   con i raggruppatori dichiarati per edizione.
6. **Collezioni avanzate**: linee del tempo, reti, sinossi dei testimoni,
   testo del singolo testimone derivato dal modello.
7. **Il rapporto di conformità** integrato nella CI (strict: la build fallisce
   sul sintattico, chiede conferma scritta sul semantico).
8. **I test**: prendere i TEI di edizioni pubblicate e
   stamparle senza configurazione.

## Materiali e diritti

Codice MIT. Dati delle classi generati dal `p5subset` (TEI Consortium,
licenza duale CC BY 3.0 / BSD-2). Demo: Odissea da Perseus Digital Library
(CC BY-SA 4.0); lettere di Van Gogh da Van Gogh Museum e Huygens ING via
e-editiones (CC BY-NC-SA 4.0). Ricerche geografiche su dati derivati da
GeoNames (CC BY 4.0). Il corpus di contrasto non è incluso nel repository:
la lista delle 95 edizioni e il metodo sono descritti sopra e riproducibili.
