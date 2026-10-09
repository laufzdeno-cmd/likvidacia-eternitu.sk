# ASTANA — spoločný kandidát na ukážku, 9. 10. 2026

## Rozsah a hranice

Vetva `codex/astana-upgrade-rc1`, HEAD
`c12604501b8cf92ad9eddda9a56dd35bf3207948` plus pracovný diff.
Kód je po poslednej oprave zmrazený; ďalšie úpravy v tomto checkpointe sú
iba dôkazové dokumenty. Produkcia sa nemenila. Majiteľ musí najprv vidieť
výsledok a až potom môže schváliť nasadenie. Lokálny PASS nie je release PASS.

## Čo sa dokončilo

- Homepage má deväť hlavných sekcií namiesto štrnástich; pôvodné kotvy,
  úplný dopyt a kalkulačka zostali zachované. Reálne fotografie vedú
  do realizácií. Nevznikli fiktívne lokality, recenzie ani čísla zákaziek.
- Ponuky používajú spoločný formulár. Voliteľná doprava zachová editovateľné
  kilometre aj sadzbu 0,70 €/km a spiatočný výpočet. Akciová dokumentácia
  sa správne prepočíta na 0 €. Prázdny dátum nezhodí formulár.
- Ukladanie, zrušenie a chyba siete už nenechávajú zaseknutý stav spracovania.
  Tlačidlo uložiť a odoslať zachová cieľ schvaľovacej obrazovky; test neodoslal mail.
- Detail dopytu používa spoločné vyhodnotenie záujmu o strechára.
  Štítok pripraveného stavu má preukázaný kontrast 4,93 : 1.
- Prihlásenie a 2FA zachovávajú overenú generáciu účtu aj počas súbehu;
  pending a úplná relácia majú odlišný účel. Staré cookies bez účelu sa
  po prípadnom nasadení odmietnu a používateľ sa znovu prihlási.
- Bežný lokálny zápis obchodných dát neprepíše novšie admin účty/nastavenia.
  Analytika zachováva platné kampaňové údaje bez nadbytočného ukladania
  identifikátorov z CTA a s limitovaným telom požiadavky.

## Čerstvé dôkazy

| Kontrola | Výsledok a rozsah |
|---|---|
| Izolovaný produkčný build | PASS, 100/100 trás, Next.js 16.4.0, `ogtiw84wg3cDYS8oYQdcv` |
| Renderované SEO | PASS, 33 statických URL, samostatné dynamické realizácie/recenzie, H1, metadata, odkazy/kotvy |
| Mobilný Lighthouse | 15 behov, 5/5 stránok spĺňa mediánové prahy; Performance 95–98, Accessibility 100, SEO 100, CLS 0 |
| LCP | Mediány 2 312–2 476 ms; jeden jednotlivý homepage beh 2 501 ms, preto netvrdíme všetky behy pod 2,5 s |
| Verejný browser náhľad | 18/18, šesť trás pri 320/390/1440 px, obrázky, menu, kalkulačka a prefill; overflow 0 |
| Admin ponuky | 12/12, syntetické údaje, 320/390/1440 px, sieťová chyba aj zrušenie; emaily 0 |
| Databázové integrácie | PASS, 13/13 + štyri následné integračné scenáre, zdroje bez zmeny |
| Cielené auth/local regresie | 12/12 PASS; nenahrádzajú runtime simuláciu bezpečnostného scenára |
| Unit/regresie | Pôvodne 466/467 MJS; po oprave jedinej zastaranej asercie dotknutý súbor 37/37 PASS a presná TS časť 37/37 PASS. Nie nový úplný whole-suite beh. |
| TypeScript a diff whitespace | PASS; úplný produkčný build znovu vykonal typovú kontrolu |

Prvý finálny unit pokus skončil 429 PASS / 2 FAIL: dočasný bezpečnostný
spúšťač sa zacyklil pri hashovaní povoleného `.env.example`, pretože pôvodné
readFileSync interne volalo už obalené openSync. Nie je to pád aplikačného
formulára. Pôvodný výsledok ostáva zaznamenaný; oprava testovacieho spúšťača
nemení aplikačné súbory, povolené cesty ani sieťovú izoláciu.

Po oprave guardu celý MJS beh skončil **466/467**. Jediná zostávajúca
statická asercia v `lead-form-contract.test.mjs` ešte očakávala odstránenú
premennú `email`, hoci obe 2FA akcie správne používajú overené `user.email`.
Opravený test naďalej vyžaduje obe limitované akcie, odmietnutie `limited`
aj `unavailable` a normalizáciu adresy v spoločnom helperi. Cielené zopakovanie
celého dotknutého súboru **37/37 PASS**, presná šesťsúborová TS časť
**37/37 PASS**. Aplikácia sa pritom nemenila; DB/build sa zbytočne neopakovali.
Celá sada sa po tejto test-only zmene znovu nespúšťala, preto ju neoznačujeme
za čerstvý celosúborový PASS. Overenie skončilo 9. 10. 2026 o 08:22:55.

### Odkazy a identita

- [Náhľad](http://127.0.0.1:57189/), vlastný runtime
  `C:\Users\Zdeno\AppData\Local\Temp\astana-owner-preview-MvmwbX`.
  Presný rozsah a obrázky: [OWNER-PREVIEW-2026-10-09.md](OWNER-PREVIEW-2026-10-09.md).
- `tmp/admin-offer-ui-1791526016949/report.json` a `final-source-hashes.json`:
  12 sledovaných súborov rovnakých pred/po browser behu.
- `tmp/final-candidate-build-20261009.log`, SHA256
  `d2794d50c5495bb4356d845dede128e915930d47ebe983f9929c53912632f0f4`.
- DB/unit prvý beh: `C:\Users\Zdeno\AppData\Local\Temp\astana-final-combined-verification-af268313ecfd492a9be9ec6c7490a8d0`.
  Jeho manifest 907 zdrojových/konfiguračných/asset súborov je pred/po zhodný:
  `cdeab875b7c1d8941a6f13bbf68c0f35f402a87f8b5c1f4dffcb52bc3ea6b1cf`.
  Dokumenty sa hashujú oddelene. Formát manifestu je uvedený v `summary.json`.
- Finálny cielený dôkaz:
  `C:\Users\Zdeno\AppData\Local\Temp\astana-final-unit-targeted-completion-faa46ace79cf460f9e839566b3339db2/summary.json`.
  Manifest 907 súborov pred/po:
  `875ae58ace30800c412fc4f6d32b31dc3ee97d0a6c28d3812d61a860007c4e16`.
  `single-test-delta-proof.json` dokladá ako jediný rozdiel oproti predchádzajúcemu
  behu `scripts/lead-form-contract.test.mjs`; `app/src/public` ostali totožné.
  Test SHA256: `29d5bfc4ecde425d0744c4d7cbf7dbe54c654ca98552a3b869640a33810195fb`.
  Cielený stdout SHA256: `722b37c74093c5acccf08f181bd251cb28e77cbff214ae2ff8c509452faa0c73`;
  TS stdout SHA256: `0944e55863d3b8bcdc66401f74a8ce08e2761f4c722a024aca2d766a9ceee777`.
  Žiadny vlastný proces, listener ani DB fixture nezostal bežať.

## Čo zostáva otvorené

1. Súhlas majiteľa s aktuálnym vzhľadom; to nie je automatický súhlas s ostrými testami.
2. Bezpečnostná oprava má vykonané statické a bežné regresné testy, ale riadený
   nástroj odmietol runtime simuláciu reset/proof race. Výsledok `fix-finding`
   je preto **blocked verification**, nie `fixed`. Odmietnutie sa neobchádzalo.
   Jediný post-patch kontrolór našiel dve potvrdené chyby; parent ich opravil.
   Nový nezávislý PASS sa nepredstiera. Správa je v spravovanom bezpečnostnom
   úložisku `artifacts-43505765042dedf1764043ac9c1089b9f8099773fb3bf3990ecfbdfd34401704/artifacts/fix_report-20261009-auth.md`.
3. Oddelený staging a jeho prístupy; potom kontrolovaný kandidát, rollback,
   schválenie ostrého vydania a test dopytu bez fotky/s fotkou vrátane oboch inboxov.
4. Zvyšné firemné a ľudské dôkazy v [owner checkliste](OWNER-SIGNOFF-CHECKLIST-2026-10-08.md),
   najmä päť potvrdených realizácií, práva/lokality a odborná revízia.

Formálna projektová akceptácia zostáva **63,6/100**, nie odhad množstva
napísaného kódu. Žiadne číslo z Lighthouse negarantuje AI odporúčanie ani
100 % obchodnú kvalitu. Finálny projektový cieľ zatiaľ nie je uzavretý.

## Upratanie

Vlastná build kópia aj jednorazový PostgreSQL boli po meraní odstránené.
Starý preview server 64708 bol zastavený; jeho snapshot/logy sa zachovali.
Nový preview server 57189 zostáva pre majiteľa. Neodstránili sa zákaznícke
dopyty, ponuky, prílohy ani používateľské súbory.
