# Audit AI Act a GDPR – likvidacia-eternitu.sk

**Dátum auditu:** 2026-09-06
**Auditný základ:** izolovaný worktree `codex/privacy-ai-act-eternit`, odvodený od `60ff61e8a95583a74657a1961c0fdb76912c8167`; výsledky nižšie zahŕňajú zmeny v tomto worktree.
**Rozsah:** iba `likvidacia-eternitu.sk`; ostatné weby neboli menené ani auditované ako súčasť tejto úlohy.
**Výsledok:** `READY FOR RELEASE REVIEW` – zmeny sú pripravené na lokálne overenie a samostatný release.

Tento dokument je technický audit. Nenahrádza právne stanovisko ani potvrdenie konkrétnych zmlúv, poskytovateľov a retenčných lehôt prevádzkovateľom.

## 1. Metóda a hranice

Prešiel som verejné právne stránky, verejné formuláre a ich API route, analytiku, consent modul, databázový model, úložisko súborov, emaily, cron route a autentifikáciu. Vyhľadávanie AI bolo zamerané na OpenAI, ChatGPT, Gemini, Claude, Anthropic, LLM, AI systém, generatívnu AI a strojové učenie. Nevykonal sa produkčný submit, testovací email, produkčná DB zmena ani deploy.

## 2. OVERENÝ DÔKAZ

### 2.1 AI spracovanie

- V zdrojovom kóde nie je nájdené API napojenie na OpenAI, Gemini, Claude, Anthropic ani iný LLM provider.
- `/api/lead/` prijíma údaje formulára, vytvorí lead, business job, uloží prílohy a odošle email; nevolá AI službu.
- `/api/roofer-registration/` prijíma partnerskú registráciu a odošle internú správu; nevolá AI službu.
- Fotografie sa validujú podľa typu, veľkosti a magic bytes a ukladajú sa cez Vercel Blob, S3 alebo iba lokálny neprodukčný fallback. Úložisko je nastavené ako neverejné.
- Orientačná cena sa počíta pevnými sadzbami v klientskom kóde. Nie je to automatizované rozhodovanie ani AI cenotvorba.
- V aktuálnom runtime sa nenašla AI interakcia so zákazníkom ani AI-generovaný verejný obsah.

### 2.2 GDPR informačná vrstva

Verejná stránka `/ochrana-osobnych-udajov/` teraz uvádza:

- prevádzkovateľa a kontaktné miesto,
- kategórie údajov z dopytu, partnerskej registrácie a referencie,
- voliteľné fotografie a neverejné úložisko,
- user-agent pri dopyte a krátkodobé použitie IP na rate-limit,
- účely a navrhované právne základy podľa účelu,
- retenčné pravidlo 6 mesiacov / 5 rokov / najviac 12 mesiacov pre analytiku,
- práva vrátane sťažnosti na ÚOOÚ SR,
- kategórie príjemcov a externé plánovacie služby,
- samostatnú sekciu „Umelá inteligencia a automatizované kontroly“.

Verejná stránka `/cookies/` teraz opisuje nevyhnutné uloženie voľby a voliteľné meranie po voľbe „Prijať všetky“.

### 2.3 Súhlas a meranie

- Cookie banner zapisuje voľbu cez existujúci modul `src/lib/marketing-consent.ts`.
- Staršia hodnota `astana-cookies-v1` sa pri návšteve bezpečne prevedie na novšiu voľbu; `all` znamená marketing/voliteľné meranie povolené a `necessary` odmietnuté.
- First-party analytika a partnerské eventy sa odosielajú iba pri marketingovej/voliteľnej voľbe.
- Existujúca Meta cesta už kontrolovala marketingový súhlas; táto logika nebola prepisovaná.
- Zmena nemení polia formulára, endpointy, databázu, emailové šablóny, consent checkbox formulára ani crony.

## 3. ROZPOR / RIZIKO

### P1 – Runtime `ensureSchema()` vykonával databázové zmeny (VYRIEŠENÉ V TOMTO WORKTREE)

Pôvodný `src/server/db.ts` pri prvom použití Postgresu vykonával `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, indexy a následne legacy cleanup/seed. To znamenalo, že runtime nebol čisto read/write vrstva.

V tomto worktree je bežný runtime už read-only pri kontrole pripravenosti schémy: `ensureSchema()` overuje existenciu povinných tabuliek a pri chýbajúcej schéme skončí jasnou chybou s pokynom na explicitné `db:init`. DDL, seed a legacy cleanup sa spúšťajú iba cez exportovanú `initializeDatabase()`, ktorú volá výhradne `scripts/init-db.ts`.

Tým sa oddeľuje jednorazový bootstrap od request-time runtime. Pred produkčným nasadením však stále treba vykonať samostatný read-only preflight a explicitný bootstrap/migration release podľa aktuálnej databázovej schémy.

### P1 – Retenčné lehoty nie sú z kódu preukázané ako automaticky vynucované

Verejná stránka uvádza retenčné lehoty, ale v auditovanom kóde som nenašiel pravidelný job, ktorý by podľa nich mazal alebo anonymizoval leads, business jobs a analytics events. Backup cron uchováva posledných 12 backup súborov, čo nie je to isté ako retenčná lehota CRM údajov.

Riziko: politika môže byť správna ako interné pravidlo, ale treba ju prevádzkovo zaviesť a vedieť preukázať.

### P1 – Poskytovatelia a prenosy mimo EHP vyžadujú prevádzkové potvrdenie

Kód používa podľa konfigurácie PostgreSQL, Vercel Blob alebo S3, SMTP a pri plánovaní Nominatim/Open-Meteo. Z repozitára nemožno potvrdiť konkrétny plán, región, DPA, subprocesorov ani prenos mimo EHP. Prevádzkovateľ ich musí doplniť do evidencie spracovateľov a preveriť prenosový mechanizmus.

### P2 – Význam povinného checkboxu vo formulári

Formuláre vyžadujú pole `gdpr` alebo `privacyConsent`. Technicky sa uloží boolean, ale z kódu nemožno s istotou určiť, či má byť tento krok chápaný ako potvrdenie informačnej povinnosti alebo ako samostatný právny súhlas. Právny základ dopytu je v texte popísaný ako kroky na žiadosť osoby pred uzatvorením zmluvy; prevádzkovateľ musí potvrdiť, že text checkboxu a zvolený právny základ sú zosúladené.

### P2 – IP a user-agent

IP adresa sa používa v pamäťovom rate-limite a do analytického záznamu sa neposiela. Pri lead route sa user-agent ukladá do `raw_data`. Verejný text to teraz uvádza, ale prevádzkovateľ má overiť skutočné proxy hlavičky, logovanie platformy a retenčné lehoty týchto technických logov.

### P2 – Admin a emailové operácie

Admin má podpísanú HttpOnly session, CSRF kontrolu a 2FA mechanizmus. Emailové šablóny a administratívne obrazovky pracujú s PII; prístupy, exporty, mazanie a obnova musia zostať auditované a dostupné iba oprávneným používateľom. Tento audit ich nemenil.

## 4. INFERENCIA / OWNER INPUT

Tieto skutočnosti nemožno potvrdiť iba zo zdrojového kódu a vyžadujú odpoveď prevádzkovateľa:

- či je určený DPO alebo kontaktná osoba nad rámec `astana@astana.sk`,
- či sú retenčné lehoty 6 mesiacov / 5 rokov / 12 mesiacov schválené a reálne vykonávané,
- presný zoznam hostingového, databázového, blob/S3 a SMTP poskytovateľa,
- krajiny spracovania a DPA/safeguards pre každého poskytovateľa,
- či sa v runtime/proxy logoch uchováva IP, user-agent alebo request body,
- či sa má partnerský profil po samostatnom súhlase niekedy zverejniť a v akom rozsahu,
- či sa pri referenciách eviduje a uchováva dôkaz súhlasu na publikovanie,
- finálne právne potvrdenie právnych základov a textov checkboxov.

## 5. AI Act – použiteľnosť na aktuálny web

### Článok 4 – AI gramotnosť

Audit nepotvrdil AI systém nasadený na tomto webe. Povinnosť podľa článku 4 sa preto v tomto audite neaplikuje ako povinnosť zaviesť školenie pre existujúcu webovú analytiku alebo kalkulačku. Ak ASTANA začne AI systém používať, musí zaviesť primeranú AI gramotnosť pracovníkov, ktorí ho prevádzkujú alebo používajú.

### Článok 50 – transparentnosť

Audit nepotvrdil chatbota, AI komunikáciu s návštevníkom ani verejne publikovaný syntetický text, obraz alebo video. Na aktuálny runtime sa preto z tohto dôvodu nepridáva globálne AI označenie. Pri budúcom chatbote alebo syntetickom obsahu sa musí urobiť nové posúdenie podľa konkrétnej funkcie.

### Článok 113 – časová pôsobnosť

AI Act uvádza všeobecnú použiteľnosť od 2. augusta 2026 a osobitné dátumy pre jednotlivé časti. Dátum auditu je po tomto dátume, preto sa budúce AI zmeny nesmú posudzovať podľa starého predpokladu, že nariadenie ešte neplatí.

## 6. GDPR – použiteľnosť na aktuálny web

Informácie na stránke sú zosúladené s požiadavkami transparentnosti podľa článku 13 GDPR v rozsahu, ktorý bol možné potvrdiť z kódu. Pri dopyte ide typicky o kroky na žiadosť osoby pred uzatvorením zmluvy; pri zákonných záznamoch o právnu povinnosť; pri bezpečnostných opatreniach o možný oprávnený záujem; pri voliteľnom profile, referencii a meraní o samostatnú voľbu. Konečné právne zaradenie musí potvrdiť prevádzkovateľ.

Web podľa auditovaného kódu nerobí rozhodnutia výlučne automatizovaným spracovaním s právnym alebo obdobne významným účinkom podľa článku 22 GDPR. Pevný cenový výpočet a ľudské posúdenie dopytu nie sú takým rozhodnutím.

## 7. Zmeny vykonané v tomto worktree

- `app/public-widgets.tsx` – banner používa existujúcu consent vrstvu a migruje starú voľbu.
- `app/public-base-client.tsx` – first-party analytika je consent-aware.
- `app/homepage-below-fold-client.tsx` – first-party analytika je consent-aware.
- `app/homepage-critical-client.tsx` – first-party analytika je consent-aware; Meta flow zostal zachovaný.
- `app/landing-client.tsx` – first-party analytika a roofer eventy sú consent-aware.
- `app/ochrana-osobnych-udajov/page.tsx` – doplnená informačná vrstva podľa skutočne nájdených tokov.
- `app/cookies/page.tsx` – doplnený opis voľby a voliteľného merania.
- `src/server/db.ts` – runtime už automaticky nespúšťa DDL, seed ani legacy cleanup; bootstrap je explicitný.
- `scripts/init-db.ts` – explicitný databázový bootstrap cez `initializeDatabase()`.
- `docs/AI_USE_POLICY_ASTANA_2026-09-05.md` – interná politika používania AI.
- `docs/AI_ACT_GDPR_APPLICABILITY_AUDIT_2026-09-05.md` – tento audit.

Nevytvoril som `AI_PERSONAL_DATA_CONTRACT_DELTA.md`, pretože audit nenašiel reálne AI spracúvanie osobných údajov.

## 8. Kontroly pred review

- produkčný submit: nevykonaný,
- testovací email: nevykonaný,
- produkčná DB: nedotknutá,
- deploy/push/commit: v čase pôvodného auditu nevykonaný; release sa posudzuje samostatne,
- typecheck: PASS (`npm ci --ignore-scripts` a `npm run typecheck`),
- `git diff --check`: PASS,
- explicitný bootstrap test: PASS na dočasnom lokálnom PostgreSQL; sled `empty PostgreSQL → db:init → runtime read-only check` prešiel,
- production-equivalent build: PASS na dočasnom lokálnom PostgreSQL s platným `DATABASE_URL`; produkčná DB sa nepoužila,
- runtime bez inicializovanej schémy: PASS bezpečným zlyhaním s jasným pokynom na `db:init`, bez runtime DDL,
- runtime/produkčné integračné testy: nevykonané; nebol vytvorený produkčný submit, email ani databázová zmena,
- ostatné domény: nedotknuté.

## Zdroje

- [AI Act, nariadenie (EÚ) 2024/1689, EUR-Lex](https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng)
- [GDPR, nariadenie (EÚ) 2016/679, EUR-Lex](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679)
- [EDPB: Information and access rights](https://www.edpb.europa.eu/sme/be-compliant/respect-individuals-rights_en)
- [EDPB: Lawful processing](https://www.edpb.europa.eu/sme/be-compliant/process-personal-data-lawfully_en)
- [Úrad na ochranu osobných údajov SR](https://dataprotection.gov.sk/sk/kontakt/)
