# Google Search Console — read-only baseline 7. 10. 2026

## Rozsah a bezpečnosť kontroly

Kontrola prebehla iba na čítanie nad doménovým zdrojom `likvidacia-eternitu.sk`. Nebola odoslaná nová sitemap, spustené overenie, exportované súkromné dáta ani zmenené nastavenie účtu. Zobrazené agregované údaje boli naposledy aktualizované približne 16,5 hodiny pred kontrolou a končia 4. 10. 2026.

## Vyhľadávanie Google

| Obdobie | Kliknutia | Zobrazenia | CTR | Priemerná pozícia |
|---|---:|---:|---:|---:|
| 7. 9. – 4. 10. 2026 (28 dní) | 70 | 2,57 tis. | 2,7 % | 6,0 |
| 5. 7. – 4. 10. 2026 (3 mesiace) | 169 | 5,53 tis. | 3,1 % | 6,4 |

Medzi viditeľnými komerčnými dopytmi boli napríklad `likvidácia eternitu cena za m2`, `likvidacia azbestu nitra`, `eternit likvidacia`, `azbest odvoz` a `likvidácia azbestu bratislava`. Ide o agregované vyhľadávacie dopyty, nie o dopyty zákazníkov ani objednávky.

## Funkcie generatívnej umelej inteligencie vo Vyhľadávaní Google

Search Console sprístupňuje pre doménu samostatný beta report „Funkcie generatívnej umelej inteligencie“:

- 985 zobrazení za 7. 9. – 4. 10. 2026,
- 1,96 tis. zobrazení za 5. 7. – 4. 10. 2026,
- za 28 dní pripadlo 732 zobrazení na homepage; ďalšie viditeľné URL zahŕňali `/likvidacia-azbestu/`, regionálne stránky pre Žilinu a Nitru, `/likvidacia-eternitu/`, `/postup/`, `/cena-likvidacie-azbestu/`, `/o-firme/`, `/faq/` a `/kontakt/`.

Tieto zobrazenia nepreukazujú odporúčanie ASTANY, citáciu, kliknutie, dopyt ani obchodný výsledok. Nenahrádzajú neutrálny 24-otázkový AI panel definovaný v `ACCEPTANCE.md`.

## Indexácia, sitemap a bezpečnosť

- Sitemap `https://likvidacia-eternitu.sk/sitemap.xml` bola odoslaná 27. 5. 2026, naposledy načítaná 6. 10. 2026 so stavom **Úspech** a 34 objavenými stránkami.
- Report indexácie aktualizovaný 4. 10. 2026 eviduje 14 indexovaných a 23 neindexovaných URL.
- Neindexované URL: 3 stránky s presmerovaním, 19 „Objavené – momentálne nie je v indexe“ a 1 „Indexovo prehľadávané – momentálne neindexované“.
- Report manuálnych akcií: **Neboli zistené žiadne problémy**.
- Report problémov so zabezpečením: **Neboli zistené žiadne problémy**.
- Pre breadcrumbs bolo v prehľade viditeľných 17 platných a 0 neplatných položiek.
- Pre Core Web Vitals nebola v prehľade dostatočná terénna vzorka pre mobil ani desktop; lokálne Lighthouse dôkazy sa preto nesmú označiť ako field CWV.

## Limity a ďalší krok

Baseline patrí starej živej verzii pred checkpointom `3e8011f0`. Po kontrolovanom nasadení treba zopakovať crawl, indexačný stav a sitemap bez vytvárania falošných `lastmod`. Bing Webmaster Tools v tejto kontrole overený nebol. Preto je S09 iba **PARTIAL**, nie PASS; G09 a G10 zostávajú otvorené podľa akceptačnej matice.
