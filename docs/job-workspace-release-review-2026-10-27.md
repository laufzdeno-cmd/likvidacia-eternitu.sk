# Zákazková karta, PDF a Gmail – hranice kandidáta

Východiskový produkčný zdroj: `366d64930a0860edae7b005f4be2f504430cfe68`. Táto etapa mení interný admin; verejné podstránky, dopytový formulár, reklamné URL a reklamné meranie nemení. Produkcia nebola migrovaná ani nasadená. Žiadna skutočná Gmail správa sa nečítala, žiadny zákaznícky email sa pri kontrole neposlal.

## Potvrdené rozhodnutia majiteľa

- Google znamená iba Gmail pre ponuky a komunikáciu. Kalendár a Disk sa nepripájajú.
- Jarka odosiela PDF. Import zachová pôvodný dokument, číslo, položky a overené sumy; nevymýšľa m² ani dátum.
- Dáta zostávajú v schválenom hostingu, databáze a poštových službách. Externé AI spracovanie admina je zakázané aj pri starom zapnutom environment prepínači. Presné zákaznícke adresy sa neposielajú externej mapovej službe; km sú ručný údaj.
- Nový opakovaný náklad, KROS API ani Google bezpečnostné posudzovanie sa neobjednávajú.

## Hotový pracovný rozsah

1. Hľadanie hore v admine aj podrobné vyhľadávanie: viac slov, diakritika, čísla pôvodných CP, poznámky, materiály, rok, archív, stav, zodpovednosť, druh práce a stránkovanie. Výsledok otvorí konkrétnu editovateľnú kartu. Citlivý dotaz nejde do URL.
2. Súkromný PDF import: digitálny text sa číta v obmedzenom lokálnom procese na schválenom hostingu. Základné rozpoznané údaje sú návrhy na potvrdenie; položky a nejasnosti človek doplní. Sken nie je predstieraný za spoľahlivo rozpoznaný dokument. Rovnaký originál nevytvorí druhú ponuku a označenie skutočného odoslania nič znovu neodosiela.
3. Prijatie vlastnej aj dovezenej CP vytvorí alebo použije práve jednu zákazku. Slávka sa vyberá zo skutočných aktívnych účtov; superadmin môže nastaviť predvoleného zodpovedného človeka. Odložená ponuka má dôvod a dá sa neskôr prijať.
4. Pracovná karta: materiály a jednotky, plán/skutočnosť, samostatné podania OÚ ŽP/RÚVZ, rozhodnutia a doklady, predbežný/dohodnutý/skutočný deň, posádka, autá, ručne potvrdená kapacita, km z Popradu, vybavenie a poznámky. Skutočný deň je prepojený s pôvodnou evidenciou a ročnými filtrami; starý formulár ho neprepíše ani neobnoví po ručnom vymazaní. Každé uloženie má autora, čas a revíziu. Dokončenie zostáva kontrolované existujúcim sprievodcom.
5. Úradné oznámenie: iba aktuálne uložené skutočné čakajúce podania, presný adresát a náhľad. Výslovné schválenie odoslania, jeden pokus, ochrana opakovaného kliku a žiadne slepé opakovanie nejasného SMTP výsledku. Nejasné odoslanie sa preverí v pošte a zaeviduje ručne, nie automaticky zopakuje.
6. Kalendár: viac akcií za deň, demontáž aj samostatný odvoz, predbežné a dohodnuté termíny, upozornenia na rovnaké vozidlá/posádku a rozlíšenie známych a neznámych časov. Tlač pre posádku neobsahuje finančné údaje ani zo superadmina.
7. Komunikácia a súkromné fotografie: ručné poznámky, kontrolované Gmail priradenia a stavové oznámenia. JPG/PNG/WebP sa na serveri zmenšia a uložia bez EXIF/GPS s náhľadom. Vstupný limit je 3 MB na súbor; väčšiu fotku treba pred nahratím zmenšiť. Kliknutie otvorí súkromnú väčšiu fotku. Nahratie nič verejne nepublikuje.
8. Superadminove financie: kanonická dohodnutá/skutočná celková cena aj pri PDF bez m². Náklady sa odvodia z pôvodných nákladov a odmien. Úhrady a storná zostávajú v existujúcom ledgeri. Faktúra a hotovostná platba sú samostatné údaje; príjem môže byť aj bez pripojenej faktúry. Rozpor s faktúrami znamená kontrolu, nie zelené označenie úhrady. Neznáma cena sa nepovažuje za nulu a bráni finálnemu uzavretiu.

## Gmail – pripravený tok, zatiaľ bez aktivácie

`/admin/nastavenia/gmail` je dostupné iba superadminovi. Synchronizácia je predvolene vypnutá. Aktivácia má samostatný overovací prepínač `ASTANA_JOB_GMAIL_VERIFIED`, oficiálne OAuth pripojenie povolenej firemnej schránky a výslovné potvrdenie rozsahu. Heslo do Gmailu sa v admine neukladá.

Vybrané štítky a dátum obmedzia synchronizáciu aplikácie; nezúžia samotný rozsah oprávnenia Googlu. Návrhy párovania sú iba návrhy. Operátori neuvidia nepriradenú schránku: správu a prílohy pripojí ku konkrétnej zákazke až superadmin. Import emailu sám nemení ponuku na odoslanú ani prijatú. Odpojenie a vypnutie sú samostatné ovládania.

Reálna schránka, dokončené overenie Googlu a produkčné doručenie SMTP/Blob týmto dokumentom nie sú potvrdené. Lokálne testy používajú syntetické dáta a falošný transport.

## Overenie a dôkazy

Podrobnosti sú v `job-workspace-core-implementation-2026-10-27.md`, `job-private-mail-implementation-2026-10-27.md` a `job-workspace-ui-implementation-2026-10-27.md`. Finálny kontrolór zaznamenáva vlastné prijatie oddelene od výsledkov implementátorov.

- Jadro: **70 lokálnych + 71 PostgreSQL/PGlite kontrol PASS**, nezávisle zopakované kontrolórom. Zahŕňajú súbežné prijatia/ceny/dátumy, neznáme údaje, zachovanie histórie a bezpečné odmietnutie trvalého vymazania evidencie.
- Prehliadač: skutočný Next.js import PDF → overené odoslanie → odloženie → prijatie → jedna zákazka; globálne hľadanie; súkromné PDF a WebP; syntetická Gmail správa → kontrolované priradenie. Žiadna externá požiadavka a žiadna zákaznícka správa.
- Grafika a role: desktop aj 768/390/320 px, zbalené sekcie, bez presahu, neprístupné financie operátorovi a osobitná tlač posádky.
- Build: **PASS**, oddelená dočasná kópia bez živých `.env`, vlastná databáza a sieťový zákaz externých spojení. Testovacia pomocná GET route existuje iba v tejto kópii, nie v produkte. Zabalený PDF parser skutočne vrátil `TEXT`; overené sú aj potrebné súbory serverovej funkcie a samostatná minimálna kópia knižnice bez ostatných lokálnych balíkov. Finálny odtlačok zdrojov **`740698d2154f876808d5347e371d091863340c32741ff4037ab9cd6dfbb0a8c2`** je v `test-results/job-workspace-build-source.json` (27. 10. 2026 17:41:43 UTC).
- Pôvodné PostgreSQL platby/CP/dokončenie a samostatná TypeScript testová fáza: **43/43 PASS**, `test-results/job-workspace-regression-final.log`. TypeScript kontrola prešla aj v uvedenom finálnom builde. Pomocné skúšky úradného odoslania, súkromných súborov, vypnutia externého AI a kapacít sú samostatné cielené testy.
- Nezávislé porovnanie prvej širšej unit fázy: pôvodný commit **629 testov / 612 PASS / 17 FAIL**, zachytený kandidát **648 / 633 PASS / 15 FAIL**. Nové názvy pádov kandidáta: **0**; všetkých 15 spoločných má byte-identický zdroj testu, rovnaké miesto asercie, typ aj operátor zlyhania. Dôkaz je v `test-results/unit-baseline-acceptance-suite-7qY6tG/comparison.corrected.md`. Druhá TypeScript fáza tohto npm reťazca nebežala; samostatný TypeScript a cielené scenáre sa overujú osobitne. Celá sada sa neoznačuje za PASS.

## Pred produkciou

Treba samostatne schváliť konkrétny zdroj kandidáta, novú presne pripnutú závislosť `pdfjs-dist@6.4.299` a doprednú databázovú migráciu. Projekt vo Verceli bol iba prečítaný a používa Node 24.x; nastavenie sa nemenilo. Existujúci release guard zmenu závislosti zatiaľ úmyselne odmietne. Nesmie sa obísť posunutím baseline bez výslovného prijatia zmeneného rozsahu ani plošným vypnutím ochrany.

Migrácie `migrateJobWorkspaceSchema` a `migrateJobMailSchema` sú explicitné, opakovateľné a overené iba na izolovanej databáze. Bežná stránka ani request ich nespustí. Produkčný krok potrebuje overený cieľ, zálohu a riadené nasadenie; na náhľade zdieľajúcom produkčné úložisko sa nesmie zapisovať.

Návrat na starý kód po prijatí nových zákaziek nie je automaticky bezpečný: starší formulár nepozná ochranu kanonickej ceny a skutočného dňa. Pred produkčnou aktiváciou preto treba pripraviť a overiť kompatibilný návratový postup, ktorý zachová nové dáta a ochrany zápisu. Tabuľky ani nové originály sa pri návrate nemažú.

Po nasadení patria samostatne skontrolovať prihlásený operátor/superadmin, živé súkromné úložisko, skutočná kontrolovaná poštová skúška a stav plánovaných úloh. Aktivácia Gmailu zostáva oddelená od nasadenia interných kariet. Verejné reklamy ani ich URL sa kvôli tejto etape nemenia.
