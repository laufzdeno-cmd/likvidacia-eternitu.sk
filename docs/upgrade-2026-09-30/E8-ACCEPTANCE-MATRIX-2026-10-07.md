# E8 — aktuálna akceptačná matica 9. 10. 2026

## Najnovší lokálny checkpoint

Otestovaný zdrojový kandidát je commit `31157118` a obsahuje aj prevádzkový checkpoint O06 `49609256`. Presný čistý kandidát prešiel **436/436 MJS + 35/35 TypeScript PASS**, typovou kontrolou a úplným izolovaným produkčným buildom **100/100** trás, SEO **33 statických URL**, dynamickými realizáciami/recenziami a route CSS/JS izoláciou; BUILD_ID `fc0sTa8dV7FOC8i_pwIAO`, `productionAccess:false` a jednorazová DB aj vlastné dočasné dáta boli odstránené. Rovnaký zdroj prešiel aj 13/13 databázovými integráciami vrátane PostgreSQL prevádzkových alarmov O06 a výkonnostnou maticou 15/15 Lighthouse behov, ktoré sú spolu s unit, typecheck a build logom kanonicky hashované v jednom manifeste. Dôkazový parser odmieta chyby, preskočené alebo nedokončené testy, nezhodný BUILD_ID, nesprávne URL, sfalšované mediány, chýbajúci O06 marker aj chýbajúci cleanup; nezávislý kontrolór parsera vydal PASS. Bootstrap stagingovej databázy má transakčný advisory lock, idempotentný marker, odmietnutie konfliktu, rollback a striktne overené TLS. Plná verejná vizuálna akceptácia bola spustená na čistom dôkazovom commite `088ac8f3` a admin health rozšírenie prešlo na `c7c2059e` v 234/234 stavoch. Produkcia je **NOT VERIFIED** a deploy, alias, formulár, email, Blob aj reklamný účet zostali bez zmeny. Dôkazový manifest, úplné kanonicky hashované logy a [lokálny release checkpoint](LOCAL-RELEASE-CHECKPOINT-31157118.md) sú uložené pri tomto kandidátovi; nemenia jeho otestovaný strom.

Plná verejná vizuálna matica bola na čistom commite `088ac8f3` zopakovaná: 20 trás × 11 viewportov = 220/220 stavov, 25 snímok, reduced-motion, 200 % zoom, landscape, 0 odoslaných formulárov, 0 hydration chýb a 0 externých originov. Historický baseline `452c4f75` ostáva auditnou stopou, nie náhradou dnešného dôkazu. Stagingová a fyzická cross-browser matica sa musí zopakovať pred vydaním.

Lokálny testovací stav tohto rezu je **PASS**. Read-only Vercel snapshot z 8. 10. potvrdil, že aktuálny Preview zdieľa názvy produkčných DB/Blob/SMTP väzieb a nemá stagingový bezpečnostný kontrakt. Lokálny kandidát má otestované fail-closed blokovanie, no zdroj a ochrana živého Preview sú **NOT VERIFIED**; Preview preto nie je zapisovateľný Staging a nesmie sa na ňom mutačne testovať. Celkový release zostáva **WAITING** na zriadenie skutočne oddeleného Stagingu, externú Vercel IAM kontrolu, úplnú browser maticu budúceho stagingového deploymentu a výslovne schválený produkčný release/smoke vrátane dopytu bez fotky a s fotkou, oboch schránok, Chrome/Opera a fyzického mobilu. Lokálna 220-stavová matica už prešla; čakajúca brána je jej zopakovanie nad konkrétnym stagingovým deploymentom. Tieto externé brány sa nesmú nahradiť lokálnym skóre.

Táto matica nahrádza historickú maticu `E8-ACCEPTANCE-MATRIX.md` pre aktuálne rozhodovanie. Historický dokument zostáva zachovaný ako auditná stopa.

Kontrolovaný zdrojový kandidát: `31157118` na vetve `codex/astana-upgrade-rc1`. Obsahuje právny/GEO rez, bezpečný dopytový, kariérny a foto tok, cenové ponuky, PDF/email, admin, verejný vizuál, súhlasovo viazaný Meta CAPI outbox, kontrolovaný Vercel promote mechanizmus, pravdivé texty, regresné testy, výkonové úpravy, voliteľnú dopravu v cenovej ponuke, bezpečné responzívne fotografie realizácií, izolovaný Staging kontrakt, bezpečný databázový bootstrap, blokovanie mutácií mimo kanonickej produkcie alebo kryptograficky overeného Stagingu, opravu mobilného cookie panelu, prístupné zotavenie formulárov, fail-closed prehľad pripravenosti workerov a predvolene vypnuté prevádzkové alarmy O06 bez PII.

Legenda:

- **PASS local** — preukázané na aktuálnom lokálnom builde bez produkčných dát a bez externého odoslania.
- **PARTIAL** — časť kritéria je preukázaná, povinná časť ešte chýba.
- **WAITING** — vyžaduje produkčné prostredie, vlastníka, účet alebo reálnych testerov.
- **NOT TESTED** — povinná skúška ešte nebola vykonaná.

Aktuálne dôkazy:

- `npm.cmd run test:unit`: **436/436 MJS + 35/35 TypeScript PASS** na presnom zdrojovom kandidáte `31157118`; súčasťou je stagingová väzba, bezpečný bootstrap, aktuálne formulárové regresie aj O06.
- databázové integrácie rovnakého zdrojového kandidáta `31157118`: **13/13 PASS** vrátane PostgreSQL/PGlite, lokálneho úložiska, cenových ponúk, outboxu, TOTP, staging bootstrapu, Meta consent race a PostgreSQL prevádzkových alarmov. Bez produkčnej DB, SMTP alebo Blob zásahu.
- izolovaný PostgreSQL 17 + produkčný build zdrojového kandidáta `31157118`: **100/100 trás, TypeScript a obe SEO kontroly PASS**, BUILD_ID `fc0sTa8dV7FOC8i_pwIAO`; dynamické realizácie/recenzie, starý 308 redirect a route CSS/JS izolácia prešli. Produkčný prístup bol vypnutý, jednorazová databáza zastavená a vlastné dočasné dáta odstránené. Manifest s hashmi všetkých piatich úplných logov je v [LOCAL-BUILD-EVIDENCE-31157118.json](LOCAL-BUILD-EVIDENCE-31157118.json).
- presný rollback test zdrojového stromu checkpointu `5eb585ee`: **PASS a bez zmeny v checkpointe `452c4f75`** — jednorazový PostgreSQL overil plnú schému, migráciu kandidáta, aktuálny tok a skutočné funkcie produkčného commitu `c98c630c…` po návrate; dočasná DB bola zastavená a odstránená.
- kompletný browser audit čistého dôkazového commitu `088ac8f3`: **20 trás × 11 viewportov = 220 stavov, 25 snímok, 0 hydration chýb, 0 odoslaných formulárov a 0 externých browser originov**. Pokryté boli reduced-motion, 200 % zoom a landscape; dočasné snímky aj vlastný testovací root boli po behu odstránené. Starší trvalo uložený [baseline súhrn](VISUAL-EVIDENCE-SUMMARY-452c4f75.json) zostáva auditnou stopou predchádzajúceho stavu.
- dopytový browser/Blob emulátor: 1 lead, 1 zákazka, 2 súkromné prílohy, 2 autorizované a 0 anonymných stiahnutí, 2 čakajúce outbox položky, **0 odoslaných emailov**.
- aktuálny Lighthouse S08 nad zdrojovým kandidátom `31157118`, BUILD_ID `WumrPiz3b_54MDt2SYIOt`: **5 trás × 3 behy, všetkých 15 PASS**; Performance **96–98**, Accessibility **100**, SEO **100**, LCP **2 376–2 479 ms**, CLS **0**. Bežal iba na izolovanom loopback origin; `productionAccess:false`, jednorazová databáza aj testovací root boli odstránené. Výsledok a hash logu sú priamo v nemennom manifeste. [Presný checkpoint](LOCAL-RELEASE-CHECKPOINT-31157118.md).

Staršie časti `STATUS.md` zachovávajú historické behy s Accessibility 96–100. Nie sú dôkazom pre túto maticu. Aktuálny S08 dôkaz patrí zdrojovému kandidátu `31157118` a čistému buildu `WumrPiz3b_54MDt2SYIOt`; ten istý nemenný manifest identifikuje aplikačný build `fc0sTa8dV7FOC8i_pwIAO`.

## SEO — S01–S10

| ID | Stav | Dôkaz / otvorený bod |
|---|---|---|
| S01 | PARTIAL | Renderovaný lokálny crawl kontroluje 32 statických URL, obe dynamické obsahové URL, chybové stavy, odkazy a kotvy na rovnakom builde. Read-only produkčný snapshot potvrdil HTTPS a kanonický host, ale živá verzia je starší deployment: `/kde-posobime/` je 404 a `/pre-strecharov/` ešte vracia duplicitnú 200 stránku. Nový host sa potvrdí až po release. |
| S02 | PASS local | Canonical, index/noindex, 404 a súkromné trasy prešli lokálnym build/browser kontraktom. |
| S03 | PASS local | Title, description, jeden H1 a obsahové odkazy prešli renderovanou kontrolou. |
| S04 | PASS local | JSON-LD používa bezpečný serializer, jednu firemnú entitu a route-vlastnené breadcrumbs; testy prešli. |
| S05 | PASS local | Sitemap, robots a pravdivé/nevynútené `lastmod` prešli kontraktmi; produkčné odoslanie patrí S09. |
| S06 | PASS local | Služby, cena, regióny a poradňa majú odlišné routy a regionálne texty nepredstierajú pobočky ani realizácie. |
| S07 | PASS local | SSR obsah, interné odkazy a obchodné navigačné cesty prešli renderovanou a browser kontrolou; každý schválený prípad aj staršia publikovaná realizácia odkazujú na službu a celoslovenskú pôsobnosť. |
| S08 | PASS local current | Všetkých 15 Lighthouse behov aktuálneho buildu `WumrPiz3b_54MDt2SYIOt` na zdrojovom kandidáte `31157118` splnilo Performance ≥90, LCP ≤2,5 s, CLS ≤0,1, Accessibility ≥90 a SEO ≥90. Produkčné Core Web Vitals zostávajú samostatnou post-release bránou. |
| S09 | PARTIAL | [Read-only GSC baseline 7. 10. 2026](SEARCH-CONSOLE-BASELINE-2026-10-07.md) potvrdil vlastníctvo, úspešnú sitemap, indexáciu a 28-dňové/3-mesačné agregované výsledky. Chýba Bing a post-release GSC kontrola nového deploymentu. |
| S10 | PASS local | Statické realizácie používajú optimalizáciu Next Image a schválené súkromné zdroje presné 360/720/1080 px JPEG varianty s pravdivým 3:2 pomerom, limitom súbehu, byte-LRU/TTL cache a kontrolou publikácie pred cache. Stiahnutie schválenia bolo v izolovanom browser teste okamžite 404 aj pre predtým vytvorený variant. Aj obsahové fotografie na `/postup/` používajú zdieľaný responzívny WebP/JPG kontrakt; hero ostáva eager/high a nekritické fotografie lazy. Cielený kontrakt prešiel. |

**Podľa binárnej metodiky je aktuálne preukázané SEO skóre 80/100.** S01 a S09 zostávajú produkčné brány; lokálny Lighthouse SEO 100 ich nenahrádza.

## GEO — G01–G11

| ID | Stav | Dôkaz / otvorený bod |
|---|---|---|
| G01 | PASS local | Firemná identita ASTANA, s.r.o., kontakt a sídlo majú jeden typovaný zdroj; vznik 27. 4. 2011 je prepojený na verejný Register účtovných závierok a údaje sa zhodujú s emailovými a JSON-LD výstupmi. |
| G02 | PASS local | Hlavné služby odpovedajú komu, čo a kde firma poskytuje; rozsah a výnimky sú viditeľné. |
| G03 | PARTIAL | Kalkulačka a ponuka odlišujú orientačný odhad od schválenej CP; finálne obchodné predpoklady a všetky zahrnuté/vylúčené položky potrebuje potvrdiť vlastník v [internom owner checkliste](OWNER-SIGNOFF-CHECKLIST-2026-10-08.md). |
| G04 | WAITING | [Inventúra 8. 10. 2026](REALIZATION-EVIDENCE-INVENTORY-2026-10-08.md) potvrdila 179 párov JPG/WebP, ale žiadny JPG nemá EXIF GPS a statické súbory nemajú bezpečne doložené zoskupenie podľa zákazky, lokalitu ani práva. Potrebný je finálny súbor minimálne piatich vlastníkom doložených prípadov podľa [owner checklistu](OWNER-SIGNOFF-CHECKLIST-2026-10-08.md). |
| G05 | PARTIAL | [Právna faktická kontrola 7. 10. 2026](LEGAL-FACT-CHECK-2026-10-07.md) potvrdila aktuálny oznamovací režim a bezpečne datovaný historický rozsah oprávnenia; aktuálne firemné potvrdenie oprávnenia, odborný garant a vlastníkom schválený dátum vecnej revízie podľa [owner checklistu](OWNER-SIGNOFF-CHECKLIST-2026-10-08.md) ešte nie sú uzavreté. |
| G06 | PASS local current | Všetkých osem krajov má pravdivo vysvetlenú obsluhu a Poprad zostáva samostatnou lokálnou stránkou. Každá z deviatich URL má vlastný územný rozsah a tri praktické podklady pre cenovú ponuku; viditeľný text výslovne odlišuje pôsobnosť od pobočky aj potvrdenej realizácie. Trenčiansky kraj bol doplnený ako chýbajúci ôsmy kraj. Regionálne kontrakty **3/3**, celá aktuálna sada **436/436 MJS + 35/35 TypeScript**, renderovaný build a mobilná vizuálna matica prešli bez pridania fiktívnych prípadov. |
| G07 | PASS local | FAQ je konzistentné, prelinkované a neobsahuje svojpomocné rizikové návody. |
| G08 | PARTIAL | [Read-only kontrola verejných profilov](PUBLIC-PROFILE-REVIEW-2026-10-07.md) v dostupnom účte pozorovala spravovaný Google profil a verejný súhrn 5,0 z 5 pri troch viditeľných recenziách. Zobrazená kategória „Azbestové testy“ a staršia webová adresa vyžadujú manuálne preverenie podľa [owner checklistu](OWNER-SIGNOFF-CHECKLIST-2026-10-08.md); texty recenzií sa bez potvrdeného pôvodu a súhlasu nepreberajú na web ani do schémy. |
| G09 | PARTIAL | Robots a lokálny crawl sú pripravené a GSC sprístupňuje agregovaný beta report funkcií generatívnej AI; chýba aktuálny produkčný firewall/log dôkaz skutočného prístupu AI a vyhľadávacích botov. |
| G10 | PARTIAL | [Neutrálny GPT panel 8. 10. 2026](AI-GEO-PANEL-GPT-2026-10-08.md) archivuje presných 24 otázok a odpovedí; ASTANA bola pomenovaná alebo citovaná v 9/24 a zaradená do krátkeho výberu v 6/24 odpovediach. [Neutrálny panel webového vyhľadávania](AI-GEO-PANEL-SEARCH-2026-10-08.md) archivuje rovnakých 24 dopytov a top výsledky; doména ASTANA bola prítomná v 17/24 sadách, ale odporúčací dopyt iba v 1/8 krajov a objavila sa aj lokalitná nepresnosť. Anonymný Gemini skončil chybou 1096 a Perplexity blokoval Cloudflare, preto chýba úspešný druhý generatívny systém a G10 nie je PASS. |
| G11 | WAITING | Workflow schválenia, súkromia a približnej lokality je implementovaný. [Inventúra starších fotiek](REALIZATION-EVIDENCE-INVENTORY-2026-10-08.md) potvrdila, že ich pôvod ani práva nemožno odvodiť z názvu alebo GPS; každý publikovaný prípad potrebuje ľudské potvrdenie práv, pôvodu a bezpečného verejného rozsahu podľa [owner checklistu](OWNER-SIGNOFF-CHECKLIST-2026-10-08.md). |

GEO ešte **nie je na cieľových 90/100**, pretože chýbajú reálne dôkazy, účty, odborné potvrdenie a panel. Tieto body sa nesmú nahradiť generovaným obsahom.

## Funkčnosť — F01–F14

| ID | Stav | Dôkaz / otvorený bod |
|---|---|---|
| F01 | PARTIAL | Obe kalkulačky, všetky materiály, hranice a aktívne stavy prešli technickými testami; sadzby, DPH a obchodné predpoklady ešte musia byť vlastníkom výslovne potvrdené ako schválený cenový model v [owner checkliste](OWNER-SIGNOFF-CHECKLIST-2026-10-08.md). |
| F02 | PASS local | Cena → dopyt zachováva iba obec, výmeru a materiál; kontakt ani súhlas neprepisuje. |
| F03 | PASS local / production WAITING | Browser bez fotografie vytvára presne jeden trvalý lokálny lead a zákazku. Ostrý označený lead vyžaduje nové schválenie a záznam podľa [release šablóny](OWNER-SIGNOFF-CHECKLIST-2026-10-08.md). |
| F04 | PASS local / production WAITING | Dve súkromné viacmegabajtové prílohy majú správnu väzbu a autorizáciu v emulátore. Skutočný produkčný private Blob ostáva release test podľa [záznamovej šablóny](OWNER-SIGNOFF-CHECKLIST-2026-10-08.md). |
| F05 | PASS local | Typy, podpisy, limity, poškodené a nadrozmerné obrázky majú fail-closed validáciu a zrozumiteľné chyby. |
| F06 | PASS local | Dvojklik, timeout, retry, stabilné ID a konflikt zmeneného payloadu prešli bez duplicitného leadu. |
| F07 | PASS local | Prerušený upload a retry zachovávajú platné rezervácie a nepripájajú cudzie súbory. |
| F08 | WAITING | Treba jeden schválený produkčný test podľa [záznamovej šablóny](OWNER-SIGNOFF-CHECKLIST-2026-10-08.md): interný email aj zákaznícke potvrdenie v skutočných inboxoch, bez automatickej ponuky. |
| F09 | PASS local | SMTP fail/unknown/retry, auditovaná admin obnova a zákaz nebezpečného alternatívneho transportu prešli izolovanými testmi. |
| F10 | PASS local | Anonymné stiahnutie je odmietnuté; verejné API/HTML neodhaľuje súkromné súbory, GPS ani interné štítky. |
| F11 | PASS local | Predchádzajúci klient a aktuálny backend bezpečne prijmú alebo vysvetlia retry bez tichej straty fotiek. Už otvorené staršie karty môžu vynechať očakávané metadata iba ako pár; callback vždy nanovo overí skutočný typ, veľkosť a cestu súkromného Blob objektu. |
| F12 | PASS local / production WAITING | Kariéra, CV a strechársky tok majú súkromie, nové ID, rate limit a obnovu; živý storage/inbox sa overí až po release podľa [záznamovej šablóny](OWNER-SIGNOFF-CHECKLIST-2026-10-08.md). |
| F13 | PASS local | Galéria prešla filtrami, lightboxom, Escape, fokusom, scrollom a responzívnou maticou. |
| F14 | PASS local | CTA, kotvy, menu, realizácie, cookie voľby a atribúcia prešli bez odoslania formulára. |

Lokálne je technicky preukázaných **12/14 funkčných kritérií**. Podľa úplnej produkčnej definície je uzavretých **9/14**: F03, F04 a F12 ešte vyžadujú živé release overenie, F01 čaká na obchodné potvrdenie modelu a F08 je finálny produkčný inbox hardgate.

## UX — U01–U10

| ID | Stav | Dôkaz / otvorený bod |
|---|---|---|
| U01 | PASS local current | Aktuálna izolovaná matica má **21 trás × 11 viewportov = 231/231 stavov** bez horizontálneho pretečenia alebo chybového prekrytia; consent timeout/retry navyše prešiel na 320 × 568 px. |
| U02 | PASS local current | Audit ôsmich hlavných šablón potvrdil jeden významovo správny prvotný cieľ. Kariéra má v desktopovej aj mobilnej hlavičke a v hero vlastné CTA „Chcem sa prihlásiť“ na `#prihlasit-sa`; ostatné kupujúce šablóny si zachovali ponukové CTA. Cielené testy, 220-stavová matica a nezávislý produktový review prešli. Podrobnosti: [U02 audit](U02-PRIMARY-CTA-AUDIT-2026-10-08.md). |
| U03 | PASS local current | Mobilný dopyt má štyri krátke kroky, vlastná validácia otvorí správny skrytý krok a zrozumiteľne označí chybu; bez JavaScriptu zostáva natívna validácia. Kariéra počas odosielania uzamkne nemenný snapshot a strechárske skupiny ukážu chybu pri prvom opravnom prvku aj na 320 px. Cielené a browser dôkazy sú v [U03/U09 audite](U03-U09-FORM-USABILITY-AUDIT-2026-10-08.md) a aktuálnom [responzívnom preflighte](LOCAL-RESPONSIVE-INTERACTION-PREFLIGHT-2026-10-08.md); skúška s piatimi ľuďmi zostáva samostatne U10. |
| U04 | PASS local current | Dizajnový systém a route CSS sú zjednotené; aktuálna matica **21 trás/231 stavov** a [manuálny preflight 1440/390/320 px](LOCAL-RESPONSIVE-INTERACTION-PREFLIGHT-2026-10-08.md) nenašli konkrétnu P1–P3 chybu. Stagingová matica, produkčný Chrome/Opera/fyzický mobil podľa [záznamovej šablóny](OWNER-SIGNOFF-CHECKLIST-2026-10-08.md) a finálna 100 % obchodná akceptácia zostávajú samostatnou release bránou. |
| U05 | PASS local current | Aktuálna Lighthouse matica má Accessibility 100/100 na všetkých piatich trasách a browser regresie pokrývajú kontrast, fokus, reduced-motion aj 200 % zoom. Fyzická čítačka obrazovky zostáva v U09 otvorená. |
| U06 | PASS local | Menu, kotvy, galéria, Escape, fokus a klávesnicové cesty sú pokryté browser testami; aktuálny [interakčný preflight](LOCAL-RESPONSIVE-INTERACTION-PREFLIGHT-2026-10-08.md) navyše potvrdil mobilné menu, filtre, lightbox a navigáciu na realizácie. |
| U07 | PASS local current | V aktuálnej matici Sticky CTA, WhatsApp a cookie panel neprekryli kontrolované akcie. Regionálne stránky, `/postup/`, Kariéra a Realizácie skrývajú plávajúci WhatsApp na mobile; regionálna desktopová stránka ho zachováva. Snímky Trenčína pri 320/390/1440 px, consent test pri 320 × 568 px a aktuálny [responzívny preflight](LOCAL-RESPONSIVE-INTERACTION-PREFLIGHT-2026-10-08.md) prešli. |
| U08 | PASS local current | Reduced-motion, 200 % zoom a landscape boli znovu spustené v aktuálnej **231-stavovej** browser matici a prešli. |
| U09 | PARTIAL | Chyba/loading/success a upload stav majú čitateľné texty a semantické live/status kontrakty. Dopyt, kariéra, referencia, strechár aj admin žiadosť o recenziu presúvajú fokus na výsledok alebo prvý opravný prvok; opakovaný rovnaký výsledok dostane nový identifikátor pokusu. Browser test potvrdil aj dve odmietnutia rovnakého nadlimitného CV pri 0 POST a dve rovnaké chyby referencie so zachovanými údajmi. [U03/U09 audit](U03-U09-FORM-USABILITY-AUDIT-2026-10-08.md) a [lokálny Opera preflight](LOCAL-BROWSER-ACCESSIBILITY-PREFLIGHT-2026-10-07.md) prešli, ale povinný test skutočnou čítačkou obrazovky podľa [owner checklistu](OWNER-SIGNOFF-CHECKLIST-2026-10-08.md) ešte neprebehol. |
| U10 | WAITING | Vyžaduje 5 skutočných testerov; najmenej 4 musia nájsť cenu alebo odoslať kontakt do 60 sekúnd bez pomoci. Záznamová šablóna je v [owner checkliste](OWNER-SIGNOFF-CHECKLIST-2026-10-08.md). |

## Prevádzka — O01–O10

| ID | Stav | Dôkaz / otvorený bod |
|---|---|---|
| O01 | PASS local | Presný zdrojový kandidát `31157118` (tree `f957ecb0…`) prešiel izolovaným produkčným buildom: TypeScript, **100/100 trás**, SEO metadata a obsah **33/33 statických URL**, obe dynamické verejné trasy a route CSS/JS izolácia; BUILD_ID `fc0sTa8dV7FOC8i_pwIAO`, `productionAccess:false`. Jednorazová PostgreSQL databáza bola zastavená a odstránená. Nemenný manifest a päť hashovaných logov sú v [LOCAL-BUILD-EVIDENCE-31157118.json](LOCAL-BUILD-EVIDENCE-31157118.json). |
| O02 | PASS local | Presný kandidát prešiel **436/436 MJS + 35/35 TypeScript testov**, samostatnou typovou kontrolou a **13/13** databázovými integráciami. Skorší čistý vizuálny checkpoint prešiel **231/231** stavmi pri 0 formulároch a 0 externých browser originoch; stagingová a produkčná matica zostávajú samostatné brány. |
| O03 | PASS local slices | Nezávislá kontrola bootstrapu najprv našla možnosť TLS prepísania cez URL a chýbajúci reálny PostgreSQL dôkaz súbehu/rollbacku. Po explicitnom `PoolConfig`, odmietnutí rizikových parametrov a integračných scenároch vydala **PASS**. Nezávislý read-only kontrolór aktuálneho dôkazového profilu `31157118` tiež vydal **PASS**. Skoršie technické a vizuálne kontroly zostávajú auditnou stopou svojich presne uvedených rezov. Produkčná akceptácia zostáva samostatná. |
| O04 | WAITING | Read-only Vercel kontrola po reštarte potvrdila custom environment `staging` bez vetvy, domény a projektových premenných. `astana-staging-db` existuje, ale nie je pripojená; dva oddelené Private Blob stores neexistujú a marker nebol vytvorený. Čerstvý CLI zoznam s presným filtrom prostredia potvrdil **0 staging deploymentov**, preto kandidát `31157118` ani neznámy vedľajší build v stagingu nie sú. Kontrola zároveň potvrdila aktuálnu produkciu `dpl_FYaPKy6tkko75rkam3RUAbXFSdcT` ako **READY / Current**, apex doménu ako **Valid Configuration / Production** a `www` ako platné 308 presmerovanie. Deployment vznikol manuálnym `vercel deploy`, preto nemá v detaile Git SHA; zhoda so zdrojovým kandidátom je **NOT VERIFIED**. [Aktuálny snapshot](VERCEL-READONLY-SNAPSHOT-2026-10-08.md). |
| O05 | PARTIAL | Izolovaný test potvrdil bezpečnú migráciu aj návrat na funkcie commitu `c98c630c…` bez straty nových dát. Čerstvo potvrdený produkčný návratový bod je `dpl_FYaPKy6tkko75rkam3RUAbXFSdcT` s funkčným apex aliasom a `www` presmerovaním; jeho manuálny `vercel deploy` však neposkytuje Git SHA, takže úplná zdrojová proveniencia zostáva **NOT VERIFIED**. Reálne prepnutie sa vykoná iba pri odchýlke po schválenom release. |
| O06 | PARTIAL | Lokálne chránené workery vracajú nezdravý stav pri nevyriešenom `unknown`/`failed` alebo starom backlogu. Commit `49609256` doplnil trvalý súbežne bezpečný alert stav, HMAC-podpísaný agregovaný webhook bez PII, fail-closed DB výpadok, stabilné ID pri nejasnom doručení, symetrické `degraded`/`recovered` prechody, pripnuté verejné DNS/TLS spojenie a absolútny timeout. Finálny kontrolór vydal PASS; dôkaz je v [O06 delivery alerts](O06-DELIVERY-ALERTS-2026-10-09.md). Na produkcii stále chýba bezpečne nastavený externý kanál, overené plánovanie, menovaný vlastník retry, zástupca a eskalačný čas podľa [owner checklistu](OWNER-SIGNOFF-CHECKLIST-2026-10-08.md). |
| O07 | PASS local / production WAITING | Consent, deduplikácia, HMAC atribúcia a zákaz PII v analytike prešli testami. Izolovaný browser scenár potvrdil timeout, fail-closed stav, klávesnicový retry, nulový reálny POST a nulový externý origin. Produkcii však chýba `CONVERSION_EVENT_SECRET`, preto serverové konverzie ostanú fail-closed až do bezpečného doplnenia a overenia. |
| O08 | PASS local / production WAITING | Dashboard odlišuje leady, ponuky, zákazky a testy; produkčné obchodné dáta sa nemenili ani nerevidovali. |
| O09 | PASS local / production WAITING | Store príloh je Private a pripojený k projektu, ale produkčné retenčné bindingy/prepínače ani samostatný foto-intake store a jeho tajomstvá nie sú nastavené. Superadmin health ich stav zobrazuje iba ako pevné fail-closed hlášky; izolovaný admin audit prešiel **18 trás × 13 viewportov = 234/234** bez POST a externého originu. Produkčná konfigurácia, ochrana store, crony a retenčné rozhodnutia z [owner checklistu](OWNER-SIGNOFF-CHECKLIST-2026-10-08.md) sa musia overiť pred release. |
| O10 | PARTIAL | Matica, [lokálny release checkpoint](LOCAL-RELEASE-CHECKPOINT-31157118.md), buildový dôkaz, [Vercel snapshot](VERCEL-READONLY-SNAPSHOT-2026-10-08.md) a [interný owner checklist](OWNER-SIGNOFF-CHECKLIST-2026-10-08.md) uvádzajú otvorené brány bez hodnôt tajomstiev. Finálny handover vznikne až po bezpečnom Stagingu, deployi, produkčných testoch a owner sign-offe konkrétneho release. |

## Rozhodnutie

Posledný nemenný otestovaný zdrojový kandidát je `31157118`. Kandidát prešiel 436/436 MJS + 35/35 TypeScript testami, 13/13 databázovými integráciami, typovou kontrolou, 100/100 produkčným buildom a 15/15 Lighthouse behmi. Predchádzajúce consent, responzívne, CTA a formulárové dôkazy zostávajú platné iba pre svoje presne uvedené checkpointy.

Podľa uzamknutej binárnej metodiky je dnes preukázané: **S = 80/100, G = 40/100, F = 64,3/100, U = 80/100 a O = 30/100**. Vážené celkové skóre je preto **61,1/100**, nie 98 %. Skôr komunikovaných 98 % opisovalo iba rozsah lokálnej technickej implementácie a prípravy, nie formálnu projektovú akceptáciu; pre celkový stav to bolo zavádzajúce.

Projekt ešte nie je hotový ani schválený na produkciu. Blokujú ho najmä S01/S09, G03–G05/G08–G11, F01/F03/F04/F08/F12, U09–U10, pripojenie skutočne oddelených stagingových zdrojov, stagingový deployment a jeho matica, finálna kontrola Chrome/Opera a fyzického mobilu, päť reálnych používateľov, 100 % obchodná a vizuálna akceptácia a zostávajúce O04–O10. Žiadny z týchto bodov sa nesmie označiť PASS iba na základe Lighthouse skóre alebo automatického testu.
