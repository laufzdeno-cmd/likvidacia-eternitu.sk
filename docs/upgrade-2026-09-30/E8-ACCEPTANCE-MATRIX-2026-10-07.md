# E8 — aktuálna akceptačná matica 7. 10. 2026

Táto matica nahrádza historickú maticu `E8-ACCEPTANCE-MATRIX.md` pre aktuálne rozhodovanie. Historický dokument zostáva zachovaný ako auditná stopa.

Kontrolovaný aplikačný a QA checkpoint: commit `abc63731` na vetve `codex/astana-upgrade-rc1`. Izolovaný produkčný build má ID `DjT2355rS4NIWewKmyTMZ`. Nezávislý kontrolór posudzoval presný diff, ktorý tvorí tento commit; následná zmena je iba toto doplnenie identifikátora do dokumentácie.

Legenda:

- **PASS local** — preukázané na aktuálnom lokálnom builde bez produkčných dát a bez externého odoslania.
- **PARTIAL** — časť kritéria je preukázaná, povinná časť ešte chýba.
- **WAITING** — vyžaduje produkčné prostredie, vlastníka, účet alebo reálnych testerov.
- **NOT TESTED** — povinná skúška ešte nebola vykonaná.

Aktuálne dôkazy:

- `npm.cmd run test:unit`: **291/291 MJS + 22/22 TypeScript PASS**.
- izolovaný PostgreSQL 17 + produkčný build: **96/96 stránok, TypeScript a obe SEO kontroly PASS**; produkčný prístup bol vypnutý.
- vizuálny browser audit: **20 trás, 220 viewport stavov, 25 snímok, 0 hydration chýb, 0 odoslaných formulárov**; pokryté reduced-motion, 200 % zoom a landscape.
- dopytový browser/Blob emulátor: 1 lead, 1 zákazka, 2 súkromné prílohy, 2 autorizované a 0 anonymných stiahnutí, 2 čakajúce outbox položky, **0 odoslaných emailov**.
- Lighthouse S08: 5 trás × 3 behy, všetky PASS; medián Performance **97–98**, Accessibility **100**, SEO **100**, LCP **2 285–2 455 ms**, CLS **0**.

Staršie časti `STATUS.md` zachovávajú historické behy s Accessibility 96–100. Nie sú dôkazom pre túto maticu; aktuálne hodnoty 100 patria výhradne buildu `DjT2355rS4NIWewKmyTMZ` po opravách kontrastu.

## SEO — S01–S10

| ID | Stav | Dôkaz / otvorený bod |
|---|---|---|
| S01 | PASS local | Renderovaný crawl kontroluje 32 statických URL, obe dynamické obsahové URL, chybové stavy, odkazy a kotvy na rovnakom builde. Produkčný host ešte nebol po novom release prelezený. |
| S02 | PASS local | Canonical, index/noindex, 404 a súkromné trasy prešli lokálnym build/browser kontraktom. |
| S03 | PASS local | Title, description, jeden H1 a obsahové odkazy prešli renderovanou kontrolou. |
| S04 | PASS local | JSON-LD používa bezpečný serializer, jednu firemnú entitu a route-vlastnené breadcrumbs; testy prešli. |
| S05 | PASS local | Sitemap, robots a pravdivé/nevynútené `lastmod` prešli kontraktmi; produkčné odoslanie patrí S09. |
| S06 | PASS local | Služby, cena, regióny a poradňa majú odlišné routy a regionálne texty nepredstierajú pobočky ani realizácie. |
| S07 | PASS local | SSR obsah, interné odkazy a obchodné navigačné cesty prešli renderovanou a browser kontrolou. |
| S08 | PASS local | Všetkých 15 Lighthouse behov splnilo Performance ≥90, LCP ≤2,5 s, CLS ≤0,1, Accessibility ≥90 a SEO ≥90. |
| S09 | WAITING | Chýba aktuálny post-release GSC/Bing stav, odoslaná sitemap a 28/90-dňový produkčný baseline. |
| S10 | PASS local | Vlastné médiá, hero preload, responzívne varianty, fonty a neverejné uploady sú chránené kontraktmi; nové reálne fotografie ostávajú samostatným redakčným vstupom. |

**Lokálne preukázané SEO skóre: 90/100.** S09 ostáva produkčná prevádzková brána.

## GEO — G01–G11

| ID | Stav | Dôkaz / otvorený bod |
|---|---|---|
| G01 | PASS local | Firemná identita ASTANA, s.r.o., kontakt, sídlo a história majú jeden typovaný zdroj a zhodujú sa s emailovými a JSON-LD výstupmi. |
| G02 | PASS local | Hlavné služby odpovedajú komu, čo a kde firma poskytuje; rozsah a výnimky sú viditeľné. |
| G03 | PARTIAL | Kalkulačka a ponuka odlišujú orientačný odhad od schválenej CP; finálne obchodné predpoklady a všetky zahrnuté/vylúčené položky potrebuje potvrdiť vlastník. |
| G04 | WAITING | Verejné realizácie nesmú byť dopočítané ani vymyslené. Potrebný je finálny súbor minimálne piatich doložených prípadov s právami k fotkám. |
| G05 | PARTIAL | Historický rozsah oprávnenia je datovaný a právne texty boli opravené; aktuálny odborný garant a dátum vecnej revízie ešte nie sú uzavreté. |
| G06 | PASS local | Celoslovenská pôsobnosť a osem krajov sú vysvetlené bez predstierania pobočiek. |
| G07 | PASS local | FAQ je konzistentné, prelinkované a neobsahuje svojpomocné rizikové návody. |
| G08 | WAITING | Treba potvrdiť aktuálne verejné profily a súhlasy k autentickým recenziám. |
| G09 | PARTIAL | Robots a lokálny crawl sú pripravené; chýba aktuálny produkčný firewall/log dôkaz pre AI a vyhľadávacie boty. |
| G10 | NOT TESTED | Povinný neutrálny 24-otázkový panel v GPT a ďalšom vyhľadávacom systéme ešte nemá aktuálny archív odpovedí. |
| G11 | WAITING | Workflow schválenia, súkromia a približnej lokality je implementovaný; každý publikovaný prípad ešte potrebuje ľudské potvrdenie práv a pôvodu. |

GEO ešte **nie je na cieľových 90/100**, pretože chýbajú reálne dôkazy, účty, odborné potvrdenie a panel. Tieto body sa nesmú nahradiť generovaným obsahom.

## Funkčnosť — F01–F14

| ID | Stav | Dôkaz / otvorený bod |
|---|---|---|
| F01 | PASS local | Obe kalkulačky, všetky materiály, hranice a aktívne stavy prešli testami. |
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

Lokálne je preukázaných **13/14 funkčných kritérií**. F08 je finálny release hardgate.

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
| U09 | PASS local | Chyba/loading/success a upload stav majú čitateľné texty a semantické live/status kontrakty; reálna čítačka obrazovky ostáva vhodný doplnkový test. |
| U10 | WAITING | Vyžaduje 5 skutočných testerov; najmenej 4 musia nájsť cenu alebo odoslať kontakt do 60 sekúnd bez pomoci. |

## Prevádzka — O01–O10

| ID | Stav | Dôkaz / otvorený bod |
|---|---|---|
| O01 | PASS local | Izolovaný produkčný build, TypeScript, generovanie 96/96 a čistenie dočasnej PostgreSQL databázy prešli. |
| O02 | PASS local | Celá sada 313/313 testov prešla v jednom povolenom lokálnom behu. |
| O03 | PASS current slice | Nezávislý read-only kontrolór najprv vrátil tri konkrétne vady; po oprave kontrastu, odstránení voľných diagnostických textov a zosúladení aktuálneho dôkazu vydal **PASS**. Celý release review sa zopakuje nad uzamknutým SHA. |
| O04 | WAITING | Aktuálny staged Production deployment, alias a post-release smoke ešte neexistujú. |
| O05 | NOT TESTED | Rollback postup je zdokumentovaný, ale nebol vykonaný nad týmto release kandidátom. |
| O06 | WAITING | Produkčné alerty, vlastníctvo retry a eskalácia `unknown` stavu treba potvrdiť v prevádzke. |
| O07 | PASS local | Consent, deduplikácia, HMAC atribúcia a zákaz PII v analytike prešli testami a browser sekvenciou. |
| O08 | PASS local / production WAITING | Dashboard odlišuje leady, ponuky, zákazky a testy; produkčné obchodné dáta sa nemenili ani nerevidovali. |
| O09 | PASS local / production WAITING | Publikačné, CV a foto retenčné workflowy sú fail-closed; produkčné crony a store sa overia po release. |
| O10 | PARTIAL | Tento dokument uvádza otvorené brány a vlastníctvo; finálny handover vznikne až po deployi, produkčných testoch a owner sign-offe. |

## Rozhodnutie

Aktuálny zdroj je **uzamknutý ako lokálny technický checkpoint `abc63731`**, ale projekt ešte nie je hotový ani schválený na produkciu. Blokujú ho najmä G04/G05/G08/G09/G10/G11, F08, U10 a zostávajúce O04–O06/O10. Žiadny z týchto bodov sa nesmie označiť PASS iba na základe Lighthouse skóre alebo automatického testu.
