# Vercel read-only snapshot — 8. 10. 2026

> Tento dokument zachytáva bodový stav pred vytvorením izolovaných zdrojov. Následne bolo vytvorené prázdne vlastné prostredie `staging` a nepripojená databáza `astana-staging-db`; aktuálny stav a bezpečnostná hranica sú v [staging bootstrap dôkaze](STAGING-BOOTSTRAP-2026-10-08.md).

## Read-only opakované potvrdenie — 9. 10. 2026

- Prihlásený Vercel dashboard v Opere znovu potvrdil správny tím `laufzdeno-3815s-projects` a projekt `likvidacia-eternitu-sk`. Predchádzajúce MCP odpovede `404/403` preto neznamenali zánik projektu; konektor nemal úplný projektový pohľad.
- Zoznam prostredí zobrazuje `Production`, `Preview`, `Development` a vlastné prostredie `staging`. Riadok `staging` stále uvádza **No branch configuration** a **No custom domains**.
- Zoznam projektových premenných zobrazil iba scope Production a/alebo Preview; žiadna hodnota sa neodkryla. Presné staršie filtrované potvrdenie, že `staging` nemá projektové premenné, zostáva zdokumentované v staging bootstrap dôkaze.
- Neon integrácia zobrazuje existujúci zdroj `astana-staging-db` s tlačidlom **Connect to Project** a otvorený dialóg s nezaškrtnutým scope `staging`. To znovu potvrdzuje, že databáza ešte nie je pripojená. Tlačidlo **Connect** nebolo stlačené.
- Projektová stránka Storage nezobrazila nové stagingové pripojenie. Dva samostatné Private Blob stores požadované runbookom preto naďalej nie sú preukázané.
- Stránka deploymentov v tejto relácii načítala iba kostru rozhrania bez zoznamu. Identita aktuálneho produkčného deploymentu ani počet staging deploymentov sa týmto browser checkpointom nemenia ani nanovo nepotvrdzujú; pre tieto tvrdenia zostáva autoritatívny predchádzajúci dashboard/CLI dôkaz nižšie.
- Kontrola bola striktne iba na čítanie: bez Save, Connect, Create, Deploy, Promote, zmeny premennej, odkrytia tajomstva, formulára, e-mailu alebo zásahu do databázy či Blob.

## Rozsah a bezpečnostná hranica

Kontrola prebehla iba na čítanie. Pôvodnú inventúru cez prihlásené Vercel CLI doplnila 8. 10. 2026 čerstvá kontrola prihláseného Vercel dashboardu v Opere. Vercel MCP bol prihlásený pod iným účtom a lokálny CLI po reštarte nebol dostupný, preto sa ich chyby `404/403` nepoužili ako dôkaz o stave projektu. Nevytvoril sa deployment, nezmenil alias, premenná, databáza, Blob, cron ani oprávnenie. Hodnoty premenných sa neodkrývali, nečítali, neukladali a tento dokument neobsahuje ich časti.

## Aktuálny živý stav

- Produkčný alias `likvidacia-eternitu.sk` smeruje na deployment `dpl_FYaPKy6tkko75rkam3RUAbXFSdcT` v stave **READY / Current**, prostredie **Production**, vytvorený 4. 10. 2026 o 20:50:19 SELČ.
- Doména `www.likvidacia-eternitu.sk` má stav **Valid Configuration** a robí HTTP **308** presmerovanie na `likvidacia-eternitu.sk`. Apex aj projektová doména `likvidacia-eternitu-sk.vercel.app` majú stav **Valid Configuration / Production**.
- Vercel CLI pri tejto kontrole neposkytlo Git SHA. Predchádzajúci snapshot ho viazal na `c98c630c…`; dnešná kontrola potvrdzuje deployment a alias, nie zdrojovú zhodu.
- Čerstvá kontrola dashboardu 8. 10. 2026 znovu potvrdila deployment `dpl_FYaPKy6tkko75rkam3RUAbXFSdcT` ako **READY**, prostredie **Production**, doménu `likvidacia-eternitu.sk` a čas 4. 10. 2026 o 20:50 SELČ.
- Aktuálny otestovaný zdrojový kandidát `31157118a05f9f903963f57182b957fe4e0347e9` ani novšie evidenčné commity na vetve `codex/astana-upgrade-rc1` nie sú nasadené a produkcia zostáva **NOT VERIFIED** voči kandidátovi.

## Preview nie je staging

- Najnovší zobrazený Preview je `dpl_3N29jpHnqFQ4ML3nVVp5shyni2nn`, stav **READY**, vytvorený 5. 10. 2026 o 10:50 SELČ.
- Dashboard potvrdil iba tri existujúce prostredia: Production sleduje vetvu `main`, Preview zahŕňa všetky nepriradené vetvy a Development je dostupné cez CLI. Projekt má v pláne zahrnuté jedno vlastné prostredie bez príplatku, ale žiadne vlastné prostredie ani Staging zatiaľ nie je vytvorené.
- Preview prostredie má priradené rovnaké názvy databázových, Blob a SMTP väzieb ako Production (`DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, relay premenné).
- Chýbajú všetky vlastné stagingové väzby vyžadované aplikáciou: `STAGING_WRITE_ENABLED`, stabilná identita a marker staging DB, deklarované ID oboch samostatných Blob úložísk, produkčné kontrolné odtlačky identít zdrojov a jediný testovací príjemca.
- Preto bežný Preview nie je bezpečné zapisovateľné testovacie prostredie. Lokálny kandidát má otestované fail-closed blokovanie, ale zdrojový SHA živého Preview nebol sprístupnený a prítomnosť tejto ochrany na ňom je **NOT VERIFIED**. Na tomto Preview sa preto nesmie vykonať dopyt, upload, CRM zápis ani e-mailová akceptácia.

## Produkčné konfiguračné medzery

Čerstvý dashboard ukázal 24 jedinečných názvov projektových premenných. Bez odkrytia hodnôt bola pre Production potvrdená prítomnosť SMTP nastavení, `LEAD_TO_EMAIL`, `MAIL_FROM`, `LEAD_EMAIL_DELIVERY_MODE`, `ASTANA_RELAY_URL`, `ASTANA_RELAY_SECRET`, `CRON_SECRET`, `META_CAPI_ACCESS_TOKEN`, `META_GRAPH_API_VERSION`, `NEXT_PUBLIC_META_PIXEL_ID`, Google Ads identifikátorov, verejnej URL, admin/auth nastavení a `ALLOWED_ORIGINS`. `DATABASE_URL` a Blob väzby spravované integráciou/system environmentom sa v tomto konkrétnom zozname projektových premenných nezobrazili; ich hodnoty ani existenciu preto čerstvá browser kontrola samostatne nepotvrdzuje ani nevyvracia.

| Oblasť | Stav | Dopad |
|---|---|---|
| `CONVERSION_EVENT_SECRET` | chýba | Lead sa môže bezpečne uložiť, ale serverová konverzia ostane fail-closed a nesmie sa vykazovať ako odoslaná. |
| `GOOGLE_MAPS_API_KEY` | chýba | Doprava v cenovej ponuke zostáva ručne editovateľná; automatický návrh kilometrov nie je dostupný. |
| retenčné opt-in a binding premenné pre leady/CV | chýbajú | Automatické mazanie zostáva bezpečne vypnuté, kým sa nedoloží správny store a retenčný režim. |
| `PHOTO_INTAKE_*` a `PHOTO_UPLOAD_SESSION_SECRET` | chýbajú | Tímový príjem fotografií zostáva bezpečne vypnutý. |
| citlivé integračné väzby DB/Blob | Vercel ich zobrazuje ako typ **Config** | Pred zmenou typu alebo rotáciou treba osobitne potvrdiť spôsob správy integrácie; hodnoty sa pri tejto kontrole neotvárali. |

## IAM a ochrana projektu

- Projekt používa Node.js 24.x a má zapnutú ochranu deploymentov z cudzích Git fork vetiev.
- Git integrácia je pripojená k repozitáru `laufzdeno-cmd/likvidacia-eternitu.sk`; dashboard nezobrazil žiadny Deploy Hook. Produkčné prostredie sleduje vetvu `main`.
- Existuje automatizačný bypass, ale jeho identifikátor ani tajomstvo sa do dôkazov neukladajú.
- Dashboard ukázal vypnuté Vercel Authentication aj Password Protection. Trusted Sources povoľujú tokenom tohto projektu prístup k zodpovedajúcim prostrediam a vývojovým tokenom k Preview. Tieto nastavenia sa iba prečítali; žiadny prepínač, zdroj ani bypass sa nemenil.
- Príkaz na prehľad tímového prístupu skončil `not_authorized` s hlásením o nepodporovanom pláne. IAM preto zostáva **NOT VERIFIED**, nie PASS.

## Aktuálne produkčné cron úlohy

- Funkcia Cron Jobs je v dashboarde **Enabled**.
- `/api/cron/backup` je naplánovaný na `0 3 * * 0` (nedeľa 03:00 UTC).
- `/api/cron/lead-upload-retention` je naplánovaný na `25 2 * * *` (denne 02:25 UTC).
- `/api/cron/notifications` je naplánovaný na `0 7 * * *` (denne 07:00 UTC).
- Kontrola potvrdzuje iba registráciu a zapnutie plánovača na aktuálnej produkcii. Nevykonala ručné spustenie a nepotvrdzuje úspešnosť posledných behov ani funkčnosť nových lokálnych workerov po budúcom deploymente.

## Release rozhodnutie

1. Aktuálna produkcia sa nemení.
2. Najnovší Preview sa nesmie použiť na mutačné testy ani označiť za Staging.
3. Pred nasadením treba vytvoriť vlastné Vercel prostredie **Staging** s oddelenou DB, hlavným Private Blob, samostatným Private Blob pre tímové fotografie a jediným testovacím e-mailovým príjemcom.
4. Až po kryptografickom overení všetkých stagingových väzieb sa zopakujú testy dopytu bez fotografie a s fotografiou, inboxov, adminu, cronov a browser matice.
5. Produkčný deployment a ostrý formulárový smoke vyžadujú samostatný čerstvý súhlas používateľa.

## Čerstvý browser checkpoint 8. 10. 2026

- **Potvrdené:** projekt `likvidacia-eternitu-sk`, Production `dpl_FYaPKy6tkko75rkam3RUAbXFSdcT` **READY / Current** s apex aliasom, `www` 308 presmerovaním a platnou projektovou doménou, nastavenie projektu sledovať pre Production vetvu `main`, najnovší Preview `dpl_3N29jpHnqFQ4ML3nVVp5shyni2nn` READY, vyššie uvedené názvy/scopy projektových premenných a zapnutie troch aktuálnych cron úloh. Detail aktuálneho deploymentu označuje Source ako manuálne `vercel deploy`; neposkytuje Git SHA ani vetvu, preto zdrojová zhoda zostáva nepreukázaná.
- **Neoverené:** hodnoty tajomstiev, zhodnosť nasadeného zdroja s lokálnym checkpointom, izolované staging väzby, funkčnosť nových cron/retention workerov v produkcii a produkčné doručenie formulára kandidáta.
- **Bez zmeny externého stavu:** žiadny klik na pridanie/upravenie premennej, redeploy, promote, alias, integráciu ani formulár.

Tento snapshot uzatvára iba čítaciu inventúru. Nevytvára staging, nemení Vercel a nie je produkčnou akceptáciou.

## Nadväzujúci checkpoint po vytvorení prázdneho stagingu

Neskoršia read-only kontrola Vercel dashboardu po reštarte potvrdila stav opísaný v [STAGING-BOOTSTRAP-2026-10-08.md](STAGING-BOOTSTRAP-2026-10-08.md): vlastné prostredie `staging` už existuje, ale nemá vetvu, doménu ani projektové environment variables. Automatické Vercel System Environment Variables sú zapnuté a poskytujú identitu targetu/projektu pre fail-closed guard. `astana-staging-db` je dostupná na pripojenie, nie pripojená. Súhrnný Storage zoznam označuje produkčné `astana-crm-db` a `astana-lead-files-prod` ako **All Environments**, no detail oboch spojení uvádza presne **Production, Preview, Development** a custom `staging` v nich nie je. Dva požadované stagingové Private Blob stores stále nie sú vytvorené ani pripojené. Toto pozorovanie nemení historický obsah pôvodného snapshotu vyššie; aktualizuje iba dnešný rozhodovací stav.

Najnovší lokálny release kandidát je zdrojový commit `31157118a05f9f903963f57182b957fe4e0347e9` (tree `f957ecb0edeb43fe927714e0440d7d6d990c8204`). Nie je nasadený; produkčná zhodnosť a ostrá akceptácia zostávajú **NOT VERIFIED**.

## Čerstvý CLI checkpoint po uzavretí kandidáta

- Prihlásené Vercel CLI `63.1.0` znovu rozpoznalo správny projekt `likvidacia-eternitu-sk` a tím. Kontrola bola iba na čítanie; nepoužil sa deploy, promote, alias, zápis premennej ani pripojenie zdroja.
- Príkaz na zoznam deploymentov s presným filtrom custom prostredia `staging` vrátil **0 deploymentov**. Kandidát `31157118…` teda nie je v stagingu a neexistuje ani neznámy stagingový deployment, ktorý by sa dal bezpečne prevziať ako kandidát.
- Custom prostredie `staging` naďalej nemá projektové environment variables. Projektová integrácia zobrazuje pripojenú produkčnú databázu, ale nie samostatnú stagingovú väzbu; tento projektový zoznam sám osebe nedokazuje scope a nenahrádza kontrolu detailu spojenia.
- Inventár Blob úložísk nepotvrdil dve samostatné Private Blob úložiská vyhradené pre hlavné stagingové prílohy a tímový photo-intake. Žiadne identifikátory, tokeny ani hodnoty tajomstiev sa do dôkazu nezapisujú.

## Lokálna validácia snapshotu

- Nový kontrakt kontroluje oddelenie pojmov Production, Preview a Staging, presné deployment ID, otvorené konfiguračné medzery, URL s vloženými prihlasovacími údajmi a priame priradenie známych citlivých premenných. Nie je všeobecným skenerom všetkých možných tajomstiev; celý štvor-súborový diff bol preto navyše skontrolovaný read-only kontrolórom, ktorý v ňom žiadne tajomstvo nenašiel.
- Najnovší nemenný zdrojový kandidát `31157118…` prešiel **436/436 MJS + 35/35 TypeScript testov**, samostatnou typovou kontrolou, **13/13 databázovými integráciami** vrátane PostgreSQL O06 alarmov a izolovaným produkčným buildom **100/100 trás**; SEO metadata a obsah prešli na **33/33 statických URL**. Päť verejných trás absolvovalo tri Lighthouse behy, spolu **15/15 PASS**, pri `productionAccess: false`. Skoršia admin vizuálna matica prešla **234/234** kombinácií bez formulárov a bez externých originov. Tieto výsledky sú lokálne dôkazy, nie stagingová ani produkčná akceptácia.
- Nezávislý kontrolór najprv vrátil dve vady dôkazovej presnosti: neprípustné prisúdenie lokálnej ochrany živému Preview a nadhodnotený opis skenera tajomstiev. Opravný commit `6fe9087e` obe tvrdenia zúžil; opakovaný read-only review vydal **PASS bez zostávajúceho P1–P3 nálezu**.
