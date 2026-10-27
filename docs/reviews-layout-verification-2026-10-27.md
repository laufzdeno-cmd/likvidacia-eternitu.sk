# Recenzie a typografia – záverečná kontrola

Toto je historický čiastkový report pred celoplošnou kontrolou GPT kontrolórom. Následné nálezy, opravy a presný konečný kandidát sú zhrnuté v `public-polish-acceptance-2026-10-27.md`; staršie počty a verdikty nižšie opisujú iba svoje uvedené zostavy. Žiadny z týchto lokálnych výsledkov nepotvrdzuje nové produkčné nasadenie.

Stav: **PRIPRAVENÉ A LOKÁLNE OVERENÉ; NOVÝ ROZSAH NIE JE NASADENÝ**.

Východisková produkcia: commit `c4272342b8207ff27aafa9508af831c1fe56df09`. Aktuálna izolovaná zostava s hviezdičkami: `tmp/review-layout/candidate-1793094831760`, build `mleluqZFvwg3YJ6pfzPXC`. Všetkých 12 zmenených aplikačných a obsahových súborov bolo porovnaných s náhľadom; nebol zistený rozdiel. Úplná matica rozloženia nižšie bola vykonaná pred poslednou úpravou popiskov a hodnotenia na zostave `uU0a1_ssN-_QLYEM9BoSC`; následné kontroly sú zaznamenané v doplneniach.

## Doplnenie: klikateľné hviezdičky

Rozbaľovací výber hodnotenia nahradilo päť hviezdičiek. Pod nimi sú natívne rádiové tlačidlá s rovnakým poľom `rating` a hodnotami 1–5. Bez zmeny API, súhlasov, identifikátorov či schvaľovania. Výber funguje kliknutím, dotykom, klávesnicou a bez JavaScriptu. Po odoslaní sa správne resetuje, pri chybe zostáva zachovaný.

- Produkčný build a TypeScript: PASS, 115 stránok/endpointov.
- Relevantné testy recenzií a workflow: 14/14 PASS.
- Výber všetkých hodnôt 1–5, počet vyplnených hviezdičiek, šípky, Tab, fokus a ciele minimálne 44 px: PASS pri 1440/768/390/320 px.
- Náhľad pri prejdení myšou nemení uloženú hodnotu: PASS.
- Dotykové ovládanie a natívne odoslanie bez JavaScriptu: PASS, odoslaná zvolená hodnota 3 zachytená iba v lokálnom teste.
- Povinný súhlas, simulovaná chyba, zachovanie hodnotenia 1 aj textu, stabilný identifikátor opakovania, úspech a reset na pôvodné hodnotenie: PASS.
- Reálne odoslania alebo databázové zmeny: 0.
- Dôkazy: `tmp/review-layout/star-check.json`, `star-tests.txt`, `form-check.json`; náhľady `stars-1440.png`, `stars-390.png`.

## Doplnenie: prirodzené popisky originálnych fotografií

Majiteľ potvrdil vlastné originálne demontáže ASTANA, s.r.o. Odstránili sa formulácie o tom, že fotografia nepredstavuje autora recenzie alebo neoznačuje realizáciu, aj podobné vedľajšie výhrady v popiskoch. Recenzie, všetky regióny, O firme, FAQ, poradňa a Realizácie používajú stručné opisy fotografovaných prác. Odstránilo sa aj označenie ilustračnej fotografie na stránke pre strechárov.

- Opakovaný produkčný build a TypeScript: PASS, 115 stránok/endpointov.
- Relevantné obsahové/SEO testy po úprave: 33/33 PASS.
- Kontrola všetkých 35 verejných URL na neprítomnosť odmietnutých formulácií: PASS, 0 chýb.
- Šesť následných kontrol popiskov a presahov pri 1440/390 px na recenziách, regióne a článku: PASS.
- Dôkaz: `tmp/review-layout/caption-check.json`, `caption-tests.txt`; náhľady `caption-*.png`.
- Nasadenie na produkciu sa nevykonalo; aktualizovaný je lokálny náhľad a pripravený zdroj.

## Hotové

- Na `/recenzie/` je prvá funkčná sekcia krátky formulár v mätovom paneli, pred schválenými hodnoteniami a fotografiou. Je dostupný cez kotvu `#napisat-recenziu`. Krátky úvod má vlastný odkaz na schválené skúsenosti.
- Formulár má tmavé popisy, biele polia, zelené tlačidlo, zreteľný fokus, ovládacie prvky s textom minimálne 16 px a výškou minimálne 44 px. Checkbox zostáva normálny checkbox s veľkou klikateľnou etiketou. Paleta má overený minimálny kontrast 5,45:1 v kontrolovaných pároch.
- Verejný a osobný formulár používajú rovnaký komponent. Osobná stránka získala rovnaké farby tela; nezmenil sa token, odosielanie, validácia, súhlas ani schvaľovanie.
- Dlhé odseky, odpovede FAQ a telo článkov majú čitateľnú šírku do 760 px. Text ostáva zarovnaný doľava, obsahové kontajnery sú vycentrované. Zjednotilo sa riadkovanie, zalamovanie nadpisov a vertikálne odstupy. Právne texty sa vecne nemenili.
- Pri audite homepage sa našiel checkbox odporúčania strechára natiahnutý ako textové pole. Teraz má 20 × 20 px a je vedľa textu, ktorý má vlastný pružný stĺpec. Jeho hodnota a funkčnosť sa nemenili.

## Ako sa zákazník dostane k dotazníku

1. K dokončenej zákazke asistent pripravuje žiadosť v stave `pending_approval`. Po ľudskom schválení sa použije existujúce odoslanie s osobným odkazom `/recenzie/<token>/`, platným 30 dní. Žiadosť je priradená ku konkrétnej zákazke.
2. Verejný odkaz `/recenzie/` možno poslať samostatne. Po nasadení bude fungovať aj priama kotva `/recenzie/#napisat-recenziu`.
3. Obe cesty ukladajú referenciu na kontrolu. Odoslanie nie je automatické zverejnenie. Aktuálne produkčné nastavenia automatizácie sa pri tejto úlohe nemenili ani neoverovali v súkromnom účte.

## Overenie

| Kontrola | Výsledok |
| --- | --- |
| Finálny produkčný build a TypeScript | PASS, 115 vygenerovaných stránok/endpointov |
| Súvisiace testy recenzií, súhlasov, schvaľovania a obsahu/SEO | 53/53 PASS |
| Súvisiace testy dopytového formulára a odporúčania strechára | 47/47 PASS |
| 35 verejných URL × 1440/768/390/320 px | 140/140 PASS, 0 chýb |
| Orezávanie, presahy, riadkovanie, šírky odsekov, centrovanie a poradie recenzie | PASS |
| Metadata/canonical/odkazy zostaveného HTML | PASS, 33 statických URL; dynamické recenzie a realizácie aj cez HTTP/browser |
| Klávesnicový fokus a ovládacie prvky recenzie | PASS v štyroch šírkach |
| Povinný súhlas, simulovaná chyba, zachovanie textu, opakovanie, úspech a fokus potvrdenia | PASS |
| Nízke hodnotenie cez rovnakú cestu a stabilný identifikátor opakovania | PASS |
| Ručná vizuálna kontrola | PASS, recenzie, článok, FAQ, služba, región, kontakt a právne stránky |
| `git diff --check` | PASS |

Prehliadač mal povolený iba loopback. Funkčná skúška zachytila dve požiadavky na odoslanie lokálne v prehliadači a simulovala odpovede; neodoslala referenciu skutočnému serveru a nič nezapísala do produkcie. Osobný token zákazníka sa neotváral. Zachovanie existujúceho procesu súkromných odkazov, schválenia a publikovania pokrývajú izolované testy workflow.

Prvý priechod našiel mobilné písmo tlačidla 13 px a chybný rozmer checkboxu. Oboje bolo opravené a finálny priechod zopakovaný. Presah ozdobnej spojovacej čiary krokov na stránke pre strechárov bol overený ako grafika s viditeľným overflow, bez orezaného textu; kontrola ho správne nevyhodnocuje ako chybu textu.

## Dôkazy

- `tmp/review-layout/browser/report.json`
- `tmp/review-layout/browser-check.txt`
- `tmp/review-layout/form-check.json`
- `tmp/review-layout/tests.txt`, `lead-tests.txt`
- `tmp/review-layout/baseline-typography.json`
- `tmp/review-layout/build.log`, `candidate.json`
- Náhľad: http://127.0.0.1:3147/recenzie/#napisat-recenziu

Reklamy, meranie, odosielanie správ, API, úložiská, databázové schémy a publikovanie zákazníckych fotografií sa nemenili. Toto overenie nepotvrdzuje aktuálne indexovanie v Google ani nové reálne doručenie zákazníckeho e-mailu. Produkčné nasadenie je samostatný ďalší krok po výslovnom schválení tohto nového rozsahu.
