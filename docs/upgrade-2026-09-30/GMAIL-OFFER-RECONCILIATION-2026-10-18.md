# Zosúladenie ručne odoslaných cenových ponúk s Gmailom

## Cieľ

Admin nesmie zobrazovať cenovú ponuku ako neodoslanú, ak ju Jarka alebo Slávka preukázateľne odoslali mimo interného workflow. Zároveň sa nesmie odoslať ďalší email, prepísať nesprávny dopyt ani uložiť heslo do Gmailu.

## Overený východiskový stav (18. 10. 2026)

- Produkcia obsahovala 170 reálnych aktívnych ponúk v stave `PRIPRAVENA`.
- Read-only kontrola pripojeného Gmailu našla 397 správ s používanými názvami príloh cenových ponúk.
- Čísla ručne vytvorených dokumentov sa nezhodujú s novými číslami CP v adminovi, preto číslo nie je možné použiť ako samostatný kľúč.
- Bezpečná automatická zhoda vyžaduje presného príjemcu, odoslanie až po pôvodnom dopyte, identifikačný znak zákazníka alebo lokality a jedinečné priradenie jednej správy k jednej ponuke.
- Takto bolo pripravených 94 jednoznačných párov. Ostatné prípady zostávajú bez zmeny na manuálnu kontrolu.

## Bezpečnostné rozhodnutia

1. Gmail sa číta iba cez autorizované read-only pripojenie; heslo sa do ASTANA adminu neukladá.
2. Zosúladenie nikdy neposiela email a nevytvára koncept.
3. Stav sa zmení iba z `PRIPRAVENA` na `ODOSLANA`.
4. Uloží sa skutočný čas nájdenej správy, hash externého ID a auditná udalosť; telo správy ani Gmail ID sa do CRM neukladajú.
5. Jedno externé ID nemožno použiť pre dve ponuky.
6. Dopyt a zákazka sa posunú iba monotónne dopredu; pokročilejší stav sa nevracia späť.
7. Nejednoznačné prípady sa automaticky nemenia.

## Prevádzkový tok

1. Asistent alebo poverený superadmin vykoná read-only kontrolu odoslanej pošty.
2. Systém pripraví iba jednoznačné páry.
3. Schválený dávkový zápis zaeviduje odoslanie bez opätovného odoslania emailu.
4. Pri budúcej CP odoslanej ručne môže operátor v detaile použiť zbalenú voľbu „Už bola odoslaná mimo adminu“, zadať skutočný čas a potvrdiť dôkaz.
5. Nové CP odoslané priamo z adminu sa evidujú automaticky existujúcim workflow.

## Hranice

- Plne automatické periodické Gmail OAuth pripojenie vyžaduje samostatného Google OAuth klienta s rozsahom `gmail.readonly`; prihlasovacie heslo sa nesmie použiť ako náhrada.
- Kým nie je OAuth klient nakonfigurovaný, read-only kontrolu vykonáva pripojený asistent a admin poskytuje bezpečnú manuálnu zálohu.
- Ponuky bez jednoznačného dôkazu zostávajú otvorené; nejde o chybu, ale o ochranu obchodnej histórie.
