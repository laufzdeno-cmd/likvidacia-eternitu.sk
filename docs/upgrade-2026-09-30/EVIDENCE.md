# Overenie auditov a skutočného stavu

Stav k 30. 9. 2026. Autor integračnej kontroly: hlavný agent; nezávislé read-only úseky: Faraday (kód a funkcie), Einstein (živý UX), Fermat (primárne zdroje). Toto je technická analýza, nie potvrdenie právnej zhody celej firmy ani meranie obchodnej návratnosti.

## Rozsah a reprodukovateľnosť

Zdrojový základ: `main` / `3f48aee5`. Produkcia: `dpl_83DhtcH4sysdBd8zfgEWMRmRvCE7`, READY, doména `likvidacia-eternitu.sk`. Deployment overený počas auditu; ide o bodový stav, pred release sa overuje znovu.

Živý GET crawl: všetkých 34 URL zo sitemap, jedna neexistujúca URL, robots, llms, company JSON, presmerovanie HTTP a www. Browser vzorka: homepage, cenová stránka, realizácie a kariéra; desktop 1280 × 720 a mobil 390 × 844. Bez odoslania formulárov a bez zámerných produkčných zápisov; možné vedľajšie účinky GET/renderu podľa DATA02/CMS01 neboli overené v produkčných dátach. Všetkých 179 JPG v `public/assets/azbest/jpg` skontrolovaných na GPS a bežné dátumové EXIF polia.

Lokálne podklady (ignorované artefakty, nepublikovať ako zákaznícky obsah):

- `artifacts/upgrade-20260930/collect-evidence.py` – reprodukovateľný verejný GET crawl.
- `artifacts/upgrade-20260930/public-crawl.json`, `crawl-summary.json`, `sitemap.xml`.
- `artifacts/upgrade-20260930/claude-pages.png` – vizuálna kontrola všetkých 11 strán PDF.
- Browser snímky: `C:/Users/Zdeno/.codex/visualizations/2026/09/22/01a0c7a8-cb61-7b31-ba91-095231227be9/astana-ux-20260930/`.

Hranice: žiadna nová end-to-end skúška e-mailu/príloh, žiadny aktuálny GSC export ani CWV field report, žiadne testovanie reálnymi zákazníkmi. Neznáme výsledky sa nesmú prezentovať ako úspešné.

### Opakovaná kontrola produkcie a samostatných formulárov

Pozorovania medzi kartami/reláciami sa líšili: prvý DOM snapshot z už otvorenej Chrome karty zobrazoval „Ukážky reálnych striech ASTANA.“ ako obyčajný text; po novej navigácii na homepage sa správny odkaz `/realizacie/` objavil a klik otvoril stránku s titulkom „Realizácie likvidácie azbestu a eternitu | ASTANA“ a H1 „Reálne realizácie ASTANA“. Dňa 30. 9. čerstvá úzka mobilná Opera relácia ukázala text ako odkaz s cieľom `/realizacie/`; klik otvoril rovnakú stránku realizácií. Mobilný navigačný smoke test: PASS, bez odoslania formulára. Presná príčina rozdielu medzi starým Chrome dokumentom a novým dokumentom nie je izolovaná; pred záverom o cache/deployi treba zistiť načítanú verziu. Plný vizuálny responsive audit (konkrétne 390 px, ostatné breakpointy a dotykové správanie) zostáva otvorený.

Live DOM potvrdil vykreslenie hlavného dopytového formulára s voliteľnými fotkami a prepínačom preferovaného kontaktu; formulár sa neodoslal. Nezávislý zdrojový audit oddelených kariérnych a strechárskych formulárov našiel tri konkrétne riziká: strechársky formulár po úspechu znovu používa rovnaké `submissionId`; jeho úspešná odpoveď API potvrdzuje prijatie registrácie, nie doručenie e-mailu, pričom chýba trvalý stav notifikácie a obnova; kariérna žiadosť sa môže uložiť pred CV/e-mailom a opakovanie bezpečne nedokončí chýbajúce kroky. Rate limiting týchto okrajových endpointov je tiež nerovnomerný/procesový. Tieto nálezy potrebujú cielené reprodukčné kontrakty a patria do E1 pred ostrým QA; nepreukazujú stratu reálnych záznamov. Lokálne dopytové testy 12/12 a PGlite 1/1 neoverujú kariéru, registráciu strechárov, Blob, SMTP ani doručenie do schránky.

## Vstupy a ich dôveryhodnosť

| Vstup | Použitie | Záver |
|---|---|---|
| CLAUDE Audit likvidacia-eternitu.sk — SEO a GEO.pdf, 11 strán | Široký obsahový, právny a SEO/GEO návrh | Užitočné smery; každé právne a algoritmické tvrdenie vyžaduje vlastný zdroj |
| GEMINI audit 30.9.2026.txt | Hypotézy o viditeľnosti AI a lokalitách | Neprijímať ako technickú špecifikáciu bez overenia; príliš kategorické algoritmické tvrdenia |
| GPT audit a odporúčania.. 30.9.206.txt | Prioritizácia ceny, dôkazov a konverzií, staršie GSC údaje | Prijať jadro podmienečne; namerané čísla patria obdobiu a účtu zo zdroja |
| ASTANA_technicke_zadanie_a_dokazy.md | Existujúce nálezy, dôkazy a ochranné hranice | Použiť ako historický baseline, nie ako dôkaz aktuálneho runtime |

SHA-256 vstupov v rovnakom poradí:

```text
69ABD74B05DE5D5840756FC6D710C59885B94135479AC9B5BF218296DA5327A8
A3A5CFA9F8AECCD4E4F336602B1074D4C8E900E1A081FB263E3C9920F5231918
C03F61CD1954414495E3D6261CAAFF739C7CE72F21EC75A9D9526C9CDDC7370B
AA309A729258D16806601CE9B3A259B3F04EA7AD149F4ECE906D3A89BCE5FA93
```

## Register tvrdení z auditov

`ACCEPT` = podložené a použiteľné. `CONDITIONAL` = dobrý smer, chýba podklad alebo podmienka. `REJECT` = nepodložený sľub, nesprávna univerzalizácia alebo nevhodná implementácia.

| Tvrdenie/návrh | Verdikt | Rozhodnutie pre ASTANU |
|---|---|---|
| Pravdivé ceny, zahrnuté/nezahrnuté položky, ľahký dopyt | CONDITIONAL | Zjednotiť existujúcu kalkulačku; DPH a cenové predpoklady potvrdiť. Historicky schválené znenie dopravy od 100 m² možno použiť iba v presnom rozsahu: „Pri ploche od 100 m² dopravu po Slovensku neúčtujeme.“ Nepreberať konkurenčné sadzby |
| Reálne prípadové štúdie, pôvodné fotografie, konkrétny postup | ACCEPT | Hlavná investícia do dôvery; nie generické SEO odseky |
| AI musí odporúčať firmu pri každom lokálnom dopyte | REJECT | Nie je ovládateľná garancia; merať pripravenosť, odpovede a skutočné referral dopyty |
| Všetkých 8 krajov v areaServed je podmienka odporúčania | REJECT | Vhodné na opis pravdivej pôsobnosti, nie algoritmická povinnosť. Slovakia už existuje |
| Určitý počet mestských stránok alebo lokalít odomkne AI | REJECT | Neexistuje doložený univerzálny počet; vysoké riziko klonov bez hodnoty |
| Regionálne stránky vždy predstavujú spam | REJECT | Rozhoduje účel a vlastná hodnota; existujúce URL automaticky nerušiť |
| llms.txt zásadne zlepší Google ranking | REJECT | Google uvádza, že ho ignoruje. Existujúci súbor možno udržiavať konzistentný, nie stavať na ňom stratégiu |
| FAQ schema prinesie Google FAQ rich results | REJECT | Google oznámil koniec tejto prezentácie od 7. 5. 2026. Viditeľné užitočné FAQ zachovať |
| Pre AI treba špeciálnu schému alebo formulácie príkazov | REJECT | Bežné indexovateľné HTML a pravdivé štandardné schema; žiadne pokyny robotom k odporúčaniu |
| Firma od 2011 = oprávnenie na azbest od 2011 | REJECT | História firmy a oprávnenie sú odlišné fakty; historický úradný zoznam uvádza pri ASTANE 2013 |
| NV 185/2026 nahradilo NV 253/2006 od 15. 7. 2026 | ACCEPT | Overené oficiálnym Slov-Lex PDF, §15–16. Staré pravidlo neuvádzať ako aktuálne |
| Vždy žiadať rozhodnutie RÚVZ podľa starého textu | REJECT | Opraviť na aktuálny režim podľa druhu práce; odborné posúdenie neskracovať na slogan |
| GPS z fotky spoľahlivo dokazuje miesto realizácie | REJECT | Je to kandidátska metainformácia. Musí ju potvrdiť firma a prejsť publikačnou kontrolou |
| Približná mapa automaticky vyrieši GDPR | REJECT | Môže znížiť riziko; dom a osoby môžu byť stále identifikovateľné |
| Celý backend treba zahodiť spolu s dizajnom | REJECT | Chrániť dopyty a kompatibilitu; opravovať preukázané slabiny postupne |

## Potvrdené runtime a obsahové nálezy

| ID | Priorita / dôkaz | Nález | Oprava / etapa |
|---|---|---|---|
| UX01 | P1, živý browser + kód | Homepage slider mení svoju hodnotu, nie výmeru/cenu; materiály nereagujú ani po načítaní odloženého klienta | Spoločný kalkulačný komponent s vlastným životným cyklom, E1 |
| UX02 | P1, živý browser + kód | Hladký eternit posiela `hladky`, sadzby poznajú `plocha`; fallback použije vlnitý eternit | Jednotný typ/kľúč materiálu, všetky materiály otestovať, E1 |
| UX03 | P1, živý mobil | Vysoká fotografia vytvorí dialog ~1402 px na výške844 px; zatváranie je nad viewportom | Rozmer podľa viewportu, scroll, dostupné zatváranie/fokus, E1 |
| UX04 | P2, živý browser | Formulár naraz zobrazuje všetky kroky a 7 povinných polí + súhlas; telefón aj email aj pri voľbe Zavolať | Prvé3 údaje, následne vysvetlený kontakt; backend nesmie byť v rozpore, E4 |
| UX05 | P2, živý browser | Hodnoty kalkulačky neprechádzajú do dopytu | Jeden definovaný kontrakt pre prefill na oboch stránkach, E4 |
| UX06 | P2, vizuál | Dôležitá cena/galéria sú na mobile veľmi nízko; plávajúci WhatsApp zakrýva časti CTA/obsahu | Skrátiť príbeh, koordinovať plávajúce prvky, E4 |
| SEO01 | P2, crawl | 18 stránok má dva BreadcrumbList | Jediný vlastník breadcrumb schema, E3 |
| SEO02 | P2, crawl + samostatné overenie | Skutočná404 má homepage title/canonical a dve robots hodnoty `noindex` + `index, follow` | Samostatné404 metadata a jednoznačné noindex; nejde o potvrdenú soft404, E3 |
| SEO03 | P2, kód/súbory | Verejný GBP TODO a rozdielne fakty v company JSON, site.ts a llms | Jednotné fakty, chýbajúci verejný odkaz vynechať; E2 |
| SEO04 | P2, sitemap/kód | Všetky lastmod sa menia pri builde | Skutočný dátum obsahovej aktualizácie, prípadne radšej lastmod vynechať, E3 |
| SEO05 | P2, text/kód | Staré univerzálne tvrdenie o RÚVZ v trust bloku vs nový text homepage; gramatika regiónov | Redakčný faktový kontrakt a jazykové testy, E2/E6 |
| SEO06 | P2, robots | Osobitné skupiny crawlerov nemajú všetky pravidlá wildcard | Zjednotiť chránené cesty pre príslušné skupiny. Robots nie je bezpečnostná ochrana, E3 |
| DATA01 | Obmedzenie vstupov | 179 aktuálnych JPG: GPS0, dátumové EXIF0 | Originály/majiteľom potvrdené obce, E5 |
| QA01 | Medzera dôkazu | Chýba nové úplné overenie príloh až po príjem a otvorenie v adminovi | Povinný E1 test, API200 nie je dostačujúce |

Príčina UX01: `app/page.tsx` používa `HomepageCriticalClient` a `HomepageDeferredClient`, zatiaľ čo `initPricing` ostalo iba v `app/landing-client.tsx` (približne riadky119–165 a761). `app/homepage-below-fold-client.tsx` inicializuje galériu a animácie, nie kalkulačku. Oprava observera samotného by nestačila. UX02: `app/cena-likvidacie-azbestu/page.tsx:72` a sadzby v `app/landing-client.tsx:119`. Riadky platia pre auditovaný commit, pri ďalšej zmene sa môžu posunúť.

Bez potvrdenej chyby vo vzorke: 34/34 sitemap stránok HTTP200, jeden H1 na každej; načítanie galérie/filtrov; hero CTA nad prehybom mobilu; „Celé Slovensko“ sa zmestí; na skúšaných stránkach nebol horizontálny overflow. HTTP a www správne smerujú na HTTPS bez www. Nález kalkulačky sám osebe nedokazuje zlyhanie príjmu formulára.

## Kódové riziká dopytov a administrácie

Nasledujúce nálezy sú potvrdené kontrolou kódu, nie potvrdením škody v produkčných dátach. Databáza ani obsah inboxov sa pri tomto audite nečítali. Závažnosť vyjadruje prioritu odstránenia rizika; nevydávať ju za počet poškodených zákaziek.

| ID | Priorita | Potvrdený mechanizmus / dôkaz v auditovanom commite | Riešenie |
|---|---|---|---|
| DATA02 | P0 preventívny | `src/server/db.ts:245,729`: ensureSchema volá cleanupLegacyData; archivuje leads/jobs/offers podľa textu mena alebo emailu vrátane firemného. Konkrétny zasiahnutý legitímny záznam NEOVERENÝ | Prvý ochranný balík: odstrániť automatickú heuristickú archiváciu. Žiadne hromadné odarchivovanie alebo mazanie existujúcich údajov |
| DATA03 | P1 | `app/homepage-critical-client.tsx:56`, `app/api/lead/route.ts:211`, `src/server/db.ts:1142`: klient má submissionId, server vytvára novéUUID bez jeho použitia | Perzistentný idempotentný príjem s unikátnosťou a kontrolou payloadhash |
| DATA04 | P1 | `src/server/db.ts:112,2622`: BEGIN/zápisy/COMMIT cez Pool.query, bez jedného rezervovaného klienta | Transakcia cez jedno pool.connect spojenie, finally release, rollback pri chybe |
| DATA05 | P1 | `app/api/lead/route.ts:231`, `src/server/db.ts:1221,2717`: lead/job/files/audit zapisované čiastkovo, väzba lead-job iba auditom | Atómový kontrakt prijatia a explicitná väzba, kompatibilná migrácia |
| MAIL01 | P1 | `app/api/lead/route.ts:249`, `src/server/mail.ts:281,333`: uloženie a výsledok zákazníckeho emailu zmiešané, chýba trvalé retry; sekvenčné SMTP proti30s timeoutu | Oddeliť prijatie od doručovania, trvalý outbox a výsledok každého príjemcu |
| MAIL02 | P1 | `app/api/cron/notifications/route.ts:113,148`: príznak sent aj pri návrate sent:false | Označiť odoslanie len podľa výsledku, retry/lastError; bez nových nevyžiadaných správ |
| UP01 | P1 | `app/api/lead/route.ts:67`, `app/api/lead-upload/route.ts:70`, `src/server/db.ts:325`: cesta sa porovnáva s klientskymID, nie servermanifestom; storage_key bez unikátnosti | Overený uploadpokus, vlastníctvo a jednorazové pripojenie. Verejný únik tým NEPREUKÁZANÝ |
| UP02 | P1 | `app/homepage-critical-client.tsx:349,390`: všetky uploady musia prejsť pred POST, retry začína novéUUID; `src/server/storage.ts:34`: naviazané súbory ostávajú lead-drafts | Obnova dokončených uploadov, možnosť vedome odoslať bez neúspešnej nepovinnej fotky; čistenie iba nereferencovaných objektov |
| UP03 | P1 podmienečný dopad | `app/api/lead-upload/route.ts:28`, `app/api/lead/route.ts:39`, `src/server/storage.ts:86`: iné previeworigin pravidlá, frontBlob vs serverS3 | Jednotný a explicitne otestovaný kontrakt podporovaného prostredia. Konfigurácia produkcie sa týmto auditom nepotvrdila |
| PRIV01 | P1 technický | `app/public-widgets.tsx:6`, `src/lib/marketing-consent.ts:38`, `app/homepage-critical-client.tsx:63`: banner v1 vs knižnica v2, vlastná analytika bez voľby bannera | Jeden consentmodel, migrovať bez presumovaného súhlasu, oddeliť nevyhnutné technické logy; nejde o právny verdict |
| REV01 | P1 obchodná merateľnosť | `app/api/lead/route.ts:225`, `app/homepage-critical-client.tsx:400`, `src/server/db.ts:4145`: source web bez spoľahlivejUTM väzby, session bez expirácie, success podľa mailu | Atribúcia s pravidlami súhlasu, oddeliť leadaccepted/delivery a skutočný výsledok zákazky |
| CMS01 | P1 | `app/page.tsx:259`, `src/server/db.ts:3593`: render pri rozdielnej contentversion zapisuje defaulty cez admin hodnoty | Čítanie obsahu bez zápisu, explicitná kontrolovaná obsahová migrácia a ochrana editácií |
| QA02 | P1 medzera kontroly | `playwright.config.ts:4`, `scripts/admin-test.ts:42`: default testmatch iba admin, chýba nakonfigurovaná sada lead/directupload/idempotencia | Pridať izolované integračné a browser testy pred zmenou kontraktu |
| CSS01 | P2 | `app/layout.tsx:5`: štyri globálne CSS vrstvy; približne655kB zdrojov a5814 riadkov s!important | Postupné odstránenie duplicitnej zodpovednosti. Dopad na CWV zatiaľ NENAMERANÝ |

Najprv ochrana existujúcich záznamov a administrátorských úprav, potom idempotentný príjem/doručovanie. Kalkulačka a lightbox sú samostatné neprekrývajúce sa opravné balíky. Historické duplicity a archivované záznamy sa bez read-only inventúry a rozhodnutia majiteľa nemažú ani hromadne neobnovujú.

## Primárne overené zdroje

- [Google AI optimization guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide): žiadne špeciálne AI schema, llms.txt ranking ignorovaný, bez garancie zaradenia.
- [Google Search updates](https://developers.google.com/search/updates): aktualizácia 8. 5. 2026 o konci FAQ rich results od 7. 5. 2026.
- [Google doorway abuse](https://developers.google.com/search/docs/essentials/spam-policies#doorway-abuse): regionálne klony bez vlastnej hodnoty nie sú stratégia.
- [Search generative AI settings](https://support.google.com/webmasters/answer/16908024) a [generative AI report](https://support.google.com/webmasters/answer/16984139?hl=en): existencia dokumentovaná; nastavenie účtu ASTANA zatiaľ neoverené.
- [OpenAI bots](https://developers.openai.com/api/docs/bots): OAI-SearchBot, GPTBot a ChatGPT-User majú rozdielne účely.
- [Google robots špecifikácia](https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec): skupiny pravidiel a ich výber.
- [Slov-Lex 355/2007, od 1. 8. 2026](https://static.slov-lex.sk/pdf/SK/ZZ/2007/355/ZZ_2007_355_20260801.pdf#page=101): §41 ods.13 oznámenie najmenej30 dní vopred s podkladmi; ods.14 osobitné havarijné situácie. Neznamená garantované schválenie každej zákazky za30 dní.
- [Slov-Lex NV185/2026](https://static.slov-lex.sk/pdf/SK/ZZ/2026/185/ZZ_2026_185_20260715.pdf#page=10): účinnosť15.7.2026, zrušenie253/2006.
- [Historický zoznam ÚVZ, 19.9.2024](https://www.uvzsr.sk/documents/d/uvz/zoznam-azbest-k-19092024-pdf#page=21): ASTANA IČO46157701, OPPL/3064/2013-Fe (26.3.2013, EXT/BJ), OPPL/7683/2013-Fe (23.10.2013, INT). Tento zoznam sám nepreukazuje aktuálnu platnosť2026 ani neprítomnosť staršieho oprávnenia.

Obchodné tvrdenia konkurentov, dotácie, pokuty a všeobecné zákazy prijímania na zberných dvoroch nepreberať ako overené právne fakty.

## Technické overenie E1 — 30. 9. 2026

- `npm run test:db-integration`: úspech v jednorazovej PGlite databáze naviazanej iba na `127.0.0.1`. Test priamo volá `createLeadSubmission`; overuje celý uložený stav dopytu + 2 metadát súborov + zákazky/nákladov + auditov + 2 outbox riadkov, rovnaké opakovanie bez zmien, konflikt pri zmene odtlačku a úplný rollback po vynútenom zlyhaní druhého (interného) outbox zápisu. Test neposiela e-mail, nenahráva skutočné súbory a nevolá verejné API.
- Nezávislý statický GPT kontrolór potvrdil vhodnú transakčnú hranicu a bezpečnosť výlučne izolovanej DB. Po dvoch kolách opráv GPT-6 Astra vydal `APPROVE` pre testovací diff: úplný DB snapshot sa porovnáva po každom type opakovania a rollback je vynútený až pri druhom outbox zápise. Review sa nevzťahuje na celý aplikačný diff ani nasadenie. PGlite Socket dokumentuje multiplexer nad databázou s jedným pripojením a výslovne negarantuje všetky prípady ako pri bežnom Postgrese; preto tento test nepreukazuje správanie pri súbehu.
- `npm run test:unit`: 35/35; `npm run test:lead-form`: 10/10; `npm run typecheck`: úspech; `npm run build`: úspech, 86 stránok/route handlerov v zostave. Zostáva jedno upozornenie na NFT tracing importu `/api/analytics` cez `db.ts` a `next.config.mjs`; build nepadol.
- Produkcia, produkčná DB, CRM, Blob úložisko, e-mailové schránky ani zákaznícke dopyty sa týmto testom nemenili ani nepoužili.

## E1 notifikácie Kariéra/Strechári — nezávislý follow-up (30. 9. 2026)

- Rozsah revízie: aktuálny lokálny diff obnovy notifikácií, nové administračné stavy a PGlite testy. GPT kontrolór Kepler vydal RETURN WITH DEFECTS.
- P2: notifikačný recovery worker je pripojený k existujúcemu dennému cron behu; retry, ktorý je podľa nextAttemptAt oprávnený, môže čakať takmer 24 hodín. PGlite testy claimu nemenia časový rozvrh. Pred voľbou častejšieho behu treba overiť aktuálny Vercel plán a zvoliť podporovanú cadence.
- P2: administrácia zobrazuje stav unknown a žiada kontrolu schránky, ale pracovník nevie zaznamenať nález a uzavrieť tento stav. Doplniť auditovaný reconciliation tok, ktorý najprv overí provider/log/mailbox dôkaz a nikdy neodošle duplikát len preto, že stav je nejednoznačný.
- Kontrolór nenašiel nový materiálny nedostatok v posudzovaných dodatkoch; jeho revízia testov nebola opätovným spustením testov. Skutočné zlyhanie/opakovanie privátneho CV Blob uploadu, SMTP/relay čiastočné prijatie a inbox dôkaz zostávajú NOT TESTED.
- Opakované lokálne kontroly po revízii: npm run test:unit 63/63 PASS; npm run test:db-integration 1/1 PASS; npm run typecheck PASS. Tieto testy používajú lokálne/izolované prostredie a nedokazujú produkčné doručenie.
- Rozsah zmien v tomto follow-upu: iba stavový/evidence dokument. Produkcia, produkčná DB, Blob, schránky, formuláre a kampane sa nemenili ani nepoužili.

## E1 auditovaná reconciliácia a manuálny retry (1. 10. 2026)

- `unknown` možno uzavrieť len v admin server action po CSRF a admin kontrole, výslovnej checkbox autorizácii a 20–1 000 znakoch dôkazu bez obsahu emailu/PII. Aktualizácia stavu a auditný riadok sa ukladajú v jednej PostgreSQL transakcii; súbežné/protichodné rozhodnutie môže uspieť iba raz.
- `confirmed_delivered` sa nikdy neobnoví resendom. `confirmed_not_delivered` nemá automatický retry: admin musí znovu výslovne potvrdiť bezpečné odoslanie. Strechársky retry sa týka jedného adresáta. Kariérny relay je párový, preto UI a DB dovolia opakovanie iba ak sú obaja príjemcovia potvrdene nedoručení; ak je aspoň jeden potvrdene doručený, resend páru sa zablokuje.
- Requeue, audit a `pending` prechod sú transakčné a idempotentné voči druhému kliknutiu. Po zaradení action spracuje presne túto povolenú jednotku; nový nejednoznačný výsledok zostane `unknown` a nebude sa automaticky opakovať.
- GPT kontrolór po oprave predchádzajúceho P2 vydal `PASS`, bez materiálnych nálezov. PGlite preveril race medzi dvoma reconciliation rozhodnutiami, jednu úspešnú auditovanú zmenu, single-recipient roofer retry, kariérny retry len po potvrdení nedoručenia obom a zákaz párového retry pri potvrdenom doručení jedného príjemcu. Nie sú to testy skutočnej pošty.
- Zostávajúci cron P2: automatický recovery beží raz denne; oficiálna Vercel dokumentácia uvádza Hobby raz denne a Pro/Enterprise od minútovej frekvencie, ale plán tohto projektu sa z lokálneho project metadata nepotvrdil. Pozri [Vercel Cron usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing). Konfigurácia a nasadenie cadence sa nemenili.
- Súčasné lokálne overenie po zmene serverového kódu: unit suite 65/65, PGlite 1/1, typecheck PASS, build 86/86 s existujúcim NFT tracing warningom; `git diff --check` bez whitespace chýb. Produkcia, emaily, reálni uchádzači/partneri ani schránky sa nemenili/nepoužili.

## E1C kalkulátor – spoločná interakcia (1. 10. 2026)

- Domovská stránka obsahovala výpočet bez napojenej klientovej obsluhy. Na samostatnej cenovej stránke ovládanie fungovalo, ale tlačidlo `hladky` nesúhlasilo s kľúčom `plocha` v sadzbách a padalo na sadzbu vlnitého eternitu.
- Obe stránky teraz pripájajú spoločný inicializátor, ktorý aktualizuje výmeru/cenové rozpätie, nastavuje aktívny materiál a odstraňuje poslucháče pri odmontovaní. Existujúce sadzby sa nezmenili; alias `hladky` smeruje na pôvodnú sadzbu `plocha` (9–15 €/m²).
- Lokálny prehliadač: pri priamom vstupe aj po scrollovaní obe routy prešli maticu minimum/default/maximum výmery a všetkých štyroch materiálov; po každej akcii accessibility strom potvrdil hodnotu slidera, cenu a jediný aktívny checkbox. Domovská stránka: min 10 m² = vlnitý 80–140 €, hladký 90–150 €, panely 110–180 €, neviem 80–160 €; default 120 m² = 960–1 680 €, 1 080–1 800 €, 1 320–2 160 €, 960–1 920 €; max 500 m² = 4 000–7 000 €, 4 500–7 500 €, 5 500–9 000 €, 4 000–8 000 €. Cenová stránka: min 30 m² = 240–420 €, 270–450 €, 330–540 €, 240–480 €; default 120 m² = rovnaké pásma ako homepage; max 500 m² = rovnaké pásma ako homepage. Na 300 m² po scrollovaní obe stránky zobrazili vlnitý 2 400–4 200 € a hladký 2 700–4 500 €. Formulár sa neodoslal.
- Kontrolór vrátil dve P2: výmera sa nepočítala do analytiky a prvé regresné kontrakty boli iba statické. Slider teraz odošle jednu `price_calculator_change` udalosť na dokončení (`change`), nie pri každom `input` kroku; behaviorálny test overuje event count aj cleanup. Správanie helpera má 3/3 vykonateľné testy; celý unit súbor je 70/70, typecheck PASS a build 86/86. Nezávislé stránkové overenie pokrylo obe routy, priamy vstup aj po scrollovaní a minimum/default/maximum × všetky štyri materiály. GPT kontrolór uzavrel oba pôvodné technické P2 (`PASS`) a prijal stránkovú maticu ako dôkaz. **Obchodné F01 a celkové schválenie cien zostáva BLOCKED** do potvrdenia sadzieb, DPH a predpokladov majiteľom; žiadna sadzba nebola zmenená ani označená ako schválená. Build zachováva existujúci NFT tracing warning cez `db.ts`/`/api/lead`; ide o lokálny build a prehliadač, nie produkčné nasadenie. Produkcia a reklamné kampane sa nemenili.

## E3 Article a jednotná identita v JSON-LD (1. 10. 2026)

- Nezávislý SEO review vrátil P2 za chýbajúci Article JSON-LD pre poradňu a dva neprepojené firemné uzly. Article teraz čerpá headline, description a body z toho istého viditeľného záznamu; zámerne neuvádza `datePublished`/`dateModified`, kým neexistujú overené redakčné dátumy. Organization a ProfessionalService sú jeden `#organization` uzol. Služby, článok, autor, publisher a WebSite odkazujú na túto identitu.
- Lokálny production HTML GET článku `/poradna/co-je-eternit-a-kedy-obsahuje-azbest/` vrátil HTTP 200; parsovaný HTML obsahoval presne 1 Article a 1 ProfessionalService+Organization uzol s author ID zhodným s `#organization`. Regresné SEO testy 10/10 sú súčasťou unit 70/70; typecheck/build 86/86 prešli.
- Nezávislý GPT follow-up potvrdil uzavretie oboch pôvodných P2 v zdroji a regresných testoch (Article + zjednotená identita), ale výslovne ponechal E3 `IN_PROGRESS`: kompletný renderovaný crawl sitemap URL a nových stránok, HTTP 404 metadata/noindex a audit prístupnosti ešte treba doložiť. Lokálny HTML GET/report uvedený vyššie nie je náhradou za úplný crawl, verejný crawler/Google rich results test ani produkčné nasadenie. Indexácia, GSC/Bing a externé potvrdenie firemných faktov zostávajú otvorené.

## Nezávislá kontrola kampaní, referencií a fotoportálu (1. 10. 2026)

- Živý sitemap crawl: 34/34 URL HTTP 200. `/cena/` však vracia 308 bez zachovania query; zdrojový helper už zachováva opakované a bežné parametre, no aktuálna produkčná odpoveď dokazuje, že nasadený runtime sa od pracovného kódu líši. HTTP → HTTPS, www → apex a doplnenie lomky boli v testovanej vzorke query-preserving. Kontrola neotvárala JavaScript ani mobilný browser.
- Zdieľané CTA používa `/#dopyt`; kód nevie z tejto kontroly preukázať spoľahlivé priradenie UTM/click ID konkrétnemu leadu. Aktívne finálne/mobilné reklamné URL, tracking templates a URL suffixy z Google/Meta/Instagram neboli exportované. Žiadne účty ani kampane sa neupravovali.
- GPT photo-intake kontrola vlastným PGlite reproduktorom dokázala admin edit → stale worker confirm, ktorý pôvodne prepísal lokalitu a kategórie bez auditu. Pridaný `metadata_version` compare-and-set, odmietnutie odlišného stale obsahu, idempotentné potvrdenie rovnakých hodnôt a worker audit bez voľnej lokality; client polia sú vypnuté počas POST. Izolovaný PGlite po oprave PASS vrátane zachovania admin opravy a verzie; unit kontrakt photo-intake 7/7. Čerstvý controller review aktuálnej opravy je ešte otvorený.
- GPT review verejných referencií: consent gate/allowlist bez kritickej chyby, no našiel P2 pre duplicitné retry a autofill honeypotu. Opravené lokálne stable UUID na formulári, unique partial index na `submission_id`, identický retry vráti pôvodný koncept a odlišný obsah vráti 409. Unit 72/72 zahŕňa source regresiu; PGlite overil jeden záznam pre opakované odoslanie aj konflikt pri zmene textu. Honeypot má `autocomplete="new-password"`; samostatné vymazanie/retencia referencií a dokladov súhlasu stále chýba. GPT re-review pokračuje.
- `npm run test:unit`: 72/72 PASS; `npm run test:db-integration`: izolovaný PGlite 1/1 PASS; `npm run typecheck`: PASS. Všetky výsledky sú lokálne. V tejto fáze sa nespúšťalo publikovanie, reálny upload, mail, produkčná DB, deploy ani zápis do reklamných účtov.
- Opakovaný GPT controller pre prvé doplnené zmeny potvrdil odstránenie oboch photo-intake P2 (admin/worker stale race a polia meniteľné počas ukladania), no pri referenciách reprodukoval dva nové P2: neatomické INSERT/audit pri databázovej chybe a stratu úprav dopísaných počas POST. Oprava presúva SQL INSERT aj audit do jednej transakcie na rezervovanom klientovi; lokálny JSON fallback serializuje oba zápisy do jedného uloženia. Verejný formulár zamyká editovateľné polia počas odoslania. PGlite pridáva kontrolné obmedzenie, ktoré úmyselne odmietne audit; overil rollback záznamu a jeho následný retry s práve jedným auditom. Unit 72/72, PGlite 1/1, typecheck PASS, Next production build 86/86. Ďalší GPT re-review aktuálneho diffu je pending.
- Browser QA nad novo zostavenou lokálnou produkčnou zostavou potvrdil plnohodnotný render homepage, navigáciu, CTA, krátky dopytový formulár, cenový kalkulátor a vybrané realizácie; accessibility strom nemal prázdnu/blank stránku. Screenshot bol desktopový (~1250 px). Mobile Chromium screenshot z Playwright sa skončil OS `spawn EPERM`; bez potvrdeného 390 px runtime zobrazenia preto mobilný gate zostáva otvorený. Browser runtime neposlal žiadny formulár.
- Lokálny GET `/cena/?utm_source=test&utm_campaign=source&gclid=click&tag=a&tag=b` vrátil 308 s kompletným opakovaným query v `Location: /cena-likvidacie-azbestu/?...`. To potvrdzuje pracovnú verziu, nie produkciu: predchádzajúca live HTTP kontrola zaznamenala tú istú trasu bez query a kód zatiaľ nebol nasadený.

## E1D – idempotencia verejných referencií, finálny lokálny checkpoint (1. 10. 2026)

- Nezávislý GPT kontrolór pri druhom re-review reprodukoval P2: `ensureSchema()` mohol pri prvom štarte paralelne vytvoriť viac prázdnych lokálnych JSON databáz ešte pred zámkom vytvárania referencie. Inicializácia lokálneho úložiska teraz prechádza rovnakým serializačným zámkom; inicializácia zlyhá bezpečne pred označením schémy za pripravenú. Kontrolór potvrdil `PASS`, bez zvyšných P0–P2 v rozsahu opravy. Výslovne to nepotvrdzuje zámok medzi viacerými procesmi.
- Nový cielený test štartuje súbežné vytvorenie nad neexistujúcim súborom v izolovanom subprocess-e: dve totožné podania vrátia rovnaké ID, samostatné podanie má vlastné ID a v súbore zostanú oba záznamy aj ich audity. `node --test scripts/testimonial-policy.test.mjs`: 7/7 PASS.
- Záverečný lokálny checkpoint: `npm run test:unit` 73/73 PASS; `npm run test:db-integration` 1/1 PASS (izolovaný PGlite); `npm run typecheck` PASS; `npm run build` PASS, 86/86 stránok/rout. `git diff --check` PASS. Build stále hlási známy NFT tracing warning cez `next.config.mjs` → `src/server/db.ts` → `/api/lead`; homepage CMS nebola dostupná pri build-e a použil sa skontrolovaný predvolený obsah.
- GPT review a tieto automatizované kontroly nie sú dôkazom produkčného mailu, skutočného Blob uploadu ani browser odoslania. Žiadny formulár, mailbox, produkčná DB, Blob ani reklama sa týmto checkpointom nemenili. Mobilné 390 px vizuálne overenie stále zablokoval Chromium `spawn EPERM`; mobilný gate preto ostáva otvorený.
- Produkcia nebola nasadená. Živý `/cena/` redirect zatiaľ stráca query parametre, hoci lokálny helper ich zachováva; presné reklamné URL/tagy bez exportu neboli potvrdené. E1/E3/E5/E7 a celkové skóre projektu ostávajú nedokončené a nehodnotené.
- **Opakované živé browser overenie 1. 10. 2026:** otvoril som `/cena/?utm_source=astana_audit&utm_medium=cpc&gclid=EAIATEST`; browser skončil na `/cena-likvidacie-azbestu/` bez query. To potvrdzuje stratu testovacích UTM/GCLID v live redirecte, ale nedokazuje kompletné nastavenie ani dopad konkrétnej reklamnej kampane. Lokálny `priceRedirectTarget()` a jeho test už query zachovávajú. Nezmenil som Ads účty ani produkciu; pred propagáciou treba nasadiť túto opravu v čistom reviewed deploymente a zopakovať rovnaký test.
- Dodatočný renderovaný crawl tejto lokálnej produkčnej zostavy: všetkých 34 sitemap URL vrátilo HTTP 200, presne jeden H1 a canonical na vlastnú doménu; title a meta description boli prítomné a všetky nájdené bloky JSON-LD sa dali parsovať. Ide o lokálny build, nie verejný deploy ani externý rich-results test.
- Následná kontrola detailov 404: neznáma cesta HTTP 404, `robots=noindex`, bez canonical — lokálny production server. Prístupnosť, viewport 390 px a verejná produkčná crawl kontrola stále nie sú prijaté.

## E1 – prílohy v opakovanom odoslaní (1. 10. 2026)

- GPT review 1: `RETURN WITH DEFECTS`, P2 pre snapshot súboru založený iba na metadátach. Zavedené SHA-256 nad skutočnými bajtmi vo `src/lib/lead-form-snapshot.ts`; používajú ho snapshot formulára aj cache uploadu v aktívnom `app/homepage-critical-client.tsx`.
- GPT review 2: obsahový P2 uzavretý; nový P2 pre odstránenie cache položky neskorým zlyhaním starého uploadu. Pridaná ochrana identity Promise cez `removeLeadPhotoUploadIfCurrent` a regresný test A zlyhá po tom, čo B prepíše rovnaký fingerprint.
- GPT review 3: `PASS`; nezávisle zopakovaný A/B súbeh potvrdil zachovanie B a presné opätovné použitie upload path bez duplicitného uploadu.
- Automatizované výsledky po oprave: `test:lead-form` 18/18; unit 78/78; PGlite integrácia 1/1; typecheck PASS; production build 86/86. Build warning NFT trace zostal.
- Hranice dôkazu: nie je vykonaný Vercel Blob upload, skutočný email/inbox, produkčný submit/deploy ani 390 px mobile browser test. Vizuálny prehliadač neodoslal formulár.

## E7 – read-only kontrola Google Ads/Meta Ads a atribúcie (1. 10. 2026)

- Google Ads: otvorený účet ASTANA, s.r.o.; zobrazené obdobie 24.–30. 9. 2026. Prehľad 6 kampaní vykázal 437 kliknutí, 18 659 zobrazení, 247,22 € nákladov a 0 konverzií. Dve aktívne kampane: „Azbest – bezpečne a legálne“ (270 kliknutí; 28,09 €) a „SK | Search | Azbest a eternit | Core“ (167 kliknutí; 219,13 €); obe 0 konverzií. Štyri kampane sú pozastavené. Core obsahuje 4 aktívne responzívne reklamy s finálnymi cestami `/cena-likvidacie-azbestu/`, `/likvidacia-azbestu/`, `/` a `/likvidacia-eternitu/`; textové zobrazované cesty nie vždy zodpovedajú finálnej ceste (napr. reklama „Nová strecha a strechári“ má finálnu `/` a zobrazovanú `/nova-strecha/bez-cakania`). Nepotvrdené, či viditeľné paths rozširuje Google automaticky.
- Meta Ads: dve aktívne reklamy `A02 | PLOCHA | WEBSITE LEADS` a `A01 | VLNITY | WEBSITE LEADS` smerujú na homepage s `material=plocha|vlnity`, `utm_source=facebook`, `utm_medium=paid_social`, `utm_campaign=astana_meta_2026_08`, samostatným `utm_content` a `#dopyt`. Editor pixel ukázal neaktívny stav/žiadne udalosti za posledných 7 dní. Tri ďalšie položky sú koncepty; neboli publikované.
- V aktuálnom pracovnom strome `rg` nenašiel `GTM-*`, `G-*`, `AW-*`, `gtag(`, `googletagmanager` ani Google tag deklaráciu. To nevylučuje Vercel/edge/CDN/GTM injekciu mimo repozitára. Meta klient po úspechu skúsi vyvolať vlastnú udalosť `astana:meta-lead` iba pri ID pixelu a marketingovom súhlase; v repozitári však nie je jej prijímač ani `fbq` volanie. Zároveň API vracia štandardné `{ ok, message, emailSent }` bez `metaLead`, takže response-based `dispatchMetaLead` vetva z API úspechu sa nespustí. Natívne spracovanie `meta_lead` query parametrov samo osebe nepreukazuje Pixel ani server-side CAPI odoslanie.
- Atribúcia: `src/lib/analytics-client.ts` zhromaždí UTM iba so súhlasom analytiky a gclid/fbclid iba so súhlasom marketingu, no `app/api/lead/route.ts` vytvára lead s `source: 'web'` a `rawData` bez týchto hodnôt. Samostatné consent-gated analytické eventy nemajú garantované prepojenie so stabilným lead ID; pri nesúhlase sa marketingové údaje vedome neukladajú. Preto interný lead/obratový report nevie spoľahlivo priradiť konkrétny dopyt kampani. Súhlas sa nesmie obchádzať.
- Záver/priorita: E7 P1 — treba jediný zdokumentovaný súhlasový kontrakt pre UTM/kampane a platformové konverzie; odosielať conversion event iba po potvrdenom prijatí dopytu (nie po kliknutí na submit), deduplikovať stabilným ID a oddeliť meranie od email delivery. Pred implementáciou overiť možné GTM/edge injekcie, Google conversion action, Meta Pixel/CAPI a consent mode v skutočnom deployi, aby sa nevytvorili duplicitné konverzie alebo nevyhovujúce cookies. Zároveň vyrovnať zobrazovanú/final URL len po kontrole cieľovej cesty a až po osobitnom potvrdení pred publikovaním zmeny live reklám.
- Hranice: všetky Ads kroky boli iba read-only; nebola vykonaná reklama, rozpočet, URL, pixel/tag, publikovanie, testovací lead, email, DB zápis ani deploy. Reportovaných 0 konverzií neznamená 0 leadov; časové okno a atribučné nastavenia sa môžu líšiť. Nulové konverzie sú účtový report, nie samostatný audit logov/Google tag diagnostiky.
- Nezávislý GPT kontrolór potvrdil zdrojové P1: lead bez atribúcie, chýbajúce Google Ads odoslanie v repozitári a nepreukázané Meta Pixel odoslanie. Odporučil najprv kontrolu GTM/deploy vrstvy a platformovej konverznej akcie; potom whitelistovanú consent-safe atribúciu v konkrétnom leade a jednorazovú konverziu až po potvrdenom API úspechu. Kontrolór neupravoval pracovný strom a jeho revízia sa nevzťahuje na produkčný runtime.

## E7 – consent-safe atribúcia ku konkrétnemu dopytu (1. 10. 2026)

- Klientská homepage aj spoločná/landing forma posielajú `leadAttribution` zo session úložiska. Server payload whitelistuje cez Zod, obmedzuje dĺžku a znovu kontroluje consent cookies: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` a prvá stránka zaznamenaná po analytickom súhlase iba pri analytics consent; `gclid`, `fbclid`, `gbraid` a `wbraid` len pri súčasnom analytics aj marketing consent. Validátor povoľuje bežné medzery v názve kampane a odmieta riadiace znaky/nebezpečné cesty. Click IDs sa odstránia zo session atribúcie pri odvolaní marketingového súhlasu.
- `raw_data` je už JSONB a `createLeadSubmission` ho ukladá, preto sa nepridáva DB migrácia ani sa nemení stabilný submission fingerprint/idempotency. Admin detail zobrazuje UTM, kreatívu, hľadaný výraz, prvú zaznamenanú stránku a nanajvýš názov platformy; surové click IDs nevykresľuje. Cookies/GDPR text vysvetľuje uloženie súhlasom povoleného zdroja spolu s dopytom a jeho retenciu.
- Nezávislý GPT controller prvýkrát vrátil `RETURN WITH DEFECTS` pre zamietnuté názvy kampaní s medzerou a nesprávne označenú cestu z formulára ako vstupnú; follow-up našiel aj CR/LF okraj pred trimom a zastaranú testovaciu cestu. Všetky opravené. GPT re-review: `PASS`; potvrdil medzery, odmietnutie CR/LF, first-page zachovanie a aktuálne testy.
- Aktuálna lokálna kontrola po oprave: `test:lead-form` 23/23, `test:unit` 80/80, PGlite 1/1, `typecheck` PASS, build PASS (86 rout, známy NFT trace warning a CMS fallback), `git diff --check` PASS (Git uvádza len LF/CRLF upozornenia). Behavior testy parsera nepokrývajú kompletný browser→DB tok.
- Bez preview/produkčného runtime, browser network/inbox/lead overenia, ani kontroly prípadného GTM/Vercel injektora. Nepridala sa Google/Meta konverzná udalosť, live Ads sa nemenili a nevznikol testovací lead/email.

### Rozšírenie atribučných polí (1. 10. 2026)

- Po read-only kontrole účtu Ads sa doplnili `utm_content`, `utm_term`, `gbraid` a `wbraid` v klientskom zbere, Zod serverovom allowliste, ukladaní ku konkrétnemu dopytu a admin detaile. Click ID ostáva skryté; Google identifikátory správne označia zdroj Google Ads. UTM polia vyžadujú analytický súhlas; click ID vyžadujú analytický aj marketingový súhlas.
- `npm run test:unit` 84/84, `npm run test:lead-form` 24/24, `npm run test:analytics` 5/5, `node --test scripts/analytics-consent-contract.test.mjs` 5/5, TypeScript PASS a `npm run build` PASS (86 rout). Známy NFT tracing warning ostal; počas buildu CMS a DB neboli dostupné a použil sa schválený statický fallback. `git diff --check` bez obsahových chýb, len bežné LF/CRLF upozornenia.
- GPT controller review presného rozšírenia je vyžiadaný a čaká na výsledok. Toto je zdrojový/build dôkaz, nie produkčné nasadenie alebo doručený lead. GTM/Vercel/Ads účty sa nemenili, konverzná udalosť sa nepridala a formular ani email sa neposlal.
- Prvý read-only controller vrátil P2: pri samotnom `wbraid` admin detail nerozpoznal Google Ads. Podmienka bola opravená a zdrojový regresný test teraz vyžaduje všetky tri identifikátory Google (`gclid`, `gbraid`, `wbraid`) bez ich zobrazenia. P3 pripomienku na behaviorálne overenie odvolania súhlasu pokrýva `marketing-consent.behavior.mjs`: po odmietnutí sa odstránia všetky štyri click ID a čakajúci Meta event, analytické UTM zostanú. Po oprave: `test:unit` 84/84, `test:analytics` 6/6, `test:lead-form` 24/24, typecheck PASS, build 86 rout PASS a `git diff --check` bez obsahových chýb (len LF/CRLF upozornenia). Nezávislý GPT-6 Astra re-review opraveného diffu čaká.
- Druhý read-only GPT-6 Astra review našiel P2, že súhrnný CRM report (lokálny aj PostgreSQL) poznal iba `gclid`, preto samotné `gbraid`/`wbraid` označil ako neznámy zdroj. Obe vetvy teraz klasifikujú všetky tri Google ID ako `Google Ads`. Behaviorálny test preveruje lokálny report; PGlite integračný test vytvára oddelený lead s každým braid ID a kontroluje databázový report. Po tejto úprave: `test:db-integration` 1/1, `test:unit` 84/84, `git diff --check` bez obsahových chýb. Predchádzajúci TypeScript/build po zmene SQL prešiel; následne sa menil už iba test. Finálny nezávislý GPT-6 Astra re-review: `APPROVE`, testy vyhodnotil ako dostatočné pre tento obmedzený rozsah. Výslovne nejde o potvrdenie deployu ani živého reklamného merania.

## E7 – CRM kohortový prehľad kampaní (1. 10. 2026)

- Admin analytika oddeľuje odhad návštev z consentovaných analytických udalostí od CRM kohorty dopytov prijatých v zvolenom období. Pri každej kampani zobrazuje agregované dopyty, vydané ponuky (iba odoslané/prijaté/odmietnuté/expirujúce, nie návrhy ani zrušené), prijaté ponuky a dopyty v objednanom/realizovanom/ukončenom stave. Hodnoty ponúk, reklamné náklady a tržby sa neuvádzajú.
- Produkčný PostgreSQL dotaz aj lokálny JSON fallback agregujú bez PII a surových click ID; zoradenie zdroj/typ/kampaň je deterministické aj pri limite 50 riadkov. PGlite integračný test používa zmiešané stavy ponúk a overuje počet iba vydaných/prijatých ponúk.
- Nezávislý GPT review: `PASS`. Po zosúladení jednotkového testu s aktuálnym UI textom: `npm run test:unit` 81/81, `npm run test:analytics` 5/5, `npm run test:db-integration` 1/1 a `git diff --check` PASS (iba štandardné upozornenia Git na LF/CRLF v pracovnom strome).
- Záverečný `npm run build` po zmene testu/dokumentácie: PASS, 86 rout; známy NFT tracing warning ostáva. Pri build-e nebol dostupný CMS a použil sa skontrolovaný predvolený obsah. Typecheck prešiel počas buildu.
- Je to lokálny kód a testovacie dáta, nie produkčný dôkaz. Report nebol nasadený; produkčná DB, browser, formulár, email, reklamy a účtové tagy sa nemenili. Export analytiky ostáva len pre existujúce návštevnostné dáta a nezahŕňa nový CRM kohortový report.

## E4 – most medzi schválenou administratívnou realizáciou a verejnou galériou (1. 10. 2026)

- Zdrojová kontrola našla, že verejné `/realizacie/` používalo iba statickú galériu, hoci administrácia ukladá aj záznamy `published` a databáza už poskytuje `listPublishedRealizations()`. Verejná stránka teraz používa práve tento filtrovaný dotaz s limitom 24 a päťminútovým ISR.
- Verejne sa nevykresľuje lokalita, výmera, autor ani ďalšie interné metadata. Obrázky sa normalizujú na lokálnu cestu `/assets/`; percent-kódovanie sa celé odmieta, aby sa v ďalšej URL parsovacej vrstve nedal obísť traversal alebo separator. Povolené sú iba obrazové prípony. Admin prijme relatívnu cestu alebo absolútny HTTPS odkaz iba z presnej ASTANA domény a uloží ho ako lokálnu cestu; cudzie/súkromné URL sa odmietnu s vysvetlením. Súkromné uploady ani cudzie hosty sa nezobrazujú.
- Vytvorenie a každá zmena stavu v admin realizáciách invaliduje `/realizacie`, takže `published → hidden` nečaká na ISR TTL. Textové karty používajú normálny tok rozloženia a dlhý popis sa neoreže do overlay; svetlý podklad má prednosť pred globálnym dôležitým gradientom.
- GPT kontrolór počas nezávislých kôl našiel P1 cache/audit a P2 pre kontrast, dlhý text, vstup URL a dvojito percent-kódovanú cestu. Všetky opravy sú aplikované; SQL/local rollback a 28 doplnkových kontrol normalizácie prešli. Záverečný GPT verdict: `APPROVE` pre tento kódový rozsah. Kontrolór výslovne nevykonal browser test, nový build, deploy ani reálne ISR invalidovanie.
- Po opravách: cielený policy/source test 2/2 PASS, celý unit balík 83/83 PASS, PGlite 1/1 PASS vrátane rollback fault-injection, TypeScript PASS, Next.js production build PASS (86/86 rout), `git diff --check` PASS s bežnými Windows LF/CRLF upozorneniami. Zostáva známy NFT tracing warning v API stope cez `db.ts`.
- Lokálny in-app browser accessibility tree načítal `/realizacie/` a existujúcu statickú galériu. DB pri build-e nebola dostupná, preto dynamické karty nebolo možné skontrolovať renderom ani na mobile. BrowserAct sa nespustil pre chybu oprávnenia k jeho logu mimo workspace. Produkčná DB, public preview, reálne image pathy, screenshot mobile/desktop a promočná invalidácia preto ostávajú overiť pred nasadením. Žiadne produkčné dáta ani formulár sa nemenili.

## E5 – súkromný foto-príjem, bezpečnostná kontrola (1. 10. 2026)

- Overené v zdroji: klientský upload odovzdáva `access: 'private'`; server vydá upload token až po platnej podpísanej relácii/pozvánke a obmedzí jeho cestu, MIME, veľkosť a platnosť. Cielená regresná kontrola teraz vyžaduje private access aj kontrolu serverovej relácie/origin. Vercel oficiálne uvádza, že režim určuje Blob store; private store súbory sa čítajú cez autorizovaný serverový `get()` endpoint. [Vercel Private Storage](https://vercel.com/docs/vercel-blob/private-storage) · [Vercel Client Uploads](https://vercel.com/docs/vercel-blob/client-upload)
- Lokálne overenie: fotoportál unit 7/7, celá unit sada 81/81, typecheck PASS, `git diff --check` PASS (iba Windows LF/CRLF upozornenia). Zmena v tejto etape je iba doplnený test; upload ani konfigurácia sa nemenili.
- Nezávislý bezpečnostný audit odporúča príjem nezapínať, kým sa nepreukáže, že konkrétny pripojený store je Private. `PHOTO_INTAKE_PRIVATE_STORE_VERIFIED=true` je len ručný príznak a neoveruje typ store. Produkčný store/token väzba, PostgreSQL migrácie, cron, reálny upload, anonymné/nesprávne autorizované čítanie a provider zmazanie/retry nie sú z tejto relácie overené; prijatie majiteľa retenčných lehôt 1/30/7/180 dní chýba. GPT-6 Astra re-review presného photo-intake balíka sa spustil, ale nevrátil výsledok a nie je započítaný ako schválenie. Príjem ostáva vypnutý.
- V tejto relácii sa pri pokuse vypísať iba konfiguráciu omylom objavila hodnota jedného tokenu z lokálneho `.env.local` v internom command outpute. Hodnota sa do dokumentácie neukladá ani v odpovedi neopakuje. Treba s tokenom zaobchádzať ako s prezradeným a otočiť ho vo Vercel pred ďalším použitím; Vercel konektor odmietol čítanie nasadení (403), CLI nie je nainštalované a z tejto relácie preto nemožno bezpečne overiť/otočiť produkčné tajomstvo. Žiadny upload, deploy ani zmena nastavení sa nevykonali.

## E5 – retenčná bezpečnosť a história súkromných fotiek (1. 10. 2026)

- Read-only audit identifikoval, že upload-completed callback a okamžité upratanie po odvolaní pozvánky mohli zmazať Blob podľa stavu načítaného pred súbežnou zmenou. Callback teraz objekt nikdy nemaže. Upratanie najprv v transakcii nárokuje iba `pending_upload` záznam s neaktívnou pozvánkou a bez čerstvého upload tokenu, čím ho uzamkne do `deletion_pending`; token mladší než 1 deň ponechá bezpečnú rezervu. Až po nároku sa volá Blob delete; úspech odstráni DB záznam spolu s auditom, chyba ponechá retry stav.
- Administrácia a worker história zobrazujú po 50 záznamov s deterministickým radením a navigáciou. Chyba DB sa zobrazuje ako chyba, nie ako „žiadne fotografie“.
- Regresný PGlite test pokrýva revoke-vs-confirm, ochranu čerstvého tokenu, atomický nárok na zmazanie a stránkovanie. Cielený photo policy test 7/7 PASS, kompletné unit 83/83 PASS, izolovaný DB integration 1/1 PASS, typecheck PASS, build PASS (86 rout). `git diff --check` bez obsahových chýb, iba bežné CRLF upozornenia.
- Build stále hlási známy NFT tracing warning (`next.config.mjs` → `src/server/db.ts` → `/api/lead`). GPT re-review tejto konkrétnej opravy sa nepodarilo spustiť pre limit súbežných agentov; výsledok nie je označený ako nezávislé schválenie.
- Lokálna evidencia nepokrýva produkčný Private Blob store, nasadený cron, reálne uploady/mazanie ani browser QA. Portál musí zostať vypnutý, kým sa nezávisle nepotvrdí súkromný store a retention politika.

## E7 – cieľová sekcia reklamy pre výmenu strechy (1. 10. 2026)

- V živom účte Google Ads bola read-only otvorená kampaň `SK | Search | Azbest a eternit | Core`, obdobie 24.–30. 9. 2026. Reklama „Meníte eternitovú strechu | Strechári nestratia deň | Ráno začneme my“ má final URL `https://likvidacia-eternitu.sk/`; zobrazovaná cesta `/nova-strecha/bez-cakania` sa nerovná skutočnej cieľovej URL. Za toto obdobie mala 38 kliknutí, náklady 50,34 € a 0 reportovaných konverzií. Účet ukazuje 4 aktívne reklamy v Core: 167 kliknutí, 219,13 € a 0 reportovaných konverzií. Tieto čísla nepreukazujú, že dopyty neprišli.
- Kódová kontrola potvrdila, že `/postup/` už obsahuje jedinečný obsah pre túto potrebu: koordináciu so strechárom, ranný príchod z Popradu a dopytové CTA. Aby nevznikla druhá takmer totožná SEO stránka, bol do tejto existujúcej sekcie doplnený stabilný fragment `#nadvazujuca-strecha`.
- Overenie pracovnej verzie: regresný test kotvy prešiel; celý `npm run test:unit` 84/84, `npx tsc --noEmit --incremental false` PASS, `npm run build` PASS (86 rout). Lokálny produkčný server otvoril `/postup/#nadvazujuca-strecha`, accessibility strom potvrdil cieľovú sekciu a CTA; screenshot potvrdil, že po otvorení je sekcia v zábere. Klik na CTA otvoril `/#dopyt` a formulár; jeho odoslanie sa nevykonalo. Build ponechal známy NFT tracing warning cez `db.ts` → `/api/lead` a skontrolované CMS fallbacky.
- Limit dôkazu: Ads zmena, preview deployment, live landing, tracking template/URL suffix, Google tag/konverzná akcia ani reálny lead/email neboli v tomto kroku vykonané. Pred úpravou reklamy treba skontrolovať tracking nastavenia a testovať cieľ v schválenom čistom preview.
