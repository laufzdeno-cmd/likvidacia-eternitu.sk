# Admin „Dnes“ — implementačný plán

## Zámer

Jedna operatívna obrazovka má tímu odpovedať na otázku „Čo treba urobiť teraz?“. Spája existujúce signály z dopytov, emailov, cenových ponúk, plánovača a — iba pre superadmina — financií a prevádzky. Nenahrádza zdrojové obrazovky ani ľudské schválenie.

## Používateľ a hlavná akcia

- Operátor potrebuje bezpečne vybaviť najnaliehavejšiu prácu bez hľadania v dlhých prehľadoch.
- Superadmin potrebuje rovnakú operatívnu frontu doplnenú o majiteľské riziká; finančné údaje zostávajú skryté operátorom.
- Hlavná akcia je otvoriť zdroj automatického odporúčania alebo dokončiť manuálnu internú úlohu.

## Rozsah

1. `/admin/asistent` sa v navigácii pomenuje „Dnes“.
2. Automatické odporúčania sa počítajú z aktuálnych zdrojových dát a neukladajú sa ako kópie. Po vyriešení zdroja samy zmiznú.
3. Manuálne úlohy sa ukladajú samostatne, majú názov, poznámku, prioritu, termín, vlastníka a stav.
4. Každý admin môže úlohu vytvoriť, upraviť, dokončiť, znovu otvoriť alebo zrušiť. Všetky zmeny sa auditujú.
5. Filtre fungujú cez URL a bez klientského JavaScriptu: všetko, kritické, moje, bez vlastníka, hotové a zrušené.
6. Majiteľské financie, systémový stav a obchodný lievik zostávajú dostupné iba superadminovi.

## Bezpečnostné hranice

- Automatizácia neposiela emaily ani cenové ponuky, nemení platby, nespúšťa reklamy, nepublikuje fotografie a nemaže zdrojové záznamy.
- Každá zapisujúca Server Action znovu overí prihláseného admina, CSRF token a vstupné údaje.
- Priradenie je možné iba aktívnemu adminovi. Stavové prechody pracujú iba s existujúcou manuálnou úlohou.
- Zrušenie vyžaduje dôvod; trvalé vymazanie úloh sa nezavádza.
- Operátor nikdy nedostane superadmin priority ani finančné dáta.

## Dátový model

`admin_work_items`: UUID, názov, poznámka, priorita, termín, vlastník, stav, dôvod zrušenia, vytvoril, dokončil, čas dokončenia, created/updated. PostgreSQL aj lokálny JSON fallback používajú rovnaký doménový typ a audit log.

## UX

- Kompaktná hlavička a významové súhrny namiesto dekoratívnych metrík.
- Jednotná fronta rozdelená na po termíne, dnes, nasleduje a hotové.
- Automatická položka vedie k zdroju; manuálna položka má priamo ovládanie stavu a editáciu.
- Modrá označuje bežnú akciu, zelená hotové, oranžová upozornenie, červená iba kritické/destruktívne a fialová manuálnu úlohu.
- Desktop používa dva stĺpce; mobil jeden stĺpec bez tabuliek a horizontálneho posunu.

## Overenie

- čisté unit testy priorít, filtrov a rolí,
- lokálna integračná skúška create → edit → complete → reopen → cancel → audit,
- kontrola auth/CSRF a zákazu automatických obchodných zásahov,
- TypeScript kontrola a produkčný build,
- izolovaný vizuálny audit „Dnes“ od 1440 px po 320 px bez odoslania formulára a bez externých požiadaviek.
