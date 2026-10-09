# Úprava náhľadu podľa pripomienok majiteľa — 9. 10. 2026

## Analýza pred úpravou

Rozsah je iba úvodná stránka: čitateľnosť, kompaktnejší orientačný výpočet a správna fotografia hospodárskej budovy. Cieľ návštevníka zostáva nezáväzný dopyt. Nové stránky, integrácie ani zmeny odosielania nie sú potrebné.

- V aktuálnom náhľade má nadpis `#preco h2` farbu `rgb(16,24,39)` na tmavom modrom gradiente. Nový nadpis nemá vlastnú farbu. Oprava bude v existujúcom CSS module úvodnej stránky.
- Kalkulačka má pri šírke náhľadu 1265 px výšku približne 819 px. Veľký nadpis, odsadenia a ďalšie pole obce zbytočne predlžujú cestu k dopytu. Zmenšíme typografiu a medzery, skrátime úvod bez odstránenia cenových výhrad. Ovládacie prvky zostanú použiteľné na mobile aj klávesnicou.
- Pole obce odstránime iba z kalkulačky na úvodnej stránke. Povinná obec v dopyte ostane. Existujúci inicializátor už podporuje chýbajúce pole kalkulačky; prenos výmery/materiálu nevymaže obec vyplnenú v dopyte.
- Vybraný materiál potrebuje explicitnú bielu farbu na bordovom pozadí aj cez mobilné globálne pravidlá.
- Fotografia `azbest-057` je existujúci verejný reálny záber dlhej hospodárskej budovy s vlnitou krytinou. Nahradí iba homepage kartu s baleným odpadom, vrátane zodpovedajúceho titulku a alt textu. Lokalitu ani presný účel budovy nedopĺňame bez dôkazov.

## Overenie a hranice

Zachovať presný obsah formulára, navigáciu, kontakty, súhlasy a odosielanie. Pridať regresné testy pre odstránené pole, zachovaný prenos a nové farby/fotografiu. Overiť nový izolovaný náhľad na počítači a pri šírkach 320 a 390 px, vrátane kontrastu a vodorovného pretečenia. Bez skutočných odoslaní, produkčných zmien alebo nasadenia. Majiteľ najprv schvaľuje náhľad.

## Výsledok

- Náhľad: `http://127.0.0.1:61779/`, PID 35940, runtime `C:\Users\Zdeno\AppData\Local\Temp\astana-owner-preview-Rf7Ul0`.
- Odtlačok 305 zdrojových/konfiguračných súborov: `595ff0b114df533d523db790a47772735e47450e2698646d58c022302426a674` (nezahŕňa celý public ani celý release).
- Prehliadačová matica ukončená 2026-10-09T06:48:26.951Z: **18/18 PASS** (šesť trás × 1440, 390, 320 px). Nulový vodorovný presah, nulové JS chyby, nulové chybné verejné assety, nulové externé požiadavky a odoslané formuláre. Lokálne dátové kolekcie ostali prázdne.
- Homepage kalkulačka: výška 494 px pri 1440 px, 645 px pri 390 px, 729 px pri 320 px. Všetky štyri rozsahy pri 500 m² sa zmestia dovnútra cenového panelu. Tlačidlá majú aspoň 44 px; dva riadky ostávajú aj na mobile.
- Potvrdené biele nadpisy a názvy dôkazov na tmavom pozadí pri všetkých šírkach; bordový štítok na svetlom mobile a biele písmo aktívneho materiálu. Mobilná kontrola odhalila aj staršie konflikty názvov v trust bloku a svetlého štítku kalkulačky, ktoré sa opravili v tomto lokálnom module.
- Pri zmene výmery na 130 m² a výbere hladkého eternitu sa preniesli iba správne hodnoty. Existujúca obec ostala zachovaná, email prázdny, GDPR nezaškrtnuté. Samostatná stránka ceny si ponechala vlastné pole obce aj fungujúci prenos.
- **49/49 cielených testov**, typová kontrola PASS. Hash test naďalej chráni presnú nezmenenosť formulára, dopytovej sekcie a navigácie oproti predchádzajúcemu kandidátovi.
- Nezávislý GPT kontrolór Fermat: **PASS kódu**. Jeho jediný nález, možný presah ceny pri 320 px, bol opravený pre samotnú cenu aj vnorené span prvky a následne potvrdený vyššie uvedeným browser testom.
- Hlavný agent vizuálne prezrel desktopovú kalkulačku, mobilný trust blok/kalkulačku a tri fotografie. V runtime sú `verification.json`, `calculator-{1440,390,320}.png`, `trust-{1440,390,320}.png`, `gallery-{1440,390,320}.png` a celostránkové snímky.
- Kontrola podľa React best practices: bez nového klientského JavaScriptu, efektov alebo dátových volaní; natívne označené ovládacie prvky, lazy loading existujúcich reálnych obrázkov a izolované štýly homepage.
- Predchádzajúce vlastné náhľady MvmwbX, 98X4vo, g7NHJH a 5ThXLd boli cielene zastavené; ich súbory sú zachované. Produkcia, DB, SMTP, formulárové API, tracking a prihlasovanie sa nemenili. Toto nie je nový produkčný build ani schválenie celého projektu.
