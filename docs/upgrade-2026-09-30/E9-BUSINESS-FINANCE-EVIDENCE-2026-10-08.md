# E9 — interná evidencia faktúr a úhrad (8. 10. 2026)

## Nemenný lokálny checkpoint

Základ implementácie je uložený v commite `f8829fb0` (`feat: add auditable business finance evidence`) a finálna dátumová oprava v commite `332dc0e3` (`fix: reject future business invoices`). Tento checkpoint nebol nasadený a nepoužil produkčnú databázu, Blob, formulár ani e-mail.

## Čo je hotové

- Detail zákazky eviduje faktúry a prijaté úhrady. Úhrady a ich reverzné opravy sú samostatné udalosti; storno faktúry zachová pôvodné údaje, doplní storno polia a vytvorí auditný záznam.
- Stav sa počíta po jednotlivých faktúrach. Preplatok jednej faktúry nemôže zakryť dlh na inej faktúre.
- Administrácia odlišuje fakturované, prijaté, zostávajúce, omeškané a stornované sumy. Odhad zákazky sa nevydáva za prijaté peniaze ani účtovný zisk.
- Opravy zostávajú v histórii s dôvodom a auditom. Platobná referencia ani osobné údaje zákazníka sa nekopírujú do auditných zmien.
- Samostatný CSV export finančných dôkazov je dostupný iba superadminovi a používa `no-store`.
- Desktop aj mobil majú vlastné čitateľné rozloženie bez horizontálneho pretečenia.

## Integrita a bezpečnosť

- Všetky finančné mutácie vyžadujú platný CSRF token a rolu superadmina.
- Stabilné identifikátory operácií, hash požiadavky, databázové unikátne obmedzenia a transakčné zámky chránia pred dvojklikom, retry a súbežným zápisom.
- Faktúru s aktívnou úhradou nemožno stornovať. Úhradu možno opraviť iba reverznou udalosťou.
- Budúca faktúra, budúca úhrada, budúce storno úhrady a budúce storno faktúry sú odmietnuté. Odvodené saldo navyše ignoruje historický chybný budúci záznam až do jeho účinného dátumu a označí ho na kontrolu.
- Kalendárny dátum z PostgreSQL sa zachová v časovej zóne `Europe/Bratislava`; storno deň pred vystavením sa odmietne rovnako v lokálnom aj PostgreSQL režime.
- Databázová schéma je aditívna a opakovateľná. Zlyhanie auditu v PostgreSQL vráti celú finančnú transakciu späť.

## Overenie checkpointu

- TypeScript: **PASS**.
- Celá unit/kontraktná sada: **379/379 MJS + 34/34 TypeScript PASS**.
- Databázové integrácie: **12/12 PASS**, vrátane lokálnej databázy, PGlite/PostgreSQL parity, súbehu, idempotencie, rollbacku, migrácie a dátumov.
- Izolovaný browser test financií: **PASS** — 1 faktúra, desktop overflow 0, mobil overflow 0, externé originy 0, browser chyby 0.
- Úplný izolovaný Next.js 16.4.0 produkčný build: **99/99 trás PASS**; 32/32 statických SEO URL, dynamické realizácie a recenzie, route CSS/JS izolácia, `productionAccess:false`.
- Jednorazový PostgreSQL 17 bol po teste zastavený a jeho projektové dočasné dáta odstránené.
- Nezávislí read-only kontrolóri našli dve hraničné chyby pri budúcich úhradách/stornách a následne budúcej faktúre. Po opravách, regresných testoch a presnom opakovanom posúdení vydali technický aj obchodno-vizuálny kontrolór **PASS**.
- Codex Security diff scan `e8f97bc2-4b8e-4162-a96d-3a989d48fb7a` uzavrel pôvodných **20/20** položiek bez reportovateľného nálezu. Finálny úzky scan `f5fe731d-0918-4009-a525-67b1369b01ed` následne uzavrel všetkých **6/6** zmenených súborov s úplným pokrytím a nulou nálezov.

## Čo tento dôkaz nepotvrdzuje

Tento checkpoint potvrdzuje lokálnu implementáciu a jej izolované testy. Nepotvrdzuje produkčné dáta, produkčný deploy, živé schránky, skutočný formulár, Vercel Staging ani účtovnú správnosť historických údajov, ktoré ešte neboli vložené. Otvorené produkčné, obchodné, profilové, reálne používateľské a fyzické zariadenia zostávajú samostatnými bránami v aktuálnej akceptačnej matici.
