# Riadené nasadenie zákazkových kariet – 27. 10. 2026

Majiteľ výslovne schválil nasadenie kandidáta `0913c256ebd26a9522fc76731549f1c3f4cc7600` aj doprednej databázovej migrácie a následnú nezávislú kontrolu. Gmail má zostať vypnutý do overenia. Rozsah nemení verejné URL, reklamy, dotazník ani meranie; neobjednáva platené služby.

Pred úpravou bol cez existujúce prihlásenie oficiálneho Vercel CLI overený projekt `prj_33bexlmoSP20DpesVJ4gWVHmZtkH`, tím `team_YXyTmAek7bBSOa6iNb2nI41A`, Node 24.x a živý deployment `dpl_41YhGeJk2qWS1gtRR22UNsBVAmyM` zo zdroja `366d64930a0860edae7b005f4be2f504430cfe68`. Konektory tento projekt nesprístupňujú; ich nepríbuzné projekty sa nepoužívajú.

## Bezpečnostný doplnok vydania

- Release guard dostáva iba výslovnú úzku výnimku na schválený presne pripnutý `pdfjs-dist@6.4.299`, schválené Git bloby package/lock a konkrétne cesty bezpečnostného doplnku. Baseline ostáva pôvodná; všeobecná kontrola sa nevypína.
- Kompatibilný návratový commit obsahuje všetky nové ochrany kanonickej ceny a skutočného dňa, ale novú pracovnú kartu, import, synchronizáciu, nové zápisy a uploady má zablokované pevným prepínačom v zdroji. Nasledujúci aktívny commit zapne iba tento prepínač. Staršie operatívne funkcie zostávajú dostupné. Návrat na pôvodný `366d6493` po nových zápisoch nie je dovolený.
- Oba buildy sa pripravia zo samostatných presných Git archívov cez production `--skip-domain`. Až po overení kandidáta nasleduje povýšenie cez kontrolovaný helper. Pri nejasnom výsledku povýšenia sa overia aliasy; krok sa slepo neopakuje.

## Migrácia a obnova

`scripts/job-workspace-production-migration.mjs` bez `--apply` iba kontroluje cieľ. Zápis vyžaduje čistý presný schválený zdroj a odtlačok cieľovej databázy. Nastavenia sa injektujú cez existujúci `vercel env run`; žiadne heslá ani zákaznícke riadky sa nevypisujú ani neukladajú lokálne.

Pred DDL vytvorí konzistentný export bežných tabuliek bez návštevníckych štatistík do samostatnej novej cesty existujúceho súkromného firemného Blob úložiska. Jeho väzba na projekt bola nezávisle overená cez provider metadáta. Export sa overí súčtom po súkromnom načítaní a odmietnutím anonymného čítania. Staršie zálohy sa nemažú.

Stiahnutý export následne prejde `scripts/job-workspace-backup-drill.mjs`: oddelený proces bez prevádzkových tajomstiev, sieť povolená iba na loopback, PostgreSQL/PGlite v pamäti, typované vloženie všetkých stĺpcov a kontrola počtov. Sekvencie sa obnovia podľa maxima a overí sa bezpečná nasledujúca hodnota. Dáta sa neposielajú do AI ani do inej služby. Tento dôkaz je skúška obnovy riadkov do schémy aplikácie; nie je tvrdením o obnove celej infraštruktúry alebo príloh.

Obe dopredné migrácie prebehnú na jednom klientovi v jednej transakcii s krátkym limitom na zámok a poradným zámkom. Pred a po sa kontroluje súčet pôvodných cien a skutočných dní zákaziek. Konfigurácia Gmailu sa vynúti na vypnutú a staré pripojenia sa deaktivujú bez čítania správ. Nasleduje overenie schémy a vypnutia Gmailu. Tabuľky ani originály sa pri návrate nemažú.

## Záverečná kontrola

GPT kontrolór oddelí lokálne prijatie od živého overenia. Na produkcii sa preverí presný commit/deployment/alias, dostupnosť verejného webu a prihlásenia, neprihlásený prístup k súkromným súborom, vypnutý Gmail a nové runtime chyby. Pri dostupných oprávnených reláciách sa preverí operátor a superadmin bez úpravy reálnych zákaziek alebo odoslania zákazníckych správ. Nedostupná relácia sa uvedie ako neoverená, nie ako PASS.

Predchádzajúca širšia unit sada obsahuje 15 pôvodných pádov bez nového zlyhávajúceho testu oproti baseline; celá sada sa netvrdí ako zelená. Pred nasadením už existoval problém plánovanej úlohy `application-notifications` (503); jeho aktuálny stav sa posudzuje samostatne a neskrýva sa výsledkom buildu.

Konkrétne časy, kontrolné súčty zálohy, priebeh migrácie, kandidát a produkčné aliasy budú v samostatných dôkazoch `test-results/job-workspace-production-*` a `tmp/job-workspace-release/`. Finálne nezávislé stanovisko patrí do `docs/gpt-job-workspace-production-review-2026-10-27.md`.
