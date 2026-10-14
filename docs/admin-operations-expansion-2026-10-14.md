# Rozšírenie administrácie ASTANA — prevádzkové centrum

## Zámer

Majiteľ a tím potrebujú z jedného miesta vidieť, čo brzdí obchod alebo realizáciu,
bez toho, aby systém vykonal nevratnú alebo externú akciu. Primárna akcia je
otvoriť zdrojový záznam, overiť ho a manuálne rozhodnúť.

## Implementované vrstvy

- **Dnes:** automatické signály pre zaseknuté zákazky, ponuky bez reakcie,
  kapacitné kolízie, kvalitu dát, referencie a superadmin pohľadávky.
- **Globálne vyhľadávanie:** dopyty, zákazky, ponuky, žiadosti o referencie a
  faktúry. Finančné výsledky sa na serveri načítajú iba superadminovi.
- **Kontrola prevádzky:** obchodný lievik, kvalita dát, kapacita na 14 dní,
  kolízie, zaseknuté zákazky a zoznam follow-upov.
- **Centrum automatizácií:** viditeľná matica spúšťač → pripravený výsledok →
  schvaľovateľ → aktuálny stav.
- **Návrhový asistent:** bezpečná lokálna šablóna. Je jasne označená ako
  deterministická; nič neodosiela ani neukladá.
- **Navigácia:** Obchod, Realizácia, Financie, Marketing a Správa.

## Bezpečnostné hranice

- Cenová ponuka, email, platba, reklama, fotografia a odstránenie záznamu
  vyžadujú pôvodný manuálny postup.
- Finančné údaje sa nesmú načítať pre operátora.
- Vyhľadávanie nezobrazuje testovacie dopyty a zákazky.
- AI provider je fail-closed. Samotný env flag ho neaktivuje.
- Obsah návrhu sa v aktuálnom režime spracúva iba v prehliadači.

## Rozhodnutia pre výkon a údržbu

- Obrazovky sú serverové komponenty; klientský JavaScript používa iba lokálny
  editor návrhu.
- Nezávislé zdroje sa načítavajú paralelne.
- Kontroly sú odvodené z existujúcich dát bez novej duplicitnej databázovej
  pravdy a bez zásahu do verejného formulára.
