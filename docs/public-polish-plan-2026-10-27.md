# Nezávislé vizuálne a obsahové prijatie verejného webu

## Cieľ a rozsah

Na základe požiadavky majiteľa preveriť a doladiť všetky existujúce verejné podstránky: plnohodnotnosť, ľudskú slovenčinu, zmysluplné farby, rozloženie a jedinečné obsahové fotografie. Ide o ohraničenú korekciu pripraveného kandidáta, nie nový web alebo nové funkcie. Základ tvorí 35 URL zo sitemapy; verejná informačná stránka pre Gmail a 404 sú doplnkové kontroly.

Používateľom sú majitelia nehnuteľností, správcovia a strechári. Hlavné obchodné stránky majú pomôcť pripraviť nezáväzný dopyt; poradňa vysvetlí konkrétnu otázku a recenzie umožnia odovzdať skúsenosť. Existujúca informačná architektúra a obchodné pravidlá sa nemenia.

## Postup

1. Nezávislý GPT kontrolór posúdi skutočný render všetkých podstránok na počítači a mobile; oddelí technickú priechodnosť od vizuálneho prijatia. Druhý kontrolór preverí prirodzenosť a užitočnosť textov. Explorer zmapuje opakované fotografie a dostupné vlastné podklady.
2. Hlavný Codex integruje cielené opravy. Fotografie vyberie podľa skutočného obsahu záberu, bez pridávania neoverených miest, zákazníkov alebo výsledkov. Vznikne dohľadateľné rozdelenie fotografií medzi stránky a galériu.
3. Relevantné obsahové testy, kontrola jedinečnosti fotografií, produkčný build a lokálny prehliadač overia zmenený kandidát. GPT kontrolór následne nezávisle prevezme opravy a vydá PASS alebo RETURN WITH DEFECTS s konkrétnymi dôkazmi.

## Pravidlo fotografií

Každá obsahová fotografia bude mať jeden verejný kontext použitia naprieč webom. Fotografie použité na domovskej stránke, v službe, regióne, karte poradne alebo článku nebudú opätovne zaradené do hlavnej galérie. Rovnaká fotografia v JPEG/WebP, responzívne veľkosti a otvorenie náhľadu v lightboxe predstavujú jeden záber. Logá, ikony a zdieľacie metadata sa neposudzujú ako obsahové fotografie. Právne stránky nepotrebujú dekoratívny obrázok.

Majiteľ potvrdil originálne fotografie ASTANA, s.r.o. Nepoužijeme generovanie ani nové platené podklady. Popisky nebudú obsahovať hlášky o tom, že fotografia nepredstavuje autora recenzie či miestnu realizáciu. Nebudeme však záberu dodatočne vymýšľať adresu, zákazníka, výmeru ani dátum.

## Akceptácia

- Každá z 35 URL má zaznamenaný obsahový a vizuálny verdikt, nielen celkový dojem.
- Nezostáva otvorená potvrdená chyba grafiky, čitateľnosti, kontrastu alebo rozloženia v schválenom rozsahu.
- Odseky majú pohodlnú dĺžku riadkov, nadpisy jasnú hierarchiu a farby význam. Dlhé texty nie sú plošne vycentrované.
- Evidencia fotografií a automatická kontrola nezistia opakovaný obsahový záber; varianty sa zjednocujú podľa identity fotografie.
- Texty neobsahujú interné redakčné poznámky, umelé frázy, falošné dôkazy ani výplň bez prínosu.
- Kontrola na 1440/768/390/320 px pokrýva presahy, orezanie textov, kontrolné prvky, SEO dáta a odkazy. Reprezentatívne celé stránky sú skutočne vizuálne prezreté.
- Verejný dotazník zostáva krátky. Hviezdičky, súhlasy a manuálne schvaľovanie referencií zostávajú funkčné.

## Hranice

Bez zmien reklám, merania, súhlasových pravidiel, cien, odosielania cenových ponúk, databázových schém, administratívnych práv a súkromných fotografií. Neposielať reálne dopyty, recenzie ani e-maily. Nezasahovať do produkcie bez samostatného schválenia výsledného kandidáta. Po nezávislom prijatí pripraviť odovzdanie a zastaviť rozširovanie tejto etapy.

## Potvrdené doplnenie rozsahu počas auditu

Pri obsahovej kontrole bola zistená nedokončená informácia o uchovávaní samostatnej analytiky. Majiteľ v odpovedi na konkrétnu otázku určil **12 mesiacov**. K tomuto rozhodnutiu pripravujeme úzke vynútenie lehoty, aby verejné znenie nezostalo iba sľubom: samostatné udalosti, ich recovery, čítačky, denná údržba a budúce zálohy. Obchodný pôvod dopytov, finančné údaje, reklamné outboxy a súhlasy sa nemenia. Plán a izolované dôkazy sú v `analytics-retention-implementation-2026-10-27.md`. Staršie súkromné zálohy neboli čítané ani zmazané; ručná obnova vyžaduje osobitný postup. Zdrojová príprava nepotvrdzuje produkčné vykonanie a všetko zostáva v jednom novom kandidátovi čakajúcom na samostatné schválenie nasadenia.
