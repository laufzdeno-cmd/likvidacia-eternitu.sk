# ASTANA Release Baseline

## Aktuálny zdrojovo doložený produkčný baseline

- Source SHA: `78fee8ec9089cc32c926e251d138482edb9b84d6`
- Deployment: `dpl_BnJ32pJfz5NmzY6N3KHzA9tb1A92`
- Domény: `likvidacia-eternitu.sk` a `www.likvidacia-eternitu.sk`
- Stav: P0 Mobile Light je produkčne overený. HTML aj CSS deklarujú `only light`; verejné GEO endpointy a redirecty prešli smoke kontrolou. Crony bežia z tohto deploymentu so zachovanými cestami a harmonogramami.
- Poznámka: pri tomto release nevznikol zámerný QA lead ani email. Skorší produkčný QA tok formulára a emailov ostáva zdokumentovaný pri predchádzajúcom release gate.

## Bezprostredný operatívny rollback

- Deployment: `dpl_4boBbXeNgyp1XHYMmAxF3BqzngLL`
- Stav: predchádzajúci funkčný live deployment pred P0 promoteom.
- Source SHA: `UNKNOWN` -- deployment bol operatívne funkčný, ale jeho zdroj nebol spätne doložený. Nepovyšovať ho na zdrojový baseline ani ho nepromovať bez výslovného release rozhodnutia.

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
