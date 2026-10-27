# Súkromné dokumenty a kontrolovaný Gmail import

Stav: implementovaný a izolovane otestovaný zdrojový diel novej zákazkovej karty. Nejde o potvrdenie produkčnej funkčnosti ani aktiváciu Gmailu. Žiadne reálne správy, zákaznícke súbory, produkčné tajomstvá alebo databázy sa pri tomto diele nečítali. Zákazníkom sa nič neposielalo.

## Rozsah a API

- `POST /api/admin/job-workspace/upload/`: prihlásený operátor alebo superadmin, overený `_csrf`, obmedzený multipart stream. Polia `file`, `kind=PDF|PHOTO|AUTHORITY`, voliteľne `jobId`. Odpoveď `{ document, extraction }`. Dokumentová projekcia obsahuje identifikátor, názov, hash a autentifikované odkazy; neobsahuje storage key ani verejnú Blob URL.
- `GET /api/admin/job-workspace/documents/{id}/`: prihlásený oprávnený pracovník, autorizácia dokumentu na serveri, bez cache, bez indexovania, CSP sandbox/nosniff. PDF sa sťahuje ako príloha, fotografia sa zobrazuje ako WebP. `?thumbnail=1` je malý náhľad. Neprihlásený dostane 401, Meta reviewer 403, nedostupný dokument 404.
- `storeJobPrivateUpload(input, actor, repository)` a `privateDocumentPublicView(document)` sú serverové adaptéry pre formuláre a súkromnú galériu. Existujúci core register overuje zákazku, rolu a vlastníctvo nezaradeného dokumentu. Zverejnenie referencie nie je súčasť uploadu.

Vstupný limit je **3 MB na súbor**, aby sa požiadavka s rezervou zmestila do bežného limitu serverless požiadavky. JPG/PNG/WebP majú najviac 25 megapixelov a jednu snímku. Sharp aplikuje orientáciu, odstráni metadáta vrátane EXIF/GPS, pripraví WebP do 2400 × 2400 a náhľad do 480 × 360. Pôvodné fotografie sa v tomto novom toku neposielajú do verejného úložiska. Staršie uložené originály sa nemenia.

Produkčné úložisko využíva už overený súkromný foto Blob s existujúcim OIDC/binding pravidlom. Nie je zavedený nový poskytovateľ, verejný adresár, tokenový fallback v produkcii ani S3 účet. Nový privátny prefix `job-workspace/` je oddelený od verejných realizácií. Lokálny disk je povolený iba mimo produkcie a Vercelu. Nasadenie musí samostatne overiť funkčné pripojenie úložiska; lokálny PASS toto nepotvrdzuje.

Po nejasnom potvrdení databázového zápisu sa už nahraté privátne bajty **nemažú**: registrácia mohla uspieť. Potenciálny osamotený súbor ostáva privátny na neskoršie kontrolované zosúladenie. Automatické mazanie registrovaných dokumentov tento adaptér neobsahuje.

## PDF bez externého AI

`job-pdf-extraction.ts` používa lokálny `pdfjs-dist` vo vlastnom Node worker vlákne. Limity: 3 MB, 25 strán, 100 000 znakov, 15 sekúnd, pamäťový limit workeru. Vyhodnocovanie PDF JavaScriptu ani font-face načítanie sa nepoužíva. Pôvodný PDF súbor a jeho SHA-256 ostávajú nezmenené.

Číslo ponuky, dátum, kontakt a suma sú iba deterministické návrhy s konkrétnym zdrojovým úryvkom a `REVIEW_REQUIRED`. Nejde o automatické účtovníctvo. Nejednoznačné položky, skeny, prázdny alebo šifrovaný/nečitateľný obsah vyžadujú ručné doplnenie; nevymýšľa sa množstvo, sadzba ani dnešný dátum. Neexistuje externý OCR/LLM export.

## Gmail

`job-mail-service.ts` poskytuje výhradne superadminovi:

- `getJobMailAdminView(actor, {page?, pageSize?, review?})`: lokálny prehľad konfigurácie a stagingu bez Google volania, predvolene 20 správ, najviac 50 na stranu; vracia `page`, `totalPages`, `total`.
- `getJobMailLabels(actor)`, `configureJobMailSync(input, actor)`: výber existujúcich firemných štítkov, dátum od, limit 1–25 správ. Pred zapnutím potrebuje oficiálne pripojený povolený účet, explicitné potvrdenie overenia a serverový gate `ASTANA_JOB_GMAIL_VERIFIED=true`.
- `synchronizeJobMail(actor, candidates?)`: výslovné ohraničené načítanie. Správy ostanú v superadminovom stagingu. Zhodné číslo ponuky či email je návrh na kontrolu; viac zákaziek rovnakého zákazníka sa automaticky nezlúči. Kurzor každého štítku umožňuje ďalším spustením prechádzať staršie správy; po konci sa ďalší cyklus vráti k novým.
- `reviewJobMailMessage({id, decision:LINK|IGNORE, jobId?, confirmed:true}, actor)`: vedomé schválenie pripojí text a overené prílohy ku konkrétnej zákazke. Jedinečný identifikátor zdrojovej správy bráni opakovanému pripojeniu do druhej karty.
- `importJobMailPdf({stagedId, attachmentId}, actor)`: PDF sa smie načítať iba z už zaevidovanej správy povoleného účtu, s kontrolou ID, MIME, veľkosti, PDF hlavičky a hashom súkromného originálu. Opakované stiahnutie používa kanonický uložený odkaz.
- `disableJobMailSync(actor)` a `disconnectJobMail(actor)`: zastavenie nového čítania, resp. lokálne odpojenie a následné best-effort zrušenie Google tokenu. Schválená privátna história ostáva zachovaná.

Čítací API adaptér používa iba GET na pevnej doméne Gmail API, 12-sekundový timeout, obmedzené JSON odpovede a bezpečné chybové kódy bez obsahu pošty/tokenov. HTML je prevedené na neaktívny text; vzdialené obrázky, odkazy, skripty a štýly sa neotvárajú. Staging neodosiela emaily, nemení Gmail štítky, nepotvrdzuje prijatie CP ani nevytvára reklamné konverzie. V novom diele nie je automatický cron; spustenie je vedomá superadminová akcia.

**Filtrovanie podľa štítkov je pravidlo aplikácie, nie zúženie Google OAuth oprávnenia.** Existujúce `gmail.modify` má širší rozsah. Predchádzajúce rozhodnutie majiteľa overiť aplikáciu u Googlu sa rešpektuje. Tento diel nič nepublikuje v Google Cloud, neobchádza upozornenie a neaktivuje platené bezpečnostné posudzovanie. Reálne Gmail API/Google súhlas/produkčné tokeny zostávajú neoverené.

Perzistencia je oddelená od core zákazky: `job_mail_workspace_state`, zamknutá transakcia v PostgreSQL; pri lokálnych testoch izolovaný súbor s procesovým zámkom a atomickým nahradením. Pri vypnutí alebo zmene rozsahu počas Google volania sa starý výsledok odmietne uložiť. Explicitná migrácia `migrateJobMailSchema(db)` nič nevytvára cez runtime UI.

## Dôkazy

`node --import tsx --test scripts/job-private-mail.test.mjs`: **9/9 PASS** po poslednej oprave, izolovaný priečinok pod `tmp/job-private-mail-tests/`.

Testy overujú reálny komprimovaný digitálny PDF cez worker, prázdny/neplatný PDF a ručné doplnenie, pôvodné PDF bajty/hash, zachovanie bajtov po nejasnom DB potvrdení, WebP/náhľad a odstránenie EXIF, neaktívny emailový text, návrhy s nejednoznačným zákazníkom, GET-only Google adaptér cez fake transport, firemné štítky a staršie strany, kontrolu PDF príloh, SA-only/off-by-default staging, Google gate, súbežnú deduplikáciu, konflikt revízie a idempotentnú migráciu v PGlite.

Samotné browserové upload/401/403 a zobrazenie galérie v produkčnom builde ešte musí potvrdiť integrátor/nezávislý kontrolór. Produkčné Blob/Gmail spojenie, kompletný firemný Gmail import, OCR skenov a dodatočné riadené odstraňovanie osamotených súborov týmto testom overené nie sú.
