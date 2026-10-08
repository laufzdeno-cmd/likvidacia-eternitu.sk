# Release readiness — produkčný snapshot 7. 10. a lokálne uzavretie 8. 10. 2026

> Aktuálna lokálna vrstva: aplikačný checkpoint `5587258c`, QA checkpoint `439f75dc`. Izolovaný build aplikácie má BUILD_ID `MCh2KF31jp2mdDfBbZhIH`, 99/99 trás, 32 statických SEO URL, 389/389 MJS a 34/34 TypeScript testov. Úzky mobilný browser test odvolania marketingového súhlasu prešiel bez reálneho POST a bez externého originu. Bezpečnostný scan `c93c78ce-787d-4f57-844d-766a59044e24` pokryl 5/5 nových súborov s nulou nálezov. Plná 220-stavová vizuálna matica ostáva historickým baseline commitu `452c4f75`; na aktuálnom QA checkpointe nebola celá zopakovaná. Produkčný snapshot nižšie je stále bodový stav zo 7. 10. a nepreukazuje dnešný Vercel stav.

## Rozsah kontroly

Produkčná kontrola bola iba na čítanie. Lokálne sa 8. 10. uzavrela kompatibilita kandidáta a rollback topológia. Nebol vytvorený deployment, zmenený alias, upravená premenná, odoslaný formulár, otvorený zákaznícky súbor ani odhalená hodnota tajomstva.

## Živý stav

- Aktuálny produkčný deployment `dpl_FYaPKy6tkko75rkam3RUAbXFSdcT` je **Ready**, **Current**, vznikol 4. 10. 2026 a Vercel ho viaže na vetvu `codex/private-photo-upload` a Git SHA `c98c630c1af467c51c615980841630a4cabf6c29`.
- Táto dvojica deployment + plný Git SHA identifikuje skutočný živý návratový bod. Checkpoint `f4f1eb31` ho transparentne zaznamenáva ako druhého rodiča grafového merge bez zmeny aplikačného stromu; strom sa zhoduje s prvým rodičom `0efdcbb6` a produkčný SHA je jeho predkom.
- Presný izolovaný test nad plnou schémou a skutočnými DB funkciami commitu `c98c630c…` potvrdil migráciu, nový tok, dokončenie uploadu po návrate starej aplikácie, pripojenie aj retenciu. Samotný živý rollback deploymentu sa nevykonal.
- Tento historicky pozorovaný deployment neobsahuje ani vizuálny baseline `452c4f75`, ani aktuálny aplikačný checkpoint `5587258c` a jeho QA dôkaz `439f75dc`. Aktuálnosť externého Vercel stavu sa po tomto snapshote znovu neoverovala.
- Za posledných 30 minút Vercel pri tomto deploymente zobrazoval 0 warning, 0 error a 0 fatal záznamov. Krátke okno nenahrádza produkčný monitoring ani post-release smoke.
- Produkčný HTTPS a `www` používajú trvalé presmerovanie na kanonický host; kontrolované hlavné trasy vracajú 200 a neexistujúca cesta 404.

## Preukázané odchýlky starej produkcie

- Homepage stále publikuje obchodný prísľub dopravy zdarma nad určitú výmeru. Kandidát používa pravdivé pravidlo, že prípadná doprava je samostatne uvedená v cenovej ponuke.
- Homepage stále opisuje rozhodnutie RÚVZ ku konkrétnej stavbe. Kandidát vysvetľuje aktuálny oznamovací režim bez predstierania individuálneho povolenia.
- `/kde-posobime/` je v starej produkcii 404 a `/pre-strecharov/` je duplicitná indexovateľná 200 stránka; kandidát má celoslovenský hub a kanonické presmerovanie na `/strechari/`.
- Produkčná sitemap používa jeden rovnaký nedoložený `lastmod` pre všetky URL; kandidát tieto dátumy nevymýšľa.
- Produkčný robots.txt ešte nemá úplné pravidlá kandidáta pre AI botov a zákaz `/api/`.

## Vercel konfiguračný kontrakt

Overené boli iba názvy, prostredia a typ premenných, nikdy nie ich hodnoty.

- `GOOGLE_MAPS_API_KEY` chýba. Cenová ponuka ostáva bezpečne funkčná s ručne editovateľnými kilometrami, automatický výpočet trasy však nebude dostupný.
- `CONVERSION_EVENT_SECRET` chýba. Nový konverzný outbox ostane fail-closed a nesmie predstierať odoslanie Meta konverzie.
- Všetky `PHOTO_INTAKE_*` premenné aj `PHOTO_UPLOAD_SESSION_SECRET` chýbajú. Nový tímový foto-intake preto ostane bezpečne vypnutý.
- Retenčné prepínače a väzby pre prílohy, CV a tímové fotografie chýbajú. Mazanie sa nesmie zapnúť bez inventarizácie a presného projektu/DB/store bindingu.
- `DATABASE_URL` aj `BLOB_READ_WRITE_TOKEN` sú integračne vytvorené šifrované systémové premenné pripojených Vercel úložísk pre Production, Preview aj Development. Nemajú sa ručne duplikovať ani konvertovať; pred staged testom treba iba read-only potvrdiť ich väzbu na správny projekt a úložisko bez odkrytia hodnoty.
- Existujúci store `astana-lead-files-prod` je **Private**, je pripojený k projektu pre Production, Preview aj Development a obsahuje približne 77,2 MB. Jeho firewall je označený **Not Protected**; ochranu projektu treba zapnúť iba ako osobitne schválenú zmenu prístupu.
- Živý deployment má iba tri staršie cron definície (backup, notifications a lead-upload-retention), zatiaľ čo kandidát má deväť kontrolovaných cron trás. Pred povýšením musia mať všetky nové crony buď úplný fail-closed konfiguračný kontrakt, alebo sa nesmú plánovať.
- Dva novšie Ready preview deploymenty z 5. 10. 2026 stále používajú starý Git SHA `c98c630c1af467c51c615980841630a4cabf6c29`, majú `gitDirty=1` a nie sú vhodné ako release kandidát ani rollback dôkaz.

## Bezpečný ďalší krok

1. S výslovným súhlasom upraviť iba Vercel bezpečnostnú konfiguráciu a chýbajúce tajomstvá; hodnoty nevypisovať do chatu ani logov.
2. Vytvoriť vlastné Vercel prostredie **Staging** s oddelenou databázou, súkromným Blob úložiskom, bezpečným testovacím príjemcom emailov a vypnutými alebo fail-closed cronmi. Bežný Preview ani `--prod --skip-domain` sa nesmú používať na mutačné testy, pretože môžu zdediť produkčné zdroje.
   Aplikácia povolí stagingové zápisy iba pri `VERCEL_TARGET_ENV=staging`, úplnej kryptografickej väzbe projektu + staging DB + hlavného staging Blob úložiska + oddeleného photo-intake Blob úložiska + jediného testovacieho príjemcu. Databáza musí mať vlastné stabilné provider ID odlišné od produkcie a vopred vytvorenú tabuľku `astana_environment_guard` s jedným 64-znakovým náhodným markerom pre riadok `environment='staging'`; zhodný marker je uložený iba v tajnej stagingovej premennej `STAGING_DATABASE_MARKER`. Kontrola markera prebehne pred akýmkoľvek runtime DDL/DML. Databázové URL, stabilné ID databázového zdroja aj obe Blob úložiská musia mať vlastný odtlačok odlišný od produkcie. Relay a všetky cron trasy ostávajú v Stagingu zablokované. Deployment sa pred testom overí cez `npm run deploy -- --staging --candidate-deployment dpl_...`.
3. V izolovanom Staging prostredí zopakovať build/route smoke, admin prihlásenie, súkromný Blob a označený test dopytu bez fotografie aj s fotografiou do testovacích schránok.
4. Až potom vytvoriť presný staged **Production** deployment s `--skip-domain` a vykonať na ňom iba read-only kontroly. Proxy zablokuje jeho zápisy na `*.vercel.app` a bežný produkčný runtime už nespúšťa DDL/DML migrácie pri čítaní. Schéma sa pripraví osobitným schváleným krokom pred povýšením. Po nezávislom re-review a samostatnom súhlase možno povýšiť presne overený deployment na produkčný alias.
5. Ihneď po povýšení a po čerstvom výslovnom súhlase vykonať minimálny označený ostrý smoke: kanonický host, sitemap, robots, právny a dopravný text, formulár, inboxy, Chrome/Opera a fyzický mobil. Pri odchýlke použiť vopred overený rollback deployment.

Historický lokálny baseline build checkpointu `452c4f75` je viazaný na nemenný [buildový dôkaz](LOCAL-BUILD-EVIDENCE-452c4f75.json): 99/99 trás, 32 statických SEO URL, BUILD_ID `kU2ps9Dzy-l05aYdXXEIC`, `productionAccess:false` a odstránená jednorazová databáza. Jeho čistá browser matica prešla na 20 trasách a 220 viewport stavoch s nulovým pracovným diffom, bez odoslania formulára, hydration chyby alebo externého browser originu; bezpečnostný diff scan pokryl 28/28 zmenených súborov. Aktuálny aplikačný/QA dôkaz je uvedený v úvode a nepreberá automaticky celý tento baseline. Produkcia zostáva NOT VERIFIED.

## Oddelené účtové zosúladenie

[Read-only kontrola verejných profilov](PUBLIC-PROFILE-REVIEW-2026-10-07.md) zaznamenala dve oblasti odchýlok mimo webového deploymentu: Google Business Profile zobrazoval kategóriu „Azbestové testy“ a staršiu webovú adresu `astana.sk/Likvidacia-azbestu`; v zobrazených podkladoch Google Ads boli viditeľné nedoložené označenie „certifikovaný tím“ a starý prísľub bezplatnej dopravy. Kontrola nepotvrdila, či sa konkrétne reklamné texty aktívne doručovali. Kandidát webu tieto tvrdenia nepreberá. Profil ani reklamy sa nesmú meniť ako vedľajší účinok nasadenia webu; potrebujú osobitné schválenie a kontrolu stavu pred a po zmene.
