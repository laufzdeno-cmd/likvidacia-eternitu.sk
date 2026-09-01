# ASTANA Release Baseline

## Aktuálny zdrojovo doložený produkčný baseline

- Source SHA: `691dba1b96e90d887cb3c195d00bd59d61d2e59f`
- Parent SHA: `b97d6cdba8635e37feab6a941ca701816b4cfb11`
- Deployment: `dpl_EGzMuDSrCBau6opSn5bsJ6gT4ccs`
- Domény: `likvidacia-eternitu.sk` a `www.likvidacia-eternitu.sk`
- Promote: `2026-09-01 12:41:18 UTC`
- Zdrojová attestácia: lokálny worktree bol pred uploadom čistý (`git status` bez zmien); kandidát bol vytvorený z commitnutého SHA bez dirty overlay. Vercel pri tomto CLI uploade v inspect výstupe neposkytuje samostatné pole `gitDirty`; projektový deployment list však eviduje `gitCommitSha` `691dba1b...`.
- Runtime rozsah: oproti parentu ide iba o presný `.gitignore` overlay a testovací harness; `app/`, `src/`, `vercel.json`, produkčné formulárové/API/DB/mail/tracking časti a dependencies sa nemenili.
- Stav: P0 Mobile Light je produkčne overený. HTML aj CSS deklarujú `only light`; verejné GEO endpointy a redirecty prešli smoke kontrolou. Crony bežia z tohto deploymentu so zachovanými cestami a harmonogramami.
- Aktuálne crony: `/api/cron/backup` — `0 3 * * 0`; `/api/cron/meta-capi` — `*/5 * * * *`; `/api/cron/notifications` — `0 7 * * *`.
- Poznámka: pri tomto release nevznikol zámerný QA lead ani email. P1B mail outbox zostáva zmrazený/odložený.

## Bezprostredný operatívny rollback

- Deployment: `dpl_7BruxgoQnPD4MEZDZREehAoz8GV4`
- Stav: predchádzajúci funkčný live deployment pred čistým source promoteom.
- Source SHA: `b97d6cdba8635e37feab6a941ca701816b4cfb11`
- Poznámka: pri pôvodnom uploade bol evidovaný `gitDirty=1` kvôli jedinému známemu `.gitignore` overlay. Nepovyšovať ho na aktuálny source baseline; slúži iba ako operatívny rollback.

## Historický zdrojovo doložený rollback

- Source SHA: `be825e31ee7af7636b62343e2356aff6afab8b86`
- Deployment: `dpl_GNRGXffgTDLTQTiuosa8wyWyeSfu`
- Stav: skorší overený referenčný rollback pre formulár a emailový tok.

## Povinný release postup

1. Každý kandidát vzniká len z čistého Git SHA, nikdy z dirty worktree.
2. Aktuálny HEAD môže byť novší než baseline, ale chránené runtime súbory musia mať voči baseline nulový diff, ak release výslovne neschvaľuje ich zmenu.
3. Pred releaseom sa spúšťa `release:guard` s povinnými argumentmi a povoleným scope releasu. Tento dokument je informácia pre ľudí, nie dôveryhodný zdroj baseline pre guard.
4. Produkcia sa prepína iba explicitným promoteom už otestovaného deploymentu, bez nového buildu. Priamy `vercel --prod` je zakázaný mimo výslovne schválenej emergency recovery.
5. Pred a po production-target kandidátovi sa porovná host, cesty a harmonogramy Vercel cronov. Zmena cesty alebo harmonogramu bez schválenia je release fail.
6. Produkčný QA submit sa vykonáva iba s výslovným aktuálnym súhlasom; test označte `QA – NEKONTAKTOVAŤ` a následne ho archivujte v CRM.

## Stav release guardu

Release Guard V2 je samostatná odložená práca. Táto dokumentačná aktualizácia nemení jeho implementáciu ani ho nepovažuje za aktualizovaný na nový baseline.
