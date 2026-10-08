# U03/U09 — použiteľnosť a prístupná spätná väzba formulárov

Dátum kontroly: 8. 10. 2026

Aplikačný checkpoint: `d0b1730a2aeba569d62be597259f834db7336ec2`

Strom aplikácie: `c3f12d8844c775ac3de1aa44406d08e515e47710`

## Uzavretý rozsah

- Mobilný dopytový formulár po načítaní JavaScriptu sám riadi validáciu, otvorí správny skrytý krok, označí chybu a presunie fokus. Bez JavaScriptu zostáva zachovaná natívna validácia prehliadača.
- Chýbajúci súhlas už nezobrazuje interný názov `gdpr`, ale zrozumiteľnú vetu: „Potvrďte súhlas so spracovaním údajov na vybavenie cenovej ponuky.“
- Kariérny formulár vytvorí nemenný odosielaný snapshot pred čakajúcou operáciou a počas odosielania uzamkne všetky editovateľné polia vrátane CV a súhlasu.
- Strechársky formulár zobrazuje chybu regiónov a špecializácií priamo pri príslušnej skupine. Na šírke 320 px zostáva hláška pri zaostrenom opravnom prvku vo viewporte.
- Výsledok strechárskeho formulára mení live-region na úspech alebo chybu a presúva fokus na výsledok.
- Žiadosť o recenziu sa uloží ako odoslaná iba po výslovnom potvrdení administrátorom. Lokálny pending stav sa po dokončení skončí, výsledok dostane fokus aj pri dvoch po sebe idúcich rovnakých výsledkoch a odmietnutie schránky ponúkne ručné kopírovanie.

## Dôkazy

- cielené kontrakty: **44/44 PASS**,
- úplná jednotková/kontraktná sada: **393/393 MJS + 34/34 TypeScript PASS**,
- izolovaný produkčný build: **99/99 trás**, TypeScript, 32 statických SEO URL, dynamické realizácie/recenzie a route izolácia PASS; BUILD_ID `JTcGAZ_fhpwrtFnTthxHg`,
- verejná responzívna matica zhodného verejného rezu: **20 trás × 11 viewportov = 220/220 PASS**, 25 snímok, 0 odoslaných formulárov, 0 hydration chýb a 0 externých originov,
- strechárska lokálna validácia: 320 × 568 px, obe skupinové chyby viditeľné pri zaostrenom prvku, **0 odoslaných formulárov**,
- admin review-request audit: **3 stavy × 13 viewportov = 39/39 PASS**, 0 odoslaných formulárov a 0 externých originov; chyba aj úspech mali správny aktívny prvok,
- nezávislý produktový kontrolór: **PASS**,
- nezávislý technický kontrolór po troch opravných iteráciách: **PASS**.

## Záver

U03 je na lokálnom checkpointe **PASS**. U09 je technicky preukázané automatizovanými a browser testami, ale celkový bod zostáva **PARTIAL**, pretože fyzický test so skutočnou čítačkou obrazovky ešte neprebehol. U10 zostáva samostatná používateľská skúška s piatimi ľuďmi.

Produkcia, Vercel aliasy, produkčná databáza, Blob, formuláre a emaily sa touto kontrolou nemenili.
