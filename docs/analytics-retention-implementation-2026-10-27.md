# Implementácia uchovávania samostatnej analytiky

## Plán pred implementáciou – 27. 10. 2026

Vlastník určil lehotu **12 kalendárnych mesiacov**. Rozsah je iba vlastná tabuľka `analytics_events` a lokálne `analyticsEvents`, nie pôvod dopytu, reklamné outboxy, obchodné ani účtovné záznamy. Vychádzame z read-only mapy `analytics-retention-readiness-2026-10-27.md` a miestnych pravidiel AGENTS.md; pre nový endpoint bol prečítaný miestny Next.js sprievodca Route Handlers.

1. Pridať jednu čistú UTC politiku: odpočítať 12 kalendárnych mesiacov s orezaním priestupného dňa, odstrániť len časy `< cutoff`. Neplatný riadiaci čas odmietnuť pred mutáciou; poškodený lokálny čas zachovať a vykázať.
2. Pridať cielený dávkový purge. PostgreSQL maže iba expirované ID z analytickej tabuľky. Lokálny writer filtruje až zlúčené udalosti pod existujúcim súborovým zámkom a vlastní monotónny retenčný watermark. Rozpoznanie už držaného zámku zabráni vnorenému deadlocku; obyčajné staré snapshoty watermark neznížia.
3. Zabrániť obnove starých udalostí vo všeobecnom analytickom zápise aj v recovery kandidátoch/počtoch. Analytické čítačky používajú aktuálny cutoff aj pred najbližším fyzickým denným čistením.
4. Pridať samostatný denný autentifikovaný GET cron. Overiť secret aj cieľ nasadenia pred DB; zachovať preview ochrany a nespojiť tok s odosielaním oznámení. Jeden beh má konečný limit dávok; neúplný beh/chyba vráti 503.
5. Budúce obchodné zálohy vynechajú samostatnú surovú analytiku. Ostatné tabuľky/polia ostanú. Existujúce zálohy sa hromadne nemažú; aplikačný restore celej zálohy sa v zdrojoch nenašiel. Pri manuálnej obnove musí byť analytika vynechaná alebo vyčistená pred sprístupnením systému.
6. Izolovane preveriť kalendárne hranice, lokálny stale/súbežný zápis, recovery, PostgreSQL dávky, nedotknuté obchodné/reklamné záznamy, backup a cron autorizáciu/preview. Nespúšťať produkčné operácie, odosielanie, commit ani deploy.

## Akceptačné hranice

Zdrojová implementácia a izolované PASS testy nepotvrdzujú produkčné vykonanie. Denné fyzické čistenie môže meškať do najbližšieho úspešného behu; aktuálny cutoff sa uplatní pri čítaní aj recovery. Historické súkromné zálohy môžu obsahovať staršiu analytiku a musia byť samostatne posúdené v bežnom cykle obnovy/uchovávania. Ich obsah sa v tejto úlohe nečíta ani nemení.

## Implementovaný rozsah

- `src/server/analytics-retention-policy.ts`: spoločný UTC cutoff, vrátane `2028-02-29 → 2027-02-28`, striktnej hranice a bezpečného zaobchádzania s neplatným časom.
- `src/server/db.ts`: `purgeExpiredAnalyticsEvents` maže iba `analytics_events`, predvolene 5 000 záznamov na dávku, najviac 10 000 pri internom volaní. `runAnalyticsRetention` spracuje najviac osem predvolených dávok a medzi dávkami sleduje 40-sekundový monotónny časový rozpočet. Zostávajúci backlog neoznačí ako dokončený.
- PostgreSQL purge používa výhradne vlastný krátkožijúci `pg.Client`, **nie acquisition obchodného poolu ani všeobecný `ensureSchema`**. Chýbajúca tabuľka bezpečne skončí chybou/503. Pripojenie má limit 5 s, query transport najviac 6 s a celá dávka rozpočet 10 s. Transakcia má `SET LOCAL statement_timeout = '5s'` a `lock_timeout = '1s'`; iba táto transakcia zahŕňa DELETE, overenie zvyšku a COMMIT. Pri chybe nasleduje najviac 1 s rollback a najviac 1 s na ukončenie transportu s núteným destroy. Žiadny globálny obchodný timeout sa nemenil. Posledná dávka plus cleanup majú ohraničený dobeh po kontrole 40-sekundového rozpočtu. Pri nejednoznačnej chybe odpovede na COMMIT môže byť mazanie už dokončené; opakovanie je bezpečné a endpoint v takom prípade nevracia falošné potvrdenie úspechu.
- Retenčný klient zachytáva aj idle `error` medzi query. Zapamätá si prvú chybu bez surového logovania, pred a po každej query ju overí, nasledujúci SELECT/COMMIT nepovolí a listener zostáva aktívny aj počas end/destroy. Pri chybe transportu sa spojenie zatvorí a neukončená serverová transakcia sa vráti späť.
- Lokálna údržba pracuje s celým lokálnym poľom, ktoré je už načítané v pamäti; poškodené dátumy zachová a vráti ich počet. Monotónny `analyticsRetentionCutoff` vlastní writer, obyčajný snapshot ho nemôže meniť. Filter sa aplikuje až po deduplikovanom merge.
- Všetky lokálne write operácie teraz používajú ten istý existujúci súborový mutation-lock. Dôvod: predchádzajúca procesná write-fronta nechránila watermark pred zapisovačom v druhom procese, ktorý mal ešte starý snapshot. `AsyncLocalStorage` rozpozná už držaný zámok a po jeho opustení token zneplatní; ostatné pravidlá merge obchodných kolekcií sa neprepisovali. PostgreSQL obchodné transakcie sa nemenili.
- `recordAnalyticsEvent`, `recordAcceptedLeadAnalytics` a výber aj počítanie kandidátov `recoverAcceptedLeadAnalytics` nepovoľujú analytické doplnenie expirovaného dopytu. Zdrojový dopyt zostáva. Analytické čítačky vrátane `allTime` používajú aktuálny cutoff; `allTime` preto znamená dostupné uchovávané obdobie, nie históriu od začiatku firmy.
- `app/api/cron/analytics-retention/route.ts`: presný Bearer secret overený pred DB, porovnanie v konštantnom čase, zachovaný produkčný deployment gate. Priame preview volanie je odmietnuté aj bez proxy. Výnimka iba pre explicitný `NODE_ENV=test` bez Vercelu umožňuje izolované lokálne testy. Výsledok s backlogom alebo poškodenými dátumami má 503, úplný výsledok 200. Chyba neodhaľuje udalosti ani text DB chyby.
- `vercel.json`: nová samostatná cesta `/api/cron/analytics-retention/`, denne o **05:30 UTC**. Existujúce crony zostali zachované. `preview-safety.ts`, meracie súhlasy, klientské meranie a notifikačný cron sa nemenili.
- `exportDatabaseBackup`: budúci PostgreSQL export úplne vynecháva `analytics_events`, lokálny `analyticsEvents`. Výstup to deklaruje v `excludedTables`. Ostatné obchodné, finančné, auditné a reklamné dáta sa exportujú ako predtým. Analytický watermark neobsahuje surové udalosti a môže zostať v lokálnom obchodnom exporte.

## Izolované dôkazy

Výsledky sa týkajú lokálnych zdrojov, fiktívnych údajov, dočasných súborov a jednorazovej PGlite databázy. **Nejde o dôkaz produkčného behu.**

1. `node --import tsx --test --test-concurrency=1 scripts/analytics-retention-policy.test.mjs scripts/analytics-retention.local.integration.mjs scripts/analytics-retention-route.test.mjs scripts/local-admin-state-ownership.test.mjs scripts/site-content-local-concurrency.test.ts scripts/lead-email-safety.local.integration.mjs scripts/price-offer-local-state.integration.mjs scripts/price-offer-parent-state.local.integration.mjs scripts/business-billing.local.integration.mjs scripts/business-job-completion.local.integration.mjs scripts/review-request-workflow.local.integration.mjs` – **20/20 PASS**, 14,7 s.
   - Kalendárna hranica, priestupný deň, UTC/DST, neplatný riadiaci čas a neplatné uložené dátumy.
   - Staré/nové/hraničné analytické udalosti, staré accepted-lead udalosti a staré neplatné sessions bez falošného recovery backlogu.
   - Skutočný oneskorený obchodný snapshot počas cleanupu v **druhom procese**, následný súbežný nový analytický event a ďalšia údržba. Staré udalosti sa nevrátili a watermark neklesol.
   - Auth, preview odmietnutie pred vytvorením lokálneho súboru, úspešný cron, 503 pre poškodené dáta a chybu bez úniku súkromných údajov.
   - Existujúce admin-state ownership a CMS concurrency, prijatie dopytu/bezpečný email-state, CP a jej rodičovské stavy, finančná história, dokončenie zákazky a review workflow bez deadlocku.
2. `node --import tsx --test --test-concurrency=1 scripts/analytics-consent-contract.test.mjs scripts/analytics-retention.local.integration.mjs scripts/runtime-worker-scheduling-policy.test.mjs scripts/public-analytics-route.test.mjs scripts/analytics-metrics.behavior.mjs scripts/lead-attribution.behavior.mjs scripts/lead-attribution-report.behavior.mjs scripts/marketing-consent.behavior.mjs scripts/preview-isolation.test.ts` – **53/53 PASS**, 11,7 s. Zahŕňa znovu lokálnu retenčnú sadu; počty sa nesčítavajú ako jedinečné testy. Zastaralý zdrojový kontrakt procesnej write-fronty bol zmenený na aktuálny zdieľaný lock; jeho reálne správanie overujú integračné testy.
3. `node --import tsx scripts/analytics-retention.pglite.integration.mjs` – **PASS**, opakovane na finálnom serverovom zdroji. Reálny SQL purge v dávkach, presná hranica, pre-cleanup reportový filter, recovery práve raz, budúca záloha bez analytiky a rovnosť **všetkých** ostatných tabuliek pred/po. Nenulové fixture dopytov/pôvodu, CP, zákazky, faktúry, úhrady, auditov, Meta outboxov aj súhlasov ostali nezmenené. Záťažová fixture 40 001 starých udalostí overila 503 po ôsmich dávkach (40 000 zmazaných), ďalší beh dokončil zvyšok s 200.
4. `node --import tsx scripts/meta-capi-consent-race.local.integration.mjs` – **PASS**, lokálne odvolanie súhlasu a create/revoke race, bez siete a produkcie.
5. TypeScript `--noEmit --incremental false` a cielený `git diff --check` – **PASS**. Produkčný build/verejný vizuálny audit vykonáva samostatne koordinátor nad zmrazeným kandidátom.
6. `node --import tsx scripts/analytics-retention-timeout.postgres.integration.mjs` – **PASS** na skutočnom jednorazovom PostgreSQL 17, vrátane finálnej listener úpravy. Použité boli iba už existujúce binárky, nový privátny cluster s fiktívnymi údajmi a loopback socket; bez služby, inštalácie či produkčnej väzby. Dôkazy:
   - Studený purge s chýbajúcou schémou bezpečne odmietne operáciu bez vytvorenia akýchkoľvek aplikačných tabuliek; retenčný klient sa zavrie.
   - Skutočný `ACCESS EXCLUSIVE` lock spôsobí PostgreSQL `55P03` približne po 1 s, route vráti 503, nič sa nezmaže a nezostane otvorený retenčný klient.
   - Skutočný pomalý DELETE trigger spôsobí `57014` približne po 5 s, DELETE sa rollbackne a transakcia/klient nezostanú otvorené.
   - Injektovaný idle error po vykonaní DELETE zastaví nasledujúci SELECT aj COMMIT; uzavretie spojenia rollbackne zmenu. Ďalší error pri end je stále zachytený bez procesu s unhandled error.
   - Obsadenie jediného klienta business poolu neblokuje vlastné retenčné spojenie; po uvoľnení SQL prekážok purge úspešne dokončí prácu.
   - Samostatný TCP server, ktorý prijme spojenie, ale neodpovie na PostgreSQL startup, vedie po približne 5 s ku kontrolovanej 503 a socket sa zavrie. Žiadny neohraničený Pool.connect sa nepoužíva.
   - Nenulová nesúvisiaca business fixture zostala rovnaká; dočasný PostgreSQL bol zastavený a jeho vlastný adresár odstránený.

Samotný PGlite vykonáva `pg_sleep`, ale jeho WASM runtime v tomto prostredí nevynucoval `statement_timeout`. Preto sa na tvrdenie o SQL časovom limite nepoužil; vyššie uvedený dôkaz pochádza zo skutočného PostgreSQL 17. Prvá nezávislá kontrola správne vrátila predchádzajúci medzi-kandidát kvôli neohraničeným PG príkazom/acquisition a chýbajúcemu idle error listeneru; tieto konkrétne defekty boli opravené úzko v retenčnom toku a overené vyššie.

Po poslednej listener úprave prebehli znovu plný PGlite retenčný scenár (**PASS**, 5,6 s) a sada `analytics-retention-policy`, `analytics-retention.local`, `analytics-retention-route`, `analytics-consent-contract`, `runtime-worker-scheduling-policy` (**19/19 PASS**, 3,5 s). Tým sa potvrdil finálny zmrazený retenčný zdroj; koordinátor samostatne preveruje finálny produkčný build a nezávislé prijatie.

Následný produkčný medzi-build odhalil dieru nainštalovaných `@types/pg`: runtime prijíma per-query `query_timeout`, ale `QueryConfig` ho nedeklaruje. Oprava je výhradne lokálny `RetentionQueryConfig = QueryConfig<unknown[]> & { query_timeout: number }` a explicitné typovanie výsledku/rollback konfigurácie; nemení funkčné pravidlá. Po tejto poslednej úprave prebehla **čerstvá** celoprojektová kontrola `node node_modules/typescript/bin/tsc --noEmit --incremental false` s **exit 0 / PASS**. Typovanie celého modulu sa neobchádza; `client.connection.stream` je v nainštalovaných typoch riadne deklarovaný `Duplex`.

Prvé pokusy o širšiu lokálnu sadu narazili na Windows sandbox `EPERM` pri atómovom rename v systémovom temp a na 30-sekundové timeouty testových podprocesov. Čistý sériový beh s prístupom iba k vlastným testovým súborom prešiel celý bez zmeny aplikačného zdroja kvôli týmto chybám. PGlite prvýkrát potreboval povoliť iba loopback spojenie (`EACCES 127.0.0.1`); produkčné spojenie sa nepoužilo.

## Historické zálohy a obnova – otvorená prevádzková hranica

Existujúce súkromné zálohy sa nečítali ani nemenili. Môžu obsahovať analytiku staršiu než aktívne obdobie; ich historické odstránenie nie je týmto dokázané. Týždenný backup si naďalej ponecháva najnovších 12 obchodných súborov. Nevzniklo hromadné mazanie účtovných či firemných záloh.

V aplikácii neexistuje automatický import/restore celej zálohy, preto **neexistuje ani automatická restore brána, ktorú by táto úprava vedela garantovať**. Pri manuálnej obnove starej zálohy musí správca vynechať `analytics_events`/`analyticsEvents`, alebo pred sprístupnením systému spustiť aktuálne čistenie až do `remaining: false`. Toto je povinný prevádzkový postup, nie automaticky vynútená záruka. Obnovené staré udalosti sú už z reportov a recovery vylúčené aktuálnym cutoff, ale fyzicky ostanú do čistenia. Verejná informácia nesmie tieto dva stavy zamieňať.

## Stav odovzdania

**Overené:** zdrojová implementácia, izolované behavior/integration dôkazy, ochrana preview/auth, zachovanie obchodných a reklamných záznamov, vylúčenie surovej analytiky z nových exportov.

**Neoverené / mimo zásahu:** objem produkčných udalostí, skutočné CRON_SECRET alebo produkčné env, prvý reálny cleanup, reálne vykonanie dennej údržby a obsah existujúcich súkromných záloh. Žiadna produkčná operácia, migrácia, odoslanie, commit, push ani deploy sa nevykonali. Pred produkčným tvrdením o aktívnej politike treba riadne nasadenie a overenie prevádzkového behu; koordinátor o tom rozhoduje osobitne.
