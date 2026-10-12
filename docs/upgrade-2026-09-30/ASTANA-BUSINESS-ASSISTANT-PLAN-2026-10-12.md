# ASTANA asistent — realizačný plán

Dátum: 12. 10. 2026
Stav: schválené na implementáciu ako izolovaná, read-only vrstva administrácie

## 1. Obchodný zámer

ASTANA asistent má majiteľovi a operátorovi každé ráno povedať, čo treba riešiť ako prvé. Nemá nahradiť CRM ani rozhodovať za človeka. Má spojiť existujúce dopyty, follow-upy, plánovač, cenové ponuky, emailový outbox, zákazky, financie a technický stav do jedného zrozumiteľného pracovného poradia.

Primárna akcia používateľa je otvoriť správny existujúci záznam a bezpečne ho vybaviť v súčasnom procese.

## 2. Používatelia a oprávnenia

### Operátor

- vidí nové a nepriradené dopyty,
- vidí splatné follow-upy a dopyty pripravené na nacenenie,
- vidí dnešné a najbližšie plánované akcie,
- vidí stav doručovania dopytových emailov,
- nevidí finančné súhrny ani technické detaily určené majiteľovi.

### Superadmin

- vidí všetko z operátorského pohľadu,
- navyše vidí neuhradené a omeškané sumy podľa evidovaných dokladov,
- vidí nepriradené úhrady a zákazky bez zadaných priamych nákladov,
- vidí stav databázy, úložiska a emailovej infraštruktúry,
- vidí obchodný lievik za aktuálny mesiac.

Oprávnenia sa vyhodnocujú na serveri podľa aktuálne prihláseného používateľa. Skrytie prvku v rozhraní nie je jedinou ochranou.

## 3. Architektúra bez odstávky

1. Nová stránka `/admin/asistent` bude iba v chránenej administrácii.
2. Stránka bude serverový komponent bez nového klientského JavaScriptu.
3. Dáta sa načítajú paralelne z existujúcich read-only databázových funkcií.
4. Operátorské a superadminské dotazy sa oddelia ešte pred načítaním citlivých dát.
5. Nevznikne nová tabuľka, migrácia, cron ani verejný endpoint.
6. Verejný web, dopytový formulár, analytika, consent, Google Ads a emailové odosielanie sa nemenia.
7. Návrat späť znamená iba odstránenie odkazu a novej izolovanej stránky; obchodné dáta zostanú nedotknuté.

## 4. Rozhodovací model

Priorita sa vypočíta deterministicky, aby asistent fungoval aj bez externého AI modelu:

1. problém s doručením dopytového emailu,
2. follow-up dnes alebo po termíne,
3. nový dopyt bez prvého kontaktu,
4. dopyt bez vlastníka,
5. dopyt pripravený na cenovú ponuku,
6. dnešná alebo najbližšia plánovaná akcia,
7. dopyt čakajúci na doplnenie,
8. superadminské riziká vo financiách, nákladoch a technickom stave.

Každé odporúčanie musí obsahovať zdrojový počet alebo stav a odkaz na existujúcu obrazovku, kde sa dá údaj overiť.

## 5. Bezpečnostné hranice

Asistent v prvej verzii:

- nič neodosiela zákazníkovi,
- nevytvára ani neodosiela cenovú ponuku,
- nemení stav dopytu, zákazky, faktúry ani platby,
- neupravuje reklamy, rozpočty ani meranie,
- nepublikuje fotografie alebo obsah,
- nespúšťa opakované odoslanie emailu s neznámym výsledkom,
- neposiela osobné údaje externému jazykovému modelu.

Všetky externé, finančné, publikačné a deštruktívne kroky zostávajú za existujúcim manuálnym schválením.

## 6. AI rozšírenie

Jazykový model bude neskoršia voliteľná vrstva nad týmto spoľahlivým jadrom. Môže pripraviť návrh zhrnutia alebo text follow-upu, ale iba z minimálneho potrebného kontextu. Výpadok modelu alebo minutý kredit nesmie zablokovať chod firmy. Pred pripojením externého modelu bude potrebné osobitne schváliť poskytovateľa, prenos dát, rozpočet a retenčné pravidlá.

## 7. SEO, GEO a verejný web

Táto funkcia je interná a prístupná iba po prihlásení, preto nevytvára indexovateľnú URL, sitemap položku ani verejné schema dáta. Keyword analýza a interné SEO prelinkovanie sa na túto administratívnu vrstvu nevzťahujú. Viditeľný verejný obsah a reklamné cieľové stránky sa nemenia.

## 8. Akceptačné podmienky

- operátor otvorí asistenta a nevidí finančné ani systémové karty,
- superadmin otvorí rovnakú URL a vidí rozšírený majiteľský pohľad,
- testovacie dopyty a zákazky nie sú zahrnuté do odporúčaní,
- všetky dátové dotazy sú read-only a spustené paralelne,
- stránka funguje aj bez AI kľúča,
- zobrazenie je použiteľné na mobile,
- prázdny CRM stav sa zobrazí bez chyby,
- typecheck, automatické kontraktové testy a produkčný build prejdú,
- žiadny test nevytvorí reálny dopyt, email, ponuku ani platbu.

## 9. Ďalšie etapy

1. **V1 — pracovný asistent:** dnešné priority, fronty, plán, emailové riziká a superadminský prehľad.
2. **V2 — bezpečné koncepty:** návrhy telefonických bodov, follow-upov a podkladov ponuky bez odoslania.
3. **V3 — schvaľované akcie:** každá mutácia so serverovou autorizáciou, auditom a explicitným potvrdením človeka.
4. **V4 — meranie prínosu:** čas do prvého kontaktu, splnené follow-upy, čas do ponuky a kvalita finančných dát.
