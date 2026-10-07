# Právna faktická kontrola — 7. 10. 2026

Rozsah kontroly: verejné vysvetlenie postupu, homepage a stránka „Ako to prebieha“, administrácia zákazky, sprievodný e-mail cenovej ponuky a PDF cenovej ponuky. Kontrola nemenila produkciu, databázu, formuláre ani e-mailové doručovanie.

## Potvrdené aktuálnym právnym zdrojom

- Časová verzia zákona č. 355/2007 Z. z. účinná od 1. 8. 2026 do 31. 12. 2026 v § 41 ods. 13 stanovuje, že držiteľ oprávnenia písomne oznámi každé plánované odstraňovanie azbestu príslušnému orgánu verejného zdravotníctva vrátane požadovaných dokladov najneskôr 30 dní pred začatím prác.
- § 41 ods. 14 upravuje osobitný režim pri mimoriadnej havarijnej alebo živelnej udalosti: oznámenie vrátane dokladov sa podáva najneskôr do 48 hodín od začatia neodkladného odstraňovania.
- § 41 ods. 6 uvádza vydávanie oprávnenia na dobu neurčitú; zánik alebo odobratie oprávnenia upravujú ďalšie odseky. Samotné historické uvedenie subjektu v zozname preto nie je náhradou za aktuálne overenie, že odvtedy nenastal dôvod zániku alebo odobratia.
- § 41 ods. 8 rozlišuje rozsahy pre interiér s kontrolovaným pásmom, exteriér a malé uzatvorené priestory do 10 m³.

Oficiálny zdroj: [Slov-Lex — zákon č. 355/2007 Z. z., znenie účinné od 1. 8. 2026](https://static.slov-lex.sk/static/SK/ZZ/2007/355/20260801.print.html).

## Stav verejných tvrdení ASTANA

- Verejné texty správne opisujú plánovaný postup ako písomné oznámenie, nie ako žiadosť o individuálne povolenie RÚVZ.
- Texty odlišujú plánovaný 30-dňový režim od 48-hodinového havarijného režimu.
- Cenová ponuka a sprievodný e-mail neuvádzajú potvrdenie RÚVZ medzi záverečnými dokladmi zákazníka.
- Verejný profil odkazuje na zoznam ÚVZ SR zverejnený k 19. 9. 2024 a výslovne uvádza, že tento zoznam nepotvrdzuje zmeny po danom dátume.
- Krátke vizuálne označenie „Verejný register“ bolo nahradené presným textom „Zoznam k 19. 9. 2024“.
- Sprievodný e-mail už nesľubuje rovnakú sadu dokumentov pri každej zákazke. Uvádza dostupné doklady podľa skutočného rozsahu a podmieňuje rozhodnutie, prepravný doklad aj doklad o hmotnosti tým, že pri zákazke vznikli alebo boli vystavené.
- „Správne poplatky na úradoch“ boli spresnené na prípadné poplatky podľa konkrétneho konania, ak vzniknú.
- FAQ už nehovorí o neurčitom „všeobecnom oprávnení“, ale o rozsahu oprávnenia zodpovedajúcom konkrétnemu typu prác.

Historický zdroj: [ÚVZ SR — zoznam subjektov zverejnený k 19. 9. 2024](https://www.uvzsr.sk/documents/d/uvz/zoznam-azbest-k-19092024-pdf). Pri ASTANA, s.r.o., IČO 46 157 701, uvádza záznam rozsahy EXT, BJ a INT. Pri tejto kontrole sa na verejnom webe ÚVZ SR nenašiel novší všeobecný zoznam, ktorý by bezpečne nahradil dátumované znenie.

Vznik spoločnosti 27. 4. 2011 bol osobitne overený vo verejnom [Registri účtovných závierok](https://www.registeruz.sk/cruz-public/domain/accountingentity/show/1124019) a zdroj je prepojený z verejnej stránky aj strojovo čitateľných firemných údajov. Tento dátum opisuje históriu spoločnosti, nie dátum vydania oprávnenia na azbest.

## Overenie

- `scripts/legal-process-copy.test.mjs`
- `scripts/legal-admin-workflow.test.mjs`
- `scripts/price-offer-email-contract.test.mjs`
- cielené právne a strojovo čitateľné kontrakty po oprave: **20/20 PASS**
- tok cenovej ponuky/PDF/e-mailu: **12/12 PASS**
- TypeScript: **PASS**

## Otvorená brána

Táto kontrola potvrdzuje súlad textu s citovaným znením zákona, nie aktuálny firemný stav oprávnenia ani právne stanovisko ku konkrétnej zákazke. Pred označením G05 ako úplný PASS treba doplniť aktuálne firemné potvrdenie oprávnenia, odborného garanta a vlastníkom schválený dátum vecnej revízie. Dovtedy musí zostať verejný údaj historicky datovaný a bez tvrdenia, že zoznam z roku 2024 sám dokazuje aktuálny stav.
