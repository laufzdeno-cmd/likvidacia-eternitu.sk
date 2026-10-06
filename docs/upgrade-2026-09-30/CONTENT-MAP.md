# Obsah, vyhľadávací zámer a architektúra

Súčasť [hlavného plánu](PLAN.md). Toto je návrh priorít, nie dôkaz vyhľadávanosti alebo pozícií. Objemy a poradie tém sa doplnia z dostupných GSC dát; nevymýšľať čísla. Existujúce URL sa nemenia bez dôvodu a migračného protokolu.

## Päť konkurentov – účelová vzorka

Výber z aktuálneho verejného vyhľadávania a webov, nie tvrdenie o piatich najväčších firmách či stabilnom poradí v Google. Hodnotíme komunikáciu, nie odbornú kvalitu vykonanej práce.

| Web | Čo komunikuje dobre | Priestor pre ASTANU |
|---|---|---|
| [Azbest dole](https://www.azbestdole.sk/) | Odlišuje strechu, už zložený materiál a koordináciu novej krytiny; viditeľný cenový vstup | Doložiť podobné rozlíšenie vlastnými prípadmi a podmienkami; nepoužiť cudzie ceny |
| [3MA / Demontáž azbestu](https://www.demontazazbestu.sk/sluzby/likvidacia-azbestu-eternitu-na-strechach/) | Rozpis činností a postup výmeny strechy | Zrozumiteľný aktuálny administratívny režim, overiteľné doklady a presná nadväznosť strechárov |
| [ProfiDemont](https://profidemont.sk/cennik-likvidacie-azbestu/) | Samostatný cenník, rozlíšenie položiek a výluk | Transparentné predpoklady kalkulácie + spoľahlivý dopyt; extrakcia stránky ukazovala chýbajúci kontaktný formulár, nie však úplný runtime audit konkurenta |
| [AzbestLikvid](https://www.azbestlikvid.sk/) | Širšia ponuka vrátane novej krytiny a súvisiacich služieb | Vlastný rozsah služby vysvetliť bez rozširovania sľubov nad reálne možnosti |
| [GREENLIKVID](https://www.likvid-azbestu.sk/) | Cena a komplexný servis ako hlavná správa | Odlišovať sa dokladmi, konkrétnymi realizáciami a organizáciou, nie iba sloganom „najlacnejšie“ |

Spoločná príležitosť: overiteľný príbeh „čo sa na konkrétnej stavbe riešilo, kto čo vybavil, ako nadviazal strechár, aké doklady zákazník dostal“. Nestačí dlhší text alebo viac názvov miest. Viditeľnosť konkurenta nepreukazuje príčinnú súvislosť s jedným prvkom jeho stránky.

## URL kontrakt: všetkých 34 existujúcich adries v sitemap

Doména pri relatívnych cestách: `https://likvidacia-eternitu.sk`. Každá stránka má jednu hlavnú úlohu, vlastný title/description, self-canonical a jedno H1. Jazyk sk-SK. Neoptimalizovať dĺžku title na úkor významu; cieľ50–60 znakov, description150–160 je redakčné vodidlo, nie algoritmická podmienka.

| # | URL | Jedinečný účel a prepojenie |
|---|---|---|
| 1 | `/` | Firma/služba po Slovensku, krátka cesta cena → dopyt → dôkaz; odkazy na služby, cenu, prípady |
| 2 | `/likvidacia-azbestu/` | Zastrešujúca služba podľa typu objektu a materiálu; odkazy eternit/interiér/postup/prípady |
| 3 | `/likvidacia-eternitu/` | Konkrétne eternitové krytiny a rozdiel strecha vs zložený materiál; cena/prípady |
| 4 | `/cena-likvidacie-azbestu/` | Transakčný cenový vstup, predpoklady, zahrnuté a nezahrnuté položky, kalkulačka, dopyt |
| 5 | `/postup/` | Kto, kedy, aké podklady, priebeh, nadväznosť strechárov a odovzdanie dokladov |
| 6 | `/faq/` | Krátke otázky s priamymi odpoveďami a odkazy na podrobné zdroje |
| 7 | `/realizacie/` | Dôkazy vlastných prác, filter služby/lokality, mapa, prípady; nie anonymný stock katalóg |
| 8 | `/recenzie/` | Skutočné dohľadateľné recenzie s pôvodom; nevyplniť vymysleným obsahom |
| 9 | `/o-firme/` | Právna identita, história, tím/garant po doložení, rozsah oprávnenia |
| 10 | `/kontakt/` | Jednotný telefón/mail/sídlo, pôsobnosť, dopyt, jasné prevádzkové podmienky |
| 11 | `/poradna/` | Rozhodovací rozcestník podľa problému, nie chronologická továreň článkov |
| 12 | `/strechari/` | Zákazník potrebuje nadviazať výmenu krytiny; vysvetlenie úlohy partnera |
| 13 | `/kariera/` | Živnostník/partia, skúsenosti s azbestom, ranný odchod z Popradu, školenia/prehliadky podľa zadania firmy; CV voliteľné |
| 14 | `/pre-strecharov/` | B2B ponuka spolupráce a registrácia, nie zákaznícky dopyt |
| 15 | `/spolupracujuci-strechari/` | Adresár skutočných schválených partnerov; zobraziť len súhlasené aktuálne kontakty |
| 16 | `/likvidacia-azbestu-poprad/` | Reálna východisková lokalita; výjazd, konkrétne potvrdené prípady, kontakt |
| 17 | `/likvidacia-azbestu-kosice/` | Organizácia prác v oblasti, potvrdený miestny prípad po dodaní, bez fiktívnej pobočky |
| 18 | `/likvidacia-azbestu-presov/` | Ako vyššie, ale vlastný dôvod a podklady pre Prešov; nie výmena názvu mesta |
| 19 | `/likvidacia-azbestu-zilina/` | Zachovať URL, zlepšiť miestnu užitočnosť; údajný výkon preveriť v GSC |
| 20 | `/likvidacia-azbestu-banska-bystrica/` | Reálne podmienky výjazdu a prípady; nezaručovať osobitné miestne lehoty |
| 21 | `/likvidacia-azbestu-bratislava/` | Celoslovenský výjazd z Popradu, bez tvrdenia o bratislavskom sídle |
| 22 | `/likvidacia-azbestu-nitra/` | Zachovať URL, preveriť GSC výkon; vlastné podklady namiesto generickej kópie |
| 23 | `/likvidacia-azbestu-trnava/` | Skutočné podmienky služby a regionálny dôkaz, keď je dostupný |
| 24 | `/poradna/co-je-eternit-a-kedy-obsahuje-azbest/` | Rozpoznanie a limity určovania z fotografie, bezpečný ďalší krok, služba |
| 25 | `/poradna/preco-neodstranovat-eternit-svojpomocne/` | Riziká a zákonný rámec bez strašenia či návodu na nebezpečnú svojpomoc |
| 26 | `/poradna/kolko-stoji-likvidacia-azbestu/` | Vysvetlenie faktorov a modelových príkladov; odkaz na jediný cenový/kalkulačný zdroj |
| 27 | `/poradna/ake-doklady-dostanete-po-likvidacii-azbestu/` | Vysvetliť skutočné odovzdávané doklady; anonymizovaný vzor až po schválení |
| 28 | `/poradna/ako-zmerat-strechu-pre-cenovu-ponuku/` | Jednoduchý odhad bez lezenia na strechu; neistota výmery je prípustná |
| 29 | `/poradna/co-poslat-pre-nacenenie-likvidacie-eternitu/` | Obec, výmera/odhad, fotografie voliteľné; priamy vstup do krátkeho dopytu |
| 30 | `/poradna/azbest-v-interieri-vs-exterieri/` | Rozdiely odborného postupu a oprávnení, nevyvolávať dojem univerzálnej rovnakej služby |
| 31 | `/poradna/odvoz-a-balenie-azbestoveho-odpadu/` | Postup profesionálnej služby a už zložený odpad; nie DIY bezpečnostný návod |
| 32 | `/ochrana-osobnych-udajov/` | Skutočné účely, príjemcovia, lehoty a práva podľa reálneho systému |
| 33 | `/cookies/` | Presný zoznam používaných nástrojov a správa súhlasu |
| 34 | `/podmienky-pouzivania/` | Nezáväznosť orientačnej ceny/dopytu a podmienky webu bez skrytých obchodných sľubov |

Tieto stránky sú v aktuálnej sitemap; tabuľka nie je potvrdením ich indexácie v Google. Privátne admin/API stránky do verejnej sitemap nepatria.

### Nové URL iba s dôvodom

- `/posobnost/`: jeden celoslovenský rozcestník; odlíšiť obsluhované územie od realizovaných stavieb. Odkazy na existujúce regióny a prípady.
- `/realizacie/[slug]/`: konkrétny schválený prípad. Slug neobsahuje adresu, meno zákazníka ani identifikátor zákazky.
- Nové služby pre interiér alebo samostatný odvoz až keď existuje odlišná ponuka, podklad a opakovaný dopyt. Nezakladať prázdne stránky „do zásoby“.
- Žiadne automatické okres/mesto × služba kombinácie. Rozhodnutie o zlúčení URL až po GSC/backlink analýze a 301 mape; pôvodné URL sa hromadne nemažú.

Prepojenie: poradňa → relevantná služba/cena → krátky dopyt; služba ↔ prípad; región ↔ doložený prípad; o-firme ↔ oprávnenie/recenzie; každý prípad → príslušná služba + dopyt. Menu: Služby, Cena, Ako pracujeme, Realizácie, O firme, Kontakt; Kariéra jasne v menu pre mobil a pätičke, podľa dostupnej šírky sekundárne aj desktop. Nezahltiť mobil siedmimi vedľajšími CTA.

## 20 primárnych tém

Zámer: T transakčný, K komerčné porovnanie, I informačný, N navigačný. Témy sú pracovné klastre, nie príkaz použiť presný výraz v každom nadpise. Slovné varianty pokrýva prirodzený text.

| ID | Téma | Zámer | Primárny cieľ |
|---|---|---|---|
| P01 | likvidácia azbestu | T | `/likvidacia-azbestu/` |
| P02 | likvidácia eternitu | T | `/likvidacia-eternitu/` |
| P03 | odstránenie azbestu | T | `/likvidacia-azbestu/` |
| P04 | demontáž eternitu | T | `/likvidacia-eternitu/` |
| P05 | likvidácia azbestu cena | K | `/cena-likvidacie-azbestu/` |
| P06 | likvidácia eternitu cena | K | `/cena-likvidacie-azbestu/` |
| P07 | odvoz azbestu | T | `/likvidacia-azbestu/` |
| P08 | eternitová strecha | I | `/poradna/co-je-eternit-a-kedy-obsahuje-azbest/` |
| P09 | azbestový odpad | I | `/poradna/odvoz-a-balenie-azbestoveho-odpadu/` |
| P10 | firma na likvidáciu azbestu | K | `/` |
| P11 | likvidácia azbestu Poprad | T | `/likvidacia-azbestu-poprad/` |
| P12 | likvidácia azbestu Košice | T | `/likvidacia-azbestu-kosice/` |
| P13 | likvidácia azbestu Prešov | T | `/likvidacia-azbestu-presov/` |
| P14 | likvidácia azbestu Žilina | T | `/likvidacia-azbestu-zilina/` |
| P15 | likvidácia azbestu Bratislava | T | `/likvidacia-azbestu-bratislava/` |
| P16 | likvidácia azbestu Nitra | T | `/likvidacia-azbestu-nitra/` |
| P17 | likvidácia azbestu Trnava | T | `/likvidacia-azbestu-trnava/` |
| P18 | likvidácia azbestu Banská Bystrica | T | `/likvidacia-azbestu-banska-bystrica/` |
| P19 | ASTANA azbest | N | `/o-firme/` |
| P20 | ASTANA kontakt | N | `/kontakt/` |

## 30 long-tail tém

| ID | Otázka / dopyt | Zámer | Primárny cieľ |
|---|---|---|---|
| L01 | koľko stojí likvidácia eternitovej strechy | K | cena |
| L02 | čo zahŕňa cena likvidácie azbestu | K | cena |
| L03 | cena demontáže eternitu vrátane odvozu | K | cena |
| L04 | likvidácia už zloženého eternitu cena | K | cena |
| L05 | likvidácia azbestu malá garáž | T | eternit |
| L06 | odstránenie eternitu z hospodárskej budovy | T | eternit |
| L07 | likvidácia azbestových rúr v interiéri | T | azbest + vysvetlenie interiér/exteriér |
| L08 | odstránenie boletických panelov | T | azbest |
| L09 | výmena eternitovej strechy so strechárom | T | strechari |
| L10 | odvoz starého azbestu z pozemku | T | azbest |
| L11 | ako prebieha likvidácia azbestu | I | postup |
| L12 | aké doklady dostanem po likvidácii eternitu | I | článok o dokladoch |
| L13 | čo pripraviť pred odstránením eternitu | I | postup |
| L14 | ako zmerať strechu na cenovú ponuku | I | článok o meraní |
| L15 | čo poslať na nacenenie azbestu | I | článok o nacenení |
| L16 | ako zistím či eternit obsahuje azbest | I | článok čo je eternit |
| L17 | prečo neodstraňovať eternit svojpomocne | I | článok o svojpomoci |
| L18 | ako dlho trvá odstránenie eternitovej strechy | I | postup |
| L19 | ako zosúladiť demontáž eternitu so strechárom | I | strechari/postup |
| L20 | potrebujem povolenie na odstránenie azbestu | I | postup s aktuálnym právnym zdrojom |
| L21 | oprávnená firma na likvidáciu azbestu Slovensko | K | o-firme |
| L22 | skúsenosti s firmou ASTANA likvidácia azbestu | K | recenzie |
| L23 | ASTANA realizácie eternitových striech | N | realizacie |
| L24 | likvidácia azbestu v okolí Popradu | T | Poprad |
| L25 | likvidácia eternitu na východnom Slovensku | T | posobnost → Prešov/Košice |
| L26 | likvidácia eternitu na západnom Slovensku | T | posobnost → BA/TT/NR |
| L27 | likvidácia eternitu na strednom Slovensku | T | posobnost → ZA/BB |
| L28 | práca demontáž azbestu živnostník Poprad | T | kariera |
| L29 | spolupráca strechári odstránenie azbestu | T | pre-strecharov |
| L30 | nezáväzná ponuka likvidácie eternitu z fotografií | T | dopyt; fotky voliteľné, nie diagnostická garancia |

## Redakčný a dátový kontrakt

Každý obsahový záznam: stabilné ID, účel/hlavná otázka, overené fakty, zdroj, vlastník revízie, dátum vecnej kontroly, relevantná služba a CTA. Úvod odpovedá na otázku priamo. Článok uvádza skutočného autora; odborného recenzenta iba po doložení mena a funkcie. Firemné autorstvo je prípustné, fiktívny odborník nie.

Jeden graf entity so stabilným `@id`: Organization/ProfessionalService, pravdivé Service a areaServed, jedna BreadcrumbList; Article pre články, FAQPage len pre skutočne viditeľné otázky a bez sľubu rich results. SearchAction nepridávať, ak web nemá reálne fungujúce vyhľadávanie. Nepoužiť vlastné firemné recenzie ako vymyslené AggregateRating.

Jednotné fakty generujú viditeľný text, JSON-LD, company JSON aj llms. Canonical konzistentný s redirectmi. Oprávnenie, ceny a lehoty nezakódovať do desiatok nezávislých reťazcov. Externé odkazy majú jasný účel a dátum overenia, nie iba autoritatívne logo.

## Rozhodnutia pre budúce rozšírenia

| Oblasť | Rozhodnutie teraz |
|---|---|
| Framework | Zachovať Next.js; fungujúci admin a dynamické dopyty nevymieňať za nový stack |
| CMS | Využiť existujúcu správu, typed obsah a schvaľovanie. Nový platený CMS zatiaľ nepridávať |
| Poradňa | Zachovať8 tém, revidovať a prepojiť na dôkazy. Žiadna kvóta článkov bez otázok zákazníkov |
| E-shop | Nie je cieľ. Oddeliť orientačný odhad, schvaľovanú ponuku a objednávku; nepridávať košík |
| Viac jazykov | Slovenčina teraz. Dátové modely pripraviť na locale; nevytvárať prázdne jazykové URL/hreflang |
| PWA/offline | Odložiť; dopyt nesmie offline predstierať odoslanie. Chyba zachová rozpracovaný stav primerane ochrane údajov |
| Dark mode | Tokeny, prefers-color-scheme a kontrastné testy spolu s novým dizajnom |
| CRM | Zachovať existujúcu autoritu dopytov, oddeliť delivery stav; nezdvojovať zákazky |
| Newsletter/chat | Bez preukázanej potreby nepridávať. Plávajúce kanály musia mať vlastníka a merateľný účel |
| Analytika | Jedna schéma udalostí, správny súhlas, bez mien/mailov/poznámok v analytike |

Tieto voľby redukujú zbytočné prerábanie, nie budúcu zodpovednosť za údržbu. Žiadny plán negarantuje nulový technický dlh navždy.
