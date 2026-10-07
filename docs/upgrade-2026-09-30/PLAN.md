# ASTANA: plán upgradu, ktorý má prinášať kvalitné dopyty

Dátum: 30. 9. 2026. Verzia 1.0 – nezávislý GPT kontrolór: **APPROVE pre plán**. [Protokol kontroly](REVIEW.md). Neznamená prijatú implementáciu alebo nasadenie.

## 1. Rozhodnutie a rozsah

Prebudovať verejnú prezentáciu a odstrániť chyby v zákazníckej ceste po samostatne overiteľných etapách. Zachovať Next.js, existujúce užitočné URL, databázu dopytov, administráciu a schvaľovanie cenových ponúk. Dôvodom na prepis konkrétnej časti je potvrdená chyba alebo jasná potreba návštevníka, nie samotný počet odporúčaní v auditoch.

Hlavný výsledok: návštevník pochopí službu, overí si dôveryhodnosť ASTANY, získa orientáciu v cene a odošle dopyt, ktorý sa nestratí. Firemný tím vidí, odkiaľ kvalitné dopyty prichádzajú a ktoré sa menia na zákazky.

SEO ≥ 9/10, GEO pripravenosť ≥ 9/10 a celková kvalita ≥ 8,5/10 sú minimálne bodové prahy podľa [bodovacej metodiky](ACCEPTANCE.md). Navyše platí pevná finálna brána majiteľa: obchodná a vizuálna kvalita musí dosiahnuť 100 % povinného QA checklistu bez známej nevyriešenej chyby. Nejde o dnešné namerané výsledky ani garanciu odporúčaní v AI. Projekt nemožno označiť za dokončený iba tým, že vznikol plán alebo prešiel build.

Tento balík obsahuje porovnanie auditov, reprodukované nálezy, architektúru, pracovné etapy a skúšky. Zatiaľ nemení produkčný web. Pokyny v dodaných auditoch sa berú ako odporúčania; aktuálne zadanie majiteľa má prednosť. Práca pokračuje autonómne v schválenom rozsahu; potvrdenie je potrebné iba pre chýbajúce firemné fakty, práva na publikovanie, nové výdavky alebo konkrétnu komunikáciu zákazníkom.

Aktuálne zosúladenie auditov, nový read-only audit foto-intake/recenzií/reklamnej atribúcie a rozlíšenie lokálnych dôkazov od produkčných je v [AUDIT-RECONCILIATION.md](AUDIT-RECONCILIATION.md). Tento dodatok sprísňuje dôkazné brány, nemení cieľové skóre ani nedáva povolenie na nasadenie.

### Čo zásadne nepovažujeme za riešenie

- Hromadný prepis fungujúceho backendu, zmena domény alebo rámca.
- Vymyslené recenzie, mestá pri fotografiách, počty zákaziek, mená odborníkov či pobočky.
- Stovky mestských klonov, texty písané len pre robotov a pokyny AI, aby nás uprednostňovala.
- Zmena príjemcu e-mailov, SMTP, merania alebo databázy ako vedľajší účinok dizajnu.
- Cena „od X“ prevzatá od konkurencie bez schválenia vlastných podmienok.
- Nahradenie obchodného výsledku skóre Lighthouse alebo pochvalou modelu.

## 2. Východiskový stav

Podrobnosti a dôkazy: [EVIDENCE.md](EVIDENCE.md).

- Pracovný základ: `main`, commit `3f48aee5`; pred auditom čistý pracovný strom.
- Overená produkcia: `dpl_83DhtcH4sysdBd8zfgEWMRmRvCE7`, READY, alias `likvidacia-eternitu.sk`.
- Všetkých 34 URL v živej sitemap odpovedalo HTTP 200; test neexistujúcej stránky HTTP 404.
- Na 18 URL boli dva BreadcrumbList. HTML hlavných URL obsahovalo jeden H1.
- Company JSON obsahuje verejný TODO; služby už majú schema aj celoslovenskú pôsobnosť.
- 179 webových JPG nemá GPS ani bežný časový EXIF údaj. Z týchto súborov lokality nezrekonštruujeme.
- Nezávislý UX audit našiel nereagujúcu homepage kalkulačku a orezané zatváranie mobilného detailu fotografie. To sú funkčné priority pred veľkým redizajnom.
- Kódová kontrola našla ešte vyššiu prioritu: automatickú archiváciu obchodných záznamov podľa mien/emailov pri inicializácii DB a prepis admin obsahu pri zmene verzie. Mechanizmy sú potvrdené kódom; poškodenie konkrétnych produkčných údajov zatiaľ nebolo overené. Prvý balík má tieto vedľajšie zápisy zastaviť, nie hromadne meniť historické dáta.
- Počet 78 organických kliknutí za 28 dní je údaj z dodaného GPT auditu, nie nová kontrola účtu. Neznamená 78 dopytov ani preukázané návštevy z AI.
- Predchádzajúci test veľkých súborov overil prenos do súkromného úložiska; nepreukázal celý reťazec formulár → dopyt → správne prílohy → inbox. Táto medzera musí byť uzavretá.

## 3. Zákazník, ponuka a obchodný model

Primárne publikum: majiteľ domu s eternitovou strechou, ktorý rieši výmenu a nechce koordinovať úrady, odpad a strechára. Druhé publikum: majitelia hospodárskych/priemyselných objektov, správcovia budov a strechári. Vek návštevníkov ani výnosnosť segmentov zatiaľ nie sú namerané; nezakladať dizajn na vymyslenej demografii.

Návštevník potrebuje päť odpovedí: robíte môj typ práce a môj región; čo ma to približne bude stáť; kto a čo vybaví; ako to zladíte so strechárom; prečo vám môžem veriť.

Primárna akcia: „Získať nezáväznú ponuku“. Telefonát je druhá cesta. Kariéra a partnerská registrácia majú vlastný cieľ a samostatné meranie.

Hodnotová ponuka: jedna zodpovedná firma pre odborné odstránenie azbestu, organizáciu potrebného postupu, balenie a odvoz, s koordináciou nadväzujúcich prác. Z Popradu výjazdy na celé Slovensko podľa dohodnutého termínu; ranný príchod spravidla 6:00–6:30 môže pripraviť podmienky pre strechárov okolo 8:00. Nie je to sľub dokončenia každej demontáže do 8:00.

Firma pôsobí od roku 2011 podľa existujúcich firemných údajov. Nemiešať to s dátumom oprávnenia na azbest: v overenom historickom zozname sú pri ASTANE dátumy z roku 2013. Aktuálnu platnosť a rozsah oprávnenia treba doložiť aktuálnym zdrojom.

Výnosový reťazec: relevantná návšteva → kvalifikovaný dopyt → kontakt/ponuka → schválená objednávka → dokončená zákazka → príspevok na zisk. Počet kliknutí na telefón sa nesmie vykazovať ako počet uskutočnených hovorov.

## 4. Architektúra obsahu a dizajnu

Kompletná mapa URL, 20 hlavných a 30 long-tail tém a päť konkurenčných webov: [CONTENT-MAP.md](CONTENT-MAP.md).

### Úvodná stránka: krátky predajný príbeh

1. **Hero:** H1 pomenúva službu a celoslovenské pôsobenie, dva krátke odseky najviac, vlastná fotografia, dominantné CTA na dopyt, telefón.
2. **Overiteľné fakty:** právna identita, história firmy, rozsah výjazdov, odkaz na overenie oprávnenia. Žiadne neurčité superlatívy.
3. **Cena a začiatok dopytu:** najviac tri prvotné údaje: obec, približná výmera, materiál s možnosťou „Neviem“. Prechod z kalkulačky zachová zadané hodnoty. Kto nechce počítať, môže priamo požiadať o ponuku.
4. **Dve až tri doložené realizácie:** problém, postup, výsledok; lokalita a výmera len s podkladom.
5. **Čo cena/služba zahŕňa + postup:** jeden zrozumiteľný blok namiesto opakovania rovnakého zoznamu v mnohých sekciách. Koordinácia so strechárom dostane konkrétny príklad.
6. **Práce po Slovensku:** mapa schválených realizácií a rovnocenný textový zoznam. Oddeliť vykonané práce od oblasti, kam vieme prísť.
7. **Rozhodujúce otázky:** cena, termín, podklady, už zložený materiál, strechár, doklady; právne odpovede podľa aktuálne overených pravidiel.
8. **Záver a kontakt:** jednoduché CTA, plná firemná identita, navigácia na služby, regióny a dôkazy.

Krátky návrh hero textu na ďalšie redakčné overenie:

> Likvidácia azbestu a eternitu po celom Slovensku
>
> Starú eternitovú strechu vyriešime od potrebnej prípravy až po odvoz odpadu. Práce zladíme aj s vaším strechárom.
>
> Pošlite obec a približnú výmeru. Fotky môžete priložiť, ale nie sú podmienkou dopytu.

24-hodinový prísľub podľa predchádzajúceho zadania majiteľa zostáva pri dopyte. Vysvetlenie nesmie znamenať garantovaný začiatok prác do 24 hodín ani automatické potvrdenie objednávky. Presnú prevádzkovú definíciu dostupnosti ponuky (víkendy, chýbajúce údaje) treba zosúladiť s majiteľom.

### Dizajnový systém

Zachovať rozpoznateľnú ASTANA identitu a reálne fotografie. Zjednotiť typografiu, šírku obsahu, rozostupy a tlačidlá. Pokojný svetlý obsah, tmavá navigácia, jeden hlavný akčný farebný tón. Žiadna ďalšia vrstva stoviek núdzových CSS pravidiel.

- Mobilný návrh od 320 px, povinné kontroly 320/360/390/768/1024/1440 px; navyše 200 % zoom, landscape a dlhšie texty.
- Bežný text 16–18 px, čitateľná dĺžka riadka, viditeľný fokus, dostatočný kontrast. Počet pixelov sám nie je úspech: musí byť pohodlné ovládanie.
- Dialog fotografie musí mať zatváranie dostupné vždy, trap fokusu, Escape a návrat fokusu.
- Sticky CTA a WhatsApp nesmú zakrývať obsah, formulár ani dialog. Kariéra má náborové CTA.
- CSS po sekciách a komponentoch; tokens a verejný layout oddeliť od admina. Staré pravidlá odstrániť až po preukázaní, že už nemajú konzumentov.
- Rešpektovať reduced-motion; tmavý režim spracovať cez rovnaké tokeny a podrobiť rovnakým kontrastným skúškam, nie mechanicky invertovať fotografie.

## 5. Realizácie a mapa Slovenska

Špecifikácia importu, schválenia a dát: [PHOTO-MAP.md](PHOTO-MAP.md).

Mapa bude súčasťou dôkazov reálnej práce. Prvý cieľ je päť kvalitných prípadových štúdií z dostupných podkladov, nie povinný bod v každom kraji. Kde podklad nie je, nevytvoríme fiktívnu referenciu. Všetkých osem krajov možno pravdivo uviesť ako obsluhované územie; nie ako osem doložených pobočiek alebo osem už vykonaných zákaziek.

Pre prvú verziu preferovať ľahkú SVG mapu s klávesnicou ovládateľnými bodmi a serverovo vykresleným zoznamom. Externý mapový widget nie je potrebný na základnú funkciu. Podklad musí mať doloženú licenciu.

GPS z originálu slúži len ako interný návrh lokality. Človek potvrdí obec/okres aj právo na zverejnenie. Verejný bod je stred obce alebo širšieho okresu, nie jemne posunutá súradnica domu. Pri malej obci a rozpoznateľnom dome môže byť potrebný iba okres alebo žiadny bod.

## 6. Etapy a závislosti

Každý balík má jedného autora, kontrolóra, konkrétny diff a dôkaz. Kontrolór nesmie schvaľovať vlastnú implementáciu. Autor môže byť subagent, integráciu robí hlavný agent. Zmeny nebežia súbežne v rovnakých súboroch.

| Etapa | Výsledok / rozsah | Závisí od | Podmienka dokončenia |
|---|---|---|---|
| **E0 – Overiť a naplánovať** | Porovnanie 4 podkladov, crawl, vzorka desktop/mobil, register tvrdení, plán a rozpočet kvality | Ničoho | GPT kontrolór prijme konkrétnu verziu plánu; medzery uvedené |
| **E1 – Spoľahlivá cesta k dopytu** | E1A ochrana dát a CMS; E1B idempotentný príjem/upload/mail a obnova; E1C kalkulačka a dialog | E0 | F01, F03–F11, F13 a regresia existujúcich tokov F12/F14. F12 výslovne zahŕňa opakované strechárske podanie, pravdivý stav jeho e-mailu a obnoviteľné CV/e-mail pri kariére; dáta hardgates. Prefill F02 patrí E4, nová mapa F14 patrí E5 |
| **E2 – Pravdivé jednotné fakty** | Jednotný zdroj identity, obchodných podmienok a právnych vysvetlení; odstránenie verejných TODO | E0, potvrdenie chýbajúcich faktov pre sporné časti | Zhoda viditeľného textu, JSON-LD, company JSON a llms; právne/body knowledge overené |
| **E3 – Technické SEO a prístupnosť** | Jedny breadcrumbs, presná 404, robots, sitemap lastmod, metadata, Article a graf firmy | E0; E2 pre fakty | Crawl 34 existujúcich URL + všetky nové URL, žiadne nesprávne canonical/noindex/404 |
| **E4 – Verejný dizajn a formulár** | Nový komponentový layout, skrátená homepage, prvé 3 polia, cena → dopyt, mobilná navigácia | E1; schválený kontrakt formulára | Desktop/mobile funkčné a vizuálne gates, bez zmeny adresátov či straty dát |
| **E5 – Dôkazy a mapa** | Bezpečný import originálov, schválenie, 5 doložených prípadov, mapa a zoznam | E2, podklady a publikačné oprávnenia | GPS nezverejnené; každý bod má schválený prípad; fallback bez JS |
| **E6 – Služby, regióny, poradňa** | Odlíšenie účelu existujúcich URL, priamy užitočný obsah, prepojenie na prípady; regionálny hub | E2/E5 podľa použitého dôkazu | Každá stránka má vlastný účel, dôkaz a CTA; žiadne mestské klony |
| **E7 – Meranie a externá dôveryhodnosť** | GSC/Bing a profily read-only kontrola, funnel definície, consent-safe spojenie kampane s leadom, Google Ads/Meta Pixel/CAPI diagnostika, review workflow, mesačný panel AI | E0; prístup k účtom a konkrétne schválenia zápisov | Všetky live landing/final URL overené, consent a deduplikácia otestované, každé reportované konverzné číslo dohľadateľné ku zdroju a presnému definovanému eventu, baseline Ads export, overená identita |
| **E8 – Akceptácia a release** | Nezávislý GPT audit, náprava nálezov, preview → produkcia, rollback a handover | E1–E7 v povinnom rozsahu | SEO/GEO ≥90/100, celok ≥85/100, žiadny otvorený P0/P1, úplný release protokol |

E2 a E3 môžu prebiehať súbežne, ak majú disjunktné súbory. E5 sa pripraví technicky počas čakania na originály. E7 nesmie blokovať opravu zisteného funkčného defektu. E8 sa nesmie označiť PASS len preto, že skončil čas vyhradený pre etapu. Malý ochranný release E1A možno nasadiť s overením jeho hranice a regresie, aj keď zvyšok projektu nie je dokončený; nesmie zaviesť nový P0/P1 a existujúce nesúvisiace vady ostávajú explicitne otvorené. Finálna E8 nepovoľuje žiadny otvorený P0/P1.

### Prvý vykonávací rez po prijatí plánu

1. **E1A:** Zastaviť automatickú heuristickú archiváciu pri inicializácii a prepis admin obsahu pri čítaní. Oddelené testy s fiktívnymi lokálnymi fixtures, bez DB produkčných zápisov. Existujúce softdeleted dáta iba read-only inventarizovať; obnova len podľa konkrétnych overenýchID.
2. **E1B:** Zaviesť kontrakt prijatia nižšie, transakciu na jednom spojení, idempotenciu a manifest príloh. Oddeliť mailový outbox, správne sent stavy a obnovu; nedotýkať sa SMTP hesiel/príjemcov. Izolované poruchové skúšky pred produkčným testom.
3. **E1C:** Homepage kalkulačka nemá inicializáciu vôbec, nestačí zmena observera. Vyčleniť spoločnú implementáciu, zjednotiť `hladky/plocha`, otestovať všetky materiály na homepage aj cene pri priamom vstupe aj pred/po scroll. Opraviť mobilný lightbox bez prestavby galérie.
4. Uzavrieť reťazec príloh cez skutočný prehliadač a admin: dve platné fotografie väčšie ako6MB, vytvorený dopyt, správne väzby, interný email a potvrdenie. Test viditeľne označiť; žiadna automatická cenová ponuka.
5. Súbežne v disjunktnom balíku zjednotiť consent a bezpečnú atribúciu. Až potom meniť rozloženie a postupnosť formulára.

Kalkulačka/lightbox môžu byť pripravené súbežne iným autorom, ale nesmú zatieniť P0 preventívnu ochranu dát. Nový release sa neprezentuje ako finálne prijatý web, kým sú otvorené kritické backendové riziká.

### Režim bez zacyklenia

- Jeden prieskum, jedna reprodukcia každého nálezu, prioritizácia. Neopakovať celý audit pri každej malej zmene.
- Na balík: implementácia → kontrola → najviac dve cielené kolá opráv. Pri opakovanom rovnakom blokere zastaviť daný balík, zapísať príčinu a zmeniť prístup; pracovať na nezávislom balíku.
- Nové nápady mimo cieľa idú do backlogu, nezväčšujú automaticky rozsah rozpracovanej etapy.
- Každá zmena plánu má dôvod, dopad na testy a schválenie kontrolórom. Nemeniť kritériá tak, aby neúspešný výsledok vyšiel ako úspech.
- Chýbajúce fakty sa označia `WAITING_FOR_OWNER`, dostupnosť účtu `WAITING_FOR_ACCESS`. Nie je to PASS ani automatická chyba webu.

## 7. Technická realizácia bez straty dopytov

Zachovať SSR/SSG pre obsah, progresívne interakcie pre kalkulačku a formulár a izolovaný admin. Nový CMS ani framework nie sú potrebné: využiť existujúcu správu obsahu a doplniť explicitné schvaľovanie dôkazov. Do budúcna oddeliť `companyFacts`, `serviceFacts`, `regionalCoverage`, `caseStudies` a `editorialArticles`, aby ich čítali všetky verejné výstupy.

Formulár sa nemení naraz s transportom. Zachovať alebo opraviť: honeypot odolný voči autofillu, stabilný submissionId, jedno odoslanie na jeden pokus, serverovú deduplikáciu, viditeľný priebeh, timeout a obnoviteľnú chybu, bezpečné prílohy, trvalé uloženie, e-mailový stav a následné doručenie. Starý klient otvorený pred release nesmie potichu stratiť fotografie.

### Kontrakt prijatia a doručovania

- `submissionId` trvalo unikátny; rovnakýID a rovnaký normalizovaný payload vracia pôvodný výsledok, rovnakýID s iným obsahom je zrozumiteľný konflikt. Súbežnosť chráni DB, nie iba disabled tlačidlo.
- Jedna rezervovaná DB transakcia uloží dopyt, explicitnú väzbu zákazky, manifest príloh, audit a outbox záznamy. SMTP nebeží v transakcii. Migrácia je additive a kompatibilná; historické záznamy bezID sa automaticky nededuplikujú.
- Uploadmanifest eviduje serverom vydaný pokus, oprávnenie, veľkosť/typ, storagekey a stav. Cudzí alebo už pripojený objekt sa neprevezme. Retry zachová úspešné uploady; nepovinná chybná fotografia ponúkne vedomé odoslanie bez nej, nie tiché zahodenie.
- Prijatý dopyt a výsledok jednotlivých emailov sú rozdielne stavy. UI nesmie tvrdiť „potvrdenie sme poslali“, ak je iba vo fronte. Outbox má dedupekey, pokusy, čas ďalšieho pokusu, stav/poslednú chybu, bezpečný workerlock a dohľad admina.
- SMTP timeout po odovzdaní môže znamenať neznáme doručenie; taký stav nesmie vyvolať nekontrolovanú duplicitu iným transportom. Rozlišovať confirmed/failed/unknown a zdokumentovať obnovu. Konečný inbox test musí overiť oboch príjemcov.
- Cron nesmie nastaviť sent pri sent:false. Zachovať už schválené komunikačné pravidlá; pridaním retry nevytvoriť novú marketingovú kampaň.
- Retenčné čistenie používa referencie DB a audit, nie samotný názov prefixu `lead-drafts`. Bezpečný transport Blob/S3/preview je explicitne vybraný a testovaný; nepodporovaná konfigurácia sa zistí skôr než návštevník odošle fotky.

Nový kontaktový tok: jeden preferovaný kontakt má stačiť pre prvé oslovenie iba vtedy, keď to umožní obchodný proces a backend. Keď je e-mail potrebný na ponuku, vysvetliť to alebo vyžiadať neskôr. Neodstrániť atribút `required` iba na fronte a ponechať nesúlad na serveri.

Storage oddeliť: zákaznícke prílohy sú vždy súkromné. Marketingová kópia vznikne až po schválení, anonymizácii a odstránení EXIF. Každá musí mať zdroj a možnosť stiahnutia z publikácie.

Nastavenia hesiel, SMTP, reklamné kampane a súkromné dokumenty nepatria do plánovacieho balíka. Žiadne nové výdavky bez potvrdenia. Žiadne rozosielanie žiadostí o recenzie bez konkrétne schváleného príjemcu/skupiny a textu.

## 8. Meranie a udržateľná prevádzka

Pred redizajnom exportovať 28 a 90 dní dostupných dát GSC po URL, dotaze a zariadení a porovnať s dátami dopytov. Časové hranice a časové pásmo zapisovať. Zachovať UTM/referrer pri prechode cez kalkulačku.

KPI: počet relevantných návštev, začaté a dokončené dopyty, technická úspešnosť odoslania, doručené interné notifikácie, kvalitné dopyty, vydané ponuky, objednávky, výnos a príspevok na zisk. Kvalifikácia dopytu = skutočný záujem o poskytovanú službu, použiteľný kontakt a lokalita; nie každé stlačenie CTA.

Merací kontrakt: klient `quote_view`, `quote_start`, `upload_failed`, `quote_submit_attempt`; serverová autorita `lead_accepted`, stav jednotlivého emailu, admin `lead_qualified`, `offer_approved`, `job_won`, `job_completed`. Názvy sa namapujú na existujúce udalosti bez dvojitého započítania. Spojenie cez interné pseudonymné ID, nikdy meno/email/adresu v analytickom payloade. Klientské UTM len v rozsahu dovolenom nastavením súhlasu a retenčnou politikou; odvolanie súhlasu nesmie brániť prijatiu dopytu.

Príspevok zákazky = výnos bezDPH mínus priraditeľné variabilné náklady (práca, doprava, odpad, subdodávky); nejde automaticky o čistý účtovný zisk. Náklady na získanie zákazky a kvalifikovaný dopyt počítať len z porovnateľného obdobia a zdroja. Cieľ zlepšenia počtov/miery konverzie stanoviť až po baseline a kapacite tímu; nevymýšľať percento rastu bez dát.

Pri nízkej návštevnosti najprv odstrániť technické chyby a sledovať absolútne počty. Percentuálny rast z malej vzorky nie je dôkaz účinku dizajnu. A/B test spúšťať až pri vzorke vypočítanej z baseline; dovtedy porovnateľné kohorty a používateľské skúšky.

AI panel: 24 stabilných otázok (3 v každom kraji), bez podsúvania ASTANY, nové relácie, jazyk slovenčina, dostupné GPT/Gemini/Perplexity systémy. Evidovať dátum/model/režim, presnú otázku, zmienku firmy, citovaný odkaz, odporúčanie služby a chyby. Ak systém nie je dostupný, stav NOT_TESTED. Nezamieňať panel odpovedí s referral návštevami alebo so zákazkami.

GSC nastavenie generatívnych výsledkov a report overiť v účte. Dokumentácia ich existenciu potvrdzuje, dostupnosť reportu sa môže líšiť. Nestačí zistiť, že stránka má `llms.txt`.

Prevádzka po release: týždenne chyby dopytov a doručenia; mesačne stránky/zdroje kvalitných leadov a AI panel; štvrťročne firemné podmienky, právne odkazy a redakčné dátumy. Toto je plán prevádzky, nie už aktivovaná automatizácia či rozosielanie.

## 9. Podklady, ktoré nevymyslíme

| Potrebný vstup | Na čo slúži | Čo zatiaľ možno urobiť |
|---|---|---|
| Originálne fotografie a potvrdené obce, prípadne dátumy/výmery | Päť prípadov a mapa | Vybudovať schvaľovanie, šablónu a mapu bez verejných vymyslených bodov |
| Práva na publikovanie a posúdenie identifikovateľných ľudí/domov | Publikovanie dôkazov | Pripraviť neverejný výber a anonymizáciu |
| Aktuálne doloženie rozsahu oprávnenia + odborný garant | Presné právne vysvetlenie, profil tímu | Spísať overené historické údaje, odstrániť neodôvodnené tvrdenia v návrhu |
| DPH a potvrdené cenové predpoklady | Jednotná kalkulačka/cenová stránka | Doprava je v cenovej ponuke voliteľná. Ak sa účtuje, uvádza sa samostatne s editovateľnou trasou, spiatočnými kilometrami a sadzbou; verejný web nesľubuje dopravu zdarma podľa výmery. Finálne sadzby a DPH potvrdí vlastník. |
| Verejná správna URL GBP a prístup ku GSC/Bing | Identita, indexácia, baseline | Technický crawl a príprava presného kontrolného zoznamu |
| Reálne recenzie a povolené citácie | Sociálny dôkaz | Pripraviť workflow a návrh oslovenia, nerozosielať |

Chýbajúce podklady blokujú iba závislé publikovanie. Neoprávňujú vymyslieť údaje ani zastaviť všetku nezávislú prácu.

## 10. Definícia HOTOVO a návrat

Hotovo znamená prijaté E0–E8, splnené [ACCEPTANCE.md](ACCEPTANCE.md), verejný web bez P0/P1, presný produkčný commit/deployment, uložené dôkazy testov a používateľské odovzdanie. Ak chýba kľúčový dôkaz, výsledok je PARTIAL/WAITING, nie „9/10 odhadom“.

Nasadenie: čistý checkout → testy/build → konkrétny preview → vizuál/funkcie/SEO → nezávislý verdict → produkcia → rovnaký smoke na doméne. Pred nasadením zaznamenať pôvodný deployment a obnoviteľnú DB zálohu pri migrácii. Návrat frontendu sa nesmie spájať s vymazaním nových dopytov; migrácie musia byť dopredne aj spätne kompatibilné.

Okamžitý návrat zmeny pri strate dopytu/prílohy, chybnom adresátovi, úniku súkromných dát, nefunkčnom hlavnom CTA alebo neočakávanom vylúčení obchodných URL z indexácie. Pokles návštevnosti na malej vzorke sám osebe nie je automatický dôvod na technický rollback.

## Zdroje rozhodnutí

- [Porovnanie dodaných auditov a vlastné dôkazy](EVIDENCE.md).
- [Google: generatívne vyhľadávanie](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide): dôraz na užitočný vlastný obsah; žiadna garancia zaradenia ani zvláštna AI schéma.
- [Google: pravidlá spamu](https://developers.google.com/search/docs/essentials/spam-policies#doorway-abuse): regionálne klony nie sú náhradou za skutočnú miestnu hodnotu.
- [OpenAI: vyhľadávací a tréningový robot](https://developers.openai.com/api/docs/bots): rozlišovať účely a nastavenia.
- [Slov-Lex: zákon 355/2007, verzia od 1. 8. 2026](https://static.slov-lex.sk/pdf/SK/ZZ/2007/355/ZZ_2007_355_20260801.pdf#page=101): právne texty odvodiť z aktuálneho režimu, nie starých marketingových šablón.
