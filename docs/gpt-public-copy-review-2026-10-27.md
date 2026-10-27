# Nezávislá kontrola obsahu verejných podstránok

## Konečný obsahový verdikt

**PASS pre obsah a jazyk všetkých 35 verejných URL lokálneho kandidáta `CutYIWNT_m0fzhq1O1GCf`.** Pôvodné P2-1 až P2-4 sú uzavreté v rozsahu obsahovej kontroly. Nezostáva potvrdený otvorený obsahový P1/P2 v schválenom rozsahu. Tento výrok nie je potvrdením produkčného nasadenia, bežiacej produkčnej údržby, indexovania ani novým právnym overením všetkých doterajších pravidiel webu.

### Krátka finálna delta – 2026-10-27 11:09:46 UTC

- Identita kandidáta overená v `tmp/review-layout/candidate-1793097973180/.next/BUILD_ID`: **`CutYIWNT_m0fzhq1O1GCf`**. Čerstvý prehliadačový render `http://127.0.0.1:3147/` overil `/`, `/o-firme/` a `/ochrana-osobnych-udajov/`; všetky HTTP 200 a jedna H1.
- Vlastné dôkazy: `tmp/gpt-public-copy-review/final-delta.mjs`, `final-delta.json` a vizuálne prezretý `final-retention.png`. Všetkých sedem kontrol tejto delty prešlo. Test používa skutočný text karty, ktorá je v `span`; nepovažuje jej neprítomnosť v zozname `p` za chybu produktu.
- Homepage aj O firme používajú stručný odkaz na aktuálny register ÚVZ SR podľa IČO. Neobsahujú internú poznámku o tom, čo autor nedokázal overiť, a nepridávajú tvrdenie, že touto kontrolou bol znovu potvrdený právny stav spoločnosti. Karta Fotografie hovorí priamo o našich demontážach; odstránená je formulácia o „vymyslených“ údajoch.
- Konečný retenčný text sa zhoduje so zdrojom: **12 mesiacov v aktívnom systéme**, vyradenie zo štatistík po lehote, fyzické odstránenie pri dennej údržbe a možné oneskorenie pri výpadku. Oddelený odsek pravdivo rozlišuje nové zálohy bez surovej analytiky a staršie historické zálohy; pri prípadnej ručnej obnove vyžaduje vynechanie alebo odstránenie starej analytiky pred sprístupnením systému. Neprisudzuje aplikácii automatickú restore bránu ani netvrdí, že historické zálohy už boli vymazané.
- Prečítaný nezávislý backendový výsledok `docs/gpt-analytics-retention-review-2026-10-27.md`: **PASS zdrojového patchu a izolovanej akceptácie**, vrátane lokálnych/PGlite a skutočných PostgreSQL 17 timeout skúšok. Tieto testy tento obsahový kontrolór druhý raz nespúšťal; ich nezávislé dôkazy nezamieňa za produkčnú prevádzku. Verejný text významovo zodpovedá prijatej implementácii a jej výpadkovým/zálohovým hraniciam.
- Zostávajúce stránky boli obsahovo prijaté v druhom kole nižšie; finálna kontrola sa zámerne obmedzila na oznámenú zmenu, bez nového plošného auditu. **Aktuálny per-page verdikt je PASS aj pre `/ochrana-osobnych-udajov/`**, čím sa uzatvára výnimka v staršej matici.

**Neoverené:** skutočné produkčné spustenie cronu, reálny backlog, odstránenie historických záloh, produkčné doručenie e-mailov a indexovanie. Obsahový PASS je pripravenosť uvedeného kandidáta; produkčný stav ostáva samostatné overenie po schválenom nasadení. Grafiku a jedinečnosť fotografií prijíma samostatný vizuálny kontrolór. Tento kontrolór neupravil aplikačný kód, nespustil odosielania ani nasadenie.

## Druhé kolo – predchádzajúci medzivýsledok

**PASS obsahu a jazyka na všetkých 35 URL, s výnimkou finálneho retenčného odseku, ktorý čaká na potvrdenie presného konečného buildu.** Pôvodné opraviteľné skupiny P2-1 až P2-3 aj tri menšie odporúčania sú uzavreté. V novom renderi som nepotvrdil nový obsahový P1/P2. Toto je prijatie lokálneho textového kandidáta; nie produkcie, nasadenia, grafiky ani vykonávania retencie.

### Vlastný nový dôkaz

- Lokálny render `http://127.0.0.1:3147/`, izolovaný kandidát `tmp/review-layout/candidate-1793097215829`, build **`A1N4rEMkS7fveB01k0CQ2`**. Identita overená v jeho `.next/BUILD_ID`.
- Nová snímka **2026-10-27 10:44:01 UTC**: `tmp/gpt-public-copy-review/rendered-copy-round2.json`; súhrn `round2-summary.json`; vlastný prehliadačový skript `recheck.mjs`.
- Znovu načítaných 35/35 URL zo sitemapy, všetky HTTP 200, každá jedna H1. JSON-LD sa na všetkých stránkach načítal bez chyby.
- **103/103 otázok a odpovedí FAQ** z JSON-LD sa nachádza v zobrazenom obsahu. Pred porovnaním boli lokálne otvorené rozbaľovacie odpovede. Normalizuje sa iba biele miesto, nemení sa znenie. Toto overuje zhodu dát s textom, nie oprávnenosť na konkrétny výsledok vyhľadávania.
- Preverené nadpisy všetkých 35 URL a všetky zmenené odseky proti prvej vlastnej snímke. Nezmenené jedinečné texty boli čítané v prvom kole a porovnaním sa potvrdilo ich zachovanie. Znovu prečítané spoločné šablóny a opravené zdroje. Žiadna stránka nebola prijatá iba podľa autorovho tvrdenia alebo buildu.
- Bez formulárov, odoslaní a externých požiadaviek: povolené iba GET/HEAD na loopback, analytický aj marketingový súhlas odmietnutý.

### Uzavretie pôvodných nálezov

| Nález | Stav druhého kola | Dôkaz |
| --- | --- | --- |
| P2-1 – mechanická gramatika regiónov | **UZAVRETÉ** | Všetkých deväť regiónov používa otázky „Ako účtujete dopravu pri tejto zákazke?“ a „Potrebujem pred dopytom presnú výmeru?“, s prirodzeným nadpisom. Dopravná odpoveď aj bezpečnostná podmienka zostali zachované. |
| P2-2 – interné redakčné poznámky | **UZAVRETÉ** | V galérii je vecný úvod a výber typov prác. Pôsobnosť a regióny vysvetľujú konkrétny výjazd a sídlo v Poprade; nepíšu návštevníkovi poznámky o zostavovaní SEO stránok. Nevrátili sa zakázané výhrady k autorovi recenzie ani fotografie. |
| P2-3 – nesprávny dojem voliteľných polí | **UZAVRETÉ** | Článok hovorí „Vo formulári vyberiete aj typ materiálu a objektu“ a uvádza skutočnú možnosť „Neviem posúdiť“. Fotografie ostávajú voliteľné. |
| Menšie jazykové návrhy | **UZAVRETÉ** | Empatické „pokojne nám to napíšte“, prevzatie odkrytej strechy, kratší autorský blok so zachovanými oficiálnymi zdrojmi. |
| Dlhé právne odseky | **UZAVRETÉ pre čitateľnosť** | Ochrana údajov rozdeľuje odseky podľa účelu; cookies samostatne vysvetľujú súhlas, platformy, voľbu a jej uloženie. Obsahové podmienky súhlasu sa touto úpravou nemenia. |
| P2-4 – retenčný fakt | **SAMOSTATNÁ FINÁLNA KONTROLA** | Vlastník podľa koordinátora určil 12 mesiacov; aktuálny render je kratší medzikandidát. Konečné znenie už v zdroji rozlišuje aktívny systém, denné čistenie, výpadok a historické zálohy. Na jeho presný render a izolované prevádzkové dôkazy ešte nenadväzuje tento výrok PASS. |

V porovnaných zmenách nevznikli nové ceny, zákaznícke recenzie, lokálne pobočky, falošní autori ani nové tvrdenia o overených miestnych zákazkách. Dopravné pravidlo od 100 m² a pracovné dni 8:00–18:00 zostali zachované. Oficiálne zdravotné/právne odkazy sa nemenili; toto kolo neopakuje kompletné nové právne posúdenie celej stránky.

### Aktuálna matica 35 URL

| URL | Druhé obsahové kolo |
| --- | --- |
| `/` | PASS – jasná služba a cesta k dopytu. |
| `/likvidacia-azbestu/` | PASS – vlastný zámer služby, prirodzený tón. |
| `/likvidacia-eternitu/` | PASS – krytina, príprava a nadväznosť novej strechy. |
| `/cena-likvidacie-azbestu/` | PASS – cena, rozsah, porovnanie a orientačný výpočet. |
| `/postup/` | PASS – úplný postup a rozdelenie zodpovednosti. |
| `/kde-posobime/` | PASS – výber oblasti, dostupnosť a konkrétny výjazd. |
| `/faq/` | PASS – zmysluplné skupiny otázok a zhodné schema. |
| `/realizacie/` | PASS – prirodzený úvod a zrozumiteľné filtre. |
| `/recenzie/` | PASS – krátka žiadosť o skúsenosť, schvaľovanie bez falošných hodnotení. |
| `/o-firme/` | PASS – firemná identita a vysvetlenie spolupráce. |
| `/kontakt/` | PASS – konkrétne kontaktné cesty podľa potreby. |
| `/poradna/` | PASS – užitočný rozcestník ôsmich vlastných článkov. |
| `/strechari/` | PASS – konkrétna spolupráca a prirodzené odovzdanie strechy. |
| `/kariera/` | PASS – konkrétne očakávania bez vymyslenej odmeny. |
| `/spolupracujuci-strechari/` | PASS – vlastný aj hľadaný strechár a dohoda profesií. |
| `/likvidacia-azbestu-poprad/` | PASS – sprístupnenie a nadväznosť, opravená spoločná šablóna. |
| `/likvidacia-azbestu-kosice/` | PASS – prevádzkový areál a viac objektov. |
| `/likvidacia-azbestu-presov/` | PASS – rozdelenie domu, garáže a menších stavieb. |
| `/likvidacia-azbestu-zilina/` | PASS – príjazd, terén a rekreačný objekt. |
| `/likvidacia-azbestu-banska-bystrica/` | PASS – etapy a prevádzka rozsiahleho objektu. |
| `/likvidacia-azbestu-bratislava/` | PASS – státie, vjazd, spoločný priestor. |
| `/likvidacia-azbestu-nitra/` | PASS – demontáž verzus už zložené dosky. |
| `/likvidacia-azbestu-trnava/` | PASS – potvrdený a predbežný termín strechára. |
| `/likvidacia-azbestu-trencin/` | PASS – kombinácia plôch a potvrdenie rozsahu. |
| `/poradna/co-je-eternit-a-kedy-obsahuje-azbest/` | PASS – pojmy, zloženie a hranice posúdenia z fotografie. |
| `/poradna/preco-neodstranovat-eternit-svojpomocne/` | PASS – bezpečnosť, výška, odpad a príprava. |
| `/poradna/kolko-stoji-likvidacia-azbestu/` | PASS – porovnanie celých ponúk a doprava. |
| `/poradna/ake-doklady-dostanete-po-likvidacii-azbestu/` | PASS – dokumentácia, odovzdanie a usporiadanie podkladov. |
| `/poradna/ako-zmerat-strechu-pre-cenovu-ponuku/` | PASS – bezpečný odhad a konkrétny výpočet. |
| `/poradna/co-poslat-pre-nacenenie-likvidacie-eternitu/` | PASS – opravené vysvetlenie formulára a užitočný checklist. |
| `/poradna/azbest-v-interieri-vs-exterieri/` | PASS – vlastné rozlíšenie priestorov a prevádzky. |
| `/poradna/odvoz-a-balenie-azbestoveho-odpadu/` | PASS – samostatný odvoz, uloženie a nakládka. |
| `/ochrana-osobnych-udajov/` | PASS jazyka/odsekov; finálny retenčný odsek čaká na presný build a samostatné overenie vykonávania. |
| `/cookies/` | PASS – kratšie odseky a zachované súhlasové pravidlá. |
| `/podmienky-pouzivania/` | PASS – účel formulára, kalkulátora a dohody. |

### Zostávajúca hranica

Finálny retenčný odsek sa skontroluje na presnom ďalšom kandidátovi. Historické zálohy zostávajú výslovný limit, ktorý nemožno zameniť za dôkaz ich vymazania alebo existencie automatickej brány pri obnove. **Produkčné vykonanie, cron, skutočné zákaznícke dáta, e-maily a indexácia neboli overené.** Grafické prijatie a jedinečnosť fotografií vydáva samostatný kontrolór. V tomto druhom kole sa nemenil aplikačný kód a neuskutočnilo nasadenie.

---

## Archív prvého kola

**Verdikt prvého kola: RETURN WITH DEFECTS.** Zistené sú tri opraviteľné skupiny jazykových/obsahových P2 nedostatkov a jedna samostatná vecná závislosť P2 pred úplným obsahovým prijatím. Retenčná politika nie je bežná jazyková úprava a nepatrí ju rozhodovať v grafickom scope. P1 obsahový defekt som v kontrolovanom rozsahu nepotvrdil. Zelený build ani existujúci report som nepoužil ako náhradu posúdenia textov.

## Kandidát a rozsah dôkazu

- Projekt: `C:\WEB\DIGITAL24.sk\likvidacia-eternitu.sk`.
- Východiskový commit: `c4272342b8207ff27aafa9508af831c1fe56df09` + aktuálne necommitnuté obsahové a vizuálne úpravy.
- Kontrolovaný lokálny render: `http://127.0.0.1:3147/`, zostava uvedená v `tmp/review-layout/candidate.json` pri začiatku auditu: `candidate-1793094831760`, build `mleluqZFvwg3YJ6pfzPXC`.
- Snímka textov všetkých URL: **2026-10-27 10:01:54 UTC**, `tmp/gpt-public-copy-review/rendered-copy.json`.
- Prečítané zadanie, plán `public-content-renewal-2026-10-27.md`, aktuálny plán recenzií a kritériá prijatia. Preverené jedinečné odseky všetkých 35 URL, spoločné FAQ a zdroje v `advice-articles.ts`, `regional-guides.ts`, `seo-content.ts`, spoločnom `seo-components.tsx` a príslušných stránkach.
- Všetkých 35 URL vrátilo HTTP 200 a každá mala jednu H1. Čítal som aj FAQ a opakované bloky; opakovaný spoločný text sa neposudzoval ako nová jedinečná hodnota článku.
- Prehliadač mal povolené iba GET/HEAD na loopback. Nebol odoslaný formulár, e-mail ani zákaznícka referencia. Produkcia sa nemenila.

Toto je **obsahové prijatie**. Kompletné grafické prijatie, farebné kontrasty a neopakovanie fotografií posudzuje samostatný vizuálny kontrolór. Aktuálne reálne databázové recenzie, súkromné tokeny, doručenie e-mailu, indexácia Google a nová právna správnosť celej politiky sú mimo tohto overenia. Pri prázdnych lokálnych recenziách sa nemá vymýšľať obsah ani mená.

## P2-1: Regionálne otázky používajú neskloňované názvy miest

**Dôkaz:** všetkých deväť regionálnych URL. Napríklad na `/likvidacia-azbestu-banska-bystrica/` sa zobrazuje „Ako sa účtuje doprava pri zákazke v oblasti Banská Bystrica?“ a „Treba mať presnú výmeru pred dopytom z oblasti Banská Bystrica?“. Rovnaká chyba je pri Žiline, Košiciach a ďalších mestách. Ide o mechanicky dosadené kľúčové slovo, nie prirodzenú slovenčinu.

**Zdroj:** `app/seo-components.tsx`, spoločné regionálne FAQ okolo riadkov 342–343, nadpis FAQ okolo riadka 420 a nadpis plánovania okolo riadka 386. Podobné spojenie sa používa v odkazoch z `app/kde-posobime/page.tsx`.

**Reprodukcia:** otvoriť regionálnu URL, prejsť na spodné FAQ. Obrázok: `tmp/gpt-public-copy-review/regional-language.png`.

**Presná navrhnutá oprava:**

- „Ako účtujete dopravu pri tejto zákazke?“ — odpoveď ponechať presne podľa existujúceho `transportPolicy`.
- „Potrebujem pred dopytom presnú výmeru?“ — bezpečnostnú odpoveď ponechať.
- Nadpis bloku: „Otázky k zákazke a výjazdu“.
- Nadpis plánovania: „Ako pripravíme výjazd k vašej stavbe“.
- Odkaz z prehľadu oblastí môže mať neutrálne znenie „Pozrieť podmienky výjazdu“ pod už uvedeným názvom mesta.

Lokalita zostáva v title, H1, úvode, vlastnej miestnej otázke a obsahu. Netreba ju opakovať v každej spoločnej otázke ani pridávať ďalšie regionálne URL.

## P2-2: Verejné stránky obsahujú interné redakčné poznámky

**Dôkaz:**

- `/realizacie/`: „Pri starších fotkách neuvádzame lokalitu ani výmeru bez spoľahlivého podkladu.“ a „Lokality a m2 pri fotkách nevymýšľame.“
- `/kde-posobime/`: v popisku fotografie „Regionálne stránky označujú pôsobnosť, nie sieť pobočiek.“; v texte „Na každej regionálnej stránke nájdete...“ a opakovane výhrady o nepotvrdených realizáciách.
- Každá regionálna stránka: úvod „v tejto lokalite nemáme pobočku“ a opakovaná poznámka, že zoznam miest nie je zoznam pobočiek ani potvrdených realizácií. V Poprade to navyše vyznieva nejasne vedľa pravdivej informácie o sídle firmy.

Tieto vety opisujú, ako autor skladal SEO stránky. Návštevníkovi nepomáhajú pri práci so stavbou a oslabujú prirodzený tón. Majiteľ už výslovne odmietol podobné hlášky pri vlastných fotografiách ASTANA. Neznamená to, že možno fotografie falošne priradiť k novej adrese alebo mestu.

**Zdroj:** `app/realizacie/page.tsx` okolo riadkov 219 a 319; `app/kde-posobime/page.tsx` okolo riadkov 38, 52 a 100; `app/seo-components.tsx` okolo riadka 336 a text pri `location.coverageAreas`.

**Dôkaz renderu:** `tmp/gpt-public-copy-review/gallery-editorial-note.png` a textová snímka všetkých regiónov v JSON.

**Presná navrhnutá oprava:**

- Úvod realizácií: „Pozrite si vlastné realizácie ASTANA: prípravu pracoviska, stabilizáciu krytiny, demontáž, balenie a odvoz.“
- Úvod filtrov: „Vyberte typ objektu alebo časť prác, ktorú si chcete pozrieť.“ Súkromné údaje treba naďalej chrániť v dátach; netreba to opakovať ako predajnú vetu pri každom albume.
- Popis fotografie na pôsobnosti: „Pracovné vozidlo ASTANA pri realizácii.“
- Úvod výberu oblasti: „Vyberte kraj alebo oblasť, kde je vaša stavba. Pri dopyte nám potom uveďte presnú obec a približnú výmeru.“
- Regionálny úvod: „ASTANA, s.r.o. so sídlom v Poprade zabezpečuje po dohode odbornú likvidáciu azbestu a eternitu v [existujúce `location.area`]. Na zákazky vychádzame z Popradu; termín a postup si potvrdíme podľa vašej stavby.“
- Výpis okresov: „Pracujeme aj v týchto okresoch a okolitých obciach: [existujúci zoznam].“

Zachovať presné sídlo firmy, pravdivú pôsobnosť a prirodzené opisy originálnych fotografií. Nepridávať namiesto odstránených viet nové výhrady k autorovi recenzie alebo lokalite záberu.

## P2-3: Článok označuje povinné polia formulára ako doplnkové

**URL:** `/poradna/co-poslat-pre-nacenenie-likvidacie-eternitu/`.

**Dôkaz:** veta „Vo formulári môžete doplniť typ materiálu a objektu...“ pôsobí, že ide o voliteľné údaje. Na homepage sú oba výbery označené hviezdičkou a majú HTML `required`; samotná stránka uvádza sedem povinných údajov. Materiál má skutočnú možnosť „Neviem posúdiť“.

**Zdroj:** `src/content/advice-articles.ts` okolo riadka 128, druhý odsek prvej časti. Porovnanie: `app/page.tsx` okolo riadkov 485–540. Dôkaz: `tmp/gpt-public-copy-review/form-wording.png`.

**Presné navrhnuté znenie:** „Vo formulári vyberiete aj typ materiálu a objektu. Ak zloženie materiálu nepoznáte, zvoľte možnosť ‚Neviem posúdiť‘. Pri výmere stačí označený odhad.“

Nadpis „Tri údaje, od ktorých sa vieme odraziť“ možno pre lepšiu zhodu zmeniť na „Čo si pripraviť pred vyplnením formulára“. Nie je potrebné meniť formulár ani pridávať polia. Fotografie zostávajú voliteľné.

## Vecná závislosť P2-4: nedokončená retenčná informácia

**URL:** `/ochrana-osobnych-udajov/`.

**Dôkaz:** „Doba uchovávania analytických udalostí v systéme nie je v tejto stránke uvedená, kým nebude potvrdená podľa aktuálnej konfigurácie databázy a prevádzkových pravidiel.“ To je verejná pracovná poznámka, nie dokončená informácia o prevádzke služby.

**Zdroj:** `app/ochrana-osobnych-udajov/page.tsx`, časť „Ako dlho ich uchovávame“, okolo riadka 32. Snímka: `tmp/gpt-public-copy-review/privacy-unfinished.png`.

**Potrebná oprava:** najprv overiť skutočné retenčné pravidlo a jeho vykonávanie v projekte. Potom doplniť krátku pravdivú vetu s overenou lehotou. **Lehota a finálne znenie sú v tomto audite NEOVERENÉ.** Nevymýšľať počet dní, nemať verejný TODO a neskrývať chýbajúci fakt len odstránením pracovnej poznámky. Túto položku treba posudzovať oddelene od jednoduchej jazykovej opravy; nejde o nové právne posúdenie všetkých existujúcich lehôt.

## Tri menšie jazykové a čitateľnostné úpravy

Tieto položky nezvyšujú rozsah o nové funkcie a samy osebe neznamenajú, že treba celé stránky prepisovať:

1. **Empatickejší tón:** `src/content/seo-content.ts` — „Ak jeho zloženie nepoznáte, stačí to priznať“ → „Ak zloženie nepoznáte, jednoducho nám to napíšte.“ `app/strechari/page.tsx` — „Vy nastúpite na čerstvú strechu“ → „Na odkrytú strechu potom nadviažete svojou prácou.“
2. **Kratší autorský koniec článkov:** mená firmy, dátum a oficiálne zdroje zachovať, no „Praktická metodika ASTANA“ a veta o neodvolávaní sa na externý cenník/normu pôsobia interne. Pre články bez externého zdroja môže stačiť „Praktické odporúčania vychádzajú zo skúseností ASTANA pri príprave zákaziek. Rozsah a cenu si potvrdíme podľa vašej stavby.“ Neukladať tento text ako údajný zdroj zdravotných alebo právnych tvrdení.
3. **Rozdeliť dlhé právne odseky bez zmeny významu:** v ochrane údajov najmä „Aké údaje zbierame“ a „Poskytovanie údajov“, v cookies blok „Čo sa používa pri povolenom meraní“. Oddeliť formulár, Facebook, ochranu uploadu, analytiku a marketing do samostatných odsekov. Zachovať presné podmienky súhlasu a vecné vety; nenahrádzať ich marketingovým zhrnutím.

## Pokrytie všetkých 35 URL

„PASS obsahu“ znamená, že stránka má vlastnú užitočnú úlohu, zrozumiteľný text a zistený obsahový problém nebráni prijatiu v tejto časti auditu. Neznamená právne, bezpečnostné alebo grafické prijatie celého produktu. Opakovanie spoločných dopravných podmienok či bezpečnostných odpovedí samo osebe nie je chyba; nie je dôvod ich účelovo parafrázovať pre SEO.

| URL | Obsahový verdikt | Dôvod / poznámka |
| --- | --- | --- |
| `/` | PASS obsahu | Jasná služba, orientačná cena, dopyt, doklady a nadväznosť profesií. Časový sľub 24 hodín sa týmto auditom nemení. |
| `/likvidacia-azbestu/` | PASS obsahu | Rozlišuje umiestnenie materiálu, zložený odpad, prípravu a doklady. Drobný tón v odporúčaní č. 1. |
| `/likvidacia-eternitu/` | PASS obsahu | Má vlastný strešný zámer, prípravu a odovzdanie strechárovi. |
| `/cena-likvidacie-azbestu/` | PASS obsahu | Porovnanie rozsahu, konkrétny príklad rozdielnej náročnosti a nezáväzný výpočet. |
| `/postup/` | PASS obsahu | Celý postup a rozdelenie úloh zákazník/ASTANA/strechár; bez potreby ďalšej vaty. |
| `/kde-posobime/` | RETURN – P2-2 | Užitočné plánovanie výjazdu, ale opakované verejné redakčné poznámky. |
| `/faq/` | PASS obsahu | Otázky sú zoskupené podľa reálnej potreby a odpovede sú vecné. |
| `/realizacie/` | RETURN – P2-2 | Fotografie a filtre majú zmysel, ale úvod a pokyny obsahujú interné výhrady. |
| `/recenzie/` | PASS obsahu | Funkčný zmysel je spätná väzba a schválené skúsenosti; prázdny lokálny stav sa nemá vyplniť falošnými menami. |
| `/o-firme/` | PASS obsahu | Skutočné kontakty, sídlo, záznam firmy a vysvetlenie ponuky; nepýta si vymyslenú históriu ani tím. |
| `/kontakt/` | PASS obsahu | Kontaktná stránka primerane stručná, jasne rozlišuje nový dopyt, otázku a existujúcu zákazku. |
| `/poradna/` | PASS obsahu | Prehľad ôsmich odlišných otázok; samostatný úvod je primeraný účelu rozcestníka. |
| `/strechari/` | PASS obsahu | Konkrétna ponuka spolupráce a registrácia. Drobná neobratná veta v odporúčaní č. 1. |
| `/kariera/` | PASS obsahu | Zrozumiteľné očakávania, podmienky pred dohodou a krátka žiadosť bez vymyslenej odmeny. |
| `/spolupracujuci-strechari/` | PASS obsahu | Rieši vlastného aj hľadaného strechára a zodpovednosť za novú strechu bez falošných profilov. |
| `/likvidacia-azbestu-poprad/` | RETURN – P2-1, P2-2 | Vlastná téma sprístupnenia a nadväznosti; opraviť spoločný jazyk a interné poznámky. |
| `/likvidacia-azbestu-kosice/` | RETURN – P2-1, P2-2 | Vlastná téma areálu v prevádzke a viacerých objektov; rovnaké chyby šablóny. |
| `/likvidacia-azbestu-presov/` | RETURN – P2-1, P2-2 | Rozdelenie domu, garáže a ďalších budov je užitočné; rovnaké chyby šablóny. |
| `/likvidacia-azbestu-zilina/` | RETURN – P2-1, P2-2 | Konkrétny príjazd, svah a rekreačný objekt; rovnaké chyby šablóny. |
| `/likvidacia-azbestu-banska-bystrica/` | RETURN – P2-1, P2-2 | Etapy, rozľahlý kraj a prevádzka objektu dávajú vlastnú hodnotu; rovnaké chyby šablóny. |
| `/likvidacia-azbestu-bratislava/` | RETURN – P2-1, P2-2 | Mestská časť, státie a spoločný dvor sú konkrétne; rovnaké chyby šablóny. |
| `/likvidacia-azbestu-nitra/` | RETURN – P2-1, P2-2 | Rozlišuje krytinu na objekte a odvoz uložených dosiek; rovnaké chyby šablóny. |
| `/likvidacia-azbestu-trnava/` | RETURN – P2-1, P2-2 | Koordinácia s potvrdeným/predbežným termínom strechára je užitočná; rovnaké chyby šablóny. |
| `/likvidacia-azbestu-trencin/` | RETURN – P2-1, P2-2 | Kombinácia strechy, obkladu a rozsahu stavby je odlišná; rovnaké chyby šablóny. |
| `/poradna/co-je-eternit-a-kedy-obsahuje-azbest/` | PASS obsahu | Vysvetľuje rozdiel názvov, vek, označenie a hranice fotografie. |
| `/poradna/preco-neodstranovat-eternit-svojpomocne/` | PASS obsahu | Prepája riziko materiálu, výšku, odpad a prípravu; nevydáva sa za svojpomocný pracovný návod. |
| `/poradna/kolko-stoji-likvidacia-azbestu/` | PASS obsahu | Porovnáva celé ponuky, DPH, dopravu a zmenu rozsahu bez vymyslenej ceny. |
| `/poradna/ake-doklady-dostanete-po-likvidacii-azbestu/` | PASS obsahu | Rozlišuje objednávku, vyúčtovanie a doklady k odpadu, vrátane praktického usporiadania. |
| `/poradna/ako-zmerat-strechu-pre-cenovu-ponuku/` | PASS obsahu | Má konkrétny modelový výpočet 10 × 6 × 2, odlíšenie pôdorysu a bezpečný postup odhadu. |
| `/poradna/co-poslat-pre-nacenenie-likvidacie-eternitu/` | RETURN – P2-3 | Užitočný checklist a opis podkladov; opraviť tvrdenie o doplnkových poliach. |
| `/poradna/azbest-v-interieri-vs-exterieri/` | PASS obsahu | Rozlišuje používané priestory, prístup a vhodnosť postupu; nepredstiera univerzálne riešenie. |
| `/poradna/odvoz-a-balenie-azbestoveho-odpadu/` | PASS obsahu | Má vlastnú hodnotu pre uložený odpad, nakládku a podklady; bez svojpomocného návodu. |
| `/ochrana-osobnych-udajov/` | RETURN – P2-4 | Verejne nedokončená retenčná informácia; právna správnosť ostatných lehôt týmto auditom nie je potvrdená. |
| `/cookies/` | PASS obsahu | Uvádza účel, voľbu a dopad odmietnutia. Vhodné rozdeliť dlhý odsek bez zmeny významu. |
| `/podmienky-pouzivania/` | PASS obsahu | Vysvetľuje nezáväzný dopyt, kalkulátor, podklady a samostatného strechára primerane účelu. |

## Záver pre autora

Nie je potrebné meniť všetkých 35 stránok na ďalšie dlhé články. Podstatný obsah už existuje: osem článkov má vlastné rady a regióny odlišné praktické situácie. Najväčší obsahový prínos teraz prinesú spoločné jazykové opravy a odstránenie interných redakčných viet. Po oprave troch jazykových/obsahových P2 položiek treba overiť nový render príslušných URL a zhodu FAQ/schema. Grafiku a jazyk možno prijať oddelene; úplné obsahové prijatie ochrany údajov vyžaduje samostatne doložiť alebo rozhodnúť skutočne chýbajúcu retenčnú informáciu. Úplné grafické prijatie a podmienka neopakovaných fotografií zostávajú samostatným výsledkom vizuálnej kontroly.
