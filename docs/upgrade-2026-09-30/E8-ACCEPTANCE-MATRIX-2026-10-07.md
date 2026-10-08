# E8 — aktuálna akceptačná matica 8. 10. 2026

## Najnovší lokálny checkpoint

Aktuálny aplikačný checkpoint je commit `c18f6f54`; aplikačný kód je commit `35867597`. Presný aktuálny checkpoint prešiel **393/393 MJS + 34/34 TypeScript PASS** a úplným izolovaným produkčným buildom **99/99** trás, SEO **32 statických URL**, dynamickými realizáciami/recenziami a route CSS/JS izoláciou; BUILD_ID `bVLQq_0VJpnqv3VPx66dc`, `productionAccess:false` a jednorazová DB aj vlastné dočasné dáta boli odstránené. Consent QA checkpoint je `439f75dc`, plná vizuálna akceptácia bola spustená na čistom dôkazovom commite `088ac8f3` a aktuálna výkonnostná matica na čistom commite `c882d5eb`. Najnovší formulárový rez navyše prešiel 8/8 cielenými kontraktmi a izolovanými browser tokmi dopytu, kariéry, strechárov a referencie vrátane opakovaných rovnakých chýb; produktový kontrolór po oprave vrátil PASS. Produkcia je **NOT VERIFIED** a deploy, alias, formulár, email, Blob aj reklamný účet zostali bez zmeny.

Plná verejná vizuálna matica bola na čistom commite `088ac8f3` zopakovaná: 20 trás × 11 viewportov = 220/220 stavov, 25 snímok, reduced-motion, 200 % zoom, landscape, 0 odoslaných formulárov, 0 hydration chýb a 0 externých originov. Historický baseline `452c4f75` ostáva auditnou stopou, nie náhradou dnešného dôkazu. Stagingová a fyzická cross-browser matica sa musí zopakovať pred vydaním.

Lokálny testovací stav tohto rezu je **PASS**. Read-only Vercel snapshot z 8. 10. potvrdil, že aktuálny Preview zdieľa názvy produkčných DB/Blob/SMTP väzieb a nemá stagingový bezpečnostný kontrakt. Lokálny kandidát má otestované fail-closed blokovanie, no zdroj a ochrana živého Preview sú **NOT VERIFIED**; Preview preto nie je zapisovateľný Staging a nesmie sa na ňom mutačne testovať. Celkový release zostáva **WAITING** na zriadenie skutočne oddeleného Stagingu, externú Vercel IAM kontrolu, úplnú browser maticu budúceho stagingového deploymentu a výslovne schválený produkčný release/smoke vrátane dopytu bez fotky a s fotkou, oboch schránok, Chrome/Opera a fyzického mobilu. Lokálna 220-stavová matica už prešla; čakajúca brána je jej zopakovanie nad konkrétnym stagingovým deploymentom. Tieto externé brány sa nesmú nahradiť lokálnym skóre.

Táto matica nahrádza historickú maticu `E8-ACCEPTANCE-MATRIX.md` pre aktuálne rozhodovanie. Historický dokument zostáva zachovaný ako auditná stopa.

Kontrolovaný buildový checkpoint: `c18f6f54`; aplikačný kód: `35867597`; kontrolovaný QA checkpoint: `439f75dc`, všetky na vetve `codex/astana-upgrade-rc1`. Obsahujú právny/GEO rez, bezpečný dopytový, kariérny a foto tok, cenové ponuky, PDF/email, admin, verejný vizuál, súhlasovo viazaný Meta CAPI outbox, kontrolovaný Vercel promote mechanizmus, pravdivé texty, regresné testy, výkonové úpravy, voliteľnú dopravu v cenovej ponuke, bezpečné responzívne fotografie realizácií, izolovaný Staging kontrakt, blokovanie mutácií mimo kanonickej produkcie alebo kryptograficky overeného Stagingu, opravu mobilného cookie panelu a prístupné zotavenie formulárov.

Legenda:

- **PASS local** — preukázané na aktuálnom lokálnom builde bez produkčných dát a bez externého odoslania.
- **PARTIAL** — časť kritéria je preukázaná, povinná časť ešte chýba.
- **WAITING** — vyžaduje produkčné prostredie, vlastníka, účet alebo reálnych testerov.
- **NOT TESTED** — povinná skúška ešte nebola vykonaná.

Aktuálne dôkazy:

- `npm.cmd run test:unit`: **393/393 MJS + 34/34 TypeScript PASS** na presnom buildovom checkpointe `c18f6f54`; 8/8 cielených fokusových kontraktov takisto PASS.
- Po pridaní read-only Vercel snapshotu a jeho release kontraktu prešla aktuálna dokumentačná vrstva **394/394 MJS + 34/34 TypeScript PASS**; aplikačný kód sa nezmenil.
- databázové integrácie kompatibilného checkpointu `4d0b6bfb`: **12/12 PASS** vrátane PostgreSQL/PGlite, lokálneho úložiska, cenových ponúk, outboxu a TOTP; novší aplikačný rez mení iba klientsky fokus formulárov a jeho testy. Bez produkčnej DB, SMTP alebo Blob zásahu.
- izolovaný PostgreSQL 17 + produkčný build checkpointu `c18f6f54`: **99/99 trás, TypeScript a obe SEO kontroly PASS**, BUILD_ID `bVLQq_0VJpnqv3VPx66dc`; dynamické realizácie/recenzie, starý 308 redirect a route CSS/JS izolácia prešli. Produkčný prístup bol vypnutý, jednorazová databáza zastavená a vlastné dočasné dáta odstránené. Dôkaz je v [LOCAL-BUILD-EVIDENCE-c18f6f54.json](LOCAL-BUILD-EVIDENCE-c18f6f54.json).
- presný rollback test zdrojového stromu checkpointu `5eb585ee`: **PASS a bez zmeny v checkpointe `452c4f75`** — jednorazový PostgreSQL overil plnú schému, migráciu kandidáta, aktuálny tok a skutočné funkcie produkčného commitu `c98c630c…` po návrate; dočasná DB bola zastavená a odstránená.
- kompletný browser audit čistého dôkazového commitu `088ac8f3`: **20 trás × 11 viewportov = 220 stavov, 25 snímok, 0 hydration chýb, 0 odoslaných formulárov a 0 externých browser originov**. Pokryté boli reduced-motion, 200 % zoom a landscape; dočasné snímky aj vlastný testovací root boli po behu odstránené. Starší trvalo uložený [baseline súhrn](VISUAL-EVIDENCE-SUMMARY-452c4f75.json) zostáva auditnou stopou predchádzajúceho stavu.
- dopytový browser/Blob emulátor: 1 lead, 1 zákazka, 2 súkromné prílohy, 2 autorizované a 0 anonymných stiahnutí, 2 čakajúce outbox položky, **0 odoslaných emailov**.
- aktuálny Lighthouse S08 nad čistým dôkazovým commitom `c882d5eb`, BUILD_ID `Wyp6vsSNT67wymqcXaMyB`: **5 trás × 3 behy, všetkých 15 PASS**; medián Performance **97–98**, Accessibility **100**, SEO **100**, LCP **2 351–2 467 ms**, CLS **0**. Bežal iba na izolovanej loopback origin; `productionAccess:false`, jednorazová databáza aj testovací root boli odstránené.

Staršie časti `STATUS.md` zachovávajú historické behy s Accessibility 96–100. Nie sú dôkazom pre túto maticu. Aktuálny S08 dôkaz patrí čistému commitu `c882d5eb` a buildu `Wyp6vsSNT67wymqcXaMyB`; aplikačný build checkpointu `d0b1730a` zostáva samostatne identifikovaný ako `JTcGAZ_fhpwrtFnTthxHg`.

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
| S08 | PASS local current | Všetkých 15 Lighthouse behov aktuálneho buildu `Wyp6vsSNT67wymqcXaMyB` na dôkazovom commite `c882d5eb` splnilo Performance ≥90, LCP ≤2,5 s, CLS ≤0,1, Accessibility ≥90 a SEO ≥90. Produkčné Core Web Vitals zostávajú samostatnou post-release bránou. |
| S09 | PARTIAL | [Read-only GSC baseline 7. 10. 2026](SEARCH-CONSOLE-BASELINE-2026-10-07.md) potvrdil vlastníctvo, úspešnú sitemap, indexáciu a 28-dňové/3-mesačné agregované výsledky. Chýba Bing a post-release GSC kontrola nového deploymentu. |
| S10 | PASS local | Statické realizácie používajú optimalizáciu Next Image a schválené súkromné zdroje presné 360/720/1080 px JPEG varianty s pravdivým 3:2 pomerom, limitom súbehu, byte-LRU/TTL cache a kontrolou publikácie pred cache. Stiahnutie schválenia bolo v izolovanom browser teste okamžite 404 aj pre predtým vytvorený variant. |

**Podľa binárnej metodiky je aktuálne preukázané SEO skóre 80/100.** S01 a S09 zostávajú produkčné brány; lokálny Lighthouse SEO 100 ich nenahrádza.

## GEO — G01–G11

| ID | Stav | Dôkaz / otvorený bod |
|---|---|---|
| G01 | PASS local | Firemná identita ASTANA, s.r.o., kontakt a sídlo majú jeden typovaný zdroj; vznik 27. 4. 2011 je prepojený na verejný Register účtovných závierok a údaje sa zhodujú s emailovými a JSON-LD výstupmi. |
| G02 | PASS local | Hlavné služby odpovedajú komu, čo a kde firma poskytuje; rozsah a výnimky sú viditeľné. |
| G03 | PARTIAL | Kalkulačka a ponuka odlišujú orientačný odhad od schválenej CP; finálne obchodné predpoklady a všetky zahrnuté/vylúčené položky potrebuje potvrdiť vlastník. |
| G04 | WAITING | Verejné realizácie nesmú byť dopočítané ani vymyslené. Potrebný je finálny súbor minimálne piatich doložených prípadov s právami k fotkám. |
| G05 | PARTIAL | [Právna faktická kontrola 7. 10. 2026](LEGAL-FACT-CHECK-2026-10-07.md) potvrdila aktuálny oznamovací režim a bezpečne datovaný historický rozsah oprávnenia; aktuálne firemné potvrdenie oprávnenia, odborný garant a vlastníkom schválený dátum vecnej revízie ešte nie sú uzavreté. |
| G06 | PARTIAL | Celoslovenská pôsobnosť a osem krajov sú vysvetlené bez predstierania pobočiek, ale regionálne stránky ešte nemajú dostatok vlastnej doloženej miestnej hodnoty; bez schválených prípadov nesmú dostať vymyslené realizácie. |
| G07 | PASS local | FAQ je konzistentné, prelinkované a neobsahuje svojpomocné rizikové návody. |
| G08 | PARTIAL | [Read-only kontrola verejných profilov](PUBLIC-PROFILE-REVIEW-2026-10-07.md) v dostupnom účte pozorovala spravovaný Google profil a verejný súhrn 5,0 z 5 pri troch viditeľných recenziách. Zobrazená kategória „Azbestové testy“ a staršia webová adresa vyžadujú manuálne preverenie; texty recenzií sa bez potvrdeného pôvodu a súhlasu nepreberajú na web ani do schémy. |
| G09 | PARTIAL | Robots a lokálny crawl sú pripravené a GSC sprístupňuje agregovaný beta report funkcií generatívnej AI; chýba aktuálny produkčný firewall/log dôkaz skutočného prístupu AI a vyhľadávacích botov. |
| G10 | NOT TESTED | Povinný neutrálny 24-otázkový panel v GPT a ďalšom vyhľadávacom systéme ešte nemá aktuálny archív odpovedí. |
| G11 | WAITING | Workflow schválenia, súkromia a približnej lokality je implementovaný; každý publikovaný prípad ešte potrebuje ľudské potvrdenie práv a pôvodu. |

GEO ešte **nie je na cieľových 90/100**, pretože chýbajú reálne dôkazy, účty, odborné potvrdenie a panel. Tieto body sa nesmú nahradiť generovaným obsahom.

## Funkčnosť — F01–F14

| ID | Stav | Dôkaz / otvorený bod |
|---|---|---|
| F01 | PARTIAL | Obe kalkulačky, všetky materiály, hranice a aktívne stavy prešli technickými testami; sadzby, DPH a obchodné predpoklady ešte musia byť vlastníkom výslovne potvrdené ako schválený cenový model. |
| F02 | PASS local | Cena → dopyt zachováva iba obec, výmeru a materiál; kontakt ani súhlas neprepisuje. |
| F03 | PASS local / production WAITING | Browser bez fotografie vytvára presne jeden trvalý lokálny lead a zákazku. Ostrý označený lead vyžaduje nové schválenie. |
| F04 | PASS local / production WAITING | Dve súkromné viacmegabajtové prílohy majú správnu väzbu a autorizáciu v emulátore. Skutočný produkčný private Blob ostáva release test. |
| F05 | PASS local | Typy, podpisy, limity, poškodené a nadrozmerné obrázky majú fail-closed validáciu a zrozumiteľné chyby. |
| F06 | PASS local | Dvojklik, timeout, retry, stabilné ID a konflikt zmeneného payloadu prešli bez duplicitného leadu. |
| F07 | PASS local | Prerušený upload a retry zachovávajú platné rezervácie a nepripájajú cudzie súbory. |
| F08 | WAITING | Treba jeden schválený produkčný test: interný email aj zákaznícke potvrdenie v skutočných inboxoch, bez automatickej ponuky. |
| F09 | PASS local | SMTP fail/unknown/retry, auditovaná admin obnova a zákaz nebezpečného alternatívneho transportu prešli izolovanými testmi. |
| F10 | PASS local | Anonymné stiahnutie je odmietnuté; verejné API/HTML neodhaľuje súkromné súbory, GPS ani interné štítky. |
| F11 | PASS local | Predchádzajúci klient a aktuálny backend bezpečne prijmú alebo vysvetlia retry bez tichej straty fotiek. Už otvorené staršie karty môžu vynechať očakávané metadata iba ako pár; callback vždy nanovo overí skutočný typ, veľkosť a cestu súkromného Blob objektu. |
| F12 | PASS local / production WAITING | Kariéra, CV a strechársky tok majú súkromie, nové ID, rate limit a obnovu; živý storage/inbox sa overí až po release. |
| F13 | PASS local | Galéria prešla filtrami, lightboxom, Escape, fokusom, scrollom a responzívnou maticou. |
| F14 | PASS local | CTA, kotvy, menu, realizácie, cookie voľby a atribúcia prešli bez odoslania formulára. |

Lokálne je technicky preukázaných **12/14 funkčných kritérií**. Podľa úplnej produkčnej definície je uzavretých **9/14**: F03, F04 a F12 ešte vyžadujú živé release overenie, F01 čaká na obchodné potvrdenie modelu a F08 je finálny produkčný inbox hardgate.

## UX — U01–U10

| ID | Stav | Dôkaz / otvorený bod |
|---|---|---|
| U01 | PASS local current | Aktuálna izolovaná matica má 220/220 viewport stavov bez horizontálneho pretečenia alebo chybového prekrytia; consent timeout/retry navyše prešiel na 320 × 568 px. |
| U02 | PASS local current | Audit ôsmich hlavných šablón potvrdil jeden významovo správny prvotný cieľ. Kariéra má v desktopovej aj mobilnej hlavičke a v hero vlastné CTA „Chcem sa prihlásiť“ na `#prihlasit-sa`; ostatné kupujúce šablóny si zachovali ponukové CTA. Cielené testy, 220-stavová matica a nezávislý produktový review prešli. Podrobnosti: [U02 audit](U02-PRIMARY-CTA-AUDIT-2026-10-08.md). |
| U03 | PASS local current | Mobilný dopyt má štyri krátke kroky, vlastná validácia otvorí správny skrytý krok a zrozumiteľne označí chybu; bez JavaScriptu zostáva natívna validácia. Kariéra počas odosielania uzamkne nemenný snapshot a strechárske skupiny ukážu chybu pri prvom opravnom prvku aj na 320 px. Cielené a browser dôkazy sú v [U03/U09 audite](U03-U09-FORM-USABILITY-AUDIT-2026-10-08.md); skúška s piatimi ľuďmi zostáva samostatne U10. |
| U04 | PASS local current | Dizajnový systém a route CSS sú zjednotené; aktuálna matica 20 trás/220 stavov a cielené kontroly novších rezov nenašli konkrétnu P1–P3 chybu. Stagingová matica, produkčný Chrome/Opera/fyzický mobil a finálna 100 % obchodná akceptácia zostávajú samostatnou release bránou. |
| U05 | PASS local current | Aktuálna Lighthouse matica má Accessibility 100/100 na všetkých piatich trasách a browser regresie pokrývajú kontrast, fokus, reduced-motion aj 200 % zoom. Fyzická čítačka obrazovky zostáva v U09 otvorená. |
| U06 | PASS local | Menu, kotvy, galéria, Escape, fokus a klávesnicové cesty sú pokryté browser testami. |
| U07 | PASS local current | V aktuálnej matici Sticky CTA, WhatsApp a cookie panel neprekryli kontrolované akcie; mobilný `/postup/` skrýva plávajúci WhatsApp, desktop ho zachováva. Consent test potvrdil bezkolízny panel na 320 × 568 px. |
| U08 | PASS local current | Reduced-motion, 200 % zoom a landscape boli znovu spustené v aktuálnej browser matici a prešli. |
| U09 | PARTIAL | Chyba/loading/success a upload stav majú čitateľné texty a semantické live/status kontrakty. Dopyt, kariéra, referencia, strechár aj admin žiadosť o recenziu presúvajú fokus na výsledok alebo prvý opravný prvok; opakovaný rovnaký výsledok dostane nový identifikátor pokusu. Browser test potvrdil aj dve odmietnutia rovnakého nadlimitného CV pri 0 POST a dve rovnaké chyby referencie so zachovanými údajmi. [U03/U09 audit](U03-U09-FORM-USABILITY-AUDIT-2026-10-08.md) a [lokálny Opera preflight](LOCAL-BROWSER-ACCESSIBILITY-PREFLIGHT-2026-10-07.md) prešli, ale povinný test skutočnou čítačkou obrazovky ešte neprebehol. |
| U10 | WAITING | Vyžaduje 5 skutočných testerov; najmenej 4 musia nájsť cenu alebo odoslať kontakt do 60 sekúnd bez pomoci. |

## Prevádzka — O01–O10

| ID | Stav | Dôkaz / otvorený bod |
|---|---|---|
| O01 | PASS local | Izolovaný produkčný build presného checkpointu `c18f6f54`, TypeScript, generovanie 99/99, obe SEO kontroly, dynamické verejné trasy, route izolácia a čistenie dočasnej PostgreSQL databázy prešli. |
| O02 | PASS local | Celá unit/kontraktná sada 393/393 MJS + 34/34 TypeScript prešla na checkpointe `35867597`; navyše prešlo 8/8 cielených fokusových kontraktov a typová kontrola. Databázové integrácie 12/12 a Meta scenáre prešli na bezprostrednom kompatibilnom checkpointe `4d0b6bfb`; najnovší rez mení iba klientsky fokus a jeho testy. |
| O03 | PASS local slices | Nezávislý produktový kontrolór prijal najnovší fokusový rez po oprave opakovanej chyby CV. Najnovší technický kontrolór bol nedostupný pre limit svojho vlákna; predchádzajúci technický PASS a bezpečnostný diff scan `b3026b4f-bc75-4813-8429-d9717b16c1f5` pokrývajú nezmenené serverové/API/DB/upload/SMTP plochy a **13/13** súborov bez nálezu. Skoršie úplné scany `c93c78ce-787d-4f57-844d-766a59044e24` a `d990c521-b0be-4715-b5c3-86acc272a126` zostávajú dohľadateľnou auditnou stopou. Produkčná akceptácia zostáva samostatná. |
| O04 | WAITING | Read-only Vercel kontrola 8. 10. znovu potvrdila produkčný deployment `dpl_FYaPKy6tkko75rkam3RUAbXFSdcT` ako READY a aktuálny alias; CLI dnes neposkytlo Git SHA. Najnovší Preview `dpl_3N29jpHnqFQ4ML3nVVp5shyni2nn` nie je oddelený Staging. Staged Production deployment checkpointu `c18f6f54` ešte neexistuje. [Aktuálny snapshot](VERCEL-READONLY-SNAPSHOT-2026-10-08.md). |
| O05 | PASS local / production WAITING | Živá rollback dvojica deployment + plný SHA je identifikovaná. Grafový merge má rovnaký strom ako skontrolovaný aplikačný parent, produkčný SHA je predkom checkpointu a presný izolovaný test potvrdil migráciu aj návrat na skutočné funkcie commitu `c98c630c…`. Reálne prepnutie deploymentu sa vykoná iba pri odchýlke po schválenom release. |
| O06 | PARTIAL | Lokálne chránené workery vracajú nezdravý stav pri nevyriešenom `unknown`/`failed` alebo starom backlogu a testy odlišujú aktuálne zlyhanie od čakajúcej eskalácie. Na produkcii stále chýba overené plánovanie, externý alert kanál, menovaný vlastník retry a eskalačný čas. |
| O07 | PASS local / production WAITING | Consent, deduplikácia, HMAC atribúcia a zákaz PII v analytike prešli testami. Izolovaný browser scenár potvrdil timeout, fail-closed stav, klávesnicový retry, nulový reálny POST a nulový externý origin. Produkcii však chýba `CONVERSION_EVENT_SECRET`, preto serverové konverzie ostanú fail-closed až do bezpečného doplnenia a overenia. |
| O08 | PASS local / production WAITING | Dashboard odlišuje leady, ponuky, zákazky a testy; produkčné obchodné dáta sa nemenili ani nerevidovali. |
| O09 | PASS local / production WAITING | Store príloh je Private a pripojený k projektu, ale produkčné retenčné bindingy/prepínače ani samostatný foto-intake store a jeho tajomstvá nie sú nastavené. Workflowy ostávajú fail-closed; produkčná konfigurácia, ochrana store a crony sa musia overiť pred release. |
| O10 | PARTIAL | Matica, buildový dôkaz a [Vercel snapshot](VERCEL-READONLY-SNAPSHOT-2026-10-08.md) uvádzajú otvorené brány bez hodnôt tajomstiev. Finálny handover vznikne až po bezpečnom Stagingu, deployi, produkčných testoch a owner sign-offe. |

## Rozhodnutie

Aktuálny buildový zdroj je uložený ako checkpoint `c18f6f54`, aplikačný kód ako `35867597`, consent QA dôkaz ako `439f75dc`, plná lokálna vizuálna matica bola zopakovaná na čistom commite `088ac8f3`, aktuálna S08 matica 5 × 3 na čistom commite `c882d5eb`, úzky U02 CTA checkpoint je `59149a47` a najnovší U03/U09 formulárový audit je viazaný na `35867597`. Projekt napriek tomu ešte nie je hotový ani schválený na produkciu. Blokujú ho najmä S01/S09, G03–G06/G08–G11, F01/F03/F04/F08/F12, U09–U10, skutočný oddelený Staging, stagingová matica, finálna kontrola Chrome/Opera a fyzického mobilu, 100 % obchodná a vizuálna akceptácia a zostávajúce O04/O06/O08–O10. Žiadny z týchto bodov sa nesmie označiť PASS iba na základe Lighthouse skóre alebo automatického testu.
