# Nezávislá kontrola plánu – 30. 9. 2026

Kontrolór: GPT agent Hubble, ID `01a0f1ea-92e8-7ed1-a374-2fdbaedf4eca`. Nie je autorom balíka. Režim read-only, bez úprav kódu, nasadenia a odosielania formulárov.

Rozsah: úplné prečítanie PLAN, EVIDENCE, CONTENT-MAP, PHOTO-MAP, ACCEPTANCE a STATUS; cielená kontrola kódového dôkazu. Hodnotil konzistenciu, ochranu dopytov, etapové gates a meranie kvality/obchodu. Nevykonal novú plnú runtime akceptáciu webu.

## Prvé kolo: RETURN_WITH_DEFECTS

1. P1: E1 pôvodne vyžadovala celý F01–F14 vrátane prefillu z E4 a mapy z E5; vznikla kruhová závislosť. Oprava: E1 vyžaduje svoje testy a regresiu existujúcich tokov, F02 je E4, mapaF14 je E5, celý súbor je E8. Ochranný releaseE1A má samostatné podmienky.
2. P2: absolútne „bez zápisu do produkcie“ nebolo preukázané vzhľadom na možné DB/CMS vedľajšie účinky GET. Oprava: bez zámerných zápisov; neoverené vedľajšie účinky presne označené.
3. P2: timeout pri SMTP nemožno zamieňať s presne-jedným doručením. Oprava: F06 testuje HTTP retry pri známom výsledku, F09 samostatne unknownSMTP a preverenie bez nekontrolovaného fallbacku.

## Cielené druhé kolo: APPROVE

Kontrolór potvrdil uzavretie všetkých3nálezov. V kontrolovanom rozsahu nezostáva otvorená vada plánu.

**Tento verdict sa nevzťahuje na implementáciu, produkčné nasadenie ani dosiahnutie cieľového skóre webu.** E1–E8 zostávajú v stave podľa STATUS.md. Tvrdenia o odporúčaniach AI alebo návratnosti sa neprezentujú ako garantovaný výsledok.

Dodatočné úpravy po verdict: iba zápis výsledku do hlavičky PLAN/STATUS a tento protokol. Obsahová metodika a etapové gates sa nemenili.

## Lokálna kontrola dokumentov

- Všetky relatívne odkazy medzi šiestimi pôvodnými dokumentmi existujú; REVIEW pridaný následne.
- Presne20 primárnych tém,30long-tail tém a34existujúcich URL v mape.
- `git diff --check`: bez whitespace chýb; iba bežné upozornenie Windows na LF/CRLF.
- Menené sú plánovacie dokumenty. Žiadny runtime kód, databázová migrácia, emailová konfigurácia ani deployment sa v plánovacej fáze nemenili.

Zdrojové snapshoty a browser snímky sú lokálne dôkazy opísané v EVIDENCE.md, nie verejný marketingový obsah. Pred implementáciou znovu overiť HEAD a produkčný alias.

## Retenčný diff – cielené GPT re-review, 30. 9. 2026

Kontrolór: GPT agent Nietzsche, ID `01a0f3fb-5b88-76f2-a957-5e7b34462749`. Read-only kontrola aktuálnych zmien v retencii; bez zásahu do kódu, Vercel, Blob ani produkcie.

Verdikt: **APPROVE**, bez P-level nálezov. Kontrolór potvrdil oddelenie retencie od prepínača nahrávania/session secretu, aktualizáciu token timestampu na tom istom DB riadku, ktorý retencia uzamyká, test čerstvého/starého upload tokenu a rozdelenie kandidátov medzi paralelné `SKIP LOCKED` claimy. PGlite 1/1 a foto-intake kontrakty 5/5 prešli.

Zostávajúce limity nie sú súčasťou tohto úzkeho verdictu: reálne Vercel Blob nahratie/zmazanie a retry, nasadený cron/súkromná konfigurácia a migrácia nad existujúcou databázou so starou status constraint schémou ostávajú netestované. Toto schválenie nie je súhlas na zapnutie upload portálu ani nasadenie celého webu.

## Read-only audit verejných realizácií a foto príjmu – 30. 9. 2026

Audit potvrdil, že `/realizacie/` používa statickú galériu a JSON-LD, nezávislú od admin databázy; DB realizácie sa po vytvorení nedajú upraviť a admin CSRF token chýbal vo vytvorení aj zmene stavu. CSRF tokeny sú už doplnené do oboch typov formulárov; samostatný kontrakt prešiel **1/1**. Zvyšné funkčné medzery ostávajú otvorené: edit existujúcej realizácie, bezpečný publikovací gate, prepojenie DB do verejnej galérie, uloženie schváleného EXIF-free derivátu, skutočné stiahnutie aj z verejných URL a mapa s doloženými obcami/okresmi. Súčasné interné schválenie fotky ju nezverejňuje. Read-only audit overil 179 existujúcich JPG v repozitári bez EXIF; to nie je dôkaz práv na publikovanie nových fotiek ani súkromnej konfigurácie produkčného Blob úložiska.

Audit nečítal obsah produkčnej DB ani nenahrával/nezverejňoval žiadne fotky. Pred pokračovaním treba dodané reálne podklady a potvrdenie lokality/publikovateľnosti od majiteľa; mapové body nesmú byť odvodené z presného EXIF GPS bez samostatného posúdenia/súhlasu.

## Súhlas referencií – oprava po nezávislom GPT review, 30. 9. 2026

Prvé read-only review vrátilo `RETURN_WITH_DEFECTS`: dôkaz sa dal obnoviť pri editácii bez opätovného doloženia, dátum nemal hranice a DB skracovala dlhšie znenie. Oprava pridala SHA-256 odtlačok presne zverejneného mena, hodnotenia a textu do verejného aj administrátorského dôkazu; admin formulár polia súhlasu nikdy nepredvyplní a pri editácii vyžaduje nové explicitné doloženie. Dátumy sa validujú od 2000-01-01 po aktuálny UTC deň. Odstránené je DB orezanie na 500 znakov; API vyžaduje celé hodnotenie 1–5. Zodpovedajúce fixture pokrývajú nové consent verzie.

GPT-6 Astra kontrolór po opravách: **APPROVE**, bez nových P-level nálezov. Overil 56/56 unit testov a PGlite integráciu 1/1. Súčasné celé typecheck/build a lokálne URL testy prešli. Staršie referencie bez content-hashu nie sú automaticky považované za nový platný dôkaz a po release sa môžu prestať zobrazovať, kým sa neobnoví potvrdenie; toto treba zahrnúť do release checklistu. Review je read-only a neznamená produkčné nasadenie, live DB ani právne potvrdenie pravdivosti adminom dodaného dôkazu.
