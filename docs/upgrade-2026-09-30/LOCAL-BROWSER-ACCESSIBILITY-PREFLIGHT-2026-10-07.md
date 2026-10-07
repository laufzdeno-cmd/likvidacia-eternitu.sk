# Lokálny browser a accessibility preflight — 7. 10. 2026

## Rozsah

Kontrola použila iba lokálny kandidát na `http://localhost:3100/`. Nebol odoslaný formulár, nahratý súbor, vytvorený dopyt, odoslaný email ani vykonaná produkčná alebo účtová zmena.

## Výsledok

- **Opera desktop: PASS pre načítanie a sémantický smoke.** Lokálna homepage sa načítala s aktuálnym titulkom a obsahom. Accessibility strom obsahoval hlavné menu, jeden hlavný nadpis, telefónne a CTA odkazy, link „Ukážky reálnych striech ASTANA.“ smerujúci na `/realizacie/`, všetky popísané polia krátkeho dopytu, súhlas a odosielacie tlačidlo. Akcia odoslania sa nespustila.
- **Codex in-app Chromium: PASS pre vizuálny smoke.** Lokálna homepage bola vykreslená bez viditeľného rozpadnutia layoutu; predchádzajúci izolovaný responzívny audit zostáva zdrojom dôkazu pre 220/220 stavov.
- **Google Chrome: NOT TESTED po reštarte.** Konektor v aktuálnej relácii sprístupnil Operu, ale Chrome vrátil `Browser is not available: chrome`. Tento výsledok nie je chyba webu. Chrome smoke zostáva povinný na staged deploymente alebo po opätovnom pripojení prehliadača.
- **Skutočná čítačka obrazovky: NOT TESTED.** Opera accessibility strom potvrdil mená a roly prvkov, ale nenahrádza test vo Windows Narrator alebo NVDA. U09 preto zostáva `PARTIAL`.

## Hranice dôkazu

Tento preflight nepotvrdzuje SMTP, databázu, Blob, produkčný CSP, cookies v reálnej doméne, mobilný Safari/Chrome ani finálne doručenie. Produkčný Chrome/Opera smoke sa vykoná až na presne určenom staged deploymente bez živého aliasu a po osobitnom povolení na prípadný označený test dopytu.
