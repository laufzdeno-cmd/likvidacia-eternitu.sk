# Staging bootstrap — stav 8. 10. 2026

## Vytvorené externé zdroje

- Vo Vercel projekte `likvidacia-eternitu-sk` bolo vytvorené vlastné prostredie `staging` bez sledovania Git vetvy, bez vlastnej domény a bez importovaných premenných.
- Cez Neon integráciu bola vytvorená bezplatná databáza `astana-staging-db` v regióne Frankfurt (`fra1`) s vypnutým Neon Auth.
- Databáza zatiaľ **nie je pripojená** k Vercel projektu ani k prostrediu `staging`. Do Vercelu sa preto ešte neuložila jej prístupová hodnota.
- Nebolo vytvorené ani pripojené žiadne stagingové Blob úložisko. Nebol vytvorený deployment, zmenený produkčný alias, odoslaný formulár ani e-mail.

## Čerstvé read-only potvrdenie po reštarte

- Vercel dashboard znovu potvrdil vlastné prostredie `staging`: bez sledovania vetvy a bez vlastnej domény.
- Filter projektových premenných pre presný scope `staging` zobrazil **No Environment Variables Added**. Toto tvrdenie sa vzťahuje iba na projektové premenné; automatické Vercel **System Environment Variables** sú zapnuté. Nebola odkrytá ani zmenená žiadna hodnota.
- Súhrnný zoznam Storage označuje existujúce `astana-crm-db` a `astana-lead-files-prod` ako **All Environments**, ale autoritatívny detail oboch spojení uvádza presne **Production, Preview, Development**. Custom environment `staging` v ich scope nie je. Produkčná DB ani produkčný Blob preto nie sú cez tieto dve spojenia priradené stagingu.
- Dialóg **Connect Database** zobrazuje `astana-staging-db` ako dostupnú databázu s aktívnym tlačidlom **Connect**, teda databáza stále nie je pripojená k projektu.
- V projekte stále nie je pripojený žiadny stagingový Blob store; požadované dva oddelené Private Blob stores preto zostávajú nevytvorené.
- Kontrola bola iba na čítanie. Nebol stlačený žiadny **Connect**, **Create Storage**, **Add Environment Variable**, **Save**, deploy ani formulárové tlačidlo.

Vercel System Environment Variables musia zostať zapnuté, pretože bezpečnostný guard používa `VERCEL_TARGET_ENV` a `VERCEL_PROJECT_ID`. Podľa [oficiálnej dokumentácie Vercel](https://vercel.com/docs/environment-variables/system-environment-variables) tento prepínač sprístupňuje platformové identifikátory; nejde o dôkaz, že sú stagingu sprístupnené integračné tajomstvá. Izoláciu integračných zdrojov dokazuje až detail konkrétneho DB/Blob spojenia.

## Bezpečnostný kontrakt kandidáta

Stagingové zápisy zostávajú fail-closed, kým nie sú súčasne splnené všetky podmienky:

- presný Vercel projekt a target `staging`,
- samostatná databáza s deklarovaným provider resource ID a markerom v `astana_environment_guard`,
- hlavný Private Blob a iný Private Blob pre photo-intake,
- ID každého Blob store odvodené priamo z jeho Vercel tokenu a zhodné s deklarovaným resource ID,
- žiadna stagingová databázová ani Blob identita sa nezhoduje so známou produkčnou identitou,
- kryptografická väzba celého súboru zdrojov a jediný testovací e-mailový príjemca,
- vypnutý lokálny relay a zablokované všetky cron trasy.

Normalizácia databázového endpointu odstraňuje Neon `-pooler`, koncovú DNS bodku a ekvivalentné percentové kódovanie názvu databázy. Query parametre schopné prepísať cieľ databázy aj nezabezpečené režimy TLS sú odmietnuté. Oba stagingové Blob store ID sa porovnávajú s oboma produkčnými Blob identitami, takže nie je možné obísť ochranu krížovým priradením rolí.

## Overenie aktuálneho diffu

- Cielené staging/origin/runtime testy: **18/18 PASS**.
- TypeScript kontrola: **PASS**.
- Plný unit balík po pridaní bootstrap regresií: **436/436 kontrol PASS** mimo obmedzeného Windows sandboxu.
- Dve kontroly pôvodne blokované Windows sandboxom (loopback proxy a headless Edge) boli zopakované mimo tejto izolácie: **2/2 PASS**.
- Nezávislý kontrolór najprv našiel krížové priradenie produkčných Blob rolí a dve ekvivalentné podoby databázovej identity. Po oprave a pridaní regresií vydal **PASS**.
- Jednorazový databázový bootstrap bol overený nad dočasným PostgreSQL: opakovanie rovnakého markeru, súbeh, konflikt dvoch markerov aj vynútený rollback po zápise: **PASS**.
- Nezávislý re-review bootstrapu po odstránení URL/TLS prepísania a doplnení reálneho PostgreSQL dôkazu vydal **PASS bez zostávajúcej konkrétnej vady**. Presný lokálny release kandidát `11683a62` následne prešiel 401/401 MJS + 35/35 TypeScript testov, typovou kontrolou a izolovaným buildom 99/99 trás; manifest je v [LOCAL-BUILD-EVIDENCE-11683a62.json](LOCAL-BUILD-EVIDENCE-11683a62.json).
- Najnovší presný zdrojový kandidát je `981cd9e2eb200a579f1c3eb705ee3bb6b95f83d1` (tree `3198f4d10255700c61a409ace6a7e3295a53ca8b`). Jeho nemenný manifest [LOCAL-BUILD-EVIDENCE-981cd9e2.json](LOCAL-BUILD-EVIDENCE-981cd9e2.json) potvrdzuje **428/428 MJS + 35/35 TypeScript testov**, typovú kontrolu, izolovaný Next.js build **100/100 trás**, 33 statických SEO metadata URL a 33 obsahových URL pri `productionAccess: false`. Rovnaký zdroj samostatne prešiel 12/12 databázovými integráciami a 15/15 Lighthouse behmi; presný rozsah a hranice sú v [lokálnom release checkpointe](LOCAL-RELEASE-CHECKPOINT-981cd9e2.md).

## Zostávajúca externá brána

Ďalší krok zapisuje nové prístupové údaje do Vercelu, preto sa vykoná až po výslovnom potvrdení používateľa: pripojiť `astana-staging-db` iba k prostrediu `staging`, vytvoriť a pripojiť dva samostatné Private Blob stores iba k tomuto prostrediu a následne nakonfigurovať marker, resource ID, bezpečné odtlačky a jediný testovací inbox. Produkcia sa tým nemení.

Presné poradie, nemenný kandidát, allowlist, stop podmienky a akceptačné kroky sú v [staging execution runbooku](STAGING-EXECUTION-RUNBOOK-2026-10-08.md).

Po úplnom nastavení stagingových premenných sa databázový marker vytvorí jednorazovým skriptom `scripts/bootstrap-staging-database.ts`. Skript vyžaduje výslovné potvrdenie project ID aj database resource ID, znovu overí celý staging binding, používa parameterizovaný zápis v transakcii a nikdy neprepíše už existujúci odlišný marker. Nevytvára aplikačnú schému ani žiadne obchodné údaje.
