# O06 — bezpečné prevádzkové alarmy doručovania

Dátum lokálneho dôkazu: **9. 10. 2026**  
Implementačný commit: **`49609256`**  
Produkčné nasadenie: **nevykonané**

## Čo je implementované

- Dva pevne povolené workery: doručovanie e-mailov dopytu a aplikačné notifikácie.
- Trvalý stav alarmu v lokálnom úložisku aj PostgreSQL s transakčným/súbežným claimom.
- Prechody `degraded`, `repeated` a `recovered` s rovnakým `eventId` pri nejasnom opakovaní.
- Pri nedostupnej databáze sa alarm neposiela bez trvalého claimu.
- Payload obsahuje iba pevný názov workera, stav, prechod, povolené dôvody, ohraničené číselné metriky a čas. Neobsahuje zákaznícke kontakty, lead ID, SMTP text, adresu webhooku ani tajomstvá.
- HTTPS webhook je HMAC-podpísaný. DNS adresy musia byť verejné; spojenie používa pripnutú overenú IP, pôvodný TLS názov a kontrolu certifikátu. DNS, connect, TLS aj odpoveď majú spoločný absolútny limit.
- Superadmin health zobrazuje iba pevný stav pripravenosti bez hodnôt premenných.

## Overenie

- `npm.cmd run test:unit`: **435/435 MJS + 35/35 TypeScript PASS**.
- `npm.cmd run test:db-integration`: **13/13 PASS** plus staging bootstrap, Meta consent/outbox a PostgreSQL O06 scenár.
- `npm.cmd run typecheck`: **PASS**.
- `git diff --check`: **PASS**; iba štandardné Windows upozornenia LF/CRLF.
- Izolovaný produkčný build: **100/100 trás PASS**, BUILD_ID `L9Rfk_H-tgHafBnx8iA_o`.
- Renderované SEO kontroly: **33 statických URL PASS**; dynamické realizácie a recenzie PASS.
- Testovací režim mal `productionAccess:false`; jednorazová PostgreSQL a vlastné dočasné dáta boli po teste odstránené.

Nezávislý read-only kontrolór najprv vrátil konkrétne nálezy pre DB-outage fallback, nejasné webhook doručenie, DNS rebinding, stratené recovery prechody a neúplný timeout. Každý nález dostal regresný test. Finálny úzky re-review vydal **PASS bez zostávajúcej konkrétnej vady**.

## Otvorená produkčná hranica

O06 zostáva `PARTIAL`. Pred zapnutím treba v internom [owner checkliste](OWNER-SIGNOFF-CHECKLIST-2026-10-08.md) určiť:

- bezpečný externý alert kanál,
- primárneho vlastníka a zástupcu,
- čas do prvej kontroly a eskalácie,
- kto smie potvrdiť nedoručenie a spustiť ručný retry,
- stagingové a následné produkčné overenie plánovania workerov.

Tento dokument nepovoľuje nasadenie, zmenu Vercel premenných, vytvorenie webhooku ani odoslanie ostrého formulára alebo e-mailu.
