# Lokálny náhľad pre majiteľa — 9. 10. 2026

## Rozhodnutie pred implementáciou

Cieľom je prezrieť aktuálny slovenský verejný web pred nasadením. Existujúci
`lead-private-blob-browser.integration.mjs` vytvára oddelenú dočasnú kópiu,
ale po teste server ukončí a jeho plný režim odosiela testovacie formuláre.
Samotné `next dev` v pracovnom priečinku by načítalo jeho `.env` súbory.

Nový `scripts/owner-preview.mjs` preto opakuje overený postup kopírovania
zo súčasných harnessov a používa existujúci `test-loopback-network-guard.mjs`.
Verejné stránky podporujú development režim bez PostgreSQL: vlastný prázdny
JSON dátový súbor vznikne až v dočasnej kópii. To je najjednoduchší variant
povolený zadaním; nevytvára SQL server ani staging resource.

## Bezpečnostný rozsah

- Jednorazová kópia aktuálnych `app`, `src`, `public` a potrebných konfigurácií.
  Originálne súbory sa neupravujú. Zmeny primárneho agenta po skopírovaní
  sa do bežiaceho náhľadu automaticky neprenášajú.
- Žiadne kopírovanie `.env*`, `.data`, `storage`, `.git` ani produkčných dát.
  `node_modules` sa zdieľa junction odkazom; build/cache vzniká v dočasnej kópii.
- Nové prostredie obsahuje iba nevyhnutné systémové cesty a lokálne prepínače.
  Bez DATABASE_URL, SMTP, relay, Blob/S3/AWS, Vercel, admin/cron tajomstiev
  a verejných analytických premenných. Telemetria Next.js je vypnutá.
- Existujúca sieťová ochrana pred načítaním Next.js blokuje ne-loopback
  TCP/HTTP/fetch, externé DNS a UDP; pri štarte vykoná vlastné kontrolné asercie.
  Ide o aplikačnú ochranu harnessu, nie operačný firewall.
- Server počúva výhradne na `127.0.0.1` a kontroluje Host a Origin.
  Hlavička CSP povoľuje iba vlastné zdroje, blokuje externé skripty, obrázky,
  spojenia, iframe a odoslanie HTML formulárov. Každá odpoveď má `noindex`.
- Všetky aplikačné požiadavky okrem GET/HEAD sa odmietnu pred Next.js.
  Aj GET na API, admin, súkromný príjem fotiek a potvrdenia dopytov je uzavretý.
  Analytické API sa nespúšťa. Jedinou riadiacou POST výnimkou je zastavenie
  vlastného runnera s náhodným lokálnym tajomstvom.
- Next.js 16 potrebuje pre dokončenie klientského načítania lokálny WebSocket
  `/_next/hmr`. Povoľuje sa výhradne na rovnakom Host/Origin; nemá prístup
  k aplikačným API. Ostatné upgrade spojenia sa odmietnu. Interné fonty
  vývojárskeho panelu pod `/__nextjs_font/` zostávajú zámerne blokované.
- Externý odkaz vedome otvorený používateľom opúšťa rozsah náhľadu.
  Automatické externé požiadavky samotnej stránky blokuje CSP.

## Čo možno prezerať

Verejný vzhľad, navigáciu, texty, existujúcu statickú fotogalériu, kalkulačku
a zobrazenie formulárov. Odosielanie, upload, e-mail, administrácia a ostré
meranie nie sú súčasťou náhľadu. CMS zmeny z produkčnej DB ani publikované
prípady z SQL sa neimportujú; používajú sa predvolené texty a lokálne fotky.
Vývojový režim nie je meraním produkčného výkonu ani release akceptáciou.

## Obsluha

Z koreňa projektu:

```powershell
node scripts/owner-preview.mjs start
node scripts/owner-preview.mjs status "<priečinok vypísaný pri štarte>"
node scripts/owner-preview.mjs stop "<ten istý priečinok>"
node scripts/owner-preview.mjs verify "<ten istý priečinok>"
```

Runner štartuje oddelený proces s `detached: true`, `windowsHide: true`,
odpojeným vstupom a logmi v dočasnom priečinku. Pretrvá po skončení príkazu.
Stop overuje identitu inštancie, PID a náhodné tajomstvo; nepoužíva plošné
ukončovanie Node procesov. Dočasná kópia a logy zostanú po zastavení zachované.

Obnova po potvrdenom freeze: znova `start` vytvorí čerstvý snapshot s novou
URL. Po úspešnom GET a odovzdaní novej URL sa `stop` použije na starý priečinok.
Zdrojové `app`/`src` v bežiacej kópii sa ručne neprepisujú. Vývojový server
nevytvára ani nemení produkčný build.

`verify` kontroluje šesť trás pri 320, 390 a 1440 px, mobilné menu,
kalkulačku a prenos výmery/materiálu/syntetickej obce do neodoslaného formulára.
E-mail zostane prázdny a GDPR nezaškrtnuté. Uloží tri viewportové a deväť
celostránkových snímok a tri samostatné zábery galérie do runtime priečinka.
Snímky aj JSON dôkaz sú lokálne.
`writesAllowed: false` je deklarovaná politika, nie meraný počet zápisov;
samostatným dôkazom je kontrola, že všetky dátové kolekcie ostali prázdne.

## Výsledok overenia

### Aktuálny snapshot — opravy vizuálnych pripomienok majiteľa

**URL: http://127.0.0.1:61779/ — PID 35940.** Runtime:
`C:\Users\Zdeno\AppData\Local\Temp\astana-owner-preview-Rf7Ul0`.
Odtlačok: `595ff0b114df533d523db790a47772735e47450e2698646d58c022302426a674`.
Matica **18/18 PASS**, 9. 10. 2026 o 08:48:26 Europe/Bratislava.
Nové browser kontroly zahŕňajú farby trust bloku a aktívneho materiálu,
kompaktnosť kalkulačky, maximálnu cenu pri 500 m² pre všetky materiály,
odstránené pole obce iba v homepage kalkulačke a zachovaný prenos do dopytu.
Fotografia hospodárskej budovy je reálny verejný asset `azbest-057`.
Snímky kalkulačky a trust bloku sa ukladajú navyše v každej z troch šírok.
Presný výsledok: [vizuálna oprava](HOMEPAGE-VISUAL-CORRECTION-2026-10-09.md).
Predchádzajúci server MvmwbX aj tri pracovné vizuálne snapshoty sú zastavené;
ich súbory zostali zachované. Stále bez produkcie a bez odoslania formulára.

### Historický snapshot — spoločný kandidát pred vizuálnymi pripomienkami (zastavený)

**Historická URL: http://127.0.0.1:57189/ — PID 34708, už zastavený.** Runtime:
`C:\Users\Zdeno\AppData\Local\Temp\astana-owner-preview-MvmwbX`.
Odtlačok 305 zdrojových/konfiguračných súborov:
`40a543650029167fa0eb813860dcc0125d14775cbe806fa8aec06ac147bfc020`.
Tento odtlačok nezahŕňa celý priečinok `public`; nie je hashom celého release.

Overenie skončilo **9. 10. 2026 o 08:08:25 Europe/Bratislava: 18/18 PASS**.
Šesť trás `/`, `/cena/`, `/realizacie/`, `/kariera/`, `/kontakt/`, `/poradna/`
pri 1440, 390 a 320 px má HTTP 200, jeden H1 a nulový horizontálny presah.
Kalkulačka aj prenos údajov do neodoslaného dopytu fungujú pri všetkých troch
šírkach, mobilné menu sa otvorí a zatvorí. Všetky kontrolované fotky sa načítali.
Externé browser požiadavky, odoslané formuláre, JS výnimky a chybné verejné
assety: **0**. Všetky kolekcie vlastného JSON úložiska zostali prázdne.
Tri odmietnuté fonty vývojárskeho panelu sú zámerná izolácia, nie chyba webu.

Hlavný agent na tomto náhľade vizuálne overil úvodnú obrazovku a cez DOM
potvrdil bordový odkaz „Ukážky reálnych striech ASTANA.“ (`rgb(143,22,60)`)
na `/realizacie/`. Aktuálny náhľad je ponechaný pre majiteľa; predchádzajúci
vlastný server 64708/PID 21364 bol cielene zastavený, jeho súbory ostali zachované.
`verification.json` a viewportové/celostránkové snímky sú v runtime `MvmwbX`.
Admin, skutočné odosielanie a produkčný obsah nie sú súčasťou tohto náhľadu.

### Predchádzajúci snapshot — vrátane opravy úvodnej vety (už zastavený)

**Historická URL: http://127.0.0.1:64708 — PID 21364, už zastavený.** Runtime:
`C:\Users\Zdeno\AppData\Local\Temp\astana-owner-preview-sZnpbX`.
Záverečná kontrola Windows potvrdila jediný ponechaný vlastný proces,
`MainWindowHandle = 0` a listener výhradne `127.0.0.1:64708`.
Odtlačok 305 zdrojových/konfiguračných súborov:
`8af446eec2ff35f4f62ab96ae1a6dc600a3c2e34f5535766437e5fcc015e3b1a`.

Zahrnutá je posledná obsahová oprava v `src/server/site-content.ts`:
„Zabezpečíme potrebné podklady, bezpečnú demontáž, balenie a odvoz. Výsledkom je …“.
Prvý GET vrátil 200, obsahoval nové znenie a neobsahoval chybný fragment
„odvoz aj potvrdenie alebo dokumentácia“. Zdroj aj kópia majú zhodné SHA-256:
`354a6e93531b0970eef33535af0d0f17d3c8379400ff601a638bc6928a6e05e9`.

**Homepage 3/3 PASS o 07:24:05 Europe/Bratislava:** 1440×1000, 390×844,
320×568; HTTP 200, jeden H1, horizontálny presah 0. Všetky tri fotografie
majú kladné `naturalWidth`: **475/475/475**, **390/390/390**, **320/320/320**.
Mobilné menu sa otvorilo a zatvorilo. Nulové externé požiadavky, pokusy
prehliadača o zápis, JS výnimky a chybné assety; všetky dátové kolekcie prázdne.

Aktuálny `verification.json` a deväť snímok sú v runtime `sZnpbX`:
`homepage-{1440,390,320}.png`, `homepage-{1440,390,320}-full.png`,
`gallery-{1440,390,320}.png`. Staršia matica 18/18 sa neopakovala ani
nepripisuje tomuto novšiemu snapshotu.

Hlavný agent potvrdil prepnutie IAB na 64708, opravenú vetu a deväť sekcií.
Až po tomto výslovnom potvrdení bol starší server 65202/PID 34392 zastavený.
Hlavný agent navyše uviedol výsledky 462 MJS, 37 TypeScript a 22 cielených
testov textu PASS; tieto sady sa v preview úlohe neopakovali.

### Predchádzajúci snapshot — kontrastná úprava

Vtedy overená URL: http://127.0.0.1:65202 — PID 34392, už zastavený.
Windows pri jeho overení potvrdil skryté okno (`MainWindowHandle = 0`)
a listener výhradne na 127.0.0.1:65202.

Runtime: `C:\Users\Zdeno\AppData\Local\Temp\astana-owner-preview-fHSCuU`.
Odtlačok 305 zdrojových/konfiguračných súborov:
`33e3ccf61a8e1bc63fc04583ad9860a34bddc342f5a1479fb242e214e6a74132`.

Po výsledku 18/18 nižšie hlavný agent doplnil jediný aktívny CSS riadok:
`.steps p { color: #52657b; }`, aby nový modul zachoval existujúcu politiku
kontrastu. Snapshot bol znovu vytvorený až po tejto zmene. SHA-256 modulu
v zdroji aj v aktuálnej kópii je zhodné:
`5c739cd9874cec190ef4c5a5af7a4c61e65b36065f1745a6a9eb1d1ddffbba5d`.

Podľa pokynu hlavného agenta sa po tejto CSS zmene zopakovala iba homepage:

- **3/3 PASS**, 1440×1000, 390×844, 320×568, **07:20:26 Europe/Bratislava**.
- HTTP 200, jeden H1, horizontálny presah 0 na všetkých troch šírkach.
- Všetky tri fotografie majú `naturalWidth > 0`: **475/475/475**, **390/390/390**,
  **320/320/320**. Mobilné menu sa otvorilo aj zatvorilo.
- 0 externých požiadaviek, 0 browser pokusov o zápis, 0 JS výnimiek,
  0 chybných assetov a **všetky lokálne dátové kolekcie prázdne**.
- `verification.json` zaznamenáva úzky rozsah; úplná 18-stavová matica
  a prefill nižšie sa nepripisujú tomuto novšiemu snapshotu.

Aktuálnych deväť snímok je v tomto runtime priečinku:
`homepage-{1440,390,320}.png`, `homepage-{1440,390,320}-full.png`
a `gallery-{1440,390,320}.png`. Všetky zobrazujú načítané fotografie.

Reprodukcia úzkej kontroly:

```powershell
node scripts/owner-preview.mjs verify "C:\Users\Zdeno\AppData\Local\Temp\astana-owner-preview-fHSCuU" --home-only
```

### Predchádzajúci snapshot — úplná matica 18/18 a prefill

Predchádzajúci snapshot po potvrdenom freeze homepage, trojkartového
rozloženia, odstránení osirelého CSS a oprave analytiky:

- Vtedy overená URL: **http://127.0.0.1:64197**; teraz už zastavená.
- Vtedajší proces: **PID 31652**, `MainWindowHandle = 0`.
  Windows potvrdil listener tohto procesu: **127.0.0.1:64197**.
- Runtime: `C:\Users\Zdeno\AppData\Local\Temp\astana-owner-preview-oxNEQV`.
- Odtlačok 305 skopírovaných súborov app/src a konfigurácie/guardu:
  `e26a2ae385ed662321a0c84e0fb88175087d75ecf72201b0df15263038fb829c`.
- Samostatne porovnané SHA-256 pôvodného súboru a kópie sa zhodujú:
  `app/page.tsx` = `3c235a95118576c56fe41da101fecbadc2c3f9804f81ddcd82857f54e0c817c1`;
  `app/homepage-conversion-layout.module.css` = `5f7dcb16a14fed3ff7c7a8bde7f949af7843209cf4ebfbad7d4fc092e3101780`;
  `public/assets/home-below-fold.css` = `4de1bb1e8b033b37972ce94f1b6195e985ac1f5e1eb989566b77f0f4640252ac`.

Overenie ukončené **9. 10. 2026 o 07:17:39 Europe/Bratislava**:

- **18/18 PASS**: `/`, `/cena/` (presmeruje na cenovú stránku), `/realizacie/`,
  `/kariera/`, `/kontakt/`, `/poradna/` pri **1440×1000, 390×844, 320×568**.
  Každá stránka HTTP 200, jeden H1 a nulový horizontálny presah.
- Kalkulačka pri všetkých troch šírkach reagovala na klávesnicu aj materiál.
  Preniesla `130 m2`, `Ukážková obec` a hladký eternit do dopytu.
  E-mail ostal prázdny, GDPR nezaškrtnuté; formulár sa neodoslal.
  Mobilné menu pri 320 px sa otvorilo aj zatvorilo.
- Všetky tri fotografie domovskej galérie majú preukázané `naturalWidth > 0`:
  pri 1440 px **475/475/475**, pri 390 px **390/390/390**,
  pri 320 px **320/320/320**. Opravené sú obe podoby optimalizátora
  `/_next/image` aj `/_next/image/`; výsledok je overený skutočnými obrázkami.
- **0 externých browser požiadaviek**, 0 zachytených výnimiek JavaScriptu,
  0 chybných verejných JS/CSS/image/font assetov, 0 pokusov prehliadača o zápis
  počas overenia. Všetky kolekcie vlastného lokálneho JSON úložiska sú prázdne.
- API/admin/súkromné GET vrátili 403, požiadavka s cudzím Origin vrátila 403.
  Neodosielaný kontrolný POST iba na vlastný runner `/__owner-preview__/write-probe`
  sa odmietol ešte pred aplikáciou. Žiadny POST formulára ani e-mailu.
- Tri 403 požiadavky na interný font vývojárskeho panelu Next.js sú zámerne
  oddelené ako `blockedDevelopmentAssets`; nejde o verejné fotografie webu.
- Hlavný agent nezávisle potvrdil cez CUA IAB načítané tri fotografie,
  desktopové tri stĺpce a nulový presah na desktope aj pri 320 px.

Strojový dôkaz: `verification.json` v runtime priečinku. Snímky:

- `homepage-1440.png`, `homepage-390.png`, `homepage-320.png` — prvá obrazovka.
- `homepage-{1440,390,320}-full.png`, `cena-{1440,390,320}-full.png`,
  `realizacie-{1440,390,320}-full.png` — deväť celostránkových záberov.
- `gallery-1440.png`, `gallery-390.png`, `gallery-320.png` — viditeľné fotografie.

Šesť predchádzajúcich vlastných procesov bolo cielene zastavených:
35464 (`O69xCZ`), 34312 (`nceKpc`), 31428 (`2tfLGQ`), 35260 (`tdDPJN`),
31652 (`oxNEQV`), 34392 (`fHSCuU`, až po potvrdení prepnutia prehliadača).
Ich dočasné kópie zostali na disku; iné procesy sa neukončovali.

Presné zastavenie iba finálneho náhľadu, z ľubovoľného PowerShell priečinka:

```powershell
node "C:\WEB\DIGITAL24.sk\likvidacia-eternitu.sk\scripts\owner-preview.mjs" stop "C:\Users\Zdeno\AppData\Local\Temp\astana-owner-preview-MvmwbX"
```

Produkcia, nasadenie, .env, .git, formulárové/API implementácie a existujúce
skripty sa pri príprave runnera nemenili. V repozitári tento agent vytvoril
iba `scripts/owner-preview.mjs` a tento dokument. Súbežné aplikačné úpravy
patria hlavnému agentovi a Confuciusovi. Tento PASS potvrdzuje rozsah lokálneho
náhľadu, nie produkčný release či ostré odosielanie.
