# ASTANA Release Baseline

## Source-attested runtime baseline

- Source SHA: `9b00e620b214cf9f1773d532de17b3ff63b676cb`
- Deployment: `dpl_HiDuaLiSYLhYqbaukhpQ6LUuXWzJ`
- Stav: overený produkčný tok `1 klik -> 1 POST -> 1 lead -> 1 zákazka -> 1 interný email -> 1 zákaznícky email`.

## Canonical Git baseline pre ďalšiu prácu

- Source SHA: `081e6f9035f3dc87d34566a32ae7464a6867eb07`
- Obsah: `9b00e620` + P1A guardrails s nulovým runtime diffom.
- Tento SHA je referenčný základ pre ďalšie clean worktrees. Chránené runtime súbory sa pri release guard porovnávajú so source-attested runtime baseline `9b00e620`, ak release výslovne neschvaľuje ich zmenu.

## Aktuálny operational live stav

- Deployment: `dpl_4boBbXeNgyp1XHYMmAxF3BqzngLL`
- Stav: funkčný operational live deployment, ale bez doloženého Git SHA.
- Tento deployment nie je source baseline a nesmie sa automaticky legitimizovať ako zdroj budúcich releasov.

## Verified rollback

- Source SHA: `be825e31ee7af7636b62343e2356aff6afab8b86`
- Deployment: `dpl_GNRGXffgTDLTQTiuosa8wyWyeSfu`

## Povinný release postup

1. Každý kandidát vzniká len z čistého Git SHA, nikdy z dirty worktree.
2. Aktuálny HEAD môže byť novší než baseline, ale chránené runtime súbory musia mať voči baseline nulový diff, ak release výslovne neschvaľuje ich zmenu.
3. Pred staged deploymentom sa spúšťa `release:guard` s povinnými argumentmi `--protected-baseline <overený produkčný SHA>` a `--expected-head <release SHA>` spolu s povoleným scope releasu. Tento dokument je informácia pre ľudí, nie dôveryhodný zdroj baseline pre guard.
4. Automatické Git deploymenty sú vypnuté. Push do GitHubu nesmie sám vytvoriť Vercel deployment ani zmeniť produkčné domény.
5. Štandardná QA používa Preview deployment. Priamy príkaz `vercel --prod` bez `--skip-domain` je zakázaný; výnimkou je iba výslovne schválený emergency recovery.
6. Production-target staging cez `vercel --prod --skip-domain` nie je izolovaný test: môže presmerovať Vercel cron joby na nový production deployment. Pred takýmto stagingom je povinný CRON GATE so snapshotom cron hostu, ciest a schedule; zmena cesty alebo schedule bez samostatného schválenia znamená release FAIL.
7. Produkcia sa prepína iba explicitným promoteom už otestovaného deploymentu, bez nového buildu medzi QA a promote.
8. Produkčný QA submit sa vykonáva iba s výslovným aktuálnym súhlasom; test označte `QA – NEKONTAKTOVAŤ` a následne ho archivujte v CRM.
