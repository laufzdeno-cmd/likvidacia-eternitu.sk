# OpenAI Ads conversion release checkpoint — 2026-10-11

## Rozsah

Schválený zdrojový checkpoint `ffc21caa428385fb6f0c5557873021678f48ae4c` pridáva meranie udalosti `lead_created` pre OpenAI Ads Pixel `CYUNCfwtj997ebQRw87Gwu`.

- SDK sa načíta až po marketingovom súhlase.
- Súhlas sa odošle pred inicializáciou pixelu.
- Konverzia sa odošle až po serverom potvrdenom prijatí dopytu.
- `event_id` je stabilný a v rámci otvorenej stránky deduplikovaný.
- Do OpenAI Ads sa neposiela meno, telefón, e-mail, poznámka ani fotografie.
- Odvolanie marketingového súhlasu odošle `consent=false`.
- CSP povoľuje iba oficiálne domény potrebné pre merací pixel.

## Overenie

- Cielené testy merania a odloženého klienta: 21/21 PASS.
- Analytické testy: 35/35 PASS.
- Testy dopytového formulára: 68/68 PASS.
- Testy release deploymentu: 9/9 PASS.
- TypeScript kontrola: PASS.
- Lokálny produkčný build: PASS, 100 trás.
- Vercel produkčný kandidát: READY, 100 trás.
- Opera: pred súhlasom 0 OpenAI SDK skriptov; po „Prijať všetky“ 1 SDK skript; bez konzolových chýb.
- Reálny dopyt nebol odoslaný a nevznikol testovací lead ani e-mail.

## Release hranice

- Kampaň zostáva vypnutá; tento release ju nepublikuje a nemení fakturáciu.
- Prijatie prvej udalosti v OpenAI Ads ostáva `NOT VERIFIED`, kým nepríde prvý skutočný dopyt s marketingovým súhlasom.
- Rollback zdrojový commit: `911afedc69c901bae024961ff1465586e7bec1e9`.
- Rollback Vercel deployment: `dpl_3GvoboBZok8cqbGaRrNHAB6z5Xcd`.
