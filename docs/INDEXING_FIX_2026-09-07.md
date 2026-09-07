# Indexácia: cielená oprava 7. 9. 2026

## Zistenia a zámer

Search Console uvádza 10 indexovaných URL, 23 objavených URL, tri presmerovania
HTTP/www a neindexovaný sitemap.xml. Sitemap úspešne načítal 7. 9. 2026 (33 URL).
Živý test hlavnej služby povoľuje indexovanie. Hostitelia nemajú hlásené problémy.
Tieto dôkazy nepotvrdzujú penalizáciu ani blokovanie. Rozhodnutie Googlu o
prehľadaní a zaradení nedokážeme garantovať úpravou kódu.

Zákazník potrebuje nájsť službu, miestnu pôsobnosť a overiteľné údaje firmy a
následne požiadať o cenovú ponuku. Zachovávame existujúce URL a vzhľad.

## Rozsah pred implementáciou

- Odstrániť lastModified odvodený z času buildu. Dátum vrátiť až s evidenciou
  skutočných podstatných zmien obsahu; nevyrábať čerstvosť pri každom nasadení.
- Doplniť hlavné služby a firemné údaje do existujúceho bloku súvisiacich odkazov.
- Prepojiť služby a postup so všetkými ôsmimi existujúcimi miestnymi stránkami.
- Na miestnych stránkach odstrániť opakovaný úvod, opraviť skloňovanie a pridať
  praktické odkazy. Nevytvárať miestne pobočky, recenzie ani realizácie bez dôkazov.
- Vyžiadať indexovanie štyroch dôležitých URL cez Search Console bez opakovania.

Formulár, API, DB, emaily, consent, tracking a crony ostávajú mimo diffu.
Lokálne rozpracované admin zmeny zostávajú v pôvodnom worktree.

## Overenie

Typecheck, staged production build, sitemap (rovnakých 33 canonical URL), HTTP
stav, robots a canonical, vnútorné odkazy, mobil/desktop bez overflow.
Nasadenie z čistého commitu nad aktuálnym live 7f0365ac; pred promote opäť
overiť live pointer. Žiadny formulárový POST ani zápis zákazníckych dát.

## Následné vyhodnotenie

Po 7 až 14 dňoch porovnať stav URL a dátumy prehľadania. Čakanie nie je dôkaz
úspešnej indexácie. Miestne referencie dopĺňať len z potvrdených a schválených
podkladov. Podobnosť miestnych stránok je obsahová slabina, nie dokázaná príčina.

Zdroj: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
