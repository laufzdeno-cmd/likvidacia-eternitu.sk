# Nezávislá kontrola produkčného vydania – zákazkové karty

Aktualizované 29. 10. 2026, 14:49 UTC. **Technické vydanie z 27. 10.: PASS v overenom rozsahu. Aktuálna prevádzka závislá od databázy: BLOCKED. Úplné používateľské prijatie: NEOVERENÉ.**

## Aktuálny prevádzkový blokér – 29. 10. 2026

**P1: databázový poskytovateľ odmieta spojenie po vyčerpaní kvóty.** Čítací post-check z 14:43:36 UTC na pôvodnom overenom databázovom cieli skončil kódom SQLSTATE `53000` a správou poskytovateľa: „Your account or project has exceeded the quota. Upgrade your plan to increase limits.“ Nevypisoval prihlasovacie údaje ani zákaznícke riadky.

Čerstvý 30-minútový agregát z 14:42:44 UTC uvádza **52 runtime chýb a 46 odpovedí 500/503**. Medzi ne patria `lead-email-delivery`, `admin-autopilot`, `application-notifications`, `gmail-price-offers`, mazanie leadových príloh a `meta-capi` (500), kariéra a analytika (503). Tieto počty sú súvisiace pohľady na prevádzku, nie 98 nezávislých udalostí. Dnešné pády nemožno zameniť za tri úmyselné staged-host 503 z pôvodnej kontroly.

HEAD ostáva `d9619032045aafc72593ede1919d1147183a0700`, hlavný alias stále ukazuje na ten istý aktívny deployment a pred zápisom tohto reportu bol pracovný strom čistý. Kontrolór znovu overil 29. 10. o 14:46 UTC domovskú stránku a login (200), canonical/indexáciu, private/noindex hlavičky a anonymné odmietnutie fiktívneho dokumentu (401). **Tieto dostupné stránky nepotvrdzujú funkčnosť databázy, adminových zápisov ani doručovania dopytov.** Reálny dopyt sa kvôli skúške neposielal.

Integrátor následne overil naviazaný Neon projekt `astana-crm-db`: plán **free**, správa cez Vercel, spotreba **110,3503 CU-h** v období 1. 10. – 1. 11. UTC. Endpoint bol v stave idle, s pozastavením zaznamenaným 27. 10. o 21:18:01 UTC. Kontrolór prečítal iba technické metadáta, nie zákaznícke riadky. Oficiálny cenník Neon pri nezávislom čítaní 29. 10. uvádza pre Free **100 CU-h mesačne na projekt**. [Neon – aktuálne limity Free](https://neon.com/pricing)

Naviazané Vercel resource metadáta o 14:48:43 UTC potvrdzujú konkrétny program **Free / `free_v3`** s položkou **100 CU-hours per project**. Rozsah programu je `installation`; zmena programu preto nemusí byť izolovaná iba na tento web. Katalógový stav resource `available` a `usageQuotaExceeded=false` nie je dôkazom fungujúceho SQL spojenia – priamy čítací pokus preukázateľne zlyhal na `53000`.

Prekročenie výpočtového limitu je preto **silná inferencia zo spotreby a cenníka**. API však neoznačilo presný vynucovaný limit; obdobie spotreby samo osebe nepotvrdzuje automatické obnovenie služby 1. novembra. Príčina vyčerpania ani jej prípadná súvislosť s týmto vydaním nie sú týmto auditom dokázané. Samotný text chyby nie je súhlasom s plateným programom. Kontrolór nič nekúpil, nemenil program či nastavenie endpointu, neopakoval migráciu ani browser upload a neurobil rollback. Fallback používa rovnakú databázu, preto návrat pracovného kódu na `2aed3508` tento limit nevyrieši.

Po obnovení dostupnosti overeného databázového zdroja treba zopakovať iba čítací stav, Gmail-off kontrolu a ohraničený SA/OP smoke. Najprv treba preveriť, či pôvodný technický upload nezanechal pending dokument; úspech ani cleanup nemožno teraz potvrdiť. Nejasný upload sa nemá slepo opakovať. Nižšie je zachované historické prijatie technického vydania, nie aktuálny prísľub bezchybnej prevádzky.

## Presné zdroje a nasadenie

| Úloha | Zdroj / deployment |
| --- | --- |
| Majiteľom schválený funkčný kandidát | `0913c256ebd26a9522fc76731549f1c3f4cc7600` |
| Pôvodná produkčná baseline | `366d64930a0860edae7b005f4be2f504430cfe68` |
| Kompatibilný návrat, pevne vypnuté nové funkcie | `2aed350865562a287d492419a6368d8d4e5c7bf9` / `dpl_EyBKqFhGZomQWYTSPdUo3hS1gitq` |
| Opravený jednorazový migračný pomocník | `164826891cedb162981ead898f8d8c2e116fc27d` |
| Aktívny produkčný kandidát | `d9619032045aafc72593ede1919d1147183a0700` / `dpl_h52xAdT38p24Z7pfr5zhmHWeTpDG` |

Produkčný projekt a tím zodpovedajú schválenému vydaniu. Povýšenie bolo zaznamenané kontrolovaným helperom o 19:42:21 UTC, s väzbou na kompatibilný fallback. Predtým bol povýšený false bridge, takže aktívnemu importu predchádzal kód s novými ochranami zápisu. Návrat na starý `366d6493` po nových zápisoch je neprípustný.

Kontrolór samostatne prehashoval **1 272 súborov** pripraveného aktívneho archívu: všetky sa zhodujú s Git blobmi `d9619032`. Záznam guardu má správny digest, pôvodnú baseline a presnú rollback väzbu. Od `16482689` sa aktívny commit líši iba zmenou verzovanej konštanty `false → true`. Oproti schválenému `0913c256` zostalo presne **33 explicitných bezpečnostných ciest**; verejné stránky, reklamné URL a meranie sa v tomto doplnku nemenili.

## Závislosť a bezpečný návrat

Ochrana vydania nebola plošne vypnutá. Jednorazová výnimka vyžaduje explicitný flag, pevnú baseline, schválený zdroj/povoleného potomka a presné Git odtlačky:

- `package.json`: `d8d238cd10296f0fb042fa24b6f0d302acac06c99ad2a72f1d151769990961cf`.
- `package-lock.json`: `0473042cc8834847dee1f9fd55e341451d1bc8a5685bc8b0bf9d71f265ea1d0b`.
- Jediná prípustná runtime zmena: pridanie `pdfjs-dist@6.4.299`.

Fallback nemožno zapnúť premennou `true`. Blokuje nové pracovné karty, importy, prílohy, oznámenia a nový Gmail tok. Pôvodný admin, CP, faktúry, platby, kalendár a úzke vyhľadávanie zostávajú použiteľné. Zachováva kanonickú cenu, neznámu cenu, riadený skutočný deň vrátane null, ročné projekcie a ochranu vymazania. Žiadne nové tabuľky ani originály sa pri návrate nemažú.

Nezávisle zopakované: **27 guard/deploy + 7 výnimka + 5 feature testov = 39 jedinečných testov PASS**. Feature testy boli zopakované aj na skutočnom aktívnom true zdroji. Prečítaný integračný browserový dôkaz false režimu potvrdzuje zachovanie ceny 1 230 € pri 0 m², riadeného dňa/null, neprítomnosť financií operátorovi a blokované nové URL/API.

## Migrácia a ochrana dát

Prvý pokus bezpečne skončil **pred DDL** na skúške obnovy: čerstvá aplikačná schéma neobsahovala dva historické produkčné stĺpce. Súvisiace doplnenie obnovuje chýbajúce primitívne stĺpce iba v pamäťovej kópii podľa validovaných metadát. Žiadny riadok ani neznámy stĺpec sa potichu nevynecháva; živé Ads dáta ani schéma sa týmto pomocníkom nemenia.

Kontrolór navyše našiel posun SQL DATE cez predvolený lokálny `pg` parser a stratu mikrosekúnd timestampov. Migračný Pool už pre OID 1082/1114/1184 zachováva text. Samostatný pg-wire test pri `Europe/Bratislava` potvrdil deň aj mikrosekundy. Ďalší nezávislý pamäťový test obnovil dva syntetické riadky vrátane serial 19, JSON, null a dvoch historických numeric/date stĺpcov; sekvencia mala bezpečnú ďalšiu hodnotu.

Čerstvý opravený produkčný export prešiel súkromným roundtrip/hash overením a odmietnutím anonymného čítania na presne overenom firemnom Blob store. Izolovaná obnova prešla: **60 tabuliek, 16 705 riadkov, všetky stĺpce a počty, dve historické kolóny, kontrolované sekvencie**. Ide o obnovu aplikačných riadkov do pamäťovej schémy; nie o tvrdenie o obnove celej infraštruktúry alebo súborových príloh.

Obe dopredné migrácie boli vykonané na jednom klientovi v jednej transakcii, s krátkym lock timeoutom a kontrolou zachovania pôvodných cien/dní. Záznam potvrdzuje **committed=true, 6/6 nových tabuliek, Gmail vypnutý**. Zákaznícke riadky neboli poslané kontrolórovi: export zostal v RAM, schválenom private Blob a stdin izolovaného dieťaťa bez prevádzkových tajomstiev a s blokovanou externou sieťou. Model dostal iba agregované výsledky.

## Historické živé kontroly – 27. 10. 2026

- Bridge aj aktívna verzia: domovská stránka **200**, správny canonical a `index, follow`; prihlásenie **200**, súkromné cache hlavičky a `noindex`.
- Fiktívne private document ID bez relácie: **401**, private/no-store/noindex.
- Prázdny neprihlásený upload: **401**. Bez súboru a bez vytvoreného záznamu.
- Neprihlásené import/Gmail/ročný prehľad: **307 na login**, private/no-store/noindex.
- Integrátorov čítací dôkaz: cenová stránka, recenzie, kontakt a postup **200**, canonical produkčný alias zodpovedá aktívnemu kandidátovi.
- V prvom krátkom postdeploy okne kontrolór prečítal **0 runtime chýb**. Tri 503 zodpovedali vopred očakávaným private kontrolám na staged unique hoste. Tento historický výsledok neplatí pre dnešný databázový výpadok; aktuálny `after-observability.json` už obsahuje nový agregát z 29. 10.

Pred vydaním sa samostatne reprodukoval starší `application-notifications` cron 503. Tento report ho neoznačuje za opravený. Celá stará unit sada tiež nie je PASS: nezávislé porovnanie predchádzajúcej etapy doložilo 15 existujúcich spoločných pádov bez nového názvu zlyhania.

## Prihlásený tok a neoverené časti

Integrátor pred otvorením výberu súboru úspešne videl prázdny SA formulár. Ide o jeho pozorovanie; kontrolór nevykonal vlastný prihlásený produkčný tok. Browser operácia následne zostala nedokončená a 29. 10. skončila chybou `native pipe closed`. **Úspešný produkčný upload, vyčítanie digitálneho PDF, zhoda bytes, fotografie/WebP a cleanup nie sú potvrdené.** Rovnakú hranicu má živá OP relácia. Lokálne source/browserové prijatie tieto živé body nenahrádza a browser skúška sa neopakovala.

Gmail má zostať vypnutý a toto vydanie ho neaktivovalo. **Posledná úspešná databázová kontrola vypnutia je z 27. 10.** Deploy bol pripravený s overovacím flagom false; aktuálny databázový stav konfigurácie a starých spojení sa 29. 10. pre kvótu nepodarilo znovu prečítať. Skutočná schránka, Google súhlas/overenie a odosielanie skutočného zákazníckeho emailu nie sú týmto prijaté. Kontrolór nevytvoril skúšobnú produkčnú CP, platbu ani zákazku a neposlal zákaznícky email.

## Dôkazy

- Zdrojové prijatie: `docs/gpt-job-workspace-review-2026-10-27.md`.
- `test-results/job-workspace-release-independent-final-guard.log`, `job-workspace-release-independent-exception.log`, `job-workspace-release-independent-active-feature.log`.
- `test-results/job-workspace-release-independent-restore.json`, `job-workspace-release-independent-backup-date.json`.
- `test-results/job-workspace-release-independent-archive.json`, `job-workspace-release-independent-active-source.json`.
- `test-results/job-workspace-production-migration.json`, `job-workspace-production-migration-attempt1.json`.
- `test-results/job-workspace-release-independent-bridge-http.json`, `job-workspace-release-independent-active-http-2026-10-27.json`, `job-workspace-release-independent-negative-http.json`.
- Aktuálne: `test-results/job-workspace-production-post-state.json`, `job-workspace-production-neon-quota.json`, `job-workspace-production-resource-health.json`, `job-workspace-release-independent-active-http-2026-10-29.json`.
- `tmp/job-workspace-release/active-promotion-result.json`, `active-live-check.json`, `after-observability.json`.

Toto je konečný report ohraničenej kontroly vrátane nového prevádzkového blokéra. Aplikačný kód kontrolór nemenil; pridal iba tento dokument a ignorované dôkazy. Prevádzkové obnovenie databázy a zostávajúci prihlásený smoke sú samostatné otvorené kroky, nie dôvod na ďalšie rozširovanie funkcií.
