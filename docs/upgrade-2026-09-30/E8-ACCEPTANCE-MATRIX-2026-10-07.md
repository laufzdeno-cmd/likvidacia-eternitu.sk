# E8 — aktuálna akceptačná matica 7. 10. 2026

## Najnovší lokálny checkpoint

Presný aplikačný checkpoint `293bf313` pridáva fail-closed izoláciu vlastného Vercel Staging prostredia, blokovanie zápisov zo staged Production hosta, bezpečné prepisovanie stagingových emailov na jediného testovacieho príjemcu, štvorstupňový mobilný dopytový formulár a odolnejšie mobilné realizácie. Prešiel: **362/362 MJS + 28/28 TypeScript PASS**, DB integrácie **8/8**, presný test migrácie a návratu na produkčný commit `c98c630c…`, TypeScript a diff kontrolu. Úplný izolovaný produkčný build: **99/99** trás, SEO **32 statických URL**, dynamické realizácie/recenzie a route izolácia PASS; BUILD_ID `D0Ikz1z3st4RBFzGf51_5`, `productionAccess:false` a jednorazová DB odstránená. Fokusovaný browser audit poslednej mobilnej opravy prešiel na 320 px bez POST požiadavky; kompletná browser matica presného checkpointu je **NOT RERUN**. Nezávislé read-only kontroly po oprave kanonického host allowlistu a zalamovania tlačidla vrátili PASS. Produkcia je **NOT VERIFIED** a deploy, alias, formulár, email, Blob aj reklamný účet zostali bez zmeny.

Lokálny technický stav tohto rezu je **PASS**. Celkový release zostáva **WAITING** na zriadenie skutočne oddeleného Stagingu, externú Vercel IAM kontrolu, stagingový kandidát, úplnú browser maticu a výslovne schválený produkčný release/smoke vrátane dopytu bez fotky a s fotkou, oboch schránok, Chrome/Opera a fyzického mobilu. Tieto externé brány sa nesmú nahradiť lokálnym skóre.

Táto matica nahrádza historickú maticu `E8-ACCEPTANCE-MATRIX.md` pre aktuálne rozhodovanie. Historický dokument zostáva zachovaný ako auditná stopa.

Kontrolovaný aplikačný a QA checkpoint: commit `293bf313` na vetve `codex/astana-upgrade-rc1`. Obsahuje právny/GEO rez, bezpečný dopytový, kariérny a foto tok, cenové ponuky, PDF/email, admin, verejný vizuál, súhlasovo viazaný Meta CAPI outbox, kontrolovaný Vercel promote mechanizmus, pravdivé texty, regresné testy, výkonové úpravy, voliteľnú dopravu v cenovej ponuke, bezpečné responzívne fotografie realizácií, izolovaný Staging kontrakt a blokovanie mutácií mimo kanonickej produkcie alebo kryptograficky overeného Stagingu. Nasledujúce dôkazové zmeny nesmú meniť tento aplikačný obsah.

Legenda:

- **PASS local** — preukázané na aktuálnom lokálnom builde bez produkčných dát a bez externého odoslania.
- **PARTIAL** — časť kritéria je preukázaná, povinná časť ešte chýba.
- **WAITING** — vyžaduje produkčné prostredie, vlastníka, účet alebo reálnych testerov.
- **NOT TESTED** — povinná skúška ešte nebola vykonaná.

Aktuálne dôkazy:

- `npm.cmd run test:unit`: **362/362 MJS + 28/28 TypeScript PASS**.
- databázové integrácie: **8/8 PASS**, vrátane PostgreSQL/PGlite, lokálneho úložiska, cenových ponúk, outboxu a TOTP; bez produkčnej DB, SMTP alebo Blob zásahu.
- izolovaný PostgreSQL 17 + produkčný build checkpointu `293bf313`: **99/99 trás, TypeScript a obe SEO kontroly PASS**, BUILD_ID `D0Ikz1z3st4RBFzGf51_5`; produkčný prístup bol vypnutý a jednorazová databáza odstránená. Údaje viaže [nemenný buildový dôkaz](LOCAL-BUILD-EVIDENCE-293bf313.json) na plný zdrojový commit a strom.
- presný rollback test checkpointu `293bf313`: **PASS** — jednorazový PostgreSQL overil plnú schému, migráciu kandidáta, aktuálny tok a skutočné funkcie produkčného commitu `c98c630c…` po návrate; dočasná DB bola zastavená a odstránená.
- fokusovaný browser audit poslednej zmeny: **320 px PASS**, bez POST a bez zisteného pretečenia. Starší audit 20 trás/220 stavov zostáva historickým baseline; kompletná browser matica presného checkpointu je **NOT RERUN**, pretože pokus kontrolóra prerušil nesúlad lokálneho HMR originu `127.0.0.1`/`localhost`, nie potvrdená chyba produktu.
- dopytový browser/Blob emulátor: 1 lead, 1 zákazka, 2 súkromné prílohy, 2 autorizované a 0 anonymných stiahnutí, 2 čakajúce outbox položky, **0 odoslaných emailov**.
- Lighthouse S08 nad bezprostredne predchádzajúcim buildom `y1TYexOpsKdspjTfymDsp`: 5 trás × 3 behy, všetky PASS; medián Performance **97–98**, Accessibility **100**, SEO **100**, LCP **2 284–2 451 ms**, CLS **0**. Následné zúženie iba serverového rozpoznávania starých CMS otázok nemení aktuálne renderovaný obsah; jeho vlastný build a regresné testy prešli, Lighthouse sa mu nepripisuje ako nový beh.

Staršie časti `STATUS.md` zachovávajú historické behy s Accessibility 96–100. Nie sú dôkazom pre túto maticu; hodnoty Accessibility 100 patria historickému Lighthouse buildu `y1TYexOpsKdspjTfymDsp` a build `PbffkjJF2blfWHCZP2t5Z` je tiež starší. Najnovší samostatný zdrojový build checkpointu `293bf313` je `D0Ikz1z3st4RBFzGf51_5`.

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
| S08 | PASS local | Všetkých 15 Lighthouse behov splnilo Performance ≥90, LCP ≤2,5 s, CLS ≤0,1, Accessibility ≥90 a SEO ≥90. |
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
| F11 | PASS local | Predchádzajúci klient a aktuálny backend bezpečne prijmú alebo vysvetlia retry bez tichej straty fotiek. |
| F12 | PASS local / production WAITING | Kariéra, CV a strechársky tok majú súkromie, nové ID, rate limit a obnovu; živý storage/inbox sa overí až po release. |
| F13 | PASS local | Galéria prešla filtrami, lightboxom, Escape, fokusom, scrollom a responzívnou maticou. |
| F14 | PASS local | CTA, kotvy, menu, realizácie, cookie voľby a atribúcia prešli bez odoslania formulára. |

Lokálne je technicky preukázaných **12/14 funkčných kritérií**. Podľa úplnej produkčnej definície je uzavretých **9/14**: F03, F04 a F12 ešte vyžadujú živé release overenie, F01 čaká na obchodné potvrdenie modelu a F08 je finálny produkčný inbox hardgate.

## UX — U01–U10

| ID | Stav | Dôkaz / otvorený bod |
|---|---|---|
| U01 | PARTIAL | Starší baseline má 220/220 viewport stavov bez pretečenia a aktuálna posledná mobilná oprava prešla fokusovane na 320 px. Úplná browser matica presného checkpointu `293bf313` ešte nebola zopakovaná. |
| U02 | PARTIAL | Primárne CTA je konzistentné; finálny obchodný sign-off hlavného príbehu ešte chýba. |
| U03 | PARTIAL | Prvé polia a ďalší krok sú krátke a funkčné; overenie so skutočnými používateľmi patrí U10. |
| U04 | PARTIAL | Dizajnový systém a route CSS sú zjednotené; historická široká matica a aktuálny fokusovaný 320 px test nenašli konkrétnu P1–P3 chybu. Úplný Chrome/Opera/mobilný sign-off presného checkpointu a 100 % obchodná/vizuálna akceptácia zostávajú otvorené. |
| U05 | PASS local | Lighthouse Accessibility je 100/100 na všetkých piatich trasách; známe kontrastné regresie majú samostatný test. |
| U06 | PASS local | Menu, kotvy, galéria, Escape, fokus a klávesnicové cesty sú pokryté browser testami. |
| U07 | PASS local | Sticky CTA, WhatsApp a cookie panel neprekryli kontrolované akcie v celej matici. |
| U08 | PARTIAL | Reduced-motion, 200 % zoom a landscape prešli v staršom browser baseline; po poslednom mobilnom kroku nebola celá matica znovu spustená. |
| U09 | PARTIAL | Chyba/loading/success a upload stav majú čitateľné texty a semantické live/status kontrakty. [Lokálny Opera preflight](LOCAL-BROWSER-ACCESSIBILITY-PREFLIGHT-2026-10-07.md) potvrdil názvy a roly prvkov, ale povinný test skutočnou čítačkou obrazovky ešte neprebehol. |
| U10 | WAITING | Vyžaduje 5 skutočných testerov; najmenej 4 musia nájsť cenu alebo odoslať kontakt do 60 sekúnd bez pomoci. |

## Prevádzka — O01–O10

| ID | Stav | Dôkaz / otvorený bod |
|---|---|---|
| O01 | PASS local | Izolovaný produkčný build, TypeScript, generovanie 99/99 a čistenie dočasnej PostgreSQL databázy prešli. |
| O02 | PASS local | Celá unit/kontraktná sada 362/362 MJS + 28/28 TypeScript a databázové integrácie 8/8 prešli. |
| O03 | PASS local candidate | Nezávislé read-only kontroly presného aplikačného stromu checkpointu `293bf313` po oprave kanonického host allowlistu a 320 px ovládania nenašli konkrétnu P1–P3 chybu. Tento PASS sa týka kódu a lokálnych dôkazov; úplná browser a produkčná akceptácia zostáva samostatná. |
| O04 | WAITING | Posledný read-only Vercel snapshot zo 7. 10. potvrdil ako Current starší produkčný deployment `dpl_FYaPKy6tkko75rkam3RUAbXFSdcT`, viazaný na SHA `c98c630c1af467c51c615980841630a4cabf6c29`; aktuálnosť tohto externého stavu sa 8. 10. znovu neoverovala. Oddelený Staging ani staged Production deployment checkpointu `293bf313` ešte neexistujú. Podrobnosti sú v [release readiness snapshote](RELEASE-READINESS-2026-10-07.md). |
| O05 | PASS local / production WAITING | Živá rollback dvojica deployment + plný SHA je identifikovaná. Grafový merge má rovnaký strom ako skontrolovaný aplikačný parent, produkčný SHA je predkom checkpointu a presný izolovaný test potvrdil migráciu aj návrat na skutočné funkcie commitu `c98c630c…`. Reálne prepnutie deploymentu sa vykoná iba pri odchýlke po schválenom release. |
| O06 | WAITING | Starý Current deployment mal v kontrolovanom 30-minútovom okne 0 warning/error/fatal logov, ale Speed Insights a Web Analytics sú vypnuté a chýba dlhodobý alerting, vlastník retry aj eskalácia `unknown` stavu. |
| O07 | PASS local | Consent, deduplikácia, HMAC atribúcia a zákaz PII v analytike prešli testami a browser sekvenciou. |
| O08 | PASS local / production WAITING | Dashboard odlišuje leady, ponuky, zákazky a testy; produkčné obchodné dáta sa nemenili ani nerevidovali. |
| O09 | PASS local / production WAITING | Store príloh je Private a pripojený k projektu, ale jeho firewall je Not Protected a produkčné retenčné bindingy/prepínače ani samostatný foto-intake store nie sú nastavené. Workflowy ostávajú fail-closed; produkčná konfigurácia a crony sa musia overiť pred release. |
| O10 | PARTIAL | Tento dokument uvádza otvorené brány a vlastníctvo; finálny handover vznikne až po deployi, produkčných testoch a owner sign-offe. |

## Rozhodnutie

Aktuálny aplikačný zdroj je uložený ako lokálny QA checkpoint `293bf313`; následný dôkazový commit smie upraviť iba dokumentáciu a test väzby checkpointu. Presný aplikačný checkpoint prešiel kompletnou jednotkovou sadou, TypeScriptom, izolovaným produkčným buildom, presným rollback testom a nezávislou kontrolou Staging/Production brány aj poslednej mobilnej opravy. Projekt napriek tomu nie je hotový ani schválený na produkciu. Blokujú ho najmä S01/S09, G03–G06/G08–G11, F01/F03/F04/F08/F12, U01–U04/U08–U10, skutočný oddelený Staging, finálna kontrola Chrome/Opera a fyzického mobilu, 100 % obchodná a vizuálna akceptácia a zostávajúce O04/O06/O08–O10. Žiadny z týchto bodov sa nesmie označiť PASS iba na základe Lighthouse skóre alebo automatického testu.
