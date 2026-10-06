# E8 — stavová akceptačná matica

> Historická matica základného commitu `f1be6b74`. Novší kandidát `8a4a9386` má podľa [E8-RELEASE-INVENTORY.md](E8-RELEASE-INVENTORY.md) izolovaný build 97/97, statický SEO audit 34 stránok, lokálny HTTP/browser test dynamickej `/recenzie/` a tri následné úzke nezávislé PASS. Úplná S01–S10/G01–G11 matica, Preview a produkčné hardgates zostávajú otvorené; hodnoty NOT_TESTED/WAITING nižšie sa tým automaticky nemenia.

Kontrolný základ: commit `f1be6b74275d5cc424f25c110ac32ec825260802`, Git tree `867fb8b6c860c6ac01898a15446375ae2e14e015`. `git archive` SHA-256: `6808fa6d74672cec0ba710000e13777d81a24380e5af646dc601e5d0063e54cb` (137 840 640 bajtov, 722 sledovaných súborov). Rovnaký výpočet prebehol dvakrát s rovnakým výsledkom. Je to hash Git archívu zdrojového commitu, nie hash Vercel uploadu ani runtime.

Stav sa týka prijatia dôkazu pre E8, nie tvrdenia, že kód alebo lokálne testy neexistujú. `PASS (local)` možno započítať len do lokálneho dôkazu; nikdy nenahrádza Preview/produkciu, inbox ani súhlas vlastníka. `NOT_TESTED` = požadovaný dôkaz chýba; `WAITING` = blokuje konkrétny externý vstup. Všetky scorecard kritériá a ich prahové podmienky sú definované v [ACCEPTANCE.md](ACCEPTANCE.md).

## SEO — S01–S10 (cieľ ≥90/100)

| ID | E8 stav | Dôkaz / čo ostáva |
|---|---|---|
| S01 | NOT_TESTED | Historický crawl nebol naviazaný na tento commit; treba crawl všetkých kanonických URL po vytvorení presného buildu. |
| S02 | NOT_TESTED | Indexácia/canonical/404 sa musia zmerať na presnom builde; aktuálny auditný skript čítal koreňový `.next`. |
| S03 | NOT_TESTED | Metadáta a H1 preveriť cez aktualizovaný rendered crawler na všetkých obsahových URL tohto buildu. |
| S04 | NOT_TESTED | JSON-LD validovať a porovnať s viditeľným obsahom v tomto builde. |
| S05 | NOT_TESTED | Sitemap/robots a `lastmod` preveriť na presnom builde, potom odoslanie/indexáciu v účtoch. |
| S06 | NOT_TESTED | Regionálne a obsahové URL potrebujú poslednú kontrolu duplicít, dôkazov a zámeru. |
| S07 | NOT_TESTED | SSR, interné odkazy a orphan URL nie sú schválené z jednej aktuálnej crawl matice. |
| S08 | NOT_TESTED | Chýbajú tri mobilné Lighthouse behy na určených šablónach a ich archivované výsledky. |
| S09 | WAITING | GSC snapshot existuje, ale indexačný report bol oneskorený; úplný aktuálny GSC/Bing stav a sitemap indexácia nie sú potvrdené. |
| S10 | NOT_TESTED | Médiá/alt/responzívne varianty a hero loading preveriť na schválenom kandidátovi; reálne nové fotky čakajú na vlastníka. |

## GEO — G01–G11 (cieľ ≥90/100; G11 hardgate)

| ID | E8 stav | Dôkaz / čo ostáva |
|---|---|---|
| G01 | WAITING | Majiteľ/odborný garant potvrdí právnu identitu, sídlo, históriu a rozsah oprávnenia voči verejnému profilu. |
| G02 | NOT_TESTED | Prejsť hlavné služby a všetky relevantné výnimky na presnom builde. |
| G03 | WAITING | Schváliť cenové predpoklady, DPH, zahrnuté/vylúčené položky a rozdiel medzi odhadom a záväznou ponukou. |
| G04 | WAITING | Potrebných je aspoň päť skutočných prípadov, originálne fotky, pôvod a súhlas na každý verejný rozsah. |
| G05 | WAITING | Odborné/legislatívne tvrdenia potrebuje potvrdiť kompetentný garant s dátumom revízie. |
| G06 | NOT_TESTED | Overiť pravdivý opis obsluhy všetkých ôsmich krajov bez predstierania pobočiek či referencií. |
| G07 | NOT_TESTED | Posledná vecná a bezpečnostná kontrola FAQ a odpovedí na rozhodovacie otázky. |
| G08 | WAITING | Aktuálne firemné profily a autentické recenzie/súhlasy treba potvrdiť v dostupných účtoch. |
| G09 | NOT_TESTED | Crawl botov a firewall/log dôkaz ešte nie sú priradené tomuto buildu. |
| G10 | NOT_TESTED | Reprodukovaný 24-otázkový panel v dostupnom GPT aj ďalšom systéme nebol vykonaný. |
| G11 | WAITING | Publikovanie realizácie je blokované právami, zdrojom, ľudským schválením a bezpečnou približnou lokalitou pre každý prípad. |

## Funkčnosť — F01–F14 (všetky povinné; release hardgates podľa ACCEPTANCE.md)

| ID | E8 stav | Dôkaz / čo ostáva |
|---|---|---|
| F01 | NOT_TESTED | Kalkulačné unit/browser testy existujú lokálne; plná matica oboch trás, materiálov a hraníc nebola prijatá pre tento runtime. |
| F02 | NOT_TESTED | Prefill a samostatný formulár majú lokálne dôkazy; potvrdiť celý tok na presnom kandidátovi. |
| F03 | NOT_TESTED | Hlavný rozpracovaný strom: skutočný browser klik bez fotky vytvoril jeden miestny dopyt a zákazku, bez súborov, s dvoma čakajúcimi mailovými úlohami; samostatné browser API opakovanie s rovnakým ID vytvorilo tiež iba jeden dopyt. Stále nejde o release-matched trvalý CRM/inbox ani produkčný dôkaz. Pozri [E1 miestne dôkazy](E1-PRIMARY-ISOLATED-2026-10-02.md). |
| F04 | WAITING | Hlavný strom: desať fyzických multipart prenosov na jednorazovom PostgreSQL a dve veľké fotky s autorizovaným/odmietnutým čítaním v PGlite, všetko cez miestny Blob emulátor. Skutočný izolovaný Vercel PRIVATE Blob stále chýba. [Dôkaz](E1-PRIMARY-ISOLATED-2026-10-02.md). |
| F05 | NOT_TESTED | Kompletná matica chýbajúcich, chybných a nadlimitných typov/obrázkov nie je akceptovaná na presnom builde. |
| F06 | NOT_TESTED | Miestny browser overil neistú odpoveď, opakovanie a jeden uložený dopyt; presne ten istý scenár na povolenom release runtime so skutočným doručovaním chýba. [Dôkaz](E1-PRIMARY-ISOLATED-2026-10-02.md). |
| F07 | NOT_TESTED | Lokálna obnova uploadu bola skúšaná; celý súčasný i starý klient potrebuje potvrdenie na oddelenom prostredí. |
| F08 | WAITING | Žiadne aktuálne doručenie interného aj zákazníckeho emailu do oboch schránok nebolo v tomto release kroku potvrdené. |
| F09 | NOT_TESTED | Kandidát obsahuje izolované safety/unconfigured/relay-manual-retry testy. F09 vyžaduje mock/izolované poruchové scenáre a auditovanú admin obnovu, nie živý provider test; všetky podscenáre priradiť k tomuto SHA. Inbox doručenie patrí F08 a ostáva WAITING. Nepokryté vetvy F09 ponechať NOT_TESTED. |
| F10 | NOT_TESTED | Miestny test odmietol anonymné a pozmeneným cookie stiahnutie; produkčné prihlásenie/2FA, súkromný store a runtime ešte nie sú overené. [Dôkaz](E1-PRIMARY-ISOLATED-2026-10-02.md). |
| F11 | NOT_TESTED | Starší klientsky kód proti aktuálnemu backendu prešiel konfliktom aj opakovaním; skutočná karta otvorená počas release a jeho presný runtime ešte nie. [Dôkaz](E1-PRIMARY-ISOLATED-2026-10-02.md). |
| F12 | WAITING | Kariérny/CV a strechársky tok má lokálne browser dôkazy; produkčný súkromný CV storage a obojstranné emaily neboli potvrdené. |
| F13 | NOT_TESTED | Miestny Edge test preveril 390/320/568 px, filter, otvorenie/zatvorenie a fokus; reálne mobilné zariadenia a release-matched úplná matica ešte chýbajú. [Dôkaz](E1-PRIMARY-ISOLATED-2026-10-02.md). |
| F14 | NOT_TESTED | Miestny browser preveril 7 navigačných interakcií bez submitu; celý zoznam CTA, cookies a map fallback treba potvrdiť na presnom builde. [Dôkaz](E1-PRIMARY-ISOLATED-2026-10-02.md). |

## UX — U01–U10 (cieľ podľa ACCEPTANCE.md)

| ID | E8 stav | Dôkaz / čo ostáva |
|---|---|---|
| U01 | NOT_TESTED | Aj aktuálny hlavný WIP prešiel 42 lokálnych viewport stavov bez horizontálneho pretekania; nejde o nemenný prijímaný SHA ani finálny build. [Dôkaz](E1-PRIMARY-ISOLATED-2026-10-02.md). |
| U02 | NOT_TESTED | Jednotný prvotný cieľ potvrdiť na finálnych hlavných šablónach. |
| U03 | NOT_TESTED | Prvé polia a ďalší krok formulára vyžadujú test úlohy so skutočnými používateľmi. |
| U04 | NOT_TESTED | Vizuálny systém skontrolovať naprieč homepage, cena, regióny, články, realizácie, kontakt a kariéra. |
| U05 | NOT_TESTED | WCAG AA kontrast a fokus ešte nemajú úplný report k finálnemu buildu. |
| U06 | NOT_TESTED | Klávesnica/dialogy ešte nemajú úplnú akceptačnú maticu. |
| U07 | NOT_TESTED | Prekrytie plávajúcich prvkov treba overiť v celej breakpointovej sade. |
| U08 | NOT_TESTED | 200 % zoom, landscape a reduced-motion treba vykonať a zaznamenať. |
| U09 | NOT_TESTED | Chyba/loading/success pre čítačku obrazovky a upload treba preveriť v browser teste. |
| U10 | NOT_TESTED | Kritérium: aspoň 4 z 5 skutočných ľudí nájdu cenu alebo odoslanie kontaktu do 60 sekúnd bez pomoci. Dostupnosť testerov je otvorený vstup; modely ani interný skript sa nepočítajú. |

## Prevádzka — O01–O10

| ID | E8 stav | Dôkaz / čo ostáva |
|---|---|---|
| O01 | NOT_TESTED | Na `f1be` je zaznamenaný izolovaný build 97/97; druhý reprodukovateľný build z rovnakého uzamknutého balíka a úplná čistota pracovného prostredia ešte chýba. |
| O02 | PASS (local) | `f1be`: 217/217 unit, 60/60 lead-form, izolované PostgreSQL/DB scenáre a TypeScript PASS podľa E8-RELEASE-INVENTORY.md; výsledok neznamená Preview/produkčnú akceptáciu. |
| O03 | NOT_TESTED | Úzke review klasifikácie/atribúcie má PASS; nezávislá kontrola celého release diffu a všetkých security/SEO tokov ešte nie. |
| O04 | WAITING | Funkčné Preview je blokované nepreukázanou DB/Blob izoláciou; staged Production deployment ani aktuálny alias sa v tomto kroku nemenili. |
| O05 | NOT_TESTED | Zaznamenaný rollback postup ešte nemá v bezpečnom prostredí vykonaný a zdokumentovaný dôkaz. |
| O06 | WAITING | Produkčné doručovacie alerty, vlastníctvo retry a eskalácia `unknown` stavu nie sú prevádzkovo potvrdené. |
| O07 | NOT_TESTED | Kandidát má lokálny consent/event contract; úplný audit všetkých event payloadov bez PII na presnom runtime ešte chýba. |
| O08 | NOT_TESTED | `f1be` má lokálne regresie na vylúčenie označených testovacích záznamov a atribúciu; to samo nepokrýva celý dashboard kvalitné dopyty → zákazky. Bez konkrétneho dôkazu tejto celej bunky sa výsledok nezapočítava. Produkčné CRM/reporty sa netestovali. |
| O09 | WAITING | Foto/CV retenčný workflow je lokálne implementovaný; súkromný produkčný store, retenčné vlastníctvo a mazací job zostávajú gated. |
| O10 | NOT_TESTED | Tento plán a matica sú priebežné; finálny handoff s vlastníkom každej zostávajúcej brány patrí až na koniec E8. |

## Výsledok

Aktuálne nemožno poctivo vypočítať cieľové celkové skóre tak, akoby išlo o dokončený release. `PASS (local)` sa eviduje oddelene; neprebíja `WAITING/NOT_TESTED` ani hardgates. Najbližší postup je uzavrieť testovacie prostredie, naviazať SEO crawler a vizuálne matice na ten istý source archive/build, potom prejsť otvorené F/UX/SEO bunky. Majiteľove fakty, reálne fotky/súhlasy a reálni testeri zostávajú explicitnými vstupmi; bez nich sa G04/G11/U10 neuzatvárajú.
