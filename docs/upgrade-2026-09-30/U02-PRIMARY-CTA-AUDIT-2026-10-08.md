# U02 — audit prvotného cieľa verejných šablón

Stav: **PASS local current**
Kontrolovaný commit: `59149a474ae7061b85281a7a2e17c65a518d0680`
Kontrolovaný strom: `6d4d8025bab9720b8746f130087b1d8056036028`

## Výsledok

Každá hlavná verejná šablóna má jeden zrozumiteľný prvotný cieľ zodpovedajúci zámeru návštevníka. Predvolená hlavička vedie kupujúceho na krátky dopyt. Kariéra a stránka pre strechárov používajú vlastný, významovo správny cieľ a neposielajú návštevníka do zákazníckeho formulára.

| Šablóna | Zámer návštevníka | Primárny cieľ | Stav |
|---|---|---|---|
| Domov | objednať likvidáciu | Získať cenovú ponuku | PASS |
| Cena | zistiť cenu a odoslať dopyt | Získať cenovú ponuku | PASS |
| Služba | objednať likvidáciu | Získať cenovú ponuku | PASS |
| Regionálna stránka | objednať službu v lokalite | Získať cenovú ponuku | PASS |
| Postup | pochopiť priebeh a pokračovať k dopytu | Získať cenovú ponuku | PASS |
| Realizácie | overiť skúsenosti a pokračovať k dopytu | Získať cenovú ponuku | PASS |
| Kariéra | prihlásiť sa na spoluprácu | Chcem sa prihlásiť | PASS |
| Strechári | nadviazať partnerskú spoluprácu | partnerská registrácia | PASS |

## Opravená odchýlka

Kariérna stránka predtým zdedila v desktopovej aj mobilnej hlavičke kupujúce CTA „Získať cenovú ponuku“. Teraz obe hlavičkové CTA aj primárne hero CTA používajú text „Chcem sa prihlásiť“ a smerujú na `#prihlasit-sa`. Ostatné stránky si zachovali predvolenú cestu `/#dopyt`.

## Overenie

- cielený kontraktný test kariéry: **2/2 PASS**;
- typová kontrola: **PASS**;
- celá verejná vizuálna matica: **20 trás × 11 viewportov = 220/220 PASS**;
- 25 kontrolných snímok, 0 odoslaných formulárov, 0 hydration chýb a 0 externých browser originov;
- navigačný test kliká na viditeľné hero CTA jednoznačným selektorom;
- nezávislý read-only produktový kontrolór: **PASS**.

Tento dôkaz uzatvára iba lokálne kritérium U02. Nezahŕňa produkčné nasadenie, reálny dopyt, U10 test so skutočnými používateľmi ani finálny súhlas majiteľa s celou obchodnou prezentáciou.
