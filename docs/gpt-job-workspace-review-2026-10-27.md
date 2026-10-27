# Nezávislé prijatie zákazkovej karty – 27. 10. 2026

**Výsledok: PASS pre schválený zdrojový a lokálne overený rozsah.** V preverovanom rozsahu nezostal otvorený blokujúci nález. Toto prijatie nepotvrdzuje produkčné nasadenie, živé pripojenie Gmailu ani úplný úspech všetkých historických testov projektu.

Kontrolór: `job_workspace_acceptance`. Autor hodnoteného aplikačného kódu a nezávislý kontrolór boli rozdielni agenti. Kontrolór aplikačný kód neupravoval; chyby hlásil autorom a následne preveroval ich opravy.

Východisko: commit `366d64930a0860edae7b005f4be2f504430cfe68`. Schválený zámer a merateľné kritériá sú v [pláne zákazkovej karty](job-card-workflow-proposal-2026-10-27.md). Majiteľ potvrdil Gmail pre ponuky a komunikáciu, PDF formát ručných ponúk a používanie iba schválených prevádzkových služieb bez externého AI či zdieľania zákazkových údajov.

## Prijatý rozsah

- Jedna súkromná karta existujúcej zákazky, stabilné číslo, oprávnenia operátora a superadmina, zodpovedná osoba a história zmien.
- Pôvodná PDF ponuka pod vlastným číslom, súkromný nezmenený originál, overenie pracovných údajov, dôkaz pôvodného odoslania bez ďalšieho emailu, odloženie/odmietnutie s dôvodom a následné prijatie.
- Prijatie ručnej aj generovanej CP vytvorí alebo prepojí jednu zákazku. Existujúca pokročilejšia či dokončená zákazka sa nevracia do prípravy.
- Oddelené podania OÚ ŽP a RÚVZ, skutočné dátumy a súkromné doklady, pravdivý náhľad oznámenia a výslovné schválenie odoslania.
- Materiály s jednotkami, plán/skutočnosť, predbežný/dohodnutý/skutočný deň, posádka, autá, hmotnosť, vybavenie a ručné kilometre. Viac zákaziek denne a upozornenia na možné kapacitné konflikty.
- Súkromné fotografie s náhľadmi, WebP a odstránením metadát, kontrolované priradenie komunikácie a samostatná tlač pre posádku bez financií.
- Vyhľadávanie podľa viacerých slov, poznámok a pôvodných čísel, roky, stavy a stránkovanie bez externého indexu alebo citlivého dotazu v URL.
- Jedna autoritatívna cena, odvodené skutočné náklady z pôvodnej evidencie, zachovanie existujúceho platobného ledgera a oddelenie stavu práce od úhrady.
- Pripravený Gmail adaptér a kontrolné rozhranie superadmina. Čítanie zostáva predvolene vypnuté; syntetické testovanie nie je pripojením reálnej schránky.

## Pôvodné blokéry a overené opravy

| Nález | Oprava a dôkaz | Stav |
| --- | --- | --- |
| Pracovná karta a pôvodná evidencia mali rozdielny stav/druh práce. | Zápis synchronizuje rodiča v transakcii, čítanie rešpektuje aktuálny rodičovský stav. Dokončenie chráni pôvodný kontrolný sprievodca. | Uzavreté |
| PDF za 1 230 € mohlo vytvoriť zákazku s pôvodnou finančnou cenou 0 €. | Kanonická cena sa zapisuje bez vymyslenej výmery/sadzby. Nezávislá reprodukcia potvrdila 1 230 € a následnú skutočnú cenu 1 500 € aj v pôvodnej projekcii. Neznáma cena je výslovne neznáma. | Uzavreté |
| Uloženie starého formulára mohlo pri súbehu vrátiť staršiu cenu. | Autoritatívna cena sa číta pod rovnakým rodičovským zámkom ako zápis. Tri súbežné prípady prešli lokálne aj v PostgreSQL. | Uzavreté |
| Prijatie PDF k už existujúcej karte neprevzalo prvú dohodnutú sumu ani potvrdený stav. | Nezávislá reprodukcia: pôvodná zákazka za 100 € zostala pod rovnakým UUID, po prijatí PDF mala `PONUKA_POTVRDENA`, 1 230 € a správnu dohodnutú sumu. Zrušená zákazka sa bez kontrolovaného postupu neotvorí. | Uzavreté |
| Po drobnej zmene karty sa neodoslaný náhľad oznámenia mohol natrvalo zaseknúť ako zastaraný. | Rovnaký neodoslaný náhľad možno bezpečne obnoviť na aktuálnu revíziu. Nezávislý beh potvrdil jeden úspešný claim; finálny alebo nejasný pokus sa neopakuje. | Uzavreté |
| „Skutočné“ dátumy mohli byť budúce, úradný doklad mohol patriť inej karte. | Server odmieta budúce skutočné dátumy a cudzie/neexistujúce doklady. Oznámenie obsahuje iba skutočne podané čakajúce úrady. | Uzavreté |
| Pri trvalom vymazaní sa lokálna a PostgreSQL evidencia správali rozdielne. | Obe odmietajú vymazanie zákazky s novými súkromnými dôkazmi alebo uloženou kartou a odporučia archív. Doklady, správy a revízie zostali zachované; prázdna stará zákazka je naďalej odstrániteľná. | Uzavreté |
| Skutočný deň z novej karty sa nemusel dostať do pôvodného dátumu a ročného filtrovania. | Skutočný zápis aj vymazanie majú jednu autoritu, audit a atómovú synchronizáciu. Starý formulár neobnoví zastaraný deň. Predbežné a dohodnuté termíny sa za skutočnosť nevydávajú. Historická úprava zvýši revíziu a zablokuje starý súbežný zápis. | Uzavreté |
| Rozhranie bolo príliš dlhé a niektoré filtre/stavy neboli jednotné. | Karta má zbalené časti a funkčnú navigáciu, aktívnych vlastníkov, zjednotené stavy PDF, prijatie odloženej ponuky a kontrolované filtre vyhľadávania. | Uzavreté v preverovanom rozsahu |

## Nezávisle vykonané kontroly

| Kontrola | Výsledok |
| --- | --- |
| Finálny lokálny zákazkový tok vrátane dátumov a vymazania | **70 kontrol PASS** |
| Rovnaký tok v dočasnom PostgreSQL/PGlite | **71 kontrol PASS** |
| Kontrakty vyhľadávania, súkromia a existujúcich adminových hraníc | **14/14 PASS** |
| Prvý nezávislý beh súkromného PDF/Gmail/foto dielu | **9/9 PASS** |
| Samostatné reprodukcie pôvodných finančných a náhľadových defektov | **Po oprave PASS** |

Databázové kontroly prebiehali na fiktívnych záznamoch v dočasnom úložisku alebo lokálnom PostgreSQL/PGlite. Výsledky uvádzali `emailsSent: 0` a `productionTouched: false`. Neboli načítané produkčné tajomstvá ani správy z reálneho Gmailu.

Nadväzujúci integračný log [job-workspace-regression-final.log](../test-results/job-workspace-regression-final.log) som prečítal: integrátorov samostatný beh potvrdzuje **43/43 PASS**, vrátane existujúcich cenových ponúk, bezpečnosti náhľadov, izolácie a príslušných TypeScript testov. Tento samostatný výsledok nemení neúspešnú historickú prvú fázu celej unit sady na celkové PASS.

Strojový záznam kontroly a odtlačky zdrojov: [job-workspace-independent-acceptance-2026-10-27.json](../test-results/job-workspace-independent-acceptance-2026-10-27.json).

Prečítaný finálny [záznam integrátorovho izolovaného produkčného buildu](../test-results/job-workspace-build.json) po poslednej dátumovej oprave uvádza **PASS**, čas `2026-10-27T17:41:43.551Z` a odtlačok zdrojov `740698d2154f876808d5347e371d091863340c32741ff4037ab9cd6dfbb0a8c2`. Overené je zahrnutie PDF workeru do výstupu a výsledok **`bundledPdfParser: TEXT`**. Ide o lokálny produkčný build a jeho zaznamenanú runtime skúšku, nie o nasadenie na ostrú doménu.

## Grafické a používateľské overenie

Kontrolór si nezávisle prezrel desktopovú pracovnú kartu aj mobilné výrezy v šírkach 390 a 320 px a následne finálne podklady importu, otvoreného vyhľadávania a Gmail rozhrania. **Grafický PASS pre zobrazené stavy:** text je čitateľný, sekcie sú rozlíšené podľa účelu, karty sa neprekrývajú a mobilná navigácia sa zmestí. Predvolene zbalené časti odstránili zbytočne dlhú počiatočnú obrazovku.

Podklady:

- [Desktop pracovnej karty](../test-results/job-workspace-1440-viewport.png), [mobilný Prehľad](../test-results/job-workspace-390-overview.png), [320 px](../test-results/job-workspace-320-viewport.png).
- [Import na počítači](../test-results/job-manual-import-desktop.png), [import na mobile](../test-results/job-manual-import-mobile.png).
- [Vyhľadávanie na mobile](../test-results/job-search-mobile.png), [Gmail kontrola na mobile](../test-results/job-gmail-mobile.png).

[Správa UI implementátora](job-workspace-ui-implementation-2026-10-27.md) dokladá záverečný izolovaný browserový priebeh: digitálne PDF sa vyčítalo ako `TEXT` cez skutočný Next.js upload, človek overil položky, zaevidoval už odoslanú CP, odložil ju a následne prijal. Vznikla jedna zákazka s cenou 3 690 € a správne vyhľadateľným originálom. Prešiel aj súkromný PDF/WebP, odmietnutie anonymného čítania, operátorské hranice, tlač bez financií a štyri šírky bez horizontálneho presahu.

Gmail správa v browserovom scenári bola **synteticky pripravená v izolovanom úložisku**. Kontrolované priradenie vytvorilo jeden komunikačný záznam; nešlo o test čítania skutočnej schránky. Chyba Webpack načítania PDF modulu bola počas integrácie odhalená a opravená; samotný ručný fallback sa nepovažoval za úspech automatického vyčítania.

## Staré pády celej testovacej sady

Nezávislé porovnanie používalo dve oddelené zdrojové kópie a rovnaký runtime, bez živých `.env` či provider konfigurácií. Externé spojenia blokoval loopback guard. Sledovaná verejná `.env.example` zostala zachovaná ako súčasť testovaných zdrojov.

| Prvá `node --test` fáza | Testov | PASS | FAIL |
| --- | ---: | ---: | ---: |
| Pôvodný commit `366d6493` | 629 | 612 | 17 |
| Zachytený kandidát | 648 | 633 | 15 |

**Žiadny nový názov pádu kandidáta.** Všetkých 15 zostávajúcich pádov sa reprodukovalo aj na pôvodnom commite, v byte-identickom zdroji testu, na rovnakej asercii, s rovnakým typom chyby a operátorom. Týkajú sa starších obsahových a zdrojových kontrol vrátane regionálnych stránok, realizácií, FAQ a historických dôkazov prijatia.

Jeden pôvodný health fixture test v kandidátovi po úprave prešiel. Druhý rozdiel bol časový výpadok pôvodného SEO checkeru pri plnej záťaži; samostatné opakovanie nezmeneného starého testu prešlo 1/1. Neoznačuje sa za opravu produktu.

Presné názvy, logy, zdrojový snapshot a hranice porovnania: [comparison.corrected.md](../test-results/unit-baseline-acceptance-suite-7qY6tG/comparison.corrected.md), [comparison.corrected.json](../test-results/unit-baseline-acceptance-suite-7qY6tG/comparison.corrected.json). Prvý diagnostický baseline pokus bez sledovanej šablóny je ponechaný a výslovne vylúčený z konečného porovnania.

**Kompletná unit sada nie je PASS.** Druhá TypeScript fáza pôvodného npm reťazca sa po zlyhaní prvej fázy v tomto porovnaní nespustila; vyššie uvedených 43 úspešných kontrol pochádza zo samostatného nadväzujúceho behu integrátora.

## Hranice pred produkciou

1. **Nasadenie čaká na schválenie presného kandidáta.** Explicitná dopredná migrácia a nový presne pripnutý `pdfjs-dist@6.4.299` musia prejsť existujúcim riadeným release postupom. Ochrana nasadenia sa nesmie plošne oslabiť.
2. **Gmail zostáva vypnutý.** Skutočné čítanie vyžaduje potvrdené Google overenie, oficiálny súhlas povoleného účtu a nastavenie superadmina. Tento report nepripája schránku, neobchádza varovanie Googlu ani neschvaľuje platené posudzovanie.
3. **Živé služby nie sú týmto prijaté.** Produkčná migrácia, Blob/OIDC prístup, skutočné SMTP doručenie zákazníkovi a produkčný rollback vyžadujú kontrolu finálneho kandidáta v príslušnej schválenej etape. Lokálny PASS ich nenahrádza.
4. Verejné a adminové rozhranie majú vo zdroji oddelené klientské komponenty; adminový layout nepripája verejné analytické widgety. Živá skúška s produkčnými tracking credentials sa v tomto audite nerobila. Nové súkromné údaje sa nesmú zapojiť do reklám ani externého AI.

Po splnení produkčných brán možno túto ohraničenú etapu nasadiť a preveriť na ostrých službách v schválenom rozsahu. Nové nápady ani ďalšie funkcie nie sú podmienkou tohto zdrojového prijatia.
