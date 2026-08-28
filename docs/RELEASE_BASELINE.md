# ASTANA Release Baseline

## Do-not-touch production baseline

- Source SHA: `9b00e620b214cf9f1773d532de17b3ff63b676cb`
- Deployment: `dpl_HiDuaLiSYLhYqbaukhpQ6LUuXWzJ`
- Stav: overený produkčný tok `1 klik -> 1 POST -> 1 lead -> 1 zákazka -> 1 interný email -> 1 zákaznícky email`.

## Verified rollback

- Source SHA: `be825e31ee7af7636b62343e2356aff6afab8b86`
- Deployment: `dpl_GNRGXffgTDLTQTiuosa8wyWyeSfu`

## Povinný release postup

1. Každý kandidát vzniká len z čistého Git SHA, nikdy z dirty worktree.
2. Aktuálny HEAD môže byť novší než baseline, ale chránené runtime súbory musia mať voči baseline nulový diff, ak release výslovne neschvaľuje ich zmenu.
3. Pred staged deploymentom sa spúšťa `release:guard` s povinnými argumentmi `--protected-baseline <overený produkčný SHA>` a `--expected-head <release SHA>` spolu s povoleným scope releasu. Tento dokument je informácia pre ľudí, nie dôveryhodný zdroj baseline pre guard.
4. Produkcia sa prepína iba promoteom už otestovaného staged deploymentu, bez nového buildu.
5. Produkčný QA submit sa vykonáva iba s výslovným aktuálnym súhlasom; test označte `QA – NEKONTAKTOVAŤ` a následne ho archivujte v CRM.
