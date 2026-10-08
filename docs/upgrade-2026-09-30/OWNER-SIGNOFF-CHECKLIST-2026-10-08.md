# Interný checklist potvrdení vlastníka firmy

**Stav:** `WAITING_FOR_OWNER`  
**Dátum vytvorenia:** 8. 10. 2026  
**Účel:** zhromaždiť na jednom mieste firemné fakty a ľudské dôkazy, ktoré nemožno bezpečne odvodiť z kódu, fotografií ani verejných profilov.

Tento dokument je interný pracovný podklad. Neobsahuje heslá, tokeny, prístupové údaje ani hodnoty premenných prostredia. Jeho vyplnenie samo osebe **nepovoľuje** nasadenie, zmenu cloudových zdrojov, odoslanie formulára alebo e-mailu, úpravu verejného profilu ani publikovanie fotografií. Každý taký krok má vlastnú akceptačnú a autorizačnú bránu.

## Ako sa checklist uzatvára

- Každé tvrdenie musí mať označenie `POTVRDENÉ`, `NEPLATÍ` alebo `NEVIEM / TREBA OVERIŤ`.
- Pri `POTVRDENÉ` sa uvedie interný odkaz na dôkaz, meno schvaľovateľa a dátum. Do repozitára sa nevkladajú osobné doklady, heslá ani tajomstvá.
- Verejný text sa smie zmeniť až po porovnaní potvrdenia s viditeľným obsahom, JSON-LD, `company.json`, `llms.txt`, e-mailmi a PDF.
- Ak sa odpoveď týka konkrétnej realizácie alebo fotografie, verejný rozsah musí byť výslovne užší než interný dôkaz.
- Kým nie sú splnené všetky požadované polia a nezávislá kontrola, dotknuté kritérium zostáva `PARTIAL` alebo `WAITING`.

## Súhrn otvorených potvrdení

| Kritérium | Potrebné potvrdenie alebo ľudský dôkaz | Stav |
|---|---|---|
| G03, F01 | Schválený cenový model, DPH, zahrnuté a vylúčené položky | `WAITING_FOR_OWNER` |
| G04, G11 | Najmenej päť reálnych realizácií, pôvod a práva k fotografiám, bezpečný verejný rozsah | `WAITING_FOR_OWNER` |
| G05 | Aktuálny rozsah oprávnenia, odborný garant/autor a dátum vecnej revízie | `WAITING_FOR_OWNER` |
| G08 | Správna kategória a kanonická adresa verejných profilov; pôvod a súhlas pri recenziách | `WAITING_FOR_OWNER` |
| O06 | Menovaný vlastník doručovania/retry, alert kanál a eskalačný čas | `WAITING_FOR_OWNER` |
| O09 | Retenčné lehoty a zodpovednosť za súkromné prílohy, CV a terénne fotografie | `WAITING_FOR_OWNER` |
| F03, F04, F08, F09, F12 | Živé formuláre bez fotografie, s fotografiami, aplikačné toky, oba inboxy a ľudské rozhodnutie pri stave `unknown` | `WAITING_FOR_RELEASE_EVIDENCE` |
| U04 | Skutočný fyzický mobil a podporované prehliadače | `WAITING_FOR_HUMAN_TEST` |
| U09 | Skutočný test čítačkou obrazovky | `WAITING_FOR_HUMAN_TEST` |
| U10 | Päť skutočných používateľských testov podľa akceptácie | `WAITING_FOR_HUMAN_TEST` |
| O10 | Finálny obchodný, vizuálny a prevádzkový sign-off konkrétneho deploymentu | `WAITING_FOR_RELEASE_EVIDENCE` |

## A. Cenový a obchodný model — G03, F01

Vyplniť pre konkrétnu verziu cenníka a uviesť dátum účinnosti.

| Pole | Odpoveď vlastníka | Interný dôkaz / poznámka |
|---|---|---|
| Je ASTANA, s.r.o. platiteľ DPH a aká sadzba sa má používať? |  |  |
| Dátum účinnosti schváleného modelu |  |  |
| Materiály a schválené minimálne, predvolené a maximálne sadzby |  |  |
| Čo presne zahŕňa orientačný výpočet na verejnom webe |  |  |
| Čo orientačný výpočet nezahŕňa |  |  |
| Kedy sa dokumentácia účtuje a kedy sa uvádza ako akcia 0 € |  |  |
| Kedy sa účtuje doprava, aká je predvolená sadzba a kto ju môže upraviť |  |  |
| Ako sa počíta spiatočná trasa a kedy možno kilometre ručne opraviť |  |  |
| Ktoré položky musí zákazník vždy vidieť oddelene v schválenej CP |  |  |
| Kto a akým krokom schvaľuje CP pred odoslaním |  |  |

### Obchodný sľub „do 24 hodín“

| Pole | Odpoveď vlastníka | Interný dôkaz / poznámka |
|---|---|---|
| Znamená 24 hodín prvú reakciu alebo hotovú nezáväznú ponuku? |  |  |
| Od ktorého okamihu lehota plynie |  |  |
| Platí cez víkendy a sviatky alebo iba v pracovné dni |  |  |
| Aké minimálne údaje musí dopyt obsahovať |  |  |
| Schválené znenie pravdivej výnimky pri chýbajúcich údajoch |  |  |

Potvrdenie musí rozlíšiť nezáväzný odhad na webe od individuálnej cenovej ponuky. Verejná kalkulačka ani existujúca ponuka nie sú samy osebe dôkazom schváleného cenníka.

## B. Reálne realizácie a fotografie — G04, G11

Vyplniť najmenej päť odlišných prípadov. Presná adresa, GPS, meno zákazníka, evidenčné čísla a iné osobné údaje ostávajú iba v internom dôkaze a nesmú sa prepísať do verejného webu.

| Prípad | ID alebo názvy fotografií | Približná zverejniteľná lokalita | Typ objektu a materiálu | Obdobie realizácie | Pôvod fotografií potvrdený | Právo zverejniť potvrdené | Schválil + dátum |
|---|---|---|---|---|---|---|---|
| 1 |  |  |  |  |  |  |  |
| 2 |  |  |  |  |  |  |  |
| 3 |  |  |  |  |  |  |  |
| 4 |  |  |  |  |  |  |  |
| 5 |  |  |  |  |  |  |  |

Pre každý prípad sa ešte potvrdí:

- či fotografia patrí tej istej zákazke ako ostatné fotografie v skupine;
- či na snímke nie je identifikovateľná osoba, ŠPZ, číslo domu alebo iný osobný údaj;
- či sa smie zverejniť obec, iba okres/kraj alebo vôbec žiadna lokalita;
- či je povolené použiť snímku na webe, sociálnych sieťach a v reklame samostatne;
- interný zdroj, schvaľovateľ a čas schválenia, ktoré zostanú neverejné.

Automatické odvodenie lokality z EXIF sa nepoužíva ako súhlas na publikovanie. Inventúra 179 JPG/WebP párov navyše nepotvrdila GPS, zoskupenie zákaziek ani práva.

## C. Oprávnenie a odborná revízia — G05

| Pole | Odpoveď vlastníka | Interný dôkaz / poznámka |
|---|---|---|
| Aktuálne platný dokument alebo potvrdenie oprávnenia |  |  |
| Vydávajúci orgán, číslo dokumentu, dátum vydania a platnosť |  |  |
| Presný aktuálny rozsah (napr. exteriér/interiér a príslušné kódy) |  |  |
| Nastala po 19. 9. 2024 zmena, obmedzenie alebo odobratie? |  |  |
| Meno a kvalifikácia odborného garanta alebo autora |  |  |
| Súhlas s verejným uvedením mena a kvalifikácie |  |  |
| Dátum poslednej vecnej kontroly právnych a odborných textov |  |  |
| Termín ďalšej vecnej kontroly |  |  |
| Meno osoby, ktorá vykonala vecnú kontrolu |  |  |

Verejný zoznam ÚVZ SR so stavom k 19. 9. 2024 je historický dôkaz, nie automatické potvrdenie aktuálneho stavu.

## D. Verejné firemné profily a recenzie — G08

| Pole | Odpoveď vlastníka | Interný dôkaz / poznámka |
|---|---|---|
| Schválená primárna kategória firemného profilu |  |  |
| Kanonická URL konkrétneho firemného profilu |  |  |
| Schválená kanonická webová adresa |  |  |
| Držiteľ alebo zodpovedný správca účtu |  |  |
| Kto smie meniť verejný profil |  |  |
| Pri každej recenzii: zdroj/permalink, pôvod a presný povolený úryvok |  |  |
| Rozsah povoleného použitia recenzií (web/schéma/reklama) |  |  |

Vyplnenie tejto časti nepovoľuje uložiť zmenu v Google ani inom verejnom účte. Text recenzie sa nekopíruje bez potvrdeného pôvodu a rozsahu súhlasu.

## E. Doručovanie, retry a eskalácia — O06

Neuvádzať heslá, tokeny, plné adresy logov s tajomstvom ani obsah zákazníckych e-mailov.

| Pole | Odpoveď vlastníka | Interný dôkaz / poznámka |
|---|---|---|
| Primárny vlastník kontroly nedoručených/`unknown` správ |  |  |
| Zástupca pri neprítomnosti |  |  |
| Kontrolované fronty a workery |  |  |
| Bezpečný externý alert kanál |  |  |
| Prevádzkové hodiny monitorovania |  |  |
| Prah alebo podmienka vzniku alarmu |  |  |
| Čas do prvej kontroly po alerte |  |  |
| Čas a podmienka eskalácie |  |  |
| Kto môže potvrdiť „nedoručené“ a spustiť ručný retry |  |  |
| Kde sa uchová stručný dôkaz kontroly bez PII |  |  |

Stav `unknown` sa nesmie automaticky zmeniť na neúspech ani opätovne odoslať bez kontroly poskytovateľa a inboxu.

## F. Retencia a mazanie súkromných údajov — O09

| Kategória | Retenčná lehota | Začiatok lehoty | Výnimka/legal hold | Právny alebo prevádzkový dôvod | Vlastník kontroly | Schválil + dátum |
|---|---|---|---|---|---|---|
| Dopyt a jeho súkromné prílohy |  |  |  |  |  |  |
| Kariérna žiadosť a CV |  |  |  |  |  |  |
| Pozvánka a neschválené terénne fotografie |  |  |  |  |  |  |
| Schválené interné originály realizácie |  |  |  |  |  |  |
| Verejné deriváty po odobratí schválenia |  |  |  |  |  |  |
| Auditné záznamy bez obsahu súborov |  |  |  |  |  |  |

Pred zapnutím mazacích úloh sa overí súlad lehoty, obnovenie pri chybe, väzba na audit a to, že databázový záznam nepredstiera zmazanie, kým súkromný objekt stále existuje.

## G. Ľudská prístupnosť a použiteľnosť — U09, U10

### Fyzický mobil a podporované prehliadače — U04

Každá dostupná kombinácia má samostatný riadok. `NEDOSTUPNÉ` musí mať dôvod a zostáva otvoreným dôkazom, nie PASS.

| Povinná kombinácia | Zariadenie, OS a verzia | Browser a verzia | Orientácia | Deployment, trasy a čas | Dôkaz bez PII | Nálezy |
|---|---|---|---|---|---|---|
| Desktop Chrome |  |  |  |  |  |  |
| Desktop Opera |  |  |  |  |  |  |
| Fyzický Android + Chrome |  |  |  |  |  |  |
| Fyzický iPhone/iPad + Safari, ak je dostupný |  |  |  |  |  |  |

Kontrolované trasy: dopyt, cena, realizácie, kariéra a admin detail. Kontrolované stavy: portrét/landscape podľa zariadenia, 200 % zoom, klávesnica pri desktopoch, plávajúce prvky a odosielacie stavy bez použitia cudzieho kontaktu.

### Skutočná čítačka obrazovky — U09

| Pole | Výsledok |
|---|---|
| Čítačka obrazovky, verzia a operačný systém |  |
| Prehliadač a verzia |  |
| Testovaný deployment a čas |  |
| Dopyt: chyba, odosielanie, úspech a opakovanie rovnakej chyby |  |
| Kariéra/referencia/strechár: prvý opravný prvok a stav |  |
| Nálezy a ich závažnosť |  |
| Tester a interný dôkaz |  |

### Päť skutočných používateľov — U10

Cieľ: najmenej štyria z piatich bez pomoci do 60 sekúnd nájdu cenu alebo úspešne odošlú výslovne schválený testovací kontakt. Testujúci nesmú dostať návod, kde majú kliknúť. Odoslanie kontaktu sa vykoná iba po samostatnom aktuálnom povolení; bezpečná úloha „nájsť cenu“ neodosiela formulár.

| Anonymné ID testera | Zariadenie/prehliadač | Úloha | Čas | Pomoc: žiadna | Úspech bez pomoci | Anonymné ID pozorovateľa a problém |
|---|---|---|---|---|---|---|
| 1 |  |  |  |  |  |  |
| 2 |  |  |  |  |  |  |
| 3 |  |  |  |  |  |  |
| 4 |  |  |  |  |  |  |
| 5 |  |  |  |  |  |  |

## H. Dôkaz živých formulárov a doručenia — F03, F04, F08, F09, F12

Každý mutačný test potrebuje samostatné aktuálne povolenie, jedinečné označenie `TEST-UPGRADE-...` a text „TEST – NEKONTAKTOVAŤ, NEPOSIELAŤ PONUKU“. Jeden výsledok sa nesmie preniesť na iný deployment.

### Dopyt bez fotografie — F03

| Pole | Hodnota |
|---|---|
| Odkaz na samostatné aktuálne povolenie testu |  |
| Testovacie ID, commit, deployment a čas |  |
| Presne jeden POST, jeden lead a jedna previazaná zákazka |  |
| Polia, atribúcia a prijatý stav overené |  |
| Žiadna automatická cenová ponuka |  |
| Bezpečný interný dôkaz bez kontaktov v repozitári |  |

### Dopyt s dvoma platnými fotografiami — F04

| Pole | Hodnota |
|---|---|
| Odkaz na samostatné aktuálne povolenie testu |  |
| Testovacie ID, commit, deployment a čas |  |
| Dve platné testovacie fotografie väčšie než 6 MB |  |
| Presne jeden lead a rovnaká väzba oboch súkromných objektov |  |
| Autorizované otvorenie a obsah/hash overené |  |
| Anonymné otvorenie odmietnuté |  |
| Retry nevytvoril duplicitu ani nestratil prílohu |  |
| Bezpečný interný dôkaz bez kontaktov a súkromných URL |  |

### Dopyt doručený do oboch inboxov — F08

| Pole | Hodnota |
|---|---|
| Výslovne schválené testovacie ID |  |
| Testovaný commit a deployment |  |
| Čas jedného odoslania |  |
| Očakávaný odosielateľ, príjemca a predmet |  |
| Interný inbox: doručené + bezpečný interný dôkaz |  |
| Zákaznícky inbox: doručené + bezpečný interný dôkaz |  |
| Prílohy alebo autorizované odkazy skontrolované |  |
| Potvrdené, že nevznikla automatická cenová ponuka |  |

### Rozhodnutie pri nejednoznačnom SMTP výsledku — F09

Vyplniť iba pri skutočnom stave `unknown`; bez dôkazu musí zostať nevyriešený.

| Pole | Hodnota |
|---|---|
| Interné outbox ID a provider ID, ak existuje |  |
| Skontrolovaný provider log bez uloženia tajomstva |  |
| Skontrolovaný príslušný inbox |  |
| Výsledok: doručené / preukázane nedoručené / stále neznáme |  |
| Rozhodujúci admin, dátum a čas |  |
| Stručný auditný dôkaz bez obsahu e-mailu a PII |  |
| Ak je povolený retry: samostatné výslovné potvrdenie |  |

### Kariérny a strechársky tok — F12

| Pole | Hodnota |
|---|---|
| Odkaz na samostatné aktuálne povolenie testu |  |
| Testovacie ID, commit, deployment a čas |  |
| Kariéra bez CV a s platným súkromným CV podľa kontraktu |  |
| Interný a zákaznícky inbox / bezpečne vysvetlený nedoručený stav |  |
| Opakovanie dokončilo pôvodnú žiadosť bez duplicity |  |
| Strechárska žiadosť po úspechu použila nové ID |  |
| Súkromný súbor nebol verejne dostupný |  |
| Bezpečný interný dôkaz bez kontaktov a súkromných URL |  |

## I. Finálny sign-off konkrétneho release — O10

Táto časť sa vypĺňa až po stagingu, nezávislej kontrole a produkčných smoke testoch.

| Pole | Hodnota |
|---|---|
| Zdrojový commit a nemenný manifest |  |
| Staging deployment a výsledok matice |  |
| Produkčný deployment a alias |  |
| Formulár bez fotografie / s fotografiou / obe schránky |  |
| Chrome / Opera / fyzický mobil / čítačka obrazovky |  |
| Obchodný a vizuálny checklist: počet PASS / celkom |  |
| Otvorené P0–P3 nálezy |  |
| Rollback bod a overenie |  |
| Schvaľovateľ, dátum a časová zóna |  |
| Odkaz na samostatné čerstvé povolenie produkčného nasadenia udelené tesne pred akciou; týmto checklistom sa povolenie neudeľuje |  |

Finálne `POTVRDENÉ` je platné iba pre uvedený commit a deployment. Nesmie sa preniesť na neskorší build bez opakovania primeranej regresie.
