# Jedna zákazková karta od ponuky po zaplatenie

Stav: **uzavretý rozsah schválený majiteľom; implementácia a nezávislé izolované overenie kandidáta. Produkcia ani pripojenie Google sa nemenia.** Nadväzujúci súhrn a hranice nasadenia sú v `job-workspace-release-review-2026-10-27.md`.

Majiteľ 27. 10. 2026 potvrdil: Google znamená výhradne **Gmail – ponuky a komunikácia**, ručné ponuky sú **PDF** a povolené sú iba schválené prevádzkové služby. **Externé AI ani zdieľanie zákazkových údajov nie sú povolené.** Gmail synchronizácia zostane predvolene vypnutá; aktivácia vyžaduje skutočné overené pripojenie a súhlas superadmina. Nový opakovaný náklad nebol schválený. Výstupom tejto etapy je lokálny otestovaný kandidát, nie tiché produkčné nasadenie.

Východisko: commit `366d64930a0860edae7b005f4be2f504430cfe68`. Návrh vychádza z požiadavky majiteľa z 27. 10. 2026, miestnych AGENTS.md a postupu pre ohraničené rozšírenie existujúceho systému. Nie je to nové CRM vedľa dnešného admina.

## Cieľ

Jarka nájde dopyt alebo staršiu ponuku, zaeviduje aj ručne vytvorenú CP pod jej pôvodným číslom a potvrdí skutočné odoslanie. Po potvrdení zákazníkom systém odovzdá zákazku Slávke. Slávka priebežne dopĺňa úrady, predbežný termín, materiály, posádku, dopravu a skutočný priebeh. Superadmin eviduje vyúčtovanie, všetky platby a výsledok zákazky. Záznamy sa nehľadajú v niekoľkých odlišných evidenciách.

Primárnym používateľom je firemný operátor pracujúci so zákazkami, ďalším superadmin s finančným pohľadom. Verejný leadový formulár, reklamné URL a publikovanie referencií zostávajú mimo tejto etapy.

## Čo už je v zdrojoch

| Oblasť | Overený základ | Medzera voči novej požiadavke |
| --- | --- | --- |
| Vyhľadávanie | `/admin/vyhladavanie`, POST/CSRF, meno/telefón/email/lokalita/CP/ID, odkazy do detailov, samostatné finančné výsledky pre superadmina | Jednoduchý výraz, najviac 20 výsledkov na skupinu, poznámky a celý obsah dokumentov sa neprehľadávajú; archív nie je zahrnutý do každého výsledku. V hlavnom topbare je navigácia, nie trvalo dostupné plnohodnotné vyhľadávacie pole. |
| Zákazka | Detail pre operátora aj superadmina, stavový postup, poznámka, operatívna a finančná časová os, dokumenty/podklady, väzby na ponuky, plánovanie a referencie | Nie je jedna ucelená štruktúra všetkých požadovaných údajov; samostatné podania OÚ ŽP/RÚVZ, vybavenie stavby, autá a plán/skutočnosť potrebujú doplnenie. Operátorský zápis dnes neobsahuje m² ani hmotnosť. V modeli zákazky nie je samostatné ľudské číslo zákazky. |
| CP | Vlastné číslovanie, odoslanie so schválením, potvrdenie výsledku, následná synchronizácia už prepojených rodičov, dôkaz ručného odoslania bez opätovného mailu | Chýba plnohodnotný import ručnej CP s pôvodným číslom, originálom a editovateľnými overenými údajmi. Samotná synchronizácia stavov nie je dôkazom, že chýbajúca zákazka vždy vznikne automaticky a dostane zodpovedného operátora. |
| Plánovač | `/admin/planovac`, viac záznamov za deň, demontáž/odvoz/dokumentácia/iné, časy, pracovníci, presun/zrušenie, väzba na zákazku a kontrola kolízií | Doplniť predbežný a potvrdený termín, dôvod presunu, autá/nosnosť, materiálový súhrn a oddeliť predbežný termín od skutočne vykonaného dňa. |
| Platby | Samostatné faktúry, príjmy/storná, metódy vrátane hotovosti a prevodu, opravy s históriou, superadminové finančné obrazovky | Zjednotiť zobrazenie dokončená/neuhradená/čiastočne uhradená/uhradená. Starší prepínač `FAKTURA/CASH` sa nesmie stať jedinou pravdou o doklade aj úhrade. |
| Gmail | Pripravená OAuth konfigurácia, šifrované tokeny, jeden povolený účet, presné hľadanie firemnej odoslanej kópie podľa Message-ID a zelený štítok | Chýba všeobecné čítanie firemnej komunikácie, príloh, párovanie do kariet a import obsahu ručných CP. Produkčné pripojenie, udelený súhlas ani dokončené Google overenie sa pri tomto audite nečítali. |
| Fotografie | Súkromný príjem fotografií, spracovanie a samostatné schvaľovanie pred zverejnením, väzba na zákazku | Do zákazkovej karty doplniť súkromnú galériu a pohodlný náhľad. Úsporné spracovanie rozšíriť na tento tok bez verejného sprístupnenia. |

Zdrojové opory: `app/admin/(protected)/vyhladavanie/`, `admin-topbar.tsx`, `src/server/admin-intelligence.ts`, `src/server/db.ts` (`searchAdminData`, `syncPriceOfferParentsPostgres`, `createBusinessJobFromLead`), `src/server/types.ts`, `app/admin/(protected)/zakazky/`, `app/admin/(protected)/planovac/`, `src/server/gmail-price-offer-*.ts`.

## Navrhnutý tok

```text
Dopyt / ručne dovezená ponuka
  → Jarka: príprava a overenie CP
  → CP skutočne odoslaná
  → zákazník potvrdí / odloží / odmietne
  → potvrdená CP: jedna zákazková karta, zodpovedná Slávka
  → príprava a podanie potrebných podkladov
  → čakáme na príslušné rozhodnutie alebo splnenie postupu
  → predbežný / potvrdený termín a pracovná karta
  → demontáž s odvozom alebo samostatný odvoz
  → skutočnosť, doklady a dokončenie
  → dokončená + neuhradená / čiastočne uhradená / uhradená
```

Stav realizácie, stav úradu, termín a stav úhrady sú samostatné osi. Zaplatená záloha neznamená dokončenú prácu; vykonaná práca neznamená prijatú platbu. Čakanie na úrad nie je schválenie. Existujúce staršie stavy sa bezpečne premietnu do nového pohľadu a nemusia sa naslepo prepisovať.

## Jedna karta a vyhľadávanie

Zachovať existujúce detailové URL s UUID. Pridať stabilné číslo zákazky a zachovať aj pôvodné čísla dovezených dokladov. Karta má záložky **Prehľad – Ponuky – Úrady – Plánovanie – Komunikácia – Fotky – Vyúčtovanie**. Finančná časť a zisk zostávajú serverovo dostupné iba oprávnenému superadminovi.

Vyhľadávacie pole bude dostupné hore v admine, s prehľadným mobilným zobrazením. Vyhľadá podľa viacerých slov naraz, aj bez diakritiky: meno, telefón, email, adresa, obec, číslo zákazky/CP, materiál, interná poznámka a povolené textové podklady. Vráti súvisiacu zákazku s dôvodom zhody a odkazom na konkrétnu CP/kartu. Filtre: rok/obdobie, aktívna/dokončená, stav CP, zodpovedná osoba, typ práce; archív ako vedomá voľba. Výsledky majú skutočné stránkovanie, nie tiché zahodenie starších výsledkov po prvých 20.

Vyhľadávanie nebude používať externý vyhľadávací index. Citlivý výraz sa neposiela v URL, analytike ani externých logoch. Rola sa kontroluje pred čítaním a výberom polí; finančné zhody sa nemajú prezradiť ani počtom alebo ukážkou neoprávnenému účtu. Meta reviewer nedostane prístup ku globálnemu CRM hľadaniu.

## Jarkina ručná ponuka

Import podporí formát, ktorý majiteľ potvrdí. Základný bezpečný tok má vždy fungovať ručne: nahrať súkromný originál, zadať jeho pôvodné číslo a dátum, zákazníka, rozsah, položky/jednotky, sumy a overený stav odoslania. Automatické vyčítanie je návrh na potvrdenie, nie tichý zápis nejasného čísla či ceny. Nedostatok údajov sa nesmie nahradiť vymyslenou nulou alebo dnešným dátumom.

- Pôvodné číslo sa zobrazí a bude sa dať vyhľadať. Vnútorný identifikátor ostáva stabilný; existujúce číslovanie sa tým nerozbije.
- Konflikt čísla má cestu „pripojiť k existujúcej ponuke / označiť ako revíziu / preveriť“, nie automatickú duplicitu alebo prepísanie.
- Hash súboru a prípadný jednoznačný identifikátor emailu bránia opakovanému importu toho istého dokladu.
- Zaevidovanie odoslanej ponuky ju znova neodošle zákazníkovi.
- Odoslaný originál a dôkaz zostávajú zachované. Úpravy majú novú verziu, autora a čas; už odoslaná dohoda sa nesmie potichu historicky prepísať.
- Potvrdenie CP vytvorí alebo prepojí práve jednu zákazku. Dva súčasné kliky nevytvoria dve karty ani dve oznámenia.

## Slávkina operatíva

### Úrady

Samostatný záznam pre OÚ ŽP a RÚVZ: či je daný krok pre túto zákazku potrebný, dátum a spôsob odoslania, číslo podania/spisu, súkromná príloha, stav, dátum rozhodnutia a poznámka. Potrebnosť určí oprávnený človek podľa konkrétnej zákazky; nevyhlasujeme automaticky, že každý odvoz potrebuje rovnaké podania ako demontáž.

Keď Slávka potvrdí skutočné podanie, existujúca odosielacia fronta pripraví pravdivé oznámenie konkrétnemu objednávateľovi. Tlačidlo má jasný význam „Uložiť a informovať zákazníka“, s náhľadom a adresátom. Ak boli podklady odoslané iba jednému úradu, text nebude tvrdiť obidva. Oznámenie sa eviduje v komunikácii, so stavom doručenia. Opakovaný klik alebo údržba odošle nanajvýš ten istý oprávnený pokus; nejasný SMTP výsledok sa preverí, nesmie slepo duplikovať mail. Neskoršia oprava dátumu sama nespustí ďalší zákaznícky mail.

### Plán a materiál

- Predbežný/potvrdený termín, čas, zodpovedný človek, posádka, vozidlá a dôvod presunu (počasie, zákazník, úrady, kapacita, iné).
- Podporiť viac zákaziek za deň aj viac návštev tej istej zákazky. Druh práce jasne rozlíši bežnú demontáž s odvozom a samotný odvoz.
- Viac materiálových položiek: vlnitý eternit, hladký eternit, interiérové steny/obklady/podhľady, azbestové rúry, vzduchotechnika a iné. Evidovať primeranú jednotku m²/m/ks/kg; rúry sa nemajú povinne vydávať za strešné m².
- Odhad a skutočnosť oddeliť: množstvo, kg, počet ľudí, autá a km z Popradu vrátane rozlíšenia jednej cesty/cesty tam aj späť.
- Hmotnostné koeficienty a nosnosti vozidiel musia pochádzať z potvrdených údajov firmy. Ak chýbajú, hmotnosť alebo kapacita zostane neznáma a doplní sa ručne. Orientačný výpočet nie je vážny lístok ani záruka legálneho zaťaženia auta.
- Lešenie, plošina, prístup, obmedzenia miesta, dohodnutá akcia/zľava a jej rozsah.
- Kolízie posádky/áut sú viditeľné upozornenia. Ak presné časy ešte nie sú určené, systém nebude predstierať presný cestovný plán.

Operátor má dostať zápis operatívnych m², materiálov, hmotnosti a plánovania bez načítania zisku, interných sadzieb a ročných finančných prehľadov. Pracovná karta pre posádku zobrazí iba potrebné prevádzkové údaje a dá sa vytlačiť; nový plnohodnotný typ zamestnaneckého účtu nie je nutný pre prvé vydanie.

### Komunikácia a fotografie

Časová os zhromaždí reálne systémové maily, overené importované správy, telefónne poznámky a zmeny stavu. Rozlišuje čas pôvodnej udalosti od času jej zaevidovania, autora a zdroj dôkazu. Nejasné párovanie podľa samotného mena, predmetu či starej adresy sa navrhne na kontrolu; nebude automaticky miešať zákazky.

Fotografie v karte zostanú súkromné, s náhľadom a otvorením väčšieho zobrazenia po overení prihlásenia. Reužiť existujúce spracovanie obrázkov: orientácia, odstránenie EXIF/GPS, primerané zmenšenie a úsporný WebP, samostatný malý náhľad. Žiadne zmeny obsahu fotografie. Nenahrávať nové doklady do verejného priečinka ani neposkytovať trvalé verejné URL. Pôvodný PDF doklad ponuky sa pritom nezamieňa s optimalizovanou fotografiou. Existujúce súkromné originály sa nebudú hromadne mazať.

Zverejnenie vybranej realizácie ostáva samostatné schválenie celého prípadu a práv. Nahratie do zákazkovej karty nie je súhlas na publikáciu poznámok, komunikácie, adries alebo fotografií.

## Úhrady a dokončenie

Rozlišovať **typ dokladu** a **skutočný spôsob platby**. Zákazka môže mať faktúru a úhradu v hotovosti; môže mať aj zaevidovanú platbu bez pripojenej faktúry. Všetky platby majú sumu, dátum, metódu, autora a dostupný doklad/dôvod. Platnosť či povinnosť konkrétneho účtovného dokladu neurčuje táto implementácia automaticky.

Karta a superadmin zobrazia plánovanú/dohodnutú cenu, skutočné vyúčtovanie, prijaté platby, zostatok a skutočné náklady. Dohodnutá cena môže vychádzať z celej CP vrátane potvrdených položiek, nie iba zo slepého násobku m². Hotovostná voľba sama osebe neznamená prijatie peňazí. Súhrny sa odvodia z existujúcich evidovaných platieb a opráv; opravy finančnej histórie zostávajú cez storno/opravný záznam s dôvodom.

KROS API, automatické vystavovanie faktúr ani eFaktúra 2027 nie sú týmto znovu zapínané. Majiteľ ich predtým odložil a zvolil ručnú evidenciu. Táto etapa ju zachová.

## Google a ochrana údajov – rozhodnutia pred aktiváciou

Čítanie emailov a príloh v Gmail API vyžaduje oprávnenie na obsah schránky. Read-only aj existujúce modify sú u Googlu obmedzené rozsahy. Verejná serverová aplikácia môže potrebovať overenie a bezpečnostné posúdenie; existujú výnimky, ale označenie „interný nástroj“ samo nepotvrdzuje splnenie podmienok. Konkrétny režim účtu/organizácie a predchádzajúce rozhodnutie majiteľa o Google overení sa musia rešpektovať. Nespúšťať platené posudzovanie alebo službu bez výslovného súhlasu.

Zdroje: [Google – Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes), [Google – restricted scope verification a výnimky](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification), [Google – vyhľadávanie správ](https://developers.google.com/workspace/gmail/api/guides/filtering).

Pripojenie vykoná superadmin cez oficiálny Google súhlas. Heslo do Gmailu sa v admine neukladá. Povolený bude určený firemný účet; vypnutie synchronizácie a odpojenie musia fungovať. Prednostne synchronizovať vybrané firemné štítky/rozsah, bez odovzdania celej osobnej schránky zamestnancom. Filtrovanie aplikáciou nezmenšuje samotný rozsah oprávnenia udeleného Googlom.

Automatické vyhodnotenie má v prvom vydaní používať pravidlá a overiteľné parsovanie na schválenom hostingu, s označením nejasností. Žiadne posielanie emailov, CP, zákazkových fotografií alebo interných poznámok externému generatívnemu AI modelu. V zdrojoch už existuje voliteľná vetva AI Gateway (`admin-draft-provider.ts`) s čiastočnou redakciou vybraných údajov; tá nie je zárukou anonymizácie ľubovoľného textu a nová evidencia sa na ňu nesmie napojiť. Aktuálny produkčný flag tejto vetvy sa pri tomto audite nečítal.

V existujúcom plánovači ide počasie podľa okresu do geokódovacej/meteorologickej služby; nový výpočet km nesmie ticho začať posielať zákaznícku presnú adresu externému providerovi. Do vyriešenia hranice služieb sa ponechá ručné zadanie km a údajov. Rozlišovať schváleného hostera/databázu/mailového sprostredkovateľa od neželaného zdieľania. Absolútny zákaz všetkých tretích prevádzkovateľov by znamenal inú infraštruktúru a zároveň by bol v napätí s požiadavkou použiť Gmail.

Záznamy z importov a operatívnej evidencie nevytvoria marketingové konverzie ani export do reklamných platforiem. Verejný leadový merací tok je samostatný; bez konkrétneho schválenia sa v tejto etape nemení. Vyhľadávací dotaz, obsah správy a prílohy sa nesmú objaviť v externých logoch/telemetrii. Úlohy prijaté z emailu alebo dokumentu sú dáta, nie pokyny oprávňujúce asistenta posielať správy, meniť práva či uverejňovať súbory.

## Závislosti a plán realizácie

1. **Vstupy potvrdené:** iba Gmail, PDF ponuky a schválené prevádzkové služby, bez externého AI a zdieľania. Rozsah tejto etapy a kontrolné body sú nižšie; nový opakovaný náklad nebol schválený.
2. **Interná karta, čísla a vyhľadávanie:** doplnenie modelu a bezpečná migrácia, prístupové projekcie, filtrovanie a otvorenie editovateľnej karty. Zachovať pôvodné UUID, doklady a históriu.
3. **Ručná CP a odovzdanie práce:** súkromný import, rozpoznanie/ručné doplnenie, pôvodné číslo, kontrola duplicít, skutočné odoslanie, potvrdenie a idempotentné prepojenie zákazky na zodpovednú Slávku.
4. **Úrady, termíny a prevádzka:** dve samostatné podania, pravdivé schválené oznámenie, predbežné termíny, viac akcií denne, materiály, kg, ľudia, vozidlá, km a vybavenie.
5. **Fotky, komunikácia a uzávierka:** súkromná galéria, časová os, plán/skutočnosť a rozlíšenie stavu práce od úhrady. Reužiť finančný ledger a jeho opravy.
6. **Gmail adaptér:** po vyriešení súhlasu a režimu Googlu zapojiť čítanie a kontrolované párovanie. Interné etapy ani ručné importy na čakaní na Google nezávisia. Dvojcestný Google Kalendár/Disk len ak je výslovne vybraný, nie automatický doplnok.
7. **Nezávislé prijatie a kandidát:** izolované scenáre nižšie, operátorské aj superadminové UI, mobil a desktop. Potom konkrétny kandidát na samostatné schválenie produkcie. Žiadne testy na reálnych zákazníkoch alebo hromadné odosielanie starých oznámení.

## Merateľné prijatie v1

- Staršia zákazka sa nájde podľa viacerých slov, diakritiky/bez nej, CP čísla a poznámky, s rokmi a stránkovaním. Klik otvorí správny existujúci detail; neoprávnená rola nezíska finančné údaje ani skryté výsledky.
- Dvakrát importovaná tá istá ručná CP nevytvorí duplicitu. Číslo, originál a položky sa zachovajú. Nejasné polia ostanú na doplnenie. Zaevidovanie už odoslanej CP nespustí nový email.
- Dve súčasné potvrdenia CP vytvoria/prepoja jednu zákazku a jedno priradenie zodpovednosti. Existujúca hotová zákazka sa nevráti späť do prípravy.
- Úrady majú vlastné dátumy, históriu a stav. Oznámenie zodpovedá skutočne odoslaným podkladom, opakovaný klik je idempotentný a nejasný výsledok SMTP nevytvorí duplicitné odoslanie.
- Jeden deň umožní dve odlišné zákazky vrátane samotného odvozu. Presun s dôvodom zachová pôvodný termín a autora, nerozbije druhú návštevu. Predbežný termín nevydáva budúci plán za skutočne vykonanú prácu.
- Operátor smie meniť potrebné operatívne množstvá a plánovanie, neobíde zákaz zápisu/čítania finančných polí. Materiálové jednotky, odhad/skutočnosť a ručne potvrdená nosnosť zostávajú rozlíšené.
- Foto sa zmenší, zbaví EXIF/GPS, otvorí z náhľadu a zostane nedostupné bez oprávnenia. Upload do zákazky nič automaticky nezverejní.
- Dokončená/neuhradená, čiastočne uhradená a uhradená zákazka sa líšia podľa reálnych záznamov. Faktúra + hotovosť aj príjem bez pripojenej faktúry sa správne zaevidujú a nevynulujú zostatok bez skutočnej platby.
- Zmeny obchodných údajov majú autora, čas a revíziu. Operátor nemôže zmazať auditnú stopu alebo spätne prepísať už odoslaný originál.
- Testované zápisy sú iba v izolovanom úložisku. Odoslania idú iba na kontrolovaný testovací cieľ; Gmail správy a prílohy sa neodosielajú do cudzieho AI, reklamných ani vyhľadávacích služieb.
- Produkčné potvrdenie Google súhlasu, schválenie plateného nákladu a nasadenie sú osobitné explicitné hranice. Nič z toho nie je týmto návrhom označené za hotové.

## Otvorené rozhodnutia

Rozsah Google, formát ručných CP a hranica prevádzkových poskytovateľov sú potvrdené vyššie. Hmotnostné koeficienty, nosnosti a priradenie mien Jarka/Slávka ku konkrétnym oprávneným účtom sa vyplnia v nastaveniach; tieto hodnoty sa nevymýšľajú.

Po splnení uvedeného rozsahu a nezávislom prijatí sa etapa uzavrie. KROS, ďalší CRM systém, platený externý OCR/AI poskytovateľ, optimalizácia flotily, verejný zákaznícky portál a automatické publikovanie zákazkových dát nie sú skrytou súčasťou návrhu.
