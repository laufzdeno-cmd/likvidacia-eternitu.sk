# Interné pravidlá používania AI – ASTANA

**Verzia:** 2026-09-05
**Rozsah:** likvidacia-eternitu.sk
**Stav:** interný pracovný dokument, nie právne stanovisko

## 1. Aktuálny stav

Audit zdrojového kódu na aktuálnom worktree nenašiel napojenie na OpenAI, ChatGPT, Gemini, Claude, Anthropic ani inú externú službu generatívnej AI. Dopyty, fotografie, partnerské registrácie a referencie sa podľa kódu neposielajú do AI na vyhodnotenie, cenotvorbu, výber partnera ani automatické rozhodovanie.

Orientačná kalkulačka používa pevne nastavené sadzby a jednoduchý výpočet z výmery a typu materiálu. Nie je to AI systém. Dopyty a registrácie spracúva človek v internom systéme.

Z toho vyplýva, že v aktuálnom runtime nie je potvrdené spracúvanie osobných údajov pomocou AI a nebol vytvorený dokument `AI_PERSONAL_DATA_CONTRACT_DELTA.md`.

## 2. Povolené používanie

AI možno použiť iba ako pomocný nástroj pri práci s údajmi, ktoré neobsahujú osobné, obchodne citlivé alebo bezpečnostne významné informácie ASTANY. Každý výstup musí pred použitím skontrolovať človek.

Pri práci s reálnym dopytom, fotografiou strechy, telefónom, emailom, adresou, obchodnými údajmi alebo internou cenou platí zákaz kopírovania do verejného či externého AI nástroja bez predchádzajúceho posúdenia účelu, právneho základu, zmluvného krytia a nastavenia uchovávania údajov.

## 3. Zakázané použitie bez samostatného schválenia

- posielať osobné údaje zákazníkov alebo strechárov do externého AI nástroja,
- nechať AI rozhodnúť o prijatí, odmietnutí, poradí alebo priorite dopytu bez ľudskej kontroly,
- automaticky vypočítať alebo odoslať záväznú cenovú ponuku,
- automaticky vybrať alebo verejne odporučiť strechára,
- hodnotiť človeka, jeho bonitu, dôveryhodnosť alebo rizikovosť,
- zverejniť AI vytvorenú referenciu, fotografiu alebo tvrdenie ako skutočný dôkaz,
- používať AI na bezpečnostné alebo právne pokyny bez odbornej kontroly,
- trénovať model na databáze dopytov, fotografií alebo emailov ASTANY.

## 4. Povinný postup pred zavedením AI

Pred každou novou AI funkciou sa musí zapísať:

1. konkrétny účel a používateľský prínos,
2. názov poskytovateľa, model a krajiny spracovania,
3. dátové kategórie a či obsahujú osobné údaje alebo fotografie,
4. právny základ a príjemcovia,
5. doba uchovávania a možnosť vypnutia,
6. riziká automatizovaného rozhodovania podľa GDPR,
7. potreba informovania používateľa podľa AI Act,
8. ľudská kontrola, testovací plán a rollback,
9. zmluvné a bezpečnostné overenie poskytovateľa.

Funkcia sa nesmie dostať do produkcie iba zmenou kódu. Musí mať samostatný review, aktualizované verejné informácie a overenie, že do AI neodtekajú osobné údaje mimo schváleného rozsahu.

## 5. AI Act a transparentnosť

Článok 4 nariadenia (EÚ) 2024/1689 vyžaduje primeranú AI gramotnosť poskytovateľov a nasadzovateľov AI systémov. Táto povinnosť sa bude uplatňovať podľa skutočného použitia AI systému, nie iba preto, že pracovník používa všeobecný nástroj ako pomoc pri písaní.

Článok 50 sa posudzuje podľa konkrétnej AI funkcie, napríklad pri priamom rozhovore človeka so systémom alebo pri zverejnení syntetického obsahu. Bežný crawler, analytika, pevný matematický výpočet ani ručná pomoc pri tvorbe textu samy osebe neznamenajú, že web musí označovať každú stránku ako AI.

Pri novom AI systéme sa vždy posúdi aktuálne znenie nariadenia a harmonogram podľa článku 113.

## 6. Kontrola a zodpovednosť

Za schválenie účelu, poskytovateľa, právneho základu, zmluvných podmienok a verejnej informácie zodpovedá prevádzkovateľ ASTANA, s.r.o. Technická kontrola nesmie nahrádzať právne posúdenie konkrétneho spracovania.

Pri podozrení na únik osobných údajov do AI sa používanie okamžite zastaví, zaznamená sa incident a posúdi sa oznamovacia povinnosť a ďalšie kroky podľa GDPR.

## Zdroje

- [Nariadenie (EÚ) 2024/1689 – AI Act, EUR-Lex](https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng)
- [Nariadenie (EÚ) 2016/679 – GDPR, EUR-Lex](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679)
- [EDPB: Lawful processing for small businesses](https://www.edpb.europa.eu/sme/be-compliant/process-personal-data-lawfully_en)
