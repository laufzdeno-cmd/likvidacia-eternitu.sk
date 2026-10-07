# E8 — aktuálna akceptačná matica 7. 10. 2026

## Najnovší lokálny checkpoint

Aktuálny pracovný rez po doplnení súhlasovo viazaného Meta CAPI outboxu, kontrolovaného Vercel promote mechanizmu a konfiguračno-textových regresií prešiel: **346/346 MJS + 24/24 TypeScript unit testov**, lead-form **65/65**, analytika **35/35**, DB integrácie **8/8** plus oba Meta race/outbox scenáre, release guard **12/12**, release API klient **8/8**, TypeScript a diff kontrolu. Úplný izolovaný produkčný build: **99/99** trás, SEO **32 statických URL**, dynamické realizácie/recenzie a route izolácia PASS; `productionAccess:false` a jednorazová DB odstránená. Predchádzajúci plný verejný responzívny audit je **220/220**. Oba nezávislé úzke re-review verdikty sú po opravách **PASS**. Produkčný deploy, alias, formulár, email, Blob a reklamný účet zostali bez zmeny.

Lokálny technický stav tohto rezu je **PASS**. Celkový release zostáva **WAITING** na externú Vercel IAM kontrolu, produkčné tajomstvá, staged kandidáta/rollback a výslovne schválený produkčný smoke vrátane dopytu bez fotky a s fotkou, oboch schránok, Chrome/Opera a fyzického mobilu. Tieto externé brány sa nesmú nahradiť lokálnym skóre.

Táto matica nahrádza historickú maticu `E8-ACCEPTANCE-MATRIX.md` pre aktuálne rozhodovanie. Historický dokument zostáva zachovaný ako auditná stopa.

Kontrolovaný aplikačný a QA checkpoint: commit `3e8011f0` na vetve `codex/astana-upgrade-rc1`. Obsahuje právny/GEO rez, bezpečný dopytový a foto tok, cenové ponuky, PDF/email, admin, verejný vizuál, súhlasovo viazaný Meta CAPI outbox, kontrolovaný Vercel promote mechanizmus, úplný vzorový konfiguračný kontrakt, pravdivé texty, regresné testy a výkonové úpravy. Následný dokumentačný commit nemení aplikačný kód, produkčné dáta ani externé služby.

Legenda:

- **PASS local** — preukázané na aktuálnom lokálnom builde bez produkčných dát a bez externého odoslania.
- **PARTIAL** — časť kritéria je preukázaná, povinná časť ešte chýba.
- **WAITING** — vyžaduje produkčné prostredie, vlastníka, účet alebo reálnych testerov.
- **NOT TESTED** — povinná skúška ešte nebola vykonaná.

Aktuálne dôkazy:

- `npm.cmd run test:unit`: **346/346 MJS + 24/24 TypeScript PASS**.
- databázové integrácie: **8/8 PASS**, vrátane PostgreSQL/PGlite, lokálneho úložiska, cenových ponúk, outboxu a TOTP; bez produkčnej DB, SMTP alebo Blob zásahu.
- izolovaný PostgreSQL 17 + produkčný build checkpointu `3e8011f0`: **99/99 trás, TypeScript a obe SEO kontroly PASS**; produkčný prístup bol vypnutý a jednorazová databáza odstránená.
- vizuálny browser audit aktuálneho pracovného stromu: **20 trás, 220 viewport stavov, 25 snímok, 0 hydration chýb, 0 odoslaných formulárov a 0 externých originov**; pokryté reduced-motion, 200 % zoom a landscape. Fokusovaný audit `/`, `/postup/`, `/o-firme/` navyše prešiel na 1440 a 375 px bez horizontálneho pretečenia.
- dopytový browser/Blob emulátor: 1 lead, 1 zákazka, 2 súkromné prílohy, 2 autorizované a 0 anonymných stiahnutí, 2 čakajúce outbox položky, **0 odoslaných emailov**.
- Lighthouse S08 nad bezprostredne predchádzajúcim buildom `y1TYexOpsKdspjTfymDsp`: 5 trás × 3 behy, všetky PASS; medián Performance **97–98**, Accessibility **100**, SEO **100**, LCP **2 284–2 451 ms**, CLS **0**. Následné zúženie iba serverového rozpoznávania starých CMS otázok nemení aktuálne renderovaný obsah; jeho vlastný build a regresné testy prešli, Lighthouse sa mu nepripisuje ako nový beh.

Staršie časti `STATUS.md` zachovávajú historické behy s Accessibility 96–100. Nie sú dôkazom pre túto maticu; hodnoty Accessibility 100 patria Lighthouse buildu `y1TYexOpsKdspjTfymDsp`, kým najnovší samostatný zdrojový build je `PbffkjJF2blfWHCZP2t5Z`.

## SEO — S01–S10

| ID | Stav | Dôkaz / otvorený bod |
|---|---|---|
| S01 | PARTIAL | Renderovaný lokálny crawl kontroluje 32 statických URL, obe dynamické obsahové URL, chybové stavy, odkazy a kotvy na rovnakom builde. Read-only produkčný snapshot potvrdil HTTPS a kanonický host, ale živá verzia je starší deployment: `/kde-posobime/` je 404 a `/pre-strecharov/` ešte vracia duplicitnú 200 stránku. Nový host sa potvrdí až po release. |
| S02 | PASS local | Canonical, index/noindex, 404 a súkromné trasy prešli lokálnym build/browser kontraktom. |
| S03 | PASS local | Title, description, jeden H1 a obsahové odkazy prešli renderovanou kontrolou. |
| S04 | PASS local | JSON-LD používa bezpečný serializer, jednu firemnú entitu a route-vlastnené breadcrumbs; testy prešli. |
| S05 | PASS local | Sitemap, robots a pravdivé/nevynútené `lastmod` prešli kontraktmi; produkčné odoslanie patrí S09. |
| S06 | PASS local | Služby, cena, regióny a poradňa majú odlišné routy a regionálne texty nepredstierajú pobočky ani realizácie. |
| S07 | PASS local | SSR obsah, interné odkazy a obchodné navigačné cesty prešli renderovanou a browser kontrolou. |
| S08 | PASS local | Všetkých 15 Lighthouse behov splnilo Performance ≥90, LCP ≤2,5 s, CLS ≤0,1, Accessibility ≥90 a SEO ≥90. |
| S09 | WAITING | Chýba aktuálny post-release GSC/Bing stav, odoslaná sitemap a 28/90-dňový produkčný baseline. |
| S10 | PASS local | Vlastné médiá, hero preload, responzívne varianty, fonty a neverejné uploady sú chránené kontraktmi; nové reálne fotografie ostávajú samostatným redakčným vstupom. |

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
| G08 | WAITING | Treba potvrdiť aktuálne verejné profily a súhlasy k autentickým recenziám. |
| G09 | PARTIAL | Robots a lokálny crawl sú pripravené; chýba aktuálny produkčný firewall/log dôkaz pre AI a vyhľadávacie boty. |
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
| U01 | PASS local | 220/220 viewport stavov bez horizontálneho pretekania alebo chybového prekrytia. |
| U02 | PARTIAL | Primárne CTA je konzistentné; finálny obchodný sign-off hlavného príbehu ešte chýba. |
| U03 | PARTIAL | Prvé polia a ďalší krok sú krátke a funkčné; overenie so skutočnými používateľmi patrí U10. |
| U04 | PARTIAL | Dizajnový systém a route CSS sú zjednotené; treba finálnu ľudskú vizuálnu kontrolu reprezentatívnych snímok. |
| U05 | PASS local | Lighthouse Accessibility je 100/100 na všetkých piatich trasách; známe kontrastné regresie majú samostatný test. |
| U06 | PASS local | Menu, kotvy, galéria, Escape, fokus a klávesnicové cesty sú pokryté browser testami. |
| U07 | PASS local | Sticky CTA, WhatsApp a cookie panel neprekryli kontrolované akcie v celej matici. |
| U08 | PASS local | Reduced-motion, 200 % zoom a landscape sú výslovne spustené a započítané v browser reporte. |
| U09 | PARTIAL | Chyba/loading/success a upload stav majú čitateľné texty a semantické live/status kontrakty; povinný test skutočnou čítačkou obrazovky ešte neprebehol. |
| U10 | WAITING | Vyžaduje 5 skutočných testerov; najmenej 4 musia nájsť cenu alebo odoslať kontakt do 60 sekúnd bez pomoci. |

## Prevádzka — O01–O10

| ID | Stav | Dôkaz / otvorený bod |
|---|---|---|
| O01 | PASS local | Izolovaný produkčný build, TypeScript, generovanie 99/99 a čistenie dočasnej PostgreSQL databázy prešli. |
| O02 | PASS local | Celá unit/kontraktná sada 346/346 MJS + 24/24 TypeScript a databázové integrácie 8/8 prešli. |
| O03 | PASS current slice | Nezávislé read-only kontroly po opravách vydali **PASS** pre cenové ponuky, retenčný/foto tok, Meta CAPI a kontrolované Vercel povýšenie. Finálny celý release review sa zopakuje nad uzamknutým SHA. |
| O04 | WAITING | Vercel read-only kontrola potvrdila ako Current starý produkčný deployment `FYaPKy6tk` z 4. 10. 2026. Staged Production deployment checkpointu `3e8011f0`, jeho test a kontrolované povýšenie ešte neexistujú. Podrobnosti sú v [release readiness snapshote](RELEASE-READINESS-2026-10-07.md). |
| O05 | NOT TESTED | Rollback postup je zdokumentovaný, ale nebol vykonaný nad týmto release kandidátom. |
| O06 | WAITING | Starý Current deployment mal v kontrolovanom 30-minútovom okne 0 warning/error/fatal logov, ale Speed Insights a Web Analytics sú vypnuté a chýba dlhodobý alerting, vlastník retry aj eskalácia `unknown` stavu. |
| O07 | PASS local | Consent, deduplikácia, HMAC atribúcia a zákaz PII v analytike prešli testami a browser sekvenciou. |
| O08 | PASS local / production WAITING | Dashboard odlišuje leady, ponuky, zákazky a testy; produkčné obchodné dáta sa nemenili ani nerevidovali. |
| O09 | PASS local / production WAITING | Store príloh je Private a pripojený k projektu, ale jeho firewall je Not Protected a produkčné retenčné bindingy/prepínače ani samostatný foto-intake store nie sú nastavené. Workflowy ostávajú fail-closed; produkčná konfigurácia a crony sa musia overiť pred release. |
| O10 | PARTIAL | Tento dokument uvádza otvorené brány a vlastníctvo; finálny handover vznikne až po deployi, produkčných testoch a owner sign-offe. |

## Rozhodnutie

Aktuálny aplikačný zdroj je uložený ako lokálny QA checkpoint `3e8011f0` a jeho úzke konfiguračné aj textové re-review po opravách prešli. Projekt napriek tomu nie je hotový ani schválený na produkciu. Blokujú ho najmä S01/S09, G03–G06/G08–G11, F01/F03/F04/F08/F12, U02–U04/U09/U10, finálna kontrola Chrome/Opera a fyzického mobilu, 100 % obchodná a vizuálna akceptácia a zostávajúce O04–O06/O08–O10. Žiadny z týchto bodov sa nesmie označiť PASS iba na základe Lighthouse skóre alebo automatického testu.
