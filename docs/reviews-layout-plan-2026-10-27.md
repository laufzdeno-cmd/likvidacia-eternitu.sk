# Recenzie a čitateľnosť verejných podstránok

## Zámer a hranice

Existujúci slovenský web získava dopyty na likvidáciu azbestu a eternitu. Táto ohraničená úprava pomáha zákazníkovi po dokončenej práci rýchlo odovzdať skúsenosť a návštevníkovi pohodlne čítať verejné podstránky. Primárna akcia na stránke recenzií je vyplniť krátky formulár. Zoznam schválených skúseností je druhý v poradí.

Nepridávame stránky, nové obchodné sľuby, hodnotenia, integračné služby ani ďalšie polia. Existujúca architektúra, sitemap a interný graf ostávajú zachované. Nová konkurenčná analýza ani zmena kľúčových slov by nepomohli vyriešiť toto konkrétne poradie a čitateľnosť. Zmeny nezasahujú do reklám, dopytového formulára, súhlasov, súkromných dát a schvaľovania referencií.

## Návrh

1. Nahradiť veľký úvod s fotografiou krátkym nadpisom a vysvetlením. Hneď pod ním bude vycentrovaný panel formulára so svetlou mätovou/modrou plochou, tmavým textom a jasným tlačidlom. Fotografia a vysvetlenie publikovania budú nižšie, spolu s užitočnými odkazmi.
2. Zachovať jednu H1 a sprístupniť formulár stabilnou kotvou `/recenzie/#napisat-recenziu`. Verejný odkaz funguje aj samostatne. Admin používa súkromný 30-dňový odkaz `/recenzie/<token>/`, spojený s konkrétnou zákazkou. Automatický asistent pripravuje žiadosti v stave `pending_approval`; odoslanie aj publikovanie ostávajú schvaľované.
3. Rovnakú vizuálnu rodinu formulára zachovať aj na súkromnej stránke. Nemeníme tokeny, identifikátory odoslaní, validáciu, časový limit, ochranu proti opakovanému odoslaniu, súhlas ani API.
4. Prejsť všetkých 35 verejných URL a tri základné šírky pred zmenou. Zjednotiť čitateľnú dĺžku riadkov, pomer riadkovania, odstupy od nadpisov a centrovanie kontajnerov len v obsahových šablónach. Dlhé odseky zarovnať doľava, titulky zalamovať prirodzene. Zasahovať len tam, kde meranie alebo vizuálna kontrola nájde problém. Pri kontrole sa navyše našiel natiahnutý checkbox na odporúčanie strechára na mobilnej homepage; oprava sa týka iba jeho rozmerov a vizuálneho uloženia textu.

## Výkon a správa

Použijeme existujúci Next.js a spoločný formulár. Žiadny nový balík ani klientsky JavaScript. Štýly recenzií ostanú v ich existujúcom layoute. Typografia je obmedzená na verejné obsahové šablóny; jedinou opravou na homepage je rozmer a uloženie checkboxu. Admin sa nemení. Fotografia ostáva existujúca verejná fotografia ASTANA; posunutá nižšie nebude mať vysokú prioritu sťahovania.

## Doplnenie podľa majiteľa

Výber hodnotenia bude päť klikateľných hviezdičiek namiesto textového rozbaľovacieho zoznamu. Použijeme natívnu skupinu rádiových tlačidiel s rovnakým názvom `rating`, hodnotami 1–5 a pôvodnou východiskovou hodnotou. Zostane funkčná klávesnicou aj bez JavaScriptu. Vizuálne skryté vstupy budú mať slovenské názvy pre čítačky; hviezdičky budú mať minimálne 44 px klikateľnú plochu. Nebude potrebný nový balík, React stav ani zmena API.

Majiteľ potvrdil vlastné originálne fotografie demontáží ASTANA, s.r.o. Popisky majú prirodzene opisovať prácu a nesmú obsahovať formulácie o tom, že fotografia nepredstavuje autora recenzie alebo neoznačuje realizáciu. Odstrániť aj podobné vedľajšie výhrady v popiskoch na ďalších verejných stránkach. Fotografie na regionálnych stránkach sa označujú ako vlastná fotodokumentácia ASTANA bez priraďovania novej neoverenej adresy zákazky. Vecné odborné informácie o azbeste a existujúce pravidlá schvaľovania zostávajú zachované.

## Dokončenie a dôkazy

- Formulár je prvá funkčná sekcia recenzií pred fotografiou a schválenými hodnoteniami.
- Kontrast textov minimálne 4,5:1, zreteľný klávesnicový fokus a mobilné ovládacie prvky bez pretekania.
- Rovnaký formulár funguje verejne aj cez súkromný odkaz; pozitívne a negatívne odpovede prechádzajú rovnakou kontrolou.
- Všetkých 35 verejných URL preveriť pri 1440, 768, 390 a 320 px. Kontrolovať H1, metadáta, FAQ, kotvy, obrázky, riadkovanie, orezanie a presahy textu. Ručne prezrieť reprezentantov každého typu šablóny.
- Produkčný build a príslušné existujúce testy referencií/SEO musia prejsť. Lokálne overenie používa izolovanú kópiu bez produkčných tajomstiev; nič neposiela reálnym zákazníkom.
- Nový rozsah je po dokončení pripravený na samostatné výslovné schválenie produkčného nasadenia. Predchádzajúci súhlas sa týkal kandidáta `c4272342`.
