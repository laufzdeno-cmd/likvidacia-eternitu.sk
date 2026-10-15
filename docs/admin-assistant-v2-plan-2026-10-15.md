# Firemný asistent v2 – realizačný plán

Dátum: 15. 10. 2026  
Vlastník rozhodnutí: superadmin ASTANA  
Princíp: asistent pripravuje a prioritizuje, človek schvaľuje obchodné, právne a verejné kroky.

## Stav realizácie

- Hotové lokálne: etapy 1 a 2 — trvalá história behov, odolné dávkové spracovanie, pravdivý stav cronu a rolovo filtrovaná schvaľovacia fronta v pracovisku Dnes.
- Overené lokálne: typová kontrola, jednotkové a databázové integračné testy, produkčný build a vizuálna kontrola desktopu aj mobilu.
- Hotové lokálne: etapa 3A — deterministická predodosielacia kontrola CP, schválenie konkrétnej verzie, dôkaz pri ručnom výsledku a najviac jeden úspešný follow-up.
- Hotové lokálne: etapa 3B — bezpečná jednorazová zákaznícka odpoveď na CP. Odpoveď zákazníka je iba dôkaz na kontrolu; sama nemení obchodný stav.
- Hotové lokálne: etapa 4A — riadené dokončenie zákazky. Operátor pripraví nefinančné podklady, superadmin potvrdí náklady a finálne uzavretie; referencia vznikne iba ako neodoslaný koncept.
- Hotové lokálne: etapa 4B — vysvetlený návrh aktívneho a rolovo oprávneného vlastníka aj termínu, explicitné použitie alebo odmietnutie návrhu, ochrana pred zastaraným návrhom a súhrnné prevádzkové ukazovatele iba pre superadmina.
- Produkcia: stav každého vydania sa overuje podľa release manifestu a aktuálneho Vercel deploymentu; tento plán preto neuvádza časovo nestabilný stav nasadenia.

### Akceptačné dôkazy aktuálneho balíka

- Typová kontrola: PASS.
- Jednotkové a kontraktné testy: 565/565 + 39/39 PASS; cielené kontroly návrhov a metrík 10/10 PASS.
- Databázové integračné testy: 25/25 PASS; samostatne prešli aj lokálne a PostgreSQL kontroly dokončenia zákazky, odpovede na CP, automatizácie a referencií. Testy nepoužili SMTP, Blob ani produkčnú databázu.
- Produkčný build: PASS, 110 strán.
- Vizuálna a interakčná kontrola CP: 12/12 PASS pri šírkach 1440, 390 a 320 px; 0 externých požiadaviek a 0 odoslaných emailov.
- Vizuálna kontrola dokončenia zákazky: 13/13 PASS v šírkach od 1440 po 320 px; 0 odoslaných formulárov a 0 externých požiadaviek.
- Vizuálna kontrola pracoviska asistenta: 26/26 stavov PASS na 13 šírkach od 1440 po 320 px; 0 odoslaných formulárov a 0 externých požiadaviek.
- Vizuálna kontrola automatizácií a prevádzkových metrík: 52/52 stavov PASS na 13 šírkach od 1440 po 320 px; 0 odoslaných formulárov a 0 externých požiadaviek.
- Nezávislé kontroly agentov: PASS pre CP a odosielanie, dávkové spracovanie a stavy, oprávnenia fotografií/referencií, farebnú hierarchiu dokončenia a zákaz automatického publikovania.

### Prevádzkové rozhodnutie k termínu CP

- „24 hodín“ sa v tomto balíku nepočíta programovo; ide o interný cieľ 24 pracovných hodín.
- Každú konkrétnu cenovú ponuku pred odoslaním skontroluje a potvrdí oprávnený aktívny admin.
- Mená konkrétnych ľudí nie sú zapísané natvrdo. Oprávnenie vychádza z admin účtu a roly, takže zastupovanie sa dá meniť bez úpravy kódu.
- Špecifická ponuka môže po ľudskej kontrole zostať dlhšie rozpracovaná; systém ju nesmie automaticky odoslať iba kvôli času.

### Etapa 4B — pravidlá návrhov a metrík

- Návrh je iba pomôcka. Vlastník aj termín ostávajú pred uložením editovateľné a používateľ môže úlohu ponechať nepriradenú.
- Záťaž sa počíta deterministicky z otvorených interných úloh, aktívnych pridelených dopytov a splatných follow-upov. Remíza sa rieši stabilne interným ID; mená sa nekódujú natvrdo.
- Server pri použití návrhu znovu overí prihlásenie, CSRF, rolu, aktívny účet a revíziu zdrojových dát. Zastaraný návrh sa nepoužije.
- Audit rozhodnutia ukladá iba pevné kódy a technické údaje bez osobných údajov zákazníka. Prihlásený interný aktér ostáva v štandardnom auditnom poli identifikovaný účtom, aby bolo preukázateľné, kto návrh prijal alebo odmietol; táto identita sa nikdy neposiela do súhrnných metrík ani na verejný web.
- Prevádzkové ukazovatele porovnávajú posledných 30 dní s predchádzajúcimi 30 dňami, uvádzajú veľkosť vzorky, medián a p90. Nevyhlasujú odhad za dokázanú časovú alebo finančnú úsporu.
- Testovacie a odstránené záznamy sa do časových metrík nezapočítavajú. Výsledok CP sa meria iba po jej skutočnom odoslaní.

## 1. Zámer a používatelia

Interný asistent má skrátiť čas od prijatia dopytu po kvalitné rozhodnutie, znížiť počet zabudnutých krokov a dať majiteľovi preukázateľný prehľad o tom, čo automatizácia skutočne urobila.

- Operátor denne spracúva dopyty, cenové ponuky, follow-upy a zákazky.
- Superadmin robí rovnaké operatívne kroky a navyše schvaľuje citlivé zmeny, financie a publikovanie.
- Systém iba pripravuje koncepty, bezpečne opakuje idempotentné úlohy a meria výsledok.

Hlavná akcia po otvorení admina je vyriešiť najdôležitejší ďalší krok zoradený podľa rizika a termínu.

## 2. Overený súčasný stav a problémy

Existujú tri prepojené plochy: Dnes, Návrhy textov a Automatizácie. Cenové ponuky, žiadosti o referenciu a súkromné koncepty realizácií sa už dajú pripraviť bez automatického odoslania alebo publikovania.

Kritické nedostatky:

1. Beh asistenta nemá trvalú vlastnú históriu. Čiastočné zlyhanie modulu môže v technickom logu vyzerať ako úspech.
2. Limit sa pri ponukách aplikuje pred vyradením nekompletných kandidátov. Blokované záznamy môžu zadržať platné záznamy za nimi.
3. Fotografie sa opakovane čítajú iba z prvej strany. Staršia schválená fotografia sa nemusí dostať na rad.
4. Pripravené kroky sú rozdelené medzi viac obrazoviek a operátor nemá na jednom mieste primeranú schvaľovaciu frontu.
5. Chýba merateľný dôkaz prínosu: čo asistent pripravil, čo bolo blokované a ktorý modul zlyhal.

## 3. Cieľová architektúra

### A. Spoľahlivý vykonávací motor

- Každý beh má ID, spúšťač, začiatok, koniec a stav `running`, `succeeded`, `degraded` alebo `failed`.
- História ukladá iba počty, interné ID a pevné kódy dôvodov; nie mená, emaily, telefóny ani voľný text zákazníka.
- Vytváranie ostáva idempotentné, aby opakovaný cron nevytvoril duplicitnú CP, žiadosť alebo koncept.
- Nedostupný modul označí beh ako zhoršený a monitoring nedostane falošne zelený výsledok.
- Zablokovaný kandidát nezastaví ďalších kandidátov.
- Fotky sa vyberajú podľa toho, či ešte nie sú pripojené ku konceptu.

### B. Jedno operatívne centrum

- `/admin/asistent` ostáva hlavným pracovným centrom.
- Operátor vidí operatívne schválenia, ktoré smie bezpečne vykonať.
- Superadmin navyše vidí citlivé schválenia, zdravie automatizácií, financie a publikovanie.
- Pôvodné URL ostávajú funkčné ako detailné pracoviská.
- Ručné úlohy a ručné vykonanie každého kroku zostávajú zachované.

### C. Obchodné zrýchlenie

- Jedna karta zákazky so stavom a odporúčaným ďalším krokom.
- Kontrola úplnosti a obchodných rizík pred schválením CP.
- Bezpečná zákaznícka odpoveď na CP cez jednorazový odkaz.
- Najviac jeden vopred povolený follow-up CP.
- Sprievodca dokončením zákazky: dokumenty, náklady, fotky a referencia.
- Návrh vlastníka a termínu podľa kapacity, nie automatické priradenie bez možnosti zmeny.

### D. Meranie a zlepšovanie

- Úspech a zlyhanie podľa modulu.
- Počet pripravených, blokovaných a schválených krokov.
- Čas od dopytu po prvú CP a od CP po výsledok.
- Dôvody blokovania v pevnom slovníku.
- Regresné scenáre pre idempotenciu, oprávnenia, dávky a zákaz automatického odoslania.

## 4. Oprávnenia a bezpečnosť

| Krok | Operátor | Superadmin | Systém |
| --- | --- | --- | --- |
| Pripraviť koncept CP | áno | áno | áno |
| Upraviť CP a sprievodný list | áno | áno | iba návrh |
| Odoslať prvú CP | po kontrole | po kontrole | nikdy |
| Zaevidovať výsledok CP | áno | áno | nikdy bez dôkazu |
| Pripraviť žiadosť o referenciu | áno | áno | áno |
| Odoslať prvú žiadosť | podľa existujúcej roly a kontroly | áno | nikdy |
| Potvrdiť náklady a finálne uzavrieť zákazku | nie | áno | nikdy |
| Publikovať referenciu alebo fotografiu | nie | po osobitnom schválení | nikdy |
| Financie, mazanie a reklamy | nie | ručne podľa existujúcich pravidiel | nikdy |

Každá serverová akcia znovu overí prihlásenie, rolu, CSRF a aktuálny stav záznamu. Klient posiela iba ID a požadovanú zmenu, nie celý databázový záznam.

## 5. Poradie realizácie

1. História behov, produkčne bezpečná aditívna migrácia, oprava dávok a jasný stav cronu.
2. Rolovo filtrovaná schvaľovacia fronta v Dnes a prepojenie na existujúce pracoviská.
3. Predodosielacia kontrola CP, bezpečná odpoveď zákazníka a vopred povolený jednorazový follow-up.
4. Sprievodca dokončením zákazky, návrhy vlastníka a termínu, meranie prínosu asistenta.

## 6. Akceptačné podmienky prvej etapy

- Blokovaná CP nebráni vytvoreniu neskoršej platnej CP v tom istom behu.
- Schválená nepripojená fotografia sa dostane na rad bez ohľadu na vek alebo stránku pôvodného zoznamu.
- Opakovaný alebo súbežný beh nevytvorí duplikáty.
- Každý beh skončí trvalým stavom a má čas začiatku aj konca.
- Čiastočné zlyhanie je viditeľné v adminovi a v HTTP stave cronu.
- História neobsahuje osobné údaje zákazníkov.
- Asistent sám neodošle prvú CP ani prvú žiadosť o referenciu a nič nezverejní.
- Produkčný build, typová kontrola, relevantné integračné testy a vizuálna kontrola prejdú bez regresie.

## 7. Rozhodnutia mimo aktuálneho rozsahu

- AI model ostáva návrhovou vrstvou. Stavový automat, ceny, oprávnenia a publikovanie ostávajú deterministické.
- E-shop, PWA a dark mode teraz neprinášajú tomuto internému toku merateľný prínos.
- Reklamy, meranie verejného formulára, SEO obsah a odosielanie kampaní sa touto zmenou nemenia.
