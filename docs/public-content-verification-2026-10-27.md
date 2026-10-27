# Verejné podstránky – overenie 27. 10. 2026

Stav: **lokálny kandidát overený, produkcia nezmenená**. Východiskový commit: dfc67aa2. Build: 6KrwlEGVGNaKFGKyvKSyo. Kontrola: 2026-10-27T07:30:38.380Z.

## Výsledok

- 8 článkov poradne má samostatné tematické vysvetlenie, praktické príklady alebo rozhodovacie body, kontrolný zoznam, súvisiace články, dátum aktualizácie a vlastnú fotografiu z existujúcej verejnej fotodokumentácie.
- 9 regiónov má odlišný praktický obsah podľa situácie, checklist, súvisiacu tému, fotografiu bez neovereného priradenia lokality a konkrétnejšie FAQ. Nevznikla žiadna nová regionálna URL.
- Dve hlavné služby, Poradňa, Kde pôsobíme, FAQ, O firme, Kontakt a Spolupracujúci strechári dostali zrozumiteľnejší obsah a úvod s fotografiou. Cena, Postup, Kariéra, Strechári, Realizácie a Recenzie získali doplňujúce informácie pre rozhodovanie a nadväznosť.
- Podmienky sú doplnené o význam dopytu, orientačného výpočtu, podkladov a koordinácie profesií. Právne a informačné stránky majú čitateľné odseky a navigáciu. Vecný obsah ochrany osobných údajov a logika cookies sa nemenili.
- Pri vizuálnej kontrole sa našiel mobilný štýl, ktorý skrýval úvod informačnej stránky a zobrazoval namiesto neho pevný reklamný text. Úvody už používajú vlastný štýl; overenie kontroluje aj nulovú veľkosť písma.

## Dôkazy

| Kontrola | Výsledok |
| --- | --- |
| Produkčný build vrátane TypeScriptu | PASS, 115 zostavených stránok/endpointov podľa Next výstupu |
| Relevantné obsahové a SEO testy | 33/33 PASS |
| Metadata, canonical a sitemap hotového HTML | PASS, 33 statických verejných URL |
| H1, interné odkazy a kotvy hotového HTML | PASS, 33 statických verejných URL |
| HTTP, hlavný obsah, obrázky, FAQ/schema a rozloženie | PASS, 35 URL × 1440/768/390/320 px = 140 kontrol |
| Ručná vizuálna kontrola vybraných šablón | PASS: poradňa, článok, služba, región, partneri, kontakt, FAQ a právna stránka na desktop/mobile náhľadoch |

Prehliadač neodoslal žiadny dopyt, žiadosť ani referenciu. Externé požiadavky boli zablokované. Fotografie sú existujúce verejné súbory; nenahrávali sa nové zákaznícke fotografie a nič sa neschvaľovalo v databáze.

## Inventár všetkých verejných URL

Počet slov je orientačný súčet textu hlavného obsahu vrátane FAQ a CTA, nie metrika kvality. Domovská stránka bola zahrnutá do kontroly regresie. Fotografie sa nepridávajú do právnych stránok len na dekoráciu.

| URL | Slov v hlavnom obsahu | Obrázkov | FAQ v dátach | Kontrola |
| --- | ---: | ---: | ---: | --- |
| / | 1120 | 4 | 9 | PASS |
| /likvidacia-azbestu/ | 1027 | 1 | 6 | PASS |
| /likvidacia-eternitu/ | 959 | 1 | 6 | PASS |
| /cena-likvidacie-azbestu/ | 721 | 1 | 4 | PASS |
| /postup/ | 1315 | 4 | 8 | PASS |
| /kde-posobime/ | 670 | 1 | 3 | PASS |
| /faq/ | 1048 | 1 | 17 | PASS |
| /realizacie/ | 692 | 5 | 0 | PASS |
| /recenzie/ | 176 | 1 | 0 | PASS |
| /o-firme/ | 409 | 1 | 0 | PASS |
| /kontakt/ | 233 | 1 | 0 | PASS |
| /poradna/ | 364 | 9 | 0 | PASS |
| /strechari/ | 635 | 2 | 0 | PASS |
| /kariera/ | 456 | 1 | 4 | PASS |
| /spolupracujuci-strechari/ | 533 | 1 | 3 | PASS |
| /likvidacia-azbestu-poprad/ | 676 | 1 | 3 | PASS |
| /likvidacia-azbestu-kosice/ | 686 | 1 | 3 | PASS |
| /likvidacia-azbestu-presov/ | 681 | 1 | 3 | PASS |
| /likvidacia-azbestu-zilina/ | 687 | 1 | 3 | PASS |
| /likvidacia-azbestu-banska-bystrica/ | 692 | 1 | 3 | PASS |
| /likvidacia-azbestu-bratislava/ | 673 | 1 | 3 | PASS |
| /likvidacia-azbestu-nitra/ | 685 | 1 | 3 | PASS |
| /likvidacia-azbestu-trnava/ | 670 | 1 | 3 | PASS |
| /likvidacia-azbestu-trencin/ | 691 | 1 | 3 | PASS |
| /poradna/co-je-eternit-a-kedy-obsahuje-azbest/ | 1021 | 1 | 2 | PASS |
| /poradna/preco-neodstranovat-eternit-svojpomocne/ | 994 | 1 | 2 | PASS |
| /poradna/kolko-stoji-likvidacia-azbestu/ | 994 | 1 | 2 | PASS |
| /poradna/ake-doklady-dostanete-po-likvidacii-azbestu/ | 1032 | 1 | 2 | PASS |
| /poradna/ako-zmerat-strechu-pre-cenovu-ponuku/ | 1022 | 1 | 2 | PASS |
| /poradna/co-poslat-pre-nacenenie-likvidacie-eternitu/ | 982 | 1 | 2 | PASS |
| /poradna/azbest-v-interieri-vs-exterieri/ | 997 | 1 | 2 | PASS |
| /poradna/odvoz-a-balenie-azbestoveho-odpadu/ | 1010 | 1 | 2 | PASS |
| /ochrana-osobnych-udajov/ | 704 | 0 | 0 | PASS |
| /cookies/ | 302 | 0 | 0 | PASS |
| /podmienky-pouzivania/ | 222 | 0 | 0 | PASS |

## Hranice overenia

- Nebol vykonaný deploy, zmena Google Ads, odoslanie požiadavky na indexovanie ani úprava administrácie, formulárov a odosielania e-mailov.
- Dynamické Realizácie a Recenzie sa kontrolovali bez produkčnej databázy: galéria s existujúcimi verejnými fotografiami a prázdny stav recenzií. Obsah reálnych databázových záznamov tým nebol znovu overený.
- Izolovaný produkčný server nemá DATABASE_URL; prípadná ISR obnova domovskej stránky po vypršaní cache preto nemôže overiť CMS napojenie. Produkčné nastavenia sa nečítali ani nemenili.
- Reálne Core Web Vitals, Lighthouse skóre a aktuálna indexácia v Search Console sa touto kontrolou nemerali. Lokálny PASS nie je garancia indexácie alebo citácie vo výsledkoch AI.
- Interné prístupové stránky a stránky s individuálnymi tokenmi nie sú súčasťou marketingovej sitemapy ani nových SEO cieľov.

## Náhľady

- [Poradňa – počítač](../tmp/content-audit/browser/1440-poradna.png)
- [Článok o výmere – mobil](../tmp/content-audit/browser/390-poradna--ako-zmerat-strechu-pre-cenovu-ponuku.png)
- [Regionálna stránka – počítač](../tmp/content-audit/browser/1440-likvidacia-azbestu-bratislava.png)
- [Strechár po demontáži – celý náhľad](../tmp/content-audit/browser/1440-spolupracujuci-strechari-full.png)
- [Úplný strojový záznam](../tmp/content-audit/browser/report.json)
