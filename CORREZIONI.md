# Registro delle correzioni

Registro previsto dal principio 13 di [PRINCIPI.md](PRINCIPI.md). Ogni
correzione richiesta da un'edizione reale viene registrata con data, edizione
e tipo.

Tipi:

- **assegnazione**: aggiunta o correzione di una voce nella tabella
  classi-comportamenti;
- **estensione**: aggiunta di una funzione, senza modifiche a quelle
  esistenti;
- **modifica strutturale**: modifica di un comportamento esistente del
  motore.

Condizioni di falsificazione della tesi (principio 13): modifiche
strutturali frequenti, o correzioni che non diminuiscono con l'uso a parità
di genere editoriale.

| Data | # | Imposta da | Natura | Correzione |
|---|---|---|---|---|
| 2026-07-30 | C1 | Faust-Edition, Shelley-Godwin | assegnazione | le mani come dimensione di prima classe (`handNote` è l'elemento più frequente del corpus di contrasto) |
| 2026-07-30 | C2 | Bellum Alexandrinum (DLL) | estensione | risoluzione dei puntatori con `prefixDef` (schemi URI privati) |
| 2026-07-30 | C3 | Faust-Edition, Shelley-Godwin | estensione | varianti a campata (`addSpan`/`delSpan`/`damageSpan` con `@spanTo`) |
| 2026-07-30 | C4 | quattro casi su sei | assegnazione | frontespizio e paratesti (`titlePage`, `front`/`back`), assenti dalla prima stesura |
| 2026-07-30 | C5 | Faust-Edition | assegnazione | `fw` (titoli correnti): nascosto in lettura, visibile in diplomatica |
| 2026-07-30 | C6 | Faust-Edition | assegnazione | testi composti (`group`, `floatingText`) |
| 2026-07-30 | C7 | Faust-Edition, Shelley-Godwin | assegnazione | operazioni genetiche oltre gli strati (`transpose`, `alt`, `join`, `move`) |
| 2026-07-30 | C8 | Bellum Alexandrinum (DLL) | assegnazione | lacune dei testimoni (`lacunaStart`/`lacunaEnd`): la derivazione del testo di un testimone deve sapere dove il testimone tace |
| 2026-07-30 | C9 | DraCor, Shelley-Godwin | assegnazione | faccette derivate dalle tassonomie dichiarate (`classDecl`) |
| 2026-07-30 | C10 | Bellum Alexandrinum (DLL) | estensione | citazione canonica (`refsDecl`, `citeStructure`) |
| 2026-07-30 | C11 | carteggio Thun | assegnazione | l'indice dichiarato (`index`) da fondere con gli indici derivati |
| 2026-07-30 | C12 | Shelley-Godwin | estensione | risoluzione XInclude (`xi:include`) |
| 2026-07-30 | C13 | Shelley-Godwin | estensione | radici TEI non canoniche (`surface` come radice) |
| 2026-07-30 | C14 | Odissea (Perseus), demo pubblica | assegnazione | i numeri di verso (`@n` su `l`) non venivano mostrati: ora ogni quinto verso porta il numero a margine |
| 2026-07-30 | C15 | Odissea (Perseus), demo pubblica | assegnazione | le partizioni strutturali del corpo (`div` di libro o sezione) diventano pagine con indice e navigazione, invece di una pagina unica |
| 2026-07-30 | C16 | Bellum Alexandrinum (DLL), demo pubblica | assegnazione | le note (`note`) interrompevano la prosa come blocchi: ora sono postille nel margine destro dove lo schermo lo consente |

Al 30 luglio 2026: 16 correzioni (11 assegnazioni, 5 estensioni, 0
modifiche strutturali).
