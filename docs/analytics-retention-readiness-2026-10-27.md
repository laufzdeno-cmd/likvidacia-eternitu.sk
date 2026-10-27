# Samostatné analytické udalosti – pripravenosť uchovávania na 12 mesiacov

Dátum kontroly: **27. 10. 2026**. Rozsah: read-only analýza aktuálneho zdrojového kódu pre vlastníkom určených **12 kalendárnych mesiacov samostatných analytických udalostí**. Produkčná databáza, súkromné zálohy a tajomstvá sa nečítali. Žiadne dáta sa nemenili ani neodstránili. Tento dokument je odovzdanie na implementáciu, nie potvrdenie nasadenej politiky.

## Záver

**RETURN WITH DEFECTS pre tvrdenie, že 12-mesačné uchovávanie už funguje.** Databázová analytika nemá časové mazanie. Lokálny režim ponecháva udalosti prijatých dopytov natrvalo a ostatné obmedzuje počtom, nie vekom. Obnova prijatých dopytov môže zmazané staré udalosti opäť vytvoriť. Export obchodnej databázy dnes zahŕňa aj celú surovú analytiku.

Najmenšia bezpečná implementácia je jedna spoločná retenčná politika, samostatný autentifikovaný údržbový endpoint a cielené ochrany obnovy/zlučovania/záloh. **Nepripájať mazanie ku `/api/cron/notifications/`**, ktorý zároveň posiela správy. Úprava nepotrebuje meniť klientské meranie, súhlasy, verejný formulár ani reklamné konverzie.

## Presná mapa ukladania a tokov

Čísla riadkov sú orientačné k stavu pri kontrole; súbežné úpravy ich môžu posunúť. Názvy funkcií sú rozhodujúce.

| Miesto | Overená zodpovednosť | Dôsledok pre retenciu |
| --- | --- | --- |
| `src/server/db.ts:1999` – DDL `analytics_events` | `id`, `created_at`, `session_id`, typ, cesta, referrer, zariadenie, UTM a JSON metadata | Toto je jediná vlastná PostgreSQL tabuľka surových analytických udalostí. Nemá `lead_id` ani deklarovaný cudzí kľúč na dopyt. V kontrolovanom kóde sa nenašiel ani FK smerujúci do tejto tabuľky. |
| `src/server/db.ts:2608` | Indexy `(created_at DESC, event_type)` a `(session_id, created_at DESC)` | Existujúci časový index vie podporiť dávkové mazanie podľa `created_at`; kvôli samotnej retencii netreba novú schému. |
| `src/server/db.ts:225,251,2926` | `LocalDb.analyticsEvents`; súbor `ASTANA_LOCAL_DB_PATH`, predvolene `.data/local-db.json` | Lokálna alternatíva tej istej analytiky. Nečítať skutočný dátový súbor pri vývoji testov. |
| `src/server/db.ts:18624` – `recordAnalyticsEvent` | Server určí čas, prípadne prijme dôveryhodný backfill `createdAt`; deduplikácia podľa `id` | Nové bežné udalosti dostanú aktuálny čas. Starý dôveryhodný backfill treba odmietnuť alebo explicitne preskočiť podľa spoločnej politiky. |
| `src/server/db.ts:18690` – `recordAcceptedLeadAnalytics` | Pri súhlase a platnom session UUID vytvorí `form_submit_success`, `id = lead.id`, čas `lead.createdAt` | Zhoda ID je logické prepojenie, nie FK. Toto je interná analytická kópia prijatia dopytu, nie odoslanie reklamnej konverzie. |
| `src/server/db.ts:18727` – `recoverAcceptedLeadAnalytics` | Dopĺňa chýbajúce `form_submit_success` z uložených dopytov; lokálne aj PostgreSQL, dávka najviac 500 | Dnes nemá časovú hranicu. Po zmazaní starých udalostí by ich obnovovala. Cutoff musí platiť pre výber aj počítanie neobnoviteľných záznamov. |
| `src/server/analytics-recovery.ts` – `persistAcceptedLeadAnalyticsBatch` | Pravdivý návrat persist funkcie počíta ako obnovené; prázdny ako chybu | Pri preskakovaní starého záznamu zachovať význam výsledku: vyradiť ho z kandidátov ešte pred dávkou alebo odlíšiť preskočenie od zlyhania. Inak vznikne nepravdivá chyba/backlog. |
| `src/server/db.ts:3517` – `writeLocalDb` | Čerstvo načíta existujúce údaje, spojí existujúce a prichádzajúce udalosti podľa ID, potom zachová všetky `form_submit_success` a najviac 5 000 ostatných | Samotné vyfiltrovanie `local.analyticsEvents` a zavolanie writeru **nevymaže** staré udalosti: writer ich vezme z existujúceho súboru. Starý snapshot ich môže vrátiť aj po údržbe. |
| `src/server/db.ts:264,287` | `withLocalFileLock`, `withLocalLeadSubmissionLock`, súborový mutation-lock a fronta | Lokálnu údržbu treba robiť pod existujúcim zámkom s čerstvým čítaním. Zachovať jeho pravidlá a atomický zápis. |
| `src/server/db.ts:18772` – `getAnalyticsEventsWithCoverage` | Číta časový rozsah, reportový limit 20 000 | Rozsah 365 dní a limit počtu nie sú retenčná politika; fyzické staré dáta ponechávajú v úložisku. |
| `src/server/db.ts:19088` – `getAnalyticsTrafficSummary` | Súhrny dnes/mesiac/rok/`allTime` zo samostatných udalostí | Po retencii `allTime` znamená všetku dostupnú analytiku v uchovávanom období. Administrácia ju dnes označuje „Celkom“ (`app/admin/(protected)/analytics/page.tsx:53`). Doplniť pravdivé pomenovanie dostupného obdobia. |
| `src/server/db.ts:18984` – `getLeadAttributionReport` | Reportuje `leads.raw_data.attribution`, nezávisle od tabuľky udalostí | Zdroj pripísaný konkrétnemu dopytu sa nesmie touto údržbou meniť. |
| `src/server/db.ts:6868` – `exportDatabaseBackup` | PostgreSQL: exportuje všetky verejné base tables; lokálne celý `LocalDb` | Zahŕňa aj `analytics_events`/`analyticsEvents`. Živá retencia sama nevyrieši staré analytické kópie v zálohách. |
| `app/api/cron/backup/route.ts` | Súkromné Blob zálohy, týždenný beh, ponecháva najnovších 12 súborov | Retencia počtom záloh nie je 12-mesačná retencia udalostí v ich obsahu. Nevykonávať hromadné mazanie obchodných záloh. |

## Hranice, ktoré nesmú byť prekročené

Mazanie sa smie týkať iba `analytics_events` a lokálneho poľa `analyticsEvents`. Zahŕňa všetky ich typy vrátane starej analytickej kópie `form_submit_success`; nemá byť výnimka „konverzie ponechať navždy“, ktorá by protirečila sľúbenej lehote.

Nedotknuté zostávajú:

- `leads`, ich stav, `raw_data`, `raw_data.attribution`, súhlasy a údaje o pôvode dopytu;
- ponuky, zákazky, náklady, faktúry, platby, auditné a účtovné podklady;
- `lead_meta_capi_outbox` (`db.ts:1553`) s FK na `leads`, `lead_meta_capi_consent_subjects` (`1575`) a existujúce reklamné outboxy `meta_capi_delivery_outbox`, `meta_capi_outbox`, `meta_conversion_outbox` (`2114`, `2142`, `2158`);
- odosielanie Meta konverzií, ich idempotencia, marketingový súhlas, meracie identifikátory a reklamné kampane;
- emailové fronty, follow-upy, recenzie, zákaznícke súbory a fotografie.

Nepoužiť `TRUNCATE`, kaskádové mazanie, mazanie dopytov ani globálne skrátenie všetkých `created_at`. Nepresúvať surové udalosti do novej trvalej archívnej tabuľky. Logovať iba cutoff, počty, trvanie a bezpečný stav chyby; bez URL, session ID, metadata či osobných údajov.

## Navrhnutý ohraničený zásah

### 1. Jedna spoločná časová politika

Pridať čistý pomocný modul napríklad `src/server/analytics-retention-policy.ts`. Vypočítať **12 kalendárnych mesiacov**, nie 365 dní ani približný počet milisekúnd. Odporúčaná jednoznačná implementačná konvencia je UTC čas a orezanie neexistujúceho dňa na posledný deň cieľového mesiaca: `2024-02-29T10:00Z` → `2023-02-28T10:00Z`. Bežné `Date.setMonth` bez orezania môže prejsť do nasledujúceho mesiaca.

Cutoff vypočítať raz pre jednu dávku a rovnaký ISO parameter použiť v SQL, lokálnom úložisku a recovery. Expiruje iba čas **menší** než cutoff; presná hranica zostáva. Neplatné hodiny odmietnuť pred mutáciou. Budúce udalosti nemaže táto politika. Poškodený lokálny dátum bezpečne ohlásiť/zachovať, nie ho ticho zaradiť na zmazanie.

### 2. Cielená dávková údržba v databázovej vrstve

Pridať exportovanú retenčnú funkciu do `db.ts`, ktorá použije existujúci `getPool` a produkčné ochrany. PostgreSQL má vyberať staré ID po malých usporiadaných dávkach a mazať **iba z `analytics_events`** cez parametrizovaný cutoff. Rozumný východiskový limit je 5 000, pevný strop 10 000 na dávku; implementátor môže zvoliť menšiu overenú dávku. Vrátiť `{ cutoff, deleted, remaining }`. Žiadne migrácie počas produkčnej požiadavky.

Lokálne treba odstrániť expirácie **až po** zlučovaní v `writeLocalDb`, nie iba vo vstupnom poli. Najmenšie jasné vlastníctvo zabezpečí chránený monotónny retenčný watermark uchovávaný writerom: bežný starý snapshot nesmie znížiť najnovšiu už prijatú hranicu. Vyhodnotiť maximum existujúceho a práve oprávnene posunutého cutoff. Údržba použije čerstvé čítanie a `withLocalLeadSubmissionLock`. Zachovať všetky ostatné existujúce pravidlá writeru. Alternatívou je spoločný časový filter v každom zápise; vyžaduje rovnaké izolované testy a nesmie byť omylom aplikovaný na iné kolekcie.

### 3. Zabránenie opätovnému vytvoreniu udalostí

`recoverAcceptedLeadAnalytics` musí mať rovnaký cutoff v lokálnych kandidátoch a v **oboch** SQL dotazoch: platné kandidáty aj počty neobnoviteľných session. Staré dopyty zostanú zachované a nebudú vykazované ako chýbajúca analytika.

`recordAcceptedLeadAnalytics` musí tiež bezpečne preskočiť starší dopyt, aby ho iný dôveryhodný volajúci nedoplnil mimo recovery. Ochrana `recordAnalyticsEvent` musí zabrániť vloženiu starého dôveryhodného `createdAt`; pri zmene návratovej hodnoty skontrolovať všetkých volajúcich. Uchovávanie deduplikačných ID natrvalo tu nie je potrebné: staré zdrojové udalosti už nesmú byť kandidátmi. Nové prijaté dopyty zostávajú idempotentné ako doteraz.

### 4. Samostatný údržbový endpoint

Nový `app/api/cron/analytics-retention/route.ts`: `GET`, runtime `nodejs`, `maxDuration = 60`. Najprv overiť neprázdny `CRON_SECRET` a presnú autorizáciu `Bearer`; až potom databáza. V nasadení odmietnuť preview/iný než produkčný cieľ, aj keby route bola zavolaná mimo proxy. Izolované unit/integration testy môžu mať vlastný explicitný testový režim a dočasnú databázu, nikdy produkčné väzby.

Existujúci `vercelCronRequestAllowed` (`src/server/preview-safety.ts:197`) už povoľuje generický `/api/cron/…` pri správnej autorizácii iba pre produkčné prostredie a metódu GET. `deploymentRequestBlocked` (`243`) blokuje cron v izolovanom stagingu. `getPool` (`db.ts:294`) uplatňuje `deploymentDatabaseAccessBlocked` a povinnú databázu v produkcii. **Tieto ochrany neoslabovať, nepridávať všeobecný bypass.**

Do `vercel.json` pridať samostatnú dennú položku, napríklad `/api/cron/analytics-retention/` o `30 5 * * *` (Vercel časovanie je UTC). Zachovať všetky existujúce položky. V jednom behu spracovať iba časovo a počtom obmedzené dávky. Chyba alebo zostávajúci backlog po vyčerpaní limitu nesmie vrátiť nepravdivé `{ ok: true }`; vracať kontrolovaný stav 503 s počtami. Opakovanie musí byť idempotentné.

Neimportovať mailery, nespúšťať `/api/cron/notifications/` počas QA a nepripájať k nemu mazanie. Aktuálny denný notifications cron volá recovery (`:153`) a čistenie rate-limit vedier (`:163`); to druhé čistí iba `api_rate_limit_buckets`, nie analytiku. Zmena recovery je potrebná pre správnosť, nie nové spúšťanie oznámení.

Denný fyzický cleanup prirodzene vytvára oneskorenie medzi prekročením veku a najbližším úspešným behom. Ak verejná informácia znamená prísne okamžité maximum bez prevádzkového oneskorenia, samotný denný cron to nedokazuje. Čítačky/recovery musia rešpektovať aktuálny cutoff a prevádzka musí sledovať dokončenie údržby. Neoznačovať politiku ako splnenú len preto, že existuje cron konfigurácia.

### 5. Zálohy a obnova

Zo **všetkých budúcich** obchodných exportov vynechať iba `analytics_events` a lokálne `analyticsEvents` alebo vytvoriť výslovne oddelený export bez surovej analytiky. Zachovať dopyty, ich pôvod, účtovníctvo a reklamné outboxy. Predvolený súkromný backup sa používa na obnovu chodu firmy; surová návštevnosť nemusí byť jeho súčasťou.

Existujúce súkromné zálohy môžu staré udalosti stále obsahovať; ich obsah nebol čítaný. Nenašiel sa samostatný aplikačný tok obnovy celej databázovej zálohy. Pravidlo obnovy preto musí explicitne vynechať analytiku alebo ju pred sprístupnením systému prefiltrovať aktuálnym cutoff. **Existujúce obchodné/účtovné zálohy kvôli tomu hromadne nemažeme.** Zúženie živého úložiska a budúcich exportov je overiteľný prvý výsledok; vymazanie historických súkromných kópií nie je preukázané bez samostatného rozhodnutia a vykonania. Zohľadniť tento limit pri verejnom opise politiky.

### 6. Výstupy a pravdivé zobrazenie

Klientské odosielanie, súhlasy, origin/rate-limit pravidlá a meracie názvy zostanú bez zmeny. Reporting „Celkom“ označiť ako dostupné uchovávané obdobie; existujúci filter 365 dní môže zostať reportovým oknom a nemusí sa premenovať na kalendárnu retenciu. Nezasahovať do obchodných ročných prehľadov. Verejný text o 12 mesiacoch zosúladiť až s implementovaným a overeným správaním a jasnou hranicou záloh.

## Potrebné izolované dôkazy pred prijatím

1. **Kalendárna politika:** priestupný deň, konce mesiacov, reprodukovateľné UTC a prechody DST; presná hranica zostane, 1 ms pred ňou expiruje, budúca udalosť zostane, neplatné hodiny nezmažú nič.
2. **PostgreSQL v izolovanej dočasnej databáze:** staré/nové page views aj `form_submit_success`; zmenia sa iba expirované `analytics_events`. Pred/po porovnať dopyty vrátane `raw_data.attribution`, ponuky, zákazky, faktúry, platby, audit a Meta outbox/súhlasy. Nepoužiť produkčnú DB.
3. **Lokálny izolovaný súbor:** cleanup, súbežný nový event a oneskorený obyčajný snapshot po cleanup nesmú obnoviť staré udalosti. Watermark sa nemôže znížiť. Nové udalosti a všetky ostatné kolekcie zostanú zachované. Existujúci limit 5 000 nie je dôkaz lehoty.
4. **Obnova:** po purge nevznikne starý `form_submit_success`; čerstvý chýbajúci sa doplní práve raz. Staré dopyty a staré neplatné session nevytvoria neobnoviteľný backlog. Overiť návratové hodnoty `persistAcceptedLeadAnalyticsBatch`.
5. **Endpoint a plánovanie:** chýbajúce/chybné tajomstvo odmietnuť pred DB; preview odmietnuť; izolovaný oprávnený beh má overiteľné počty, nedokončený beh a chyba majú 503, opakovanie nič nepoškodí. Žiadne emailové/sieťové odosielanie, žiadne PII v logoch. Nový cron pridaný bez odstránenia ostatných.
6. **Backup/restore hranica:** budúci export neobsahuje surovú analytiku, obsahuje obchodné a reklamné dáta bez zmeny. Prípadný test obnovy z fiktívnej starej zálohy musí overiť cutoff skôr než bude systém dostupný. Bez mutácie existujúcich súkromných záloh.
7. **Regresie:** existujúce `scripts/public-analytics-route.test.mjs`, `analytics-consent-contract.test.mjs`, `analytics-metrics.behavior.mjs`, lead-attribution testy a Meta outbox/consent/idempotency testy. Využiť vzor izolovaného local DB testu `local-admin-state-ownership.test.mjs` a plánovacích kontraktov `runtime-worker-scheduling-policy.test.mjs`.

## Stav odovzdania

**Overené:** zdrojové definície úložísk, konkrétne zapisovacie/obnovovacie/čítacie funkcie, súčasné cron a proxy ochrany, nezávislosť zdrojových údajov dopytu a reklamných outboxov, exportný tok záloh.

**Neoverené:** objem a vek produkčných udalostí, existencia/obsah konkrétnych súkromných záloh, reálne vykonanie novej údržby, čas jej produkčného behu a zavedená prax obnovy. V tomto read-only zadaní sa testy novej politiky nespúšťali, pretože implementácia ešte neexistuje. Zdrojový kód aplikácie sa nemenil.
