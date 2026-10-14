# Admin ASTANA — operačný systém firmy

## Cieľ

Admin má viesť používateľa od dopytu cez cenovú ponuku, realizáciu a úhradu až po schválenú referenciu. Domovskou pracovnou obrazovkou je **Dnes**. Každá automatizácia iba pripravuje bezpečný návrh; obchodná správa, cenová ponuka, pripomienka, úradný dokument, fotografia ani referencia sa nesmú odoslať alebo zverejniť bez výslovného ľudského potvrdenia.

## Roly a hranice

- **Operátor** spracúva dopyty, pripravuje a jednotlivo schvaľuje komunikáciu, plánuje realizácie a uzatvára kontrolné kroky zákazky.
- **Super admin** má navyše financie, hromadné limity, pravidlá automatizácií, publikovanie obsahu a systémové nastavenia.
- Osobné údaje sa nesmú zapisovať do auditných metadata polí ani do verejných tokenov.
- Verejné tokeny musia byť náhodné, ukladané iba ako hash, časovo obmedzené a viazané na konkrétny účel.
- Testovacie, archivované alebo problémové záznamy sa nesmú zaradiť do automatických zoznamov na kontaktovanie.

## Pracovné celky a akceptácia

### P0 — denné riadenie

1. **Dnes** spája nové dopyty, zmeškané kontakty, ponuky bez reakcie, plánované úlohy, zaseknuté zákazky, referencie a iba pre super admina finančné riziká.
2. **Dokončovací checklist zákazky** ukazuje ponuku, faktúru, úhradu, náklady, doklady, fotografie, realizáciu a referenciu. Neexistujúci krok musí viesť priamo na miesto, kde ho možno doplniť.
3. **Centrum komunikácie** zobrazuje na jednej časovej osi auditované odoslania ponúk, pripomienok, referencií a ich výsledky doručenia.
4. **Stráženie zaseknutých zákaziek** pomenúva dôvod aj odporúčaný ďalší krok; nič nemení automaticky.
5. **Referencie a hodnotenia** podporujú výber oprávnených zákaziek, presný náhľad správy, manuálne potvrdenie odoslania, bezpečný 30-dňový odkaz, koncept referencie, samostatné schválenie a najviac jednu vopred povolenú pripomienku.

### P1 — vykonanie práce

1. **Follow-up ponúk** pripraví text podľa stavu a platnosti. Odoslanie vyžaduje samostatné potvrdenie admina.
2. **Plánovač** predvyplní údaje zo zákazky, umožní úpravu existujúcej akcie a upozorní na kolíziu času, pracovníkov a nepriaznivé počasie.
3. **Balík dokumentov** skladá pracovný list, odovzdávací checklist a podklady z už evidovaných údajov; nesmie predstierať právnu úplnosť ani ich odoslať na úrad.
4. **Realizácie** ponúknu schválené fotografie dokončenej zákazky do konceptu; publikovanie zostáva iba na super adminovi.
5. **Pohľadávky a platby** rozdelia neuhradené, po splatnosti, preplatené a nepriradené položky; finančné údaje sú iba pre super admina.
6. **Globálne vyhľadávanie** nájde dopyt, zákazku, ponuku, faktúru alebo lokalitu bez odhalenia finančných polí operátorovi.
7. **Kvalita dát** ukáže chýbajúci kontakt, vlastníka, termín, náklady, doklady a neobvyklé hodnoty.

### P2 — riadenie a inteligencia

1. **Obchodný lievik** meria dopyt → kontakt → ponuka → prijatie → realizácia → úhrada → referencia.
2. **Kapacita tímu** ukazuje zaťaženie, kolízie a voľné termíny; odmeny sú iba pre super admina.
3. **Asistent návrhov** sumarizuje dopyt a pripravuje odpoveď, follow-up alebo poznámku. Výstup je vždy označený ako návrh a nikdy sa sám neodošle.
4. **Centrum automatizácií** ukazuje pravidlo, spúšťač, čakajúce schválenie, posledný výsledok a bezpečnostnú hranicu.

## UX systém

- Navigácia: **Dnes**, Obchod, Realizácia, Financie, Marketing, Správa.
- Bežná primárna akcia je modrá; úspech zelený; upozornenie oranžové; červená iba chyba alebo nebezpečná akcia.
- Nulové metriky nesmú odsunúť dnešnú prácu pod prvú obrazovku.
- Mobil používa karty a postupné odhalenie detailu bez horizontálneho posunu.
- Každý stav musí mať textový význam, nie iba farbu.

## Kontrolná matica pred nasadením

- TypeScript, produkčný build a relevantné unit/integračné testy musia prejsť.
- Autorizácia, roly, CSRF, idempotencia, audit, ochrana osobných údajov a zákaz automatického odoslania musia mať samostatné testy.
- Referenčný verejný odkaz sa testuje s izolovanými dátami; počas QA sa neposiela skutočný zákaznícky e-mail.
- Desktop aj mobil sa vizuálne skontrolujú pre Dnes, zákazku, referencie, plánovač a prehľady.
- Nasadí sa presne otestovaný Git commit ako kandidát, vykoná sa produkčný smoke test bez zápisu a až potom sa ten istý kandidát povýši na produkciu.
- Po povýšení sa overí produkčný alias, verejné URL, prihlásenie, oprávnenia operátora/super admina a čítacie zobrazenie nových modulov.

