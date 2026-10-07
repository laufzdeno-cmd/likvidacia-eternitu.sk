# ASTANA: zosúladenie auditov s aktuálnym stavom

**Dátum:** 1. 10. 2026
**Účel:** rozhodnúť, ktoré odporúčania z auditov GPT, Gemini a Claude realizovať, ktoré overiť a ktoré odmietnuť.
**Základný plán:** [PLAN.md](PLAN.md), schválený kontrolórom pre plánovaciu fázu. Tento dokument nemení release brány.

## Záver pre majiteľa

Web netreba zahodiť ani prepísať od nuly. Potrebuje dokončiť spoľahlivú cestu od reklamy a návštevy po uložený, doručený a obchodne vyhodnotený dopyt; zjednotiť overiteľné fakty; opraviť potvrdené obsahové a mobilné slabiny; a postupne doložiť skutočnú prácu. Plošný redesign pred týmito krokmi zvyšuje riziko a sám nevyrieši obchodný problém.

Žiadny model ani SEO značka nevie zaručiť, že AI bude ASTANU odporúčať všade na Slovensku. Merateľný cieľ je zlepšiť dostupnosť a správnosť informácií, nezávislé dôkazy a užitočnosť odpovedí a následne sledovať citácie, relevantné návštevy, kvalifikované dopyty a zákazky. Skóre SEO/GEO je kontrolný rámec, nie predpoveď predaja.

## Ako čítať tri audity

- **GPT audit (30. 9.)** je najlepšie použiteľný ako bezpečný pracovný plán: odlišuje zistenia od hypotéz, chráni užitočné URL a formulár a neodporúča sľubovať AI odporúčania.
- **Claude PDF** prináša konkrétne hypotézy pre obsah, lokálne stránky, schema a mobilný vizuál. Jeho skóre SEO 6,5/10 a GEO 4,5/10, rýchlosť z jedného načítania a chyby uvedené v PDF sú odhady/snapshoty z 30. 9., nie nezávislé meranie dnešnej produkcie.
- **Gemini text** dobre upozorňuje na dôkaznú vrstvu a opakovanie, ale zahŕňa aj odporúčania, ktoré môžu vytvoriť nepravdivé tvrdenia, právne riziko alebo doorway obsah. Jeho tvrdenia, čo AI „zahodí“, „miluje“ alebo určite ocení, nie sú dôkaz.
- **Technické zadanie a dôkazy** je register konkrétnych zistení a neoverených oblastí. Jeho bezpečnostné a akceptačné brány majú prednosť; text auditu sám osebe nie je povolením na produkčnú zmenu.

Audity sú snímky k 30. 9. a niektoré vyhľadávacie náhľady môžu byť staršie. Nález týkajúci sa indexácie, formulára, ceny, oprávnenia alebo publikovania treba pred zásahom potvrdiť na aktuálnom runtime.

**Oprava metodiky:** tabuľka mala 11 kritérií pri deklarovanom súčte100 bodov. Bez zmeny kvalitatívnej latky je teraz G01–G10 bodované po10 (spolu100) a G11 je samostatná povinná publikačná hardgate bez bodovej váhy. G11 sa nesmie vynechať: jeho nesplnenie blokuje E8, aj keď bodové GEO skóre dosiahne90.

## Rozhodnutia k odporúčaniam

| Téma | Rozhodnutie | Čo sa vykoná |
|---|---|---|
| „Celé Slovensko“ a GEO | **Prijať, ale doložiť** | Pravdivo opísať obsluhované územie a logistiku z Popradu. Servisná oblasť nie je pobočka ani referencia. JSON-LD musí kopírovať viditeľné fakty. |
| Nové mestské/krajské URL | **Upraviť** | Zachovať URL s návštevnosťou a reklamnou hodnotou. Najskôr porovnať GSC, dopyty a kampane; posilniť iba stránky s užitočným odlišným obsahom. Žiadne skryté stránky, okresné klony ani automatické 301. |
| Realizácie a GPS | **Prijať s ochranou súkromia** | Originály najskôr súkromne, lokalitu potvrdí človek; zverejniť obec/okres alebo žiadny bod podľa rizika identifikácie. EXIF GPS sa nikdy automaticky nezmení na verejnú polohu. Mapa potrebuje licencovaný podklad a textový zoznam. |
| Recenzie | **Prijať** | Zobrazovať iba autentické hodnotenia so súhlasom a dohľadateľným pôvodom. Nevymýšľať ich ani nestanovovať cieľ „20 recenzií“. Aktuálny tok chráni presné znenie a súhlas, ale sám nedokazuje, že autor je zákazník. |
| Google profil/katalógy | **Overiť, potom prípadne doplniť** | Použiť iba skutočný profil a jednotnú právnu identitu. Nezakladať virtuálne pobočky, umelé zmienky ani kupovať balíky odkazov. |
| Cena, doprava, DPH, lehota ponuky | **Doprava technicky zjednotená; sadzby a DPH podmienečne** | Novšie zadanie nahradilo staré plošné tvrdenie o doprave zdarma: doprava je v cenovej ponuke voliteľná a pri účtovaní sa uvádza samostatne s editovateľnou trasou, spiatočnými kilometrami a sadzbou. Verejný web preto nesľubuje dopravu zdarma podľa výmery. Sadzby a DPH sa neodvodzujú z kalkulačky ani auditu. „Ponuka do 24 hodín“ nesmie zameniť odpoveď, kompletnú ponuku a termín prác. |
| Právne lehoty, pokuty a dotácie | **Odborne overiť** | Zákony, sankcie, oprávnenie a dotácie uvádzať iba s presným zdrojom, dátumom kontroly a schválením kompetentnej osoby. Nevymýšľať sumy/lehoty ani negarantovať dotáciu. |
| Oznámenie prác s azbestom | **Opravený právny opis** | Pri plánovanom odstraňovaní azbestu zo stavieb § 41 ods. 13 zákona č. 355/2007 Z. z. ukladá držiteľovi oprávnenia písomne oznámiť práce príslušnému orgánu verejného zdravotníctva najmenej 30 dní vopred vrátane podkladov. Odsek 14 stanovuje osobitný 48-hodinový režim pri mimoriadnej havarijnej alebo živelnej udalosti. Neopisovať to ako zákonnú lehotu na vydanie rozhodnutia RÚVZ aj OÚ. Zdroj: [Slov-Lex, znenie účinné 1. 8. 2026](https://static.slov-lex.sk/static/SK/ZZ/2007/355/20260801.print.html). |
| Tím, odborný garant, počet prác | **Len reálne podklady** | Meno, fotografia, kvalifikácia a počty sa doplnia až po dodaní a overení. Nevytvárať citáty ani osobné garancie za pracovníka. |
| „Fušer vs. ASTANA“ | **Odmietnuť v navrhnutej podobe** | Neinscenovať neporiadok, neobviňovať konkurentov a nezneužívať strach z pokút. Možno ukázať skutočný pracovný postup a výsledok vlastnej práce. |
| JSON-LD a oprávnenia | **Overiť voči obsahu** | Opraviť duplicity a identitu. Oprávnenie, cenu, polohu, osobu či hodnotenie vložiť iba vtedy, keď typ zodpovedá dôkazu a viditeľnému obsahu. Schema sama autoritu nevytvorí. |
| FAQ, llms.txt, AI boti | **Užitočný obsah, nie trik** | FAQ ponechať pre ľudí; nesľubovať rich results. Otestovať robots, HTTP/firewall a dostupné konzoly. llms.txt nezaručuje indexáciu ani citáciu; odstrániť TODO/nepravdivé pokyny. |
| Dizajn a „celé prekopanie“ | **Redizajn po funkčných bránach** | Zachovať značku a dobré časti. Meniť po sekciách podľa reprodukovaných problémov; prednosť majú formulár, mobilné ovládanie, kalkulačka a dôkazy. |

## Aktuálny register dôkazov

### Hotové iba v lokálnom zdroji/testoch

- Technické správanie zdieľanej kalkulačky bolo lokálne testované pre krajné hodnoty a materiály. **Cenník/DPH a obchodné predpoklady ešte nie sú schválené.**
- Zdroj obsahuje opravy pre viaceré technické SEO problémy, vrátane 404, breadcrumbs, verejného firemného TODO a skupín crawlerov. To **nepreukazuje** aktuálny produkčný crawl ani stav v Search Console.
- Lokálne existujú bezpečnostné poistky a testy pre lead/outbox, prílohy, recenzie a súkromný foto-intake. Lokálne/PGlite/mock dôkazy nie sú dôkazom skutočného inboxu, produkčného Blobu ani celého verejného workflow.
- Verejná referencia sa uloží ako koncept; publikovanie vyžaduje presný a platný súhlas. Chýba nezávislé overenie, že autor je zákazník, aj história starého a nového znenia.
- Súkromný foto-intake má jednorazové pozvánky, súkromné nahratie, lokalitu a päť kategórií, internú kontrolu a bezpečné odobratie. **Je vypnutý** do overenia produkčného Private Blob, read/delete/retry a retenčnej politiky. Staršia verzia tohto auditu uvádzala, že chýba väzba na zákazku; následná lokálna oprava teraz vyžaduje pri každej novej pozvánke dokončenú CRM zákazku a viaže fotografie aj koncept na tú istú zákazku. Pracovník vidí iba dátum a okres. Toto je dôkaz kandidátového kódu/testov, nie produkčného nasadenia. Lokalitu a kategórie možno zatiaľ doplniť neskôr, preto portál zostáva vypnutý, kým sa nepotvrdia produkčné úložisko, retencia, práva a reálne end-to-end správanie.
- Odkaz z homepage „Ukážky reálnych striech ASTANA“ bol v živej kontrole otvorený; viedol na /realizacie/ a filter reagoval. Ide o bodový dôkaz v čase kontroly, nie úplný mobilný audit.
- Odstránenie neovereného dopravného sľubu a filter starého CMS textu sú lokálne; bez schváleného releasu sa produkcia nemení.

### Reklama a meranie: pracovný zdroj vs. produkcia

- Pracovný kód vie priradiť uloženému dopytu základné zdrojové údaje; interný report pracuje s UTM/kampaňou v rozsahu povolenom súhlasom. To neznamená, že Google Ads alebo Meta dostali potvrdenú konverziu.
- Stavový dokument obsahuje staršie a novšie protichodné checkpointy o kampaniach/produkcii. Zdroj pravdy je preto zatiaľ **neuzavretý**: treba jeden dátumovaný audit aktívnych finálnych URL, query-parametrov na redirectoch, consent, zdroja konkrétneho CRM leadu, Ads/Meta tagov a produkčného dashboardu.
- Bez UTM sa Google click ID v internom zoskupení nemusí premeniť na názov kampane; utm_content/kreatíva sa v reportoch nezobrazuje samostatne. Súhlasom nezachytené dopyty sa majú označiť ako nepriradené, nie spätne hádať.
- CRM kohorty nemajú úplné náklady reklamy, výnosy a príspevok na zisk. Nemeníme aktívne kampane ani rozpočty v rámci tohto auditu.

## Najväčšie otvorené brány

1. **P0 — produkčný lead reťazec:** preview/browser bez prílohy aj s prílohou, trvalý lead, správna väzba súborov, interný aj zákaznícky e-mail v schránke a bezpečná obnova. Označiť test a overiť aj CRM; úspešný API status nestačí.
2. **P0 — ochrana historických/zákazníckych údajov:** preukázať produkčnú migráciu, zálohu/rollback a inventár osirelých Blob objektov bez mazania naslepo. Rozlíšiť starého klienta od nového backendu.
3. **P1 — zdroj firemných tvrdení:** potvrdiť rozsah oprávnenia, DPH, kalkulačné predpoklady, lehotu cenovej ponuky a verejne použiteľné štatistiky. Doprava zostáva voliteľnou samostatnou položkou konkrétnej cenovej ponuky; verejný web nesľubuje dopravu zdarma podľa výmery.
4. **P1 — podklady k realizáciám:** majiteľ dodá originálne fotografie a potvrdí zákazku, lokalitu, dátum/výmeru (ak známe), práva a anonymizáciu. Zatiaľ nevznikajú fiktívne body ani prípady.
5. **P1 — reklamná atribúcia:** read-only export aktívnych Google/Meta/Instagram URL; otestovať každý redirect, query-parametre, consent, serverom potvrdenú konverziu a deduplikáciu. Porovnať s CRM bez zmeny kampaní.
6. **P1 — mobil a ľudské skúšky:** 320–390 px, tablet aj desktop; overflow, menu, cookie lišta, klávesnica, formulár, upload, CTA a galéria. Päť reálnych skúšajúcich podľa acceptance scorecard; modely sa za ľudí nevydávajú.
7. **P2 — crawl a obsah:** aktuálne URL/stavy/redirecty, canonical, indexability, sitemap, schema a robots. Potom zjednotiť právne FAQ, účel služieb a regionálne stránky bez hromadného mazania.
8. **P2 — nezávislé dôkazy a AI meranie:** skutočné recenzie s provenienciou, prípady s právami, overený firemný profil a rovnaký panel otázok v dostupných systémoch; zapísať aj neprítomnosť a faktické chyby.

## Poradie vykonávania

| Poradie | Balík | Podmienka |
|---|---|---|
| 0 | Baseline a register tvrdení | Aktuálna produkcia, crawl, kampane, cena, právne fakty a formulár; staré screenshoty nie sú dnešný stav. |
| 1 | Bezpečnosť dát a end-to-end lead | Preview, inbox a Blob dôkaz pred redizajnom formulára. |
| 2 | Reklamy → návštevy → kvalitné dopyty | Zachovať UTM/click ID, definovať súhlas a porovnať CRM s platformami. |
| 3 | Fakty a cenovo-právne texty | Jeden schválený zdroj; chýbajúce údaje zostávajú nevydané. |
| 4 | Kľúčové UX a homepage | Zachovať značku, dopytové cesty a obsah; testovať mobil aj desktop. |
| 5 | Realizácie a referencie | Súkromný import, väzba na zákazku, práva, anonymizácia, potvrdená lokalita a samostatné publikačné schválenie. |
| 6 | Obsahové a technické SEO | Dopyty z reálnych vyhľadávaní; každá URL má účel a dôkaz, žiadne klony. |
| 7 | Akceptácia a release | Nezávislá kontrola diffu, preview, iba schválený release, rollback a post-release crawl/lead test. |

## KPI a obchodný úspech

Každý report uvádza zdroj, obdobie, časové pásmo, prostredie a menovateľ. Rozlišovať:
- návštevnosť: organické URL/dopyty, platené kampane, merané relácie a priame/nepriradené;
- konverziu: začaté/dokončené formuláre, jedinečné trvalé leady, technickú úspešnosť a doručenie každému príjemcovi;
- obchod: kvalifikované dopyty, ponuky, prijaté a dokončené zákazky, výnos bez DPH, variabilné náklady a príspevok na zisk;
- SEO/AI: kanonické/indexované URL, citácie/odkazy v pevnom paneli otázok a správnosť extrahovaných faktov. Zmienka ≠ odporúčanie ≠ lead.

Čísla dodaného GPT auditu (78 kliknutí, 2,64 tis. zobrazení v „posledných 28 dňoch“) sú historický snapshot bez presných hraníc. Nie sú baseline, kým sa neexportujú konkrétne dátumy zo Search Console. Cieľom nie je „AI nadšenie“ ani kliky samy osebe, ale správne informované dopyty, ktoré sa menia na ziskové zákazky.

## Pravidlá vykonávania

- Jeden autor a iný kontrolór pre každý izolovaný balík. Kontrolór schvaľuje iba konkrétny diff a dôkazy.
- Najviac dve cielené opravné kolá pre rovnaký nález. Opakovaný blocker sa zapíše a pokračuje sa nezávislým balíkom.
- Reálny formulárový test vytvára leady/e-maily: musí byť označený a po teste sa overí schránka, CRM a prílohy.
- Produkcia, účty, kampane, zákaznícke údaje, recenzie a verejné fotografie sa menia iba v presne ohraničenom autorizovanom release kroku. Build alebo lokálny GPT PASS nie je produkčný PASS.
- E8 zostáva nedokončená, kým SEO ≥90/100, GEO pripravenosť ≥90/100, celok ≥85/100, všetky funkčné hardgates prejdú, mobilný/ľudský test je doložený a nezostane otvorený P0/P1.
