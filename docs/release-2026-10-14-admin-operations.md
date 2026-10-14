# ASTANA admin a prevádzka — release 2026-10-14

Tento dokument je nemenná značka skontrolovaného produkčného vydania. Funkčný baseline je commit `175ca191`.

## Rozsah

- modernizované administrátorské rozhranie a pracovná plocha Dnes,
- manuálne úlohy, globálne vyhľadávanie, kontrola dát a automatizačný prehľad,
- rozšírené stavy cenových ponúk a bezpečný follow-up typu koncept → výslovné odoslanie,
- plánovač, podklady zákazky, uzatvárací checklist, časová os a upozornenia,
- pohľadávky a finančné/ročné plochy iba pre superadmina,
- žiadosti o referencie s manuálnym tokom, jednou povolenou pripomienkou a samostatným schválením publikácie,
- bezpečný asistent návrhov s lokálnym fallbackom; bez automatického odosielania,
- zjednotené pracovné hodiny 8:00–18:00 v pracovných dňoch,
- zjednotená doprava: od 100 m² po Slovensku bez účtovania,
- posilnené regionálne stránky, interné odkazy a indexovateľné metadáta.

## Overenie pred kandidátom

- TypeScript: PASS,
- unit testy: 545/545 + 38/38 PASS,
- relevantné finálne testy pracovných časov a release auditu: 64/64 PASS,
- opravený lokálny klasifikačný integračný test: 1/1 PASS,
- databázové integračné toky: PASS,
- čistý produkčný build: 108/108 strán,
- SEO metadata a obsah/interné odkazy: 33/33 statických indexovateľných stránok PASS,
- admin vizuálny audit: 38 trás × 13 viewportov = 494 stavov PASS,
- formuláre odoslané počas vizuálneho auditu: 0,
- externé originy počas vizuálneho auditu: 0,
- nezávislý release audit: PASS, bez nálezu P0–P3.

Produkčné doručenie e-mailu sa pri overovaní zámerne nespúšťa. Cenová ponuka ani referencia sa nikdy neodosiela bez povolenej a auditovanej akcie.
