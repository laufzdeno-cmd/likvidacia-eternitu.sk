# Inventúra dôkazov realizácií — 8. 10. 2026

## Výsledok

- Repozitár obsahuje **179 JPG** a **179 WebP** súborov s rovnakými základnými názvami `azbest-001` až `azbest-179`.
- V žiadnom zo 179 JPG súborov sa nenachádza EXIF GPS IFD odkaz. Z týchto pracovných kópií preto nemožno spoľahlivo odvodiť miesto fotografovania.
- Statická galéria zámerne používa opis činnosti a typ objektu bez lokality, výmery, dátumu alebo tvrdenia, že jednotlivé fotografie patria k jednej konkrétnej zákazke.
- Databázový publikačný tok už vyžaduje interné schválenie práv, približnej lokality, obsahu a aspoň jednej schválenej očistenej fotografie z rovnakej CRM zákazky. Tento bezpečný tok však spätne nedokazuje pôvod starších statických súborov.

## Dôsledok pre akceptáciu

Veľký počet fotografií nie je náhradou za päť doložených prípadov. G04 a publikačná hardgate G11 zostávajú **WAITING**, kým vlastník pre najmenej päť realizácií nepotvrdí:

1. ktoré fotografie patria k rovnakej zákazke,
2. približnú verejne použiteľnú lokalitu bez presnej adresy,
3. typ objektu, materiál a rozsah, ktorý možno pravdivo zverejniť,
4. právo fotografie verejne použiť,
5. interný zdroj, schvaľovateľa a dátum schválenia.

Presná adresa zákazníka, GPS súradnice, meno zákazníka ani iné osobné údaje sa nesmú preniesť do verejného HTML, API, metadát alebo analytiky. Ak vlastník dodá originálne fotografie s GPS, súradnice možno použiť iba interne na výber približnej obce alebo okresu a pred publikovaním sa musia z výstupného obrázka odstrániť.

## Opakovateľná kontrola

Skript `scripts/realization-evidence-inventory.test.mjs` kontroluje počet a párovanie pracovných JPG/WebP súborov, absenciu EXIF GPS odkazu, bezpečný text verejnej galérie a zachovanie stavu WAITING v akceptačnej matici. Neoveruje autorské práva ani skutočný pôvod fotografií; tie vyžadujú ľudské potvrdenie.
