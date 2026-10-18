# ETERNIT ROOFER ECOSYSTEM V4

## Stav

Lokálna implementácia prešla kontraktovou, typovou, buildovou a read-only vizuálnou kontrolou. **Nebola nasadená, odoslaná do produkcie ani nebol odoslaný žiadny dopyt.**

## Rozsah zmeny

- Domovská stránka má kompaktnú sekciu o nadväzujúcej streche a voliteľné potvrdenie pomoci so strechárom.
- Potvrdenie používa existujúcu hodnotu formulára pre odporúčanie strechára; nepridáva API, databázové pole ani automatické odovzdanie údajov partnerovi.
- Stránka `/strechari/` jasne rozdeľuje prácu ASTANA a strechára. Partnerské texty a grafické podklady sa poskytujú individuálne až po overení spolupráce; verejná registrácia sama osebe neoprávňuje používať označenie partnera ani logo ASTANA.
- Verejný zoznam strechárov nebol vytvorený. Chýba samostatný, dohľadateľný súhlas na verejné profily, preto by jeho vytvorenie nebolo bezpečné ani korektné.

## Kontrolná matica

| Kontrola | Výsledok | Dôkaz |
| --- | --- | --- |
| Kompaktný blok „Potrebujete po eternite aj novú strechu?“ | OK | Verejná domovská stránka; dva stručné scenáre bez zmeny hlavného formulára. |
| Existujúci výber „Máte už strechára?“ | OK | Zostal zachovaný; voliteľné potvrdenie sa ukáže iba pri možnosti „Nemám strechára“. |
| Jeden klik / jeden POST formulára | OK | Kontraktové testy potvrdili zachovaný endpoint `/api/dopyt/` a žiadny nový request. |
| Automatické zdieľanie údajov so strechárom | OK | Nevznikol žiadny endpoint, verejný profil ani odoslanie údajov tretej strane. |
| Stránka pre strechárov | OK | Text oddeľuje odstránenie azbestu a novú strechu; neobsahuje falošné certifikácie ani garancie. |
| Partnerské podklady | OK — chránené overením | Verejná stránka neponúka odznak, logo ani hotové tvrdenie o partnerstve bez predchádzajúceho overenia spolupráce. |
| Verejný katalóg partnerov | OK — zámerne nezverejnený | Bez samostatného súhlasu na verejné profily sa nezobrazujú firmy ani kontakty. |
| TypeScript | OK | `npm.cmd run typecheck` prešiel bez chyby. |
| Kontrakty formulára a partnerov | OK | Lead formulár 68/68 a ETERNIT ROOFER ECOSYSTEM V4 4/4 prešli. |
| Produkčný build | OK | Lokálny `next build` dokončil kompiláciu, TypeScript a statické generovanie 110 trás. |
| Vizuálna kontrola 320 / 360 / 390 / 412 / 430 / 1440 px | OK | Finálny lokálny produkčný náhľad prešiel read-only Playwright kontrolou úvodnej stránky a `/strechari/`: 12 screenshotov, žiadny horizontálny pretek, orezané CTA, error overlay, JavaScript chyba, externá požiadavka ani POST. Report: `tmp/roofer-ecosystem-v4-1792314764615/report.json`. Mobilný aj desktopový náhľad bol následne prezretý. |

## Hranice nasadenia

Lokálne zobrazenie na povinných šírkach je uzavreté. Produkčné prijatie ešte vyžaduje nasadenie presného commit SHA a samostatnú smoke kontrolu domény. Táto zmena sa nedotýka formulárového API, e-mailov, Meta/CAPI, reklám, cookies, sitemap ani robots pravidiel; zachované formulárové API a zdieľaný údaj o strechárovi boli preverované regresnými testami bez odoslania dopytu.
