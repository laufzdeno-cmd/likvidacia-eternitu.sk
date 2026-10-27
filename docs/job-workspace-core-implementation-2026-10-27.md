# Zákazková karta – backend odovzdania

Zdrojový stav 27. 10. 2026. Ide o rozšírenie existujúceho CRM, nie ďalší register zákaziek. Produkčná databáza, Gmail, SMTP ani nasadenie sa pri tejto implementácii nepoužili.

## Rozhodnutia a hranice

- Existujúce `BusinessJob.id` aj URL zostávajú identitou zákazky. Číslo `ZAK-rok-prefix UUID` je stabilný čitateľný identifikátor; nevydáva sa za účtovné poradové číslo.
- Nové údaje sú typované v `job-workspace-types.ts`. PostgreSQL má prídavné tabuľky, lokálna evidencia má jediný `jobWorkspace` oddiel v existujúcom súbore a používa jeho medzi procesmi zdieľaný zámok a atómové premenovanie.
- Prechod prijatej CP a prepojenie jednej zákazky patria do jednej transakcie. Rovnaký hash PDF, číslo alebo Gmail identifikátor nevytvoria ďalší záznam ani neprepíšu dôkaz. Kolízia čísla s iným originálom sa zastaví na kontrolu.
- Generované CP zostávajú v `price_offers`; ručné PDF majú jasné `source: MANUAL_PDF` a pôvodné číslo. Spoločný prehľad a vyhľadávanie pracujú s oboma zdrojmi. Nie sú vytvárané vymyslené m² alebo sadzby podľa celkovej ceny.
- Neznáme množstvá, kg, ceny a nové termíny zostávajú `null`. Kompatibilné staré numerické polia nového importu môžu mať nulu, ale podrobné položky ju nepovažujú za známe množstvo. Neznáma cena má v PostgreSQL `total_price IS NULL` a v starom TypeScript rozhraní explicitné `totalPriceKnown: false`.
- Staré `demolitionDate` pri neznámom termíne vracia prázdny reťazec; nedopĺňa sa dnešný dátum. Nový plán odlišuje predbežný, dohodnutý a skutočný deň. Skutočné odoslania, podania, rozhodnutia a vykonanie nesmú byť v budúcnosti.

Skutočný deň má samostatnú serverovú autoritu `actualDateOverride`. Jeho explicitná zmena alebo vymazanie v karte atomicky upraví aj `business_jobs.demolition_date`, bezpečný príznak `actualDateOverridden`, revíziu a audit. Predbežný ani dohodnutý deň sa do tohto poľa nekopíruje. Staré formuláre po prevzatí autority zachovajú aktuálny skutočný deň vrátane výslovne vymazanej hodnoty; nemôžu ho obnoviť zo zastaraného formulára. Historický minulý deň sa preberá len pri dokončených stavoch. Zmeny takého ešte legacy spravovaného dňa aktualizujú aj revíziu karty, aby sa zastaraný zápis zastavil na CAS kontrole. Ročný filter preto nájde nový skutočný deň a nevynechá prijatý import po vykonaní práce.

## API

`job-workspace-db.ts` poskytuje:

- `getJobWorkspace`, `saveJobWorkspace`: revízia a optimistický zápis, materiály, úrady, operatíva a časová os. Operátor nedostane finančnú časť ani finančné udalosti a nemôže ju podstrčiť v zápise. V PostgreSQL sa tieto polia ani nevyberajú do operátorského čítania.
- `importManualPriceOffer`, `getManualPriceOffer`, `listManualPriceOffers`, `updateManualPriceOffer`, `verifyManualPriceOfferSent`, `recordManualPriceOfferOutcome`, `acceptManualPriceOffer`: koncept, overené odoslanie bez nového emailu, prijatie aj odložená/odmietnutá ponuka s dôvodom a históriou. Pôvodné PDF a číslo sú nemenné; pracovné údaje konceptu sú opraviteľné. Odoslaná dohoda sa spätne neprepisuje.
- `registerJobPrivateDocument`, `bindJobPrivateDocument`, `getJobPrivateDocument`, `listJobPrivateDocuments`: len identifikátory súkromného úložiska. Nepriradený súbor číta vlastník alebo superadmin. Po priradení sa nedá presunúť na inú zákazku. Fyzický upload, zmenšenie fotografií a autorizovaná cesta na čítanie patria súkromnému súborovému adaptéru.
- `appendJobCommunication`, `listJobCommunications`: overené správy, ručné poznámky a prílohy existujúcej zákazky. Gmail zdroj pripája superadmin. Jedna zdrojová správa sa nemôže priradiť k dvom kartám. Prílohy sa overia a priradia v rovnakej transakcii.
- `prepareAuthorityNotice`, `getAuthorityNotice`, `listAuthorityNotices`, `claimAuthorityNotice`, `finalizeAuthorityNotice`: žiadny priamy SMTP príkaz. Príprava zachytí presný email objednávateľa a len skutočne podané čakajúce úrady. Rovnaký adresát a snapshot sa neduplikujú ani pri novom identifikátore POST. Opakovaná príprava neodoslaného rovnakého náhľadu obnoví revíziu; zmena údajov po náhľade vyžaduje nový náhľad. Iba jeden súbežný odosielateľ získa pokus. `SENT`, `SENDING`, `UNCERTAIN` ani `FAILED` sa automaticky neopakujú; prekontrolovanie nejasného výsledku ostáva ľudská práca.
- `listJobWorkspaceOperationalSummaries`: jedno hromadné bezpečné čítanie pre kalendár. Žiadny N+1 prístup ani finančné údaje.

Zodpovedná osoba musí byť aktívny operátor alebo superadmin. Pre automatické prijatie generovanej CP sa používa existujúce nastavenie `job_workspace_default_responsible_email`, iba ak zodpovedá aktívnemu účtu; inak zostáva zodpovednosť viditeľne nedoplnená. Mená ani adresy Jarky/Slávky sa nevymýšľajú.

## Jedna finančná pravda

Príznak `priceOverride` sa spravuje na serveri. Prijatie overenej CP alebo uloženie dohodnutej/skutočnej celkovej ceny určí kanonický `business_jobs.total_price`. Skutočné vyúčtovanie má prednosť pred dohodnutou cenou. Legacy formulár cenu nesmie znovu prepočítať podľa m²; aktuálny override číta až pod rovnakým zámkom/transakciou ako zápis zákazky. Aj súbežný zápis preto zachová aktuálnu kanonickú sumu.

`BusinessJob.priceOverridden` umožňuje starému finančnému formuláru ukázať správnu celkovú cenu. `BusinessJobsSummary.unknownPriceCount` označuje neúplné záznamy; neznáma cena sa nezapočíta ako negatívny zisk a bráni finálnemu uzavretiu cez existujúci kontrolný sprievodca.

`plannedCostCents` je nový plán. `actualCostCents` je iba čítaná projekcia existujúcich evidovaných nákladov a odmien; nie ďalší nezávislý súčet na prepísanie. Faktúry, príjmy, ich skutočné platobné metódy a storná zostávajú v existujúcom ledgeri. Typ dokladu `INVOICE/OTHER_DOCUMENT/UNDECIDED` sa nepovažuje za prijatú platbu; staré `FAKTURA/CASH` nepreukazuje úhradu. Zápis novej finančnej časti nevymaže žiadnu faktúru, platbu ani storno.

Stav a druh práce majú zdroj v `business_jobs`; nová karta ich synchronizuje v jednej transakcii a čítanie premieta zmeny zo starého formulára či sprievodcu. Zákaz `DOKONCENA`/znovuotvorenia mimo kontrolného postupu platí aj pri ručnom POST. Prijatie CP existujúcu pokročilejšiu alebo dokončenú zákazku nevracia späť. Zrušená zákazka vyžaduje samostatné kontrolované znovuotvorenie.

Trvalé vymazanie zákazky s novým súkromným dokladom, CP, komunikáciou, oznámením alebo uloženou revíziou karty je výslovne zablokované v oboch úložiskách. Použije sa archivácia, ktorá zachová originály a väzby; lokálna evidencia nevytvorí osirelé záznamy. Prázdny starý skúšobný záznam bez dokladov zostáva odstrániteľný.

## Vyhľadávanie

`searchAdminData(query, includeFinance, options = {})` zachováva existujúce volania. `options` podporuje stránku, veľkosť 1–100, rok, stav, vedomé zahrnutie archívu, zodpovednú osobu a druh práce. Vráti skupiny aj `pagination` s úplnými počtami. Všetky slová sa hľadajú naprieč povolenými poľami, bez diakritiky, aj v poznámkach, komunikácii a pôvodných číslach CP. CP filtre mapujú rovnaký obchodný význam generovaných aj ručných stavov. Rok zákazky používa vykonanie/dohodnutý/predbežný alebo starý pracovný dátum; pri ručnej CP dátum vystavenia, nie deň importu.

PostgreSQL robí párovanie, počítanie, `LIMIT/OFFSET` vo vnútri databázy. Neukladá sa nový externý index. Operátorská požiadavka nespustí dotaz na faktúry; superadminová skupina používa explicitnú obmedzenú projekciu. Žiadne neobmedzené načítanie celého obsahu CRM do aplikácie, žiadne tiché zahodenie výsledkov po dvadsiatom.

## Migrácia a prijatie

`migrateJobWorkspaceSchema(db)` z `job-workspace-migration.ts` je explicitný dopredný a opakovateľný krok. Vytvára prídavné tabuľky a indexy, povoľuje neznámy termín/cenu a pridáva marker celkovej ceny. Funkcia sa nikdy nevolá z requestu alebo bežného inicializátora. Pred produkčnou migráciou patrí samostatná kontrola kandidáta, záloha/rollback plán a povolenie produkcie. V tejto etape sa na produkcii nespustila.

Overenie zdroja:

- `node --import tsx scripts/job-workspace.integration.mjs local`: PASS, **70 kontrol**.
- `node --import tsx scripts/job-workspace.integration.mjs postgres`: PASS, **71 kontrol**, dočasný PostgreSQL/PGlite na loopbacku.
- `node --test scripts/admin-intelligence.contract.test.mjs`: **14/14 PASS**.
- TypeScript `--noEmit`: PASS pri dokončení jadra.

Scenáre zahŕňajú hash/číslo/dôkaz, nullable vstupy, súbežné prijatie, prevzatie existujúcej karty, odmietnutie zrušenej zákazky, generovanú CP s dokumentačným poplatkom, OP projekcie a podstrčené financie, súbežné legacy/canonical ceny, neznámu cenu a uzávierku, dve podania s pravdivým snapshotom, súbežný claim, nejasné odoslanie bez retry, obnovenie starého neodoslaného náhľadu, aktívnu zodpovednú osobu, budúce skutočné dátumy, cudzie/neexistujúce prílohy, Gmail deduplikáciu a vyhľadávanie starších výsledkov vrátane druhej strany a roku.

Testy neposlali email, nespustili marketingovú konverziu, nepoužili Google ani externé AI. Toto nie je potvrdenie produkčného nasadenia, funkčného Google súhlasu, prístupu do reálnej schránky ani prijatie vizuálu či celého používateľského toku; tie patria nadväzujúcemu nezávislému overeniu kandidáta.
