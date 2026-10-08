# U03/U09 — použiteľnosť a prístupná spätná väzba formulárov

Dátum kontroly: 8. 10. 2026

Aplikačný checkpoint: `358675979d2725c618f53122d13782105298df2e`

Strom aplikácie: `e9b79858512e0df7876087b8f1407fb755ab4a5f`

Predchádzajúci širší build a bezpečnostný checkpoint: `d0b1730a2aeba569d62be597259f834db7336ec2`

## Uzavretý rozsah

- Mobilný dopytový formulár po načítaní JavaScriptu sám riadi validáciu, otvorí správny skrytý krok, označí chybu a presunie fokus. Bez JavaScriptu zostáva zachovaná natívna validácia prehliadača.
- Chýbajúci súhlas už nezobrazuje interný názov `gdpr`, ale zrozumiteľnú vetu: „Potvrďte súhlas so spracovaním údajov na vybavenie cenovej ponuky.“
- Kariérny formulár vytvorí nemenný odosielaný snapshot pred čakajúcou operáciou a počas odosielania uzamkne všetky editovateľné polia vrátane CV a súhlasu.
- Dopytový aj kariérny formulár presunú fokus na každý ukončený výsledok — úspech, chybu, timeout aj neoveriteľný stav. Opakovaná rovnaká chyba dostane nový identifikátor pokusu, takže ju technológia pre asistenciu oznámi znovu.
- Opakované odmietnutie toho istého nadlimitného CV dvakrát po sebe zachová vyplnené údaje a súbor, zakaždým zaostrí výsledok a nevykoná žiadny sieťový POST.
- Strechársky formulár zobrazuje chybu regiónov a špecializácií priamo pri príslušnej skupine. Na šírke 320 px zostáva hláška pri zaostrenom opravnom prvku vo viewporte.
- Výsledok strechárskeho formulára mení live-region na úspech alebo chybu a presúva fokus na výsledok.
- Formulár referencie presunie fokus na chybu aj úspech; dve po sebe idúce rovnaké chyby sa oznámia ako samostatné pokusy a zachovajú rozpísané polia.
- Žiadosť o recenziu sa uloží ako odoslaná iba po výslovnom potvrdení administrátorom. Lokálny pending stav sa po dokončení skončí, výsledok dostane fokus aj pri dvoch po sebe idúcich rovnakých výsledkoch a odmietnutie schránky ponúkne ručné kopírovanie.

## Dôkazy

- pôvodný širší formulárový rez: **44/44 cielených kontraktov PASS**,
- najnovší fokusový rez: **8/8 cielených kontraktov PASS**,
- úplná jednotková/kontraktná sada: **393/393 MJS + 34/34 TypeScript PASS**,
- typová kontrola aktuálneho checkpointu: **PASS**,
- izolovaný produkčný build: **99/99 trás**, TypeScript, 32 statických SEO URL, dynamické realizácie/recenzie a route izolácia PASS; BUILD_ID `JTcGAZ_fhpwrtFnTthxHg`,
- verejná responzívna matica zhodného verejného rezu: **20 trás × 11 viewportov = 220/220 PASS**, 25 snímok, 0 odoslaných formulárov, 0 hydration chýb a 0 externých originov,
- strechárska lokálna validácia: 320 × 568 px, obe skupinové chyby viditeľné pri zaostrenom prvku, **0 odoslaných formulárov**,
- admin review-request audit: **3 stavy × 13 viewportov = 39/39 PASS**, 0 odoslaných formulárov a 0 externých originov; chyba aj úspech mali správny aktívny prvok,
- izolovaný dopytový browser tok: **PASS** — 1 lead, 1 zákazka, 2 súkromné prílohy, 2 čakajúce outbox položky, 0 odoslaných emailov, 0 anonymných admin stiahnutí a 0 externých originov; chyba aj retry úspech dostali fokus,
- izolovaný kariérny a strechársky browser tok: **PASS** — opakované nadlimitné CV 2× zaostrené pri 0 POST, 1 bezpečne uložená žiadosť so súkromným CV, obnova chýbajúceho CV, 2 strechárske registrácie, 0 odoslaných emailov a 0 externých originov,
- izolovaný browser tok referencie: **PASS** — 2 rovnaké chyby boli samostatne zaostrené, natívny podpísaný redirect mal 303, formulár zachoval údaje a nevykonal externý request,
- nezávislý produktový kontrolór po oprave opakovanej chyby CV: **PASS bez zostávajúcej konkrétnej vady**,
- najnovší technický kontrolór nebol dostupný pre vyčerpaný limit svojho vlákna. Predchádzajúci technický **PASS** a bezpečnostný scan zostávajú dôkazom pre nezmenené serverové/API/DB/upload/SMTP plochy; najnovší rez mení iba klientsky fokus a jeho testy,
- bezpečnostný diff scan `b3026b4f-bc75-4813-8429-d9717b16c1f5`: **13/13 zmenených súborov preskúmaných, 0 nálezov**. Kontrola pokryla admin autentifikáciu a CSRF, pravdivosť stavu, query/redirect správanie, súbehy a idempotenciu, súkromné prílohy, ochranu osobných údajov a DoS hranice. Dvaja nezávislí kontrolóri vrátili `NO CANDIDATES`.

## Záver

U03 je na lokálnom checkpointe **PASS**. U09 je technicky preukázané automatizovanými a browser testami, ale celkový bod zostáva **PARTIAL**, pretože fyzický test so skutočnou čítačkou obrazovky ešte neprebehol. U10 zostáva samostatná používateľská skúška s piatimi ľuďmi.

Produkcia, Vercel aliasy, produkčná databáza, Blob, formuláre a emaily sa touto kontrolou nemenili.
