# ASTANA firemný asistent — release 2026-10-15

Tento dokument je release značka k funkčnému commitu `adf2237cf14aafe301486e890c15fe9b422d5d18`.

## Rozsah

- deterministický a idempotentný firemný asistent pripravuje koncept cenovej ponuky iba z dostatočných údajov,
- cenová ponuka má upraviteľný profesionálny sprievodný email a naďalej vyžaduje výslovné odoslanie adminom,
- výsledok ponuky možno zaevidovať ako prijatý, odložený s termínom alebo neúspešný s dôvodom,
- dokončená zákazka môže získať čakajúcu žiadosť o referenciu, ktorú musí človek skontrolovať a odoslať,
- interne schválené fotografie sa pripájajú iba k súkromnému konceptu realizácie,
- text, presnosť lokality, práva aj publikovanie realizácie alebo referencie potvrdzuje človek,
- centrum asistenta a jeho ručné spustenie sú dostupné iba superadminovi,
- chránená plánovaná úloha pripravuje návrhy každých desať minút, nič sama nepublikuje ani neposiela prvý obchodný email.

## Overenie

- TypeScript: PASS,
- jednotkové a kontraktové testy: `548/548 + 38/38` PASS,
- databázové integračné toky: `21/21` PASS vrátane lokálneho a PostgreSQL správania, súbehu a ochrany osobných údajov,
- produkčný build: PASS, `109/109` strán,
- centrum asistenta: `4 trasy × 13 šírok = 52 stavov` PASS,
- pracovná plocha referencií: `4 trasy × 13 šírok = 52 stavov` PASS,
- cenové ponuky v reálnom prehliadači: `12/12` kontrol PASS,
- počas vizuálnych kontrol sa neodoslal formulár ani email a nevzniklo externé sieťové volanie.

## Bezpečnostná hranica

Cenová ponuka, prvá žiadosť o referenciu, verejná referencia a fotografia sa nikdy neodošlú alebo nezverejnia bez aktuálneho rozhodnutia človeka. Asistent nevymýšľa chýbajúci materiál, výmeru, cenu, kontakt ani presnosť lokality. Voľný text obchodného dôvodu sa neduplikuje do auditného logu.
