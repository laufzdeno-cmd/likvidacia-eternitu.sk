# Kompatibilná návratová verzia pracovných kariet

Táto bezpečnostná úprava nemení finančné ani dátumové pravidlá kandidáta `0913c256`. Pripravuje dva nemenné zdroje: kompatibilný fallback a následný aktívny kandidát. Migrácia sa pri návrate nevracia späť a údaje sa nemažú.

## Riadenie režimu

- `src/server/job-workspace-release-mode.ts` obsahuje jedinú verzovanú hodnotu `JOB_WORKSPACE_RELEASE_ENABLED`. V kompatibilnom fallbacku je **false**. Následný samostatný commit zmení iba túto hodnotu na **true**.
- `src/server/job-workspace-feature.ts` vyhodnocuje verzovaný režim a súkromnú serverovú premennú `ASTANA_JOB_WORKSPACE_ENABLED`. Aktívny kandidát je pri neprítomnej premennej zapnutý; hodnota `false` ho vypne. Verzované **false nemožno zapnúť ani premennou true**.
- Režim sa kontroluje na serveri. Prehliadač nedostáva autoritatívny `NEXT_PUBLIC_` prepínač. Nové stránky sú dynamické podľa prihláseného účtu; do klientského topbaru sa odovzdá iba výsledný boolean.

## Čo vypnutie blokuje

Pred novým čítaním alebo zápisom sa skryje pracovná karta, PDF import v zozname ponúk, rozšírený topbar, nové časti nastavení a doplnkové plánové údaje v kalendári. Priamy prístup na ručný PDF import a nové pracovisko Gmailu vracia 404. Nový upload a čítanie jeho súkromných dokumentov vracajú oprávnenému účtu 503; anonymné a cudzie roly najprv dostanú pôvodné 401/403.

Každá nová serverová akcia má vlastnú kontrolu režimu po autentifikácii a CSRF, vrátane uloženia karty, ručných ponúk a ich výsledku, komunikácie, úradných náhľadov/odoslania, Gmailu a nastavenia zodpovednej osoby. Samotná služba úradného odosielania kontroluje režim ešte pred pokusom o claim či SMTP. Nová Gmail služba ho kontroluje pred úložiskom a Google providerom. Starý Gmail tok označovania odoslaných ponúk týmto nie je hromadne zakázaný.

Existujúce jadrové dátové helpery zostávajú dostupné pre kanonické pravidlá a riadené migrácie; nie sú verejnými endpointmi. Bežné prijatie pôvodnej cenovej ponuky sa neblokuje a zachová bezpečné prepojenie a cenu. Vypnutie nezneprístupní fakturáciu, platby, pôvodné ponuky, zákazky, plánovač ani prihlásenie.

## Vyhľadávanie a ochrana údajov

Pôvodná stránka vyhľadávania zostáva funkčná. `searchAdminData` pri vypnutí používa obnovenú úzku vetvu z commitu `366d6493`, bez čítania nových tabuliek pracovnej karty, Gmail komunikácie alebo ručných PDF ponúk. Zachováva maximálne 20 výsledkov na skupinu a finančnú projekciu iba pre superadmina. Nové filtre sa pri tomto režime nezobrazujú.

Kanonické zámky ceny, rozlíšenie neznámej ceny, riadený skutočný deň vrátane jeho vymazania, ročné súhrny a ochrany trvalého vymazania sa nemenia. Samotné vypnutie neopravuje ani neprepisuje zákazkové údaje a neobnovuje starú databázovú schému.

## Overenie

- `node --import tsx --test scripts/job-workspace-feature.test.mjs`: **5/5 PASS**. Pravdivostná tabuľka oboch režimov, nemožnosť zapnúť nemenný fallback premennou, zákaz claimu/SMTP/Google pri vypnutí a kontrola každého nového vstupného bodu.
- `node --import tsx scripts/job-workspace-fallback.local.integration.mjs`: izolované úložisko a Next.js kópia bez `.env`. Pri verzovanom false zámerne nastaví serverovú premennú true, čím skúša nemožnosť aktivácie fallbacku; pri aktívnom zdroji skúša runtime false. Pokrýva fungujúcu pôvodnú administráciu a vyhľadávanie, blokované nové URL/API, cenu 1 230 € pri m²=0, riadený deň aj null, operátorské finančné projekcie a zachovaný zákaz zmazania fakturovanej zákazky. Výsledok aktuálneho behu doplní koordinátor do produkčných dôkazov.
- TypeScript po doplnení serverových a UI kontrol: **PASS**.

Produkčné nasadenie, vykonanie migrácie, záloha a konkrétne deployment ID sa overujú samostatne koordinátorom. Tento dokument sám nepotvrdzuje nasadenie ani pripojenie Gmailu.
