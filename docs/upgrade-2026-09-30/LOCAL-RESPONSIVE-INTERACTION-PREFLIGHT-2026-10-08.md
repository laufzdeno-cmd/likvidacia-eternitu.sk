# Lokálny responzívny a interakčný preflight — 8. 10. 2026

## Identita kandidáta a bezpečnostná hranica

- Vetva: `codex/astana-upgrade-rc1`
- Kontrolovaný HEAD: `07b4825b`
- Lokálny cieľ: `http://localhost:3100/`
- Runtime: Next.js 16.4.0 v lokálnom `webpack` dev režime
- Kontrola nevykonala deployment, produkčnú zmenu, upload, POST formulára, zápis do databázy ani odoslanie emailu.
- Kontaktné údaje použité pri prechode krokmi boli výlučne lokálne testovacie hodnoty a formulár nebol odoslaný.

## Kontrolované viewporty

| Trasa / stav | 1440 × 900 | 390 × 844 | 320 × 568 |
|---|---:|---:|---:|
| Homepage a hero | PASS | PASS | PASS |
| Dopyt — kroky 1 až 4 bez odoslania | štrukturálny PASS | PASS | PASS |
| Realizácie a filtre | PASS | PASS | PASS |
| Detail fotografie / lightbox | — | PASS | PASS po ustálení layoutu |
| Mobilné menu | — | PASS | PASS |

## Konkrétne výsledky

### Homepage

- Jeden H1: „Bezpečná likvidácia azbestu a eternitu po celom Slovensku“.
- Primárne CTA a telefonické CTA sú na mobile viditeľné bez horizontálneho pretečenia.
- Desktop 1440 px nemá horizontálne pretečenie ani chýbajúci viditeľný hero obrázok.
- Odkaz „Ukážky reálnych striech ASTANA.“ úspešne naviguje na `/realizacie/` a cieľová galéria je viditeľná.

### Dopytový formulár

- Krok 1 obsahuje približnú výmeru, obec/mesto a voliteľný okres.
- Krok 2 obsahuje povinný materiál a typ objektu a voliteľné údaje o strechárovi a termíne.
- Krok 3 obsahuje voľbu kontaktu, telefón, meno a email.
- Krok 4 obsahuje voliteľné fotografie, poznámku, povinný GDPR súhlas a finálne CTA.
- Upload akceptuje iba `.jpg`, `.jpeg`, `.png`, `.webp` a príslušné MIME typy; podporuje viac súborov.
- Všetky viditeľné ovládacie prvky ostali v hraniciach layoutu pri 390 px aj 320 px.
- Honeypot `companyWebsite` zostal mimo obrazovky; nie je to horizontálny vizuálny prepad formulára.
- Formulár nebol odoslaný, preto tento preflight nepotvrdzuje F03, F04 ani doručenie emailov.

### Realizácie

- Galéria sa načítala s jedným H1 a bez chýbajúceho viditeľného obrázka.
- Horizontálny pás filtrov je zámerne samostatne posúvateľný; nerozširuje šírku dokumentu.
- Filter „Hospodárske budovy“ zobrazil iba tri zodpovedajúce karty.
- Detail fotografie sa otvoril ako celoplošný dialóg, zablokoval scroll pozadia a zostal v hraniciach mobilného viewportu.
- Mobilné menu sa otvorilo, zobrazilo všetky hlavné odkazy a navigácia „Realizácie“ skončila na správnej trase s H1 „Reálne realizácie ASTANA“.

## Pozorovanie úzkeho viewportu

Pri prvom okamžitom meraní po zmene viewportu na 320 × 568 px bola pevná spodná CTA dočasne nameraná mimo obrazovky. Po dokončení reflow mala `position: fixed`, `bottom: 12px`, rozmery 281 × 58 px a obdĺžnik `top: 498px`, `bottom: 556px`; následná snímka ju zobrazila správne. Išlo o prechodný stav počas zmeny viewportu, nie reprodukovateľnú chybu CSS.

## Záver a obmedzenia

Lokálny kandidát prešiel manuálnym responzívnym a interakčným preflightom pre homepage, štyri kroky dopytu, galériu, filtre, lightbox, mobilné menu a kritický odkaz na realizácie. Tento výsledok podporuje lokálne U01, U03, U04, U06 a U07, ale nenahrádza staging, fyzický mobil, skutočnú čítačku obrazovky, test piatich ľudí ani produkčné odoslanie a doručenie.
