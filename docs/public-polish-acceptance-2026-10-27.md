# Verejné stránky ASTANA – prijatie grafiky a obsahu

Stav: **PASS – ZDROJ, LOKÁLNY KANDIDÁT A NEZÁVISLÉ PREVZATIE; NOVÝ BALÍK NIE JE NASADENÝ.**

Majiteľ 27. 10. 2026 po odovzdaní tohto výsledku výslovne schválil nasadenie správou „ano nasaď to“. Nasadenie a následná produkčná kontrola tvoria samostatný nadväzujúci krok; tento report zachováva pôvodné lokálne akceptačné dôkazy.

## Rozsah a identita

Audit a cielené opravy 35 existujúcich verejných URL zo sitemapy; navyše informačná stránka Gmailu a skutočná 404. Používateľ požadoval ľudské plnohodnotné texty, prehľadné farby, čitateľné rozloženie a neopakované originálne fotografie ASTANA. Recenzný formulár má byť prvý a hodnotenie má používať hviezdičky.

- Produkčné východisko: `c4272342b8207ff27aafa9508af831c1fe56df09`.
- Vetva: `codex/photo-oidc-hardening`; nové zmeny sa v tejto etape necommitovali, nepushovali ani nenasadili.
- Zostavený kandidát: `tmp/review-layout/candidate-1793099865231`, BUILD_ID `kbSH6Gh5iiJGQkOzZHw3n`.
- Overená zhoda všetkých **802 súborov** `app/`, `src/`, `public/` a zostavovacej konfigurácie s pracovným zdrojom: 0 rozdielov. SHA-256 súhrnu: `f5f94766a56989246b3c1def0e7e4436e86dee36579b7ba0499f1a88d8a70b34`.
- Oproti obsahovo prijatému `CutYIWNT_m0fzhq1O1GCf` sa zmenil iba `app/realizations-gallery-client.tsx`; ďalších 801 súborov je byte-identických. Dôkaz `tmp/public-polish-final/final-source-delta.json` umožňuje prevziať už vykonané plošné kontroly a poslednú zmenu overiť cielene.
- Izolovaný náhľad: http://127.0.0.1:3147/recenzie/#napisat-recenziu. Server nemá produkčné údaje ani tajomstvá; spojenia mimo loopback sú blokované.

## Opravy podľa nezávislej kontroly

| Nález | Výsledná oprava |
| --- | --- |
| F1 – opakované fotografie | Jedno centrálne rozdelenie 79 originálnych záberov medzi homepage, služby, regióny, poradňu, články a galériu. JPEG/WebP, transformácie a historické aliasy sa počítajú ako jedna identita. Upravené vecné popisy podľa skutočného záberu, bez domyslených miest, osôb, dátumov či výmer. |
| F2 – kontrast malých nadpisov | Čitateľná mätová na tmavom kariérnom bloku a tmavšia oranžová na svetlej stránke strechárov. Vlastné merania kontrolóra 9,51–11,53 : 1 a 5,96 : 1. |
| F3 – tlačidlo recenzie | Skutočné zelené pozadie, biely text, bez preberania červeného tieňa v normálnom stave, hoveri aj focuse. Meraný kontrast 6,66 : 1. |
| F4 – kariérny súhlas | Checkbox a jeden pružný textový blok, správne zalomenie vety aj odkazu na 390/320 px. Povinnosť a spracovanie súhlasu sa nemenili. |
| F5 – Cookies | Rovnaká poloha úvodu ako ostatné právne stránky, bez dvojitého veľkého odsadenia; dlhé texty rozdelené na odseky. |
| F6 – interné redakčné hlášky | Zákaznícke vysvetlenie výjazdu, krátka informácia o autorovi a zdrojoch článkov, prirodzený úvod galérie. Homepage, O firme a služby používajú stručný pokyn na overenie firmy podľa IČO. Datované zdrojové fakty zostali zachované v dátovej evidencii; nevzniká nové tvrdenie o aktuálnom stave registra. |
| F7 – mobilný filter galérie | Dlhý názov sa zalomí a vojde do dostupnej šírky. Po kliknutí aj klávesnicovom focuse sa čiastočne skrytý filter posunie celý do zobrazenia. Pointer focus nehýbe cieľom pred dokončením kliknutia. Browser potvrdil všetkých sedem filtrov kliknutím aj natívnym Tab v štyroch šírkach. |
| F8 – pravý okraj strechárskeho formulára | Mobilný vnútorný kontajner má najviac 100 % rodiča; odstránený 4-pixelový nesúlad šírky, bez skrývania textu ďalším overflow. |

Formulár recenzie je pred skúsenosťami a fotografiou, v mätovom paneli. Päť natívnych rádiových volieb má vizuálnu podobu hviezdičiek; zostali tie isté hodnoty 1–5, API, súhlas, identifikátor opakovania a následné schvaľovanie. Dlhé odseky majú obmedzenú čitateľnú šírku a zarovnanie doľava; obsahové kontajnery sú vycentrované. Opravený je aj pôvodne natiahnutý checkbox odporúčania strechára na homepage.

## Overenia a aktuálne hranice výsledku

| Overenie | Dôkaz / výsledok |
| --- | --- |
| Produkčný build a TypeScript konečného zdroja | PASS, 116 stránok/endpointov; `tmp/public-polish-final/final-build-gallery.txt` |
| Zhoda zdroja so zostaveným náhľadom | PASS, 802/802; `tmp/public-polish-final/candidate-source.json` |
| Fotografie | 79 identít, 79 odlišných JPEG SHA-256, 0 blízkych párov pri použitom DCT prahu; nezávislý render potvrdil 79 výskytov / 79 identít / 0 opakovaní. Logo, ikony, sociálne metadata, responzívne varianty a otvorenie toho istého náhľadu nie sú druhý obsahový záber. |
| Obsahové, SEO a fotografické testy | 41/41 PASS, `tmp/public-polish-final/content-unit-tests.txt` |
| Recenzie, súhlasy, súkromie, potvrdenia a izolácia štýlov | 20/20 PASS, `tmp/public-polish-final/review-unit-tests.txt` |
| Plošný nezávislý GPT vizuálny audit | 35 URL × 1440/390/320 px = 105 renderov na grafickom základe A1N4; per-URL matica, screenshoty a následné prevzatie delty v samostatnom reporte |
| Konečné nezávislé GPT vizuálne prijatie | **PASS pre `kbSH6Gh5iiJGQkOzZHw3n`, F1–F8 uzavreté.** Po 30 cielených regresných renderoch predposledného kandidáta kontrolór nezávisle prepočítal 802 hashov konečného kandidáta a overil jedinú deklarovanú deltu. Vlastných 42/42 stavov galérie (7 klikov + 7 natívnych Tab krokov × 1440/390/320 px), 0 orezaných názvov a 0 stratených klikov/fokusov. Dôkazy `tmp/gpt-public-visual-review/recheck-04-gallery/`, konečný verdikt `gpt-public-visual-review-2026-10-27.md`. |
| Automatický audit a prevzatie poslednej delty | Na `CutYIWNT…` 35 URL × 1440/768/390/320 px = 140 kontrol: metadata, canonical, FAQ/viditeľný text, interné odkazy, 79 fotografií, hlavné kontajnery, riadkovanie a orezanie textov bez inej chyby; dve konkrétne zlyhania F7 sa stali regresným dôkazom. Po jedinej zmene galériového klienta nový `kbSH6…` prešiel cielenými 4/4 kontrolami `/realizacie/`, vrátane 28 kliknutí a 28 natívnych Tab stavov, **0 chýb**. Súhrnná akceptácia neobsahuje nevyriešené zlyhanie; plný nový audit iných byte-identických stránok sa zbytočne neopakoval. `tmp/public-polish-final/browser-final/report.json`, `gallery-final/report.json`, `final-source-delta.json` |
| Konečný GPT obsahový audit | PASS pre `CutYIWNT_m0fzhq1O1GCf`; 35 URL a 103 FAQ otázok/odpovedí v plošnom kole, konečný retenčný odsek a zvyšky homepage/O firme potvrdené v delte. V konečnom `kbSH6…` sú všetky tieto obsahové súbory nezmenené; jediná delta je posúvanie galériového filtra. |
| Funkčné hviezdičky a odoslanie formulára | Predchádzajúce izolované kontroly 4 šírok: kliknutie 1–5, vyplnenie hviezdičiek, klávesnica/fokus, dotyk, bez JS, povinný súhlas, simulovaná chyba/opakovanie, zachovanie nízkeho hodnotenia a reset. Komponent sa odvtedy nemenil; konečný render kontroluje jeho rozmer a farebnosť. Dôkazy `tmp/review-layout/star-check.json`, `form-check.json`. Reálne odoslania: 0. |

Starší CSS test vyžadoval presne pôvodných 18 pravidiel a ich poradie, čo nezodpovedalo schválenému novému vzhľadu. Nahradili sa tieto implementačné počty vecným kontraktom izolácie: štýly patria iba recenznej route, žiadny nechránený globálny selector, jediná koreňová výnimka je značkovač načítania, povinné prezentačné kontexty a jednokolónový mobilný formulár. Samotný reálny vzhľad overuje browser a nezávislý kontrolór, nie tento zdrojový kontrakt.

## Majiteľom potvrdená lehota 12 mesiacov

Na otázku o chýbajúcej retenčnej informácii majiteľ odpovedal **12 mesiacov**. Pripravená implementácia sa týka iba samostatných štatistických udalostí, nie pôvodu dopytu, zákaziek, ponúk, účtovných dokladov, auditov alebo reklamných outboxov.

Aktívne čítačky/recovery a denný samostatný autentifikovaný cron uplatnia 12 kalendárnych mesiacov v UTC. Staré udalosti sa nevrátia cez oneskorený lokálny zápis; budúce zálohy surovú samostatnú analytiku vynechajú. Nový PG tok má vlastné spojenie s časovým limitom, SQL transakciu, rollback, bezpečné zachytenie chyby a ukončenie. Nezávislý kontrolór zopakoval lokálne/PGlite aj skutočné PostgreSQL 17 skúšky vrátane zablokovanej DB a vydal **PASS pre zdroj a izolované overenie**.

Sady implementátora 20/20, 53/53 a 19/19 sa prekrývajú a nesčítavajú sa ako unikátne testy. Presné príkazy a dôkazy sú v `analytics-retention-implementation-2026-10-27.md`, nezávislé prijatie v `gpt-analytics-retention-review-2026-10-27.md`. V superadmin analytike je nepresné „Celkom“ nahradené „Posledných 12 mesiacov“; ročný obchodný/finančný prehľad sa nemenil.

Produkčný cron ani prvé čistenie sa v tejto etape nespustili. Historické súkromné zálohy neboli čítané ani odstránené a môžu obsahovať staré štatistiky. Pri ručnej obnove sa musí analytika vynechať alebo vyčistiť pred sprístupnením systému; automatická restore brána neexistuje. Verejné znenie výslovne rozlišuje aktívny systém, dennú údržbu/výpadok, nové zálohy a tento postup pre staré zálohy.

## Čo tieto dôkazy nepotvrdzujú

Lokálny kandidát nepotvrdzuje produkčné nasadenie ani indexáciu Google. Neodosielali sa skutočné dopyty, recenzie, CP alebo e-maily. Produkčné nastavenia, tajomstvá, zákaznícke tokeny a súkromné fotografie sa nečítali. Dynamické verejné záznamy sú v izolovanom náhľade prázdne/fallback; render živých databázových referencií nie je týmto prijatý. Nevymýšľali sa recenzie na zaplnenie obrazovky. Izolovaný server môže po uplynutí ISR intervalu vypísať chýbajúcu produkčnú DB; ide o hranicu zámerne odpojeného náhľadu, nie dôkaz chyby ostrej prevádzky.

Kontrola používala lokálny Chromium/Edge. Fyzický Safari/iPhone, reálne Core Web Vitals a právna správnosť všetkých pôvodných lehôt neboli predmetom tohto grafického prevzatia. Zdrojové fakty a ceny sa nevymýšľali. Prípadné budúce verejné databázové fotografie musia naďalej prejsť existujúcim schvaľovaním.

## Ďalší ohraničený krok

Všetky potvrdené obsahové a grafické nálezy tejto etapy sú uzavreté; konečný vizuálny aj obsahový verdikt a izolované prijatie retencie sú PASS v uvedených hraniciach. Nový balík je pripravený na samostatné výslovné schválenie nasadenia podľa doterajšej požiadavky majiteľa. Produkcia musí ísť cez čistý izolovaný release, existujúce guardrails a overenie presnej kandidátskej zostavy; po povýšení preveriť HTTP/rozloženie aj skutočné vykonanie nového retenčného cronu. Úprava tejto etapy sama o sebe nie je povolenie na zverejnenie alebo spustenie produkčnej údržby. Po tomto odovzdaní sa rozsah ďalej nerozširuje.
