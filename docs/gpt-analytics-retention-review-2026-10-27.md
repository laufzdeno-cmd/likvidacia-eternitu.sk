# Nezávislá kontrola uchovávania analytiky — 27. 10. 2026

Rozsah: iba retenčný patch v `src/server/db.ts`, `src/server/analytics-retention-policy.ts`, `app/api/cron/analytics-retention/route.ts`, `vercel.json` a súvisiace izolované testy/plán. Kontrola nemenila aplikačný kód, produkčné údaje, zálohy ani nasadenie.

## Verdikt

**PASS pre zdrojový retenčný patch a izolovanú akceptáciu.** Predchádzajúci defekt s neohraničenou PostgreSQL dávkou bol odstránený a nezávisle overený na skutočnom dočasnom PostgreSQL 17. Tento verdikt neznamená produkčné vykonanie ani vyčistenie historických záloh.

## Overené

- Politika počíta 12 kalendárnych mesiacov v UTC, vrátane priestupného dňa. Zmaže iba čas `< cutoff`; presná hranica zostáva. Neplatný riadiaci čas skončí pred mutáciou a poškodený lokálny dátum sa zachová na vyšetrenie.
- PostgreSQL maže parametrizovaným SQL iba z `analytics_events`. Lokálny režim filtruje až zlúčené udalosti s monotónnym watermarkom; oneskorený snapshot neobnoví staré udalosti. Dopyty, ich atribúcia, ponuky, zákazky, faktúry, platby, audit a Meta outbox/súhlasy zostali v izolovaných fixtúrach nedotknuté.
- Recovery aj bežný analytický zápis preskakujú staré udalosti; staré dopyty sa nemenia a nevytvárajú falošný backlog. Čítačky rešpektujú cutoff aj pred denným fyzickým čistením.
- Nový cron kontroluje secret a produkčný cieľ pred databázou. Preview sa odmieta. Neúplný backlog, poškodený lokálny dátum a zachytená chyba vracajú 503. Denný plán bol pridaný bez odstránenia ostatných cron položiek.
- Budúce obchodné exporty vynechávajú surové `analytics_events`/`analyticsEvents`, pričom obchodné a reklamné záznamy zostávajú súčasťou zálohy.
- Nová PostgreSQL údržba používa výhradne krátko žijúce retenčné spojenie: pripojenie 5 s, query 6 s, transakčné `statement_timeout` 5 s a `lock_timeout` 1 s, rozpočet dávky 10 s, rollback a uzavretie spojenia. Nevstupuje do bežného obchodného poolu ani nespúšťa schémové migrácie. Listener na `pg.Client` zachytí aj chybu mimo aktívnej query a ostáva prítomný počas odpájania; ďalšie SQL ani COMMIT po tejto chybe neprebehnú.
- Nezávisle spustené `node --import tsx --test scripts/analytics-retention-policy.test.mjs scripts/analytics-retention-route.test.mjs scripts/analytics-retention.local.integration.mjs`: **9/9 PASS**. Izolovaný `node --import tsx scripts/analytics-retention.pglite.integration.mjs`: **PASS**, iba slučka `127.0.0.1` s dočasnou in-memory PostgreSQL. Prvý beh v obmedzenom prostredí skončil `EACCES`; povolený lokálny beh prešiel.
- Nezávisle spustené `node --import tsx scripts/analytics-retention-timeout.postgres.integration.mjs`: **PASS** na jednorazovom PostgreSQL 17 viazanom iba na `127.0.0.1`. Skutočný `ACCESS EXCLUSIVE` lock aj pomalý trigger vrátili včas SQL timeout a ponechali dáta. Injektovaná idle/closing chyba nespôsobila neodchytený EventEmitter, COMMIT ani ďalšiu query. Obsadený obchodný pool neblokoval údržbu; TCP spojenie bez odpovede vrátilo kontrolovanú 503 po 5 s. Po teste nezostalo retenčné spojenie ani bežiaci dočasný cluster. Žiadna produkčná databáza sa nepoužila.
- Po poslednej typovej oprave som skontroloval, že rozdiel v `src/server/db.ts` je iba lokálny typ `RetentionQueryConfig = QueryConfig<unknown[]> & { query_timeout: number }`, explicitný typ výsledku `client.query` a rovnako typovaný rollback. Nainštalovaný runtime `pg` podporuje `query_timeout`, zatiaľ čo `@types/pg` ho na `QueryConfig` neuvádza. Žiadny timeout, SQL príkaz ani vetva riadenia sa nezmenili. Nezávislé `npx.cmd tsc --noEmit --incremental false`: **PASS**, exit 0.

## Opravený defekt

Pôvodný `runAnalyticsRetention` kontroloval 40-sekundový budget iba medzi dávkami a používal PostgreSQL pool bez query/connection timeoutu. Blokovaná dávka mohla prekročiť limit hostingu bez kontrolovanej 503. Úzka oprava zaviedla samostatné časovo ohraničené retenčné spojenie; skutočný PostgreSQL lock, pomalá query a TCP blackhole test vyššie potvrdili kontrolované zlyhanie. Časový limit celého behu sa stále kontroluje medzi dávkami, no každá jednotlivá PostgreSQL dávka má vlastnú hornú hranicu a posledná začína pred 40 s rozpočtom.

## Neoverené hranice

- Produkčné spustenie cronu, reálny backlog a monitorovanie opakovaných 503 neboli v tejto kontrole skúšané.
- Staršie súkromné zálohy môžu stále obsahovať analytiku. Ich obsah sa nečítal a neexistujúci automatický restore sa netestoval; pri ručnom obnovení treba analytiku vynechať alebo prefiltrovať pred sprístupnením systému.
- Denný cron môže fyzicky vyčistiť udalosti až pri ďalšom úspešnom behu. Read path už cutoff uplatňuje, no denný plán nie je dôkaz nepretržitého presného fyzického vymazania.
