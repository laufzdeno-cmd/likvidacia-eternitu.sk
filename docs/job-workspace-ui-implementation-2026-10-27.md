# Pracovná karta a plánovač – implementácia 27. 10. 2026

## Rozsah

Existujúci detail zákazky dostal jednu súkromnú pracovnú kartu. Pôvodné UUID a odkazy zostávajú zachované. Navrchu sú odkazy do prehľadu, materiálov, ponúk, úradov, plánovania, komunikácie, fotografií a superadminovho vyúčtovania. Predvolene je otvorený iba prehľad. Výber časti otvorí jej údaje a zbalí ostatné; funguje aj priamy príchod cez odkaz s fragmentom z plánovača.

- Oddelené podania OÚ ŽP / RÚVZ vrátane potrebnosti, dátumu, spôsobu, spisu, súkromného dokladu, rozhodnutia a poznámky. Samotné uloženie neposiela zákazníkovi email.
- Viac materiálových položiek s jednotkami m² / m / ks / kg. Plán a skutočnosť sú samostatné; neznáme hodnoty zostávajú `null`.
- Predbežný, dohodnutý a skutočný deň. Dôvod presunu, posádka, počet ľudí, autá, ručne potvrdená nosnosť, km z Popradu a rozlíšenie jednej cesty/cesty späť. Bez odosielania adresy externému mapovému poskytovateľovi.
- Lešenie, plošina, prístup na miesto a dohodnuté akcie. Žiadne vymyslené koeficienty hmotnosti ani nosnosti.
- Autorizovaná serverová akcia, CSRF, očakávaná revízia a bezpečné hlásenie konfliktu. Rozpracované polia pri chybe zostávajú vo formulári. Audit má autora, čas a predchádzajúcu/následnú hodnotu.
- Operátor nedostáva `settlement` ani finančné položky histórie. Výslovný finančný vstup operátora server odmietne. Úplné dokončenie zostáva v existujúcom kontrolnom sprievodcovi.
- Operátor môže upraviť evidované m² a kg bez práva zadávať cenu, odmeny a náklady. Legacy finančné polia toto uloženie zachová.
- Superadminova pracovná karta rozlišuje dohodnutú/skutočnú cenu a plánované náklady od skutočných prijatých platieb. Zaúčtované náklady vrátane odmien sú iba čítaný odvodený údaj z pôvodnej evidencie; nevzniká druhá editovateľná suma skutočných nákladov. Platby ostávajú v pôvodnom finančnom ledgeri.

Pripojené serverové sloty pre pôvodné/nové ponuky, komunikáciu, fotografie a schvaľované oznámenie dodáva hlavný implementátor. Súbory v selecte úradných dokladov sú iba dokumenty danej zákazky; úložiskový kľúč sa do prehliadača neposiela.

## Kalendár

Plánovač číta operatívne termíny hromadným dotazom bez finančných údajov. Predbežný/dohodnutý/skutočný deň z karty má odlišnú farbu a prerušovaný lem. Ak už na daný deň existuje aktívna kalendárová akcia tej istej zákazky, karta nevytvorí druhú vizuálnu položku. Viac zákaziek v jeden deň funguje cez existujúce akcie.

Rozlíšenie je zámerné: termín v karte môže byť ešte len návrh; konkrétna akcia rezervuje tím a umožní kontrolu kolízií. Materiálový súhrn vybranej zákazky je dostupný priamo pri plánovaní. Nová akcia bez známeho termínu nedostáva vymyslený dnešný dátum. Dve karty s rovnakým vozidlom alebo pracovníkom v rovnaký deň vyvolajú upozornenie; pri chýbajúcich časoch ide o možný konflikt na kontrolu, pri prekrývajúcich sa známych časoch o konkrétne prekrývanie. Dve neprekrývajúce sa akcie sú podporované. Systém nevymýšľa trasu ani čas presunu.

## Tlač a ochrana

Tlačidlo „Vytlačiť pre posádku“ aktivuje osobitný režim. Tlačí iba pracovný prehľad bez finančných sekcií, aj keď tlačí superadmin. Globálna tlač detailu zákazky zostáva samostatná. Rozpracovaný prehľad viditeľne žiada uloženie pred odovzdaním posádke.

Importovaná zákazka bez skutočného dňa nespôsobí `Invalid Date` pri príprave časovej osi. Základné formuláre nedopĺňajú neznámy deň realizácie dnešným dátumom.

## Overenie

- Relevantný lokálny Next.js návod na formuláre a React best practices boli prečítané pred implementáciou a revíziou.
- TypeScript kontrola priebežnej implementácie prešla; záverečné spoločné overenie riadi hlavný implementátor.
- `scripts/job-workspace.browser.integration.mjs`: **PASS v záverečnom rozšírenom behu**. Používa dočasnú zdrojovú kópiu bez `.env`, syntetické účty/zákazky, izolované lokálne úložisko a blokovanie externej siete. Overené: 2 revízie, m² vs metre a neznáme kg, dve vozidlá, predbežný termín v kalendári, operátorské financie, samostatná tlač posádky, nezmenený originál PDF, súkromný WebP, zákaz anonymného PDF a nulový horizontálny presah v šírkach 1440/768/390/320 px. Topbarové vyhľadávanie je dostupné v každej šírke.
- Ten istý beh overil skutočné **TEXT vyčítanie digitálneho PDF cez Next.js upload**, prenos návrhov do formulára, ručné overenie položky 30 m² × 100 €, originálnu CP `QA-IMPORT-2026-001`, zaevidovanie pôvodného odoslania, odloženie s dôvodom a neskoršie prijatie. Vznikla práve jedna nová zákazka s neznámym skutočným dňom a kanonickou cenou 3 690 €; cena sa nezamenila za výmeru × nulu. Vyhľadanie podľa pôvodného čísla a obce otvorilo správnu ponuku a pôvodné súkromné PDF.
- Syntetická Gmail správa bola ručne pripravená v izolovanom testovacom úložisku a následne schválená cez skutočné admin UI. Prešla z `PENDING` do `LINKED` a vznikol jeden súkromný komunikačný záznam. Reálny Gmail sa nepoužil, synchronizácia zostala vypnutá, ponukový stav sa párovaním správy nezmenil. Počet externých požiadaviek aj chýb prehliadača: **0**.
- Pri overení sa našla a hlavný implementátor opravil chyba PDF modulu vo Webpack runtime. Node test sám osebe túto chybu neodhalil. Záverečný beh výslovne vyžaduje `TEXT`, ručný fallback sa nepovažuje za úspešné automatické vyčítanie digitálneho PDF. Čakanie testovacieho nástroja na `Response.finished()` bolo nahradené ohraničenou kontrolou viditeľného finálneho stavu; vlastná dočasná kópia sa po behu odstránila.
- `scripts/job-workspace-planner.test.mjs`: **4/4 PASS** – normalizované označenie auta vrátane duplicitných zápisov, známe/neznáme časy, posádka, dva prípustné neprekrývajúce sa termíny a vylúčenie už realizovanej práce. Konkrétny časový konflikt má červené upozornenie, možný konflikt bez časov žlté.

Grafické podklady sú v `test-results/job-workspace-{1440,768,390,320}.png`, samostatné výrezy `-viewport.png` a `-overview.png`. Import, vyhľadanie a Gmail majú `job-manual-import-{desktop,mobile}.png`, `job-search-{desktop,mobile}.png`, `job-gmail-{desktop,mobile}.png`. Tlač posádky: `job-workspace-crew-print.pdf`. Záverečné nezávislé prijatie a spoločný produkčný build riadi hlavný implementátor.

Produkčné nasadenie ani migrácia sa týmto dokumentom neoznačujú za vykonané. Žiadny skutočný Gmail ani zákaznícky email sa pri implementácii nepoužil.
