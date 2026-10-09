# Staging execution runbook — 8. 10. 2026

Tento dokument je vykonávací checklist pre poslednú bezpečnú bránu pred produkciou. Neobsahuje heslá, tokeny ani oprávnenie na cloudové zmeny, odoslanie formulára alebo produkčný deploy.

## Nemenný kandidát

- Zdroj určený na staging deploy: `9a201efbb68ed1c5b20c9e8c98d0166c2abe5cd2`.
- Otestovaný tree: `8977d39f91204c8944a32388d3bec933a0fbad27`.
- Chránený baseline: `8b8775d05ca638d6a602829e7527b573be3321c9`.
- Manifest: [LOCAL-BUILD-EVIDENCE-9a201efb.json](LOCAL-BUILD-EVIDENCE-9a201efb.json).
- Súhrn aktuálneho lokálneho release dôkazu: [LOCAL-RELEASE-CHECKPOINT-9a201efb.md](LOCAL-RELEASE-CHECKPOINT-9a201efb.md).
- Novšie commity sú iba dôkazové alebo dokumentačné. Nesmú nahradiť presne otestovaný zdroj bez nového nemenného manifestu pre ich vlastný commit a tree.

Pred deployom sa vytvorí izolovaný Git worktree na novej vetve `codex/astana-staging-9a201efb`. Pokračovať možno iba pri presnom SHA, prázdnom pracovnom stave a správnom `.vercel/project.json` pre projekt `likvidacia-eternitu-sk`.

## Povinné potvrdenie pred externou zmenou

Bez čerstvého súhlasu používateľa sa nesmie:

- pripojiť databáza alebo Blob store,
- vytvoriť cloudové úložisko,
- uložiť environment variable alebo tajomstvo,
- vytvoriť deployment,
- odoslať formulár, fotografiu alebo e-mail,
- povýšiť deployment do produkcie.

## 1. Read-only preflight

Pred prvým zápisom znovu potvrdiť:

1. Vercel projekt a custom target `staging`.
2. Aktuálny produkčný deployment, jeho plný Git SHA a produkčné aliasy.
3. IAM/Production Protection a absenciu neznámeho deploy hooku.
4. Čerstvý rollback deployment a jeho zdrojový SHA.
5. Že lokálny súbor `.vercel/env-production-pull.local` sa nebude načítavať ani kopírovať do stagingu.
6. Že detail spojenia produkčnej `astana-crm-db` aj `astana-lead-files-prod` uvádza iba **Production, Preview, Development** a neobsahuje custom environment `staging`; súhrnný štítok **All Environments** nestačí ako dôkaz scope.
7. Že automatické Vercel System Environment Variables zostávajú zapnuté, aby guard dostal `VERCEL_TARGET_ENV` a `VERCEL_PROJECT_ID`; tento prepínač sa nesmie zamieňať so scope databázového alebo Blob spojenia.

Vercel CLI musí mať presne pripnutú a vopred overenú verziu. Token môže byť iba v procesnej premennej; nikdy nie v argumente príkazu, chate, dôkazovom súbore alebo logu.

## 2. Izolované stagingové zdroje

Po schválení pripojiť alebo vytvoriť iba pre custom environment `staging`:

1. existujúcu databázu `astana-staging-db`,
2. nový Private Blob store pre prílohy dopytov a CV,
3. druhý, odlišný Private Blob store pre tímový photo-intake.

Zakázané je použiť produkčnú databázu, `astana-lead-files-prod`, obyčajný Preview alebo rovnaký Blob store pre obe stagingové roly. Staging nedostane vlastnú verejnú doménu a produkčný alias sa nemení.

Po každom spojení sa musí otvoriť jeho detail **Projects / Connections** a potvrdiť presný environment scope `staging`. Ak detail produkčného zdroja začne obsahovať `staging`, alebo stagingový zdroj obsahuje Production/Preview/Development, okamžite zastaviť ešte pred deploymentom. Súhrnný zoznam Storage nie je pre túto kontrolu dostatočný.

## 3. Staging-only konfigurácia

Povinné hodnoty so scope iba `staging`:

```text
DATABASE_URL
DATABASE_RESOURCE_ID
BLOB_READ_WRITE_TOKEN
BLOB_RESOURCE_ID
PHOTO_INTAKE_BLOB_READ_WRITE_TOKEN
PHOTO_INTAKE_BLOB_RESOURCE_ID
STAGING_WRITE_ENABLED=true
STAGING_MAIL_OVERRIDE_TO=<jedna testovacia adresa>
STAGING_DATABASE_MARKER=<64 náhodných hex znakov>
STAGING_RESOURCE_BINDING_SHA256
PRODUCTION_DATABASE_IDENTITY_FINGERPRINT_SHA256
PRODUCTION_DATABASE_RESOURCE_ID_FINGERPRINT_SHA256
PRODUCTION_BLOB_RESOURCE_ID_FINGERPRINT_SHA256
PRODUCTION_PHOTO_INTAKE_BLOB_RESOURCE_ID_FINGERPRINT_SHA256
```

Ďalej sa nastavia staging-only admin/auth a podľa schváleného testu SMTP hodnoty. Pre e-mailový test sa používa `LEAD_EMAIL_DELIVERY_MODE=smtp` a jediný testovací inbox. `ASTANA_RELAY_URL` a `ASTANA_RELAY_SECRET` musia zostať prázdne. Cron trasy zostávajú zablokované.

Citlivé hodnoty sa zadávajú interaktívne alebo cez stdin. Zdrojové databázové URL a Blob tokeny sa nevypisujú. Produkčné kontrolné odtlačky aj staging binding sa počítajú iba v pamäti; uloží sa iba výsledný SHA-256.

## 4. Databázový marker

Až po úplnej a úspešnej väzbe databázy a oboch Blob stores sa spustí:

```text
scripts/bootstrap-staging-database.ts
```

Skript musí dostať explicitné potvrdenie Vercel project ID a staging database resource ID. Smie vytvoriť iba tabuľku `astana_environment_guard` a marker `staging`. Pri odlišnom existujúcom markeri musí skončiť rollbackom; marker sa nikdy neprepisuje ručne.

## 5. Release guard

Release guard sa spustí v izolovanom worktree s čerstvo overeným rollback párom. Explicitný allowlist medzi baseline a kandidátom je presne:

```text
.env.example
app/admin/(protected)/health/page.tsx
app/admin/(protected)/zakazky/export-financie/route.ts
app/api/cron/application-notifications/route.ts
app/api/cron/lead-email-delivery/route.ts
app/api/lead-upload/route.ts
app/api/lead/route.ts
app/api/testimonial/route.ts
app/seo-components.tsx
docs/upgrade-2026-09-30/E8-ACCEPTANCE-MATRIX-2026-10-07.md
docs/upgrade-2026-09-30/G09-BOT-ACCESS-SNAPSHOT-2026-10-09.md
docs/upgrade-2026-09-30/LOCAL-BUILD-EVIDENCE-31157118.json
docs/upgrade-2026-09-30/LOCAL-BUILD-EVIDENCE-981cd9e2.json
docs/upgrade-2026-09-30/LOCAL-BUILD-EVIDENCE-bd61a709.json
docs/upgrade-2026-09-30/LOCAL-RELEASE-CHECKPOINT-31157118.md
docs/upgrade-2026-09-30/LOCAL-RELEASE-CHECKPOINT-981cd9e2.md
docs/upgrade-2026-09-30/LOCAL-RESPONSIVE-INTERACTION-PREFLIGHT-2026-10-08.md
docs/upgrade-2026-09-30/O06-DELIVERY-ALERTS-2026-10-09.md
docs/upgrade-2026-09-30/OWNER-SIGNOFF-CHECKLIST-2026-10-08.md
docs/upgrade-2026-09-30/REALIZATION-EVIDENCE-INVENTORY-2026-10-08.md
docs/upgrade-2026-09-30/STAGING-BOOTSTRAP-2026-10-08.md
docs/upgrade-2026-09-30/STAGING-EXECUTION-RUNBOOK-2026-10-08.md
docs/upgrade-2026-09-30/STATUS.md
docs/upgrade-2026-09-30/U02-PRIMARY-CTA-AUDIT-2026-10-08.md
docs/upgrade-2026-09-30/VERCEL-READONLY-SNAPSHOT-2026-10-08.md
docs/upgrade-2026-09-30/evidence/31157118/databaseIntegration.txt
docs/upgrade-2026-09-30/evidence/31157118/lighthouseBuild.txt
docs/upgrade-2026-09-30/evidence/31157118/productionBuild.txt
docs/upgrade-2026-09-30/evidence/31157118/typecheck.txt
docs/upgrade-2026-09-30/evidence/31157118/unit.txt
docs/upgrade-2026-09-30/evidence/981cd9e2/databaseIntegration.txt
docs/upgrade-2026-09-30/evidence/981cd9e2/lighthouseBuild.txt
docs/upgrade-2026-09-30/evidence/981cd9e2/productionBuild.txt
docs/upgrade-2026-09-30/evidence/981cd9e2/typecheck.txt
docs/upgrade-2026-09-30/evidence/981cd9e2/unit.txt
docs/upgrade-2026-09-30/evidence/bd61a709/productionBuild.txt
docs/upgrade-2026-09-30/evidence/bd61a709/typecheck.txt
docs/upgrade-2026-09-30/evidence/bd61a709/unit.txt
package.json
public/data/company.json
public/llms.txt
scripts/acceptance-matrix-score.test.mjs
scripts/application-notifications-policy.test.mjs
scripts/article-faq-content.test.ts
scripts/business-billing-actions.contract.test.mjs
scripts/capture-local-release-evidence.mjs
scripts/csv.test.mjs
scripts/current-acceptance-checkpoint.test.mjs
scripts/current-vercel-readiness-evidence.test.mjs
scripts/lead-form-contract.test.mjs
scripts/llms-public-content.test.mjs
scripts/meta-capi-consent-race.local.integration.mjs
scripts/ops-alert-dispatch.test.mjs
scripts/ops-alert-local-state.integration.mjs
scripts/ops-alert-postgres.integration.mjs
scripts/owner-signoff-checklist.test.mjs
scripts/photo-intake-browser.integration.mjs
scripts/project-dependency-root.mjs
scripts/project-dependency-root.test.mjs
scripts/realization-evidence-inventory.test.mjs
scripts/release-guardrails.test.mjs
scripts/run-isolated-postgres.ps1
scripts/runtime-feature-health.test.mjs
scripts/seo-structured-data-contract.test.mjs
scripts/testimonial-policy.test.mjs
src/content/seo-content.ts
src/server/db.ts
src/server/ops-alert-dispatch.ts
src/server/ops-alert-policy.ts
src/server/runtime-feature-health.ts
```

Guard musí potvrdiť expected head `9a201efb…`, release vetvu, baseline `8b8775d0…`, rollback SHA/deployment a čerstvo skontrolovanú IAM hranicu.

## 6. Deploy iba do custom stagingu

Deployment sa vytvorí výhradne s targetom `staging`. Nepoužije sa existujúci `.vercel/output` ani `--prebuilt`.

Po stave READY sa deployment overí cez `scripts/deploy-reviewed-release.mjs --staging --candidate-deployment <dpl_...>` s rovnakými guard argumentmi. Overenie musí preukázať:

- správny Vercel projekt,
- target `staging`,
- stav READY,
- presný Git SHA `9a201efbb68ed1c5b20c9e8c98d0166c2abe5cd2`.

## 7. Akceptácia stagingu

Najprv iba read-only smoke:

- homepage,
- `robots.txt`,
- `sitemap.xml`,
- cron endpoint musí zostať zablokovaný.

Po samostatnom čerstvom súhlase nasledujú iba presne označené testovacie toky. Každý názov, poznámka aj predmet musí obsahovať `TEST – NEKONTAKTOVAŤ, NEPOSIELAŤ PONUKU` a všetky e-maily musia smerovať do jediného stagingového inboxu.

1. **F03 — dopyt bez fotografie:** jedno kliknutie, jeden POST, jeden `submissionId`, práve jeden dopyt a jedna zákazka. Overiť admin záznam, zákaznícke potvrdenie a internú notifikáciu podľa zvoleného spôsobu kontaktu; opakovanie s rovnakým ID nesmie vytvoriť duplicitu.
2. **F04 — dve veľké fotografie:** použiť dva platné JPG/PNG/WebP súbory, každý **väčší ako 6 MB**. Pred uploadom zaznamenať názov, MIME, rozmery, počet bajtov a SHA-256. Browser musí vykonať dva priame uploady do Private Blob a finálny lead request smie niesť iba referencie. DB musí obsahovať jeden dopyt, dve prílohy a rovnaký `submissionId`; anonymné otvorenie musí byť odmietnuté a autorizovaný admin musí stiahnuť oba súbory s rovnakou veľkosťou a SHA-256. Verejné HTML, verejné API, analytika ani logy nesmú obsahovať Blob URL alebo storage key.
3. **F08 — doručenie:** v jedinom stagingovom inboxe preukázať internú správu aj zákaznícke potvrdenie, správny `From`/`Reply-To`, predmet, HTML/text verziu a väzbu na jeden dopyt. Iný príjemca je stop podmienka.
4. **F09 — stav doručenia:** v izolovanom DB/mock scenári overiť preukázanú chybu pred prijatím, `failed`, timeout po možnom prijatí, `unknown`, expirovaný claim a zákaz automatického alternatívneho transportu alebo resend pri neistom stave. Pred rozhodnutím sa preverí provider ID/log a inbox. Admin akcia musí vyžadovať autorizáciu, CSRF, výslovné potvrdenie kontroly a allowlistovaný stručný dôkaz bez obsahu e-mailu alebo PII. Zápis výsledku a auditu musí byť atomický. Potvrdené doručenie sa nikdy neposiela znova; samostatný výslovný retry je povolený iba po potvrdenom nedoručení. Každý pokus má vlastný audit a ďalší nejednoznačný výsledok musí zachovať `unknown`; bez dôkazu zostáva `unknown` nevyriešené.
5. **F12 — kariéra a strechári:** kariérny formulár so súkromným CV overiť pre idempotentné opakovanie rovnakého ID, bezpečný nový pokus s novým ID a obnovu chýbajúceho CV alebo e-mailu bez duplicity. Chyba e-mailu sa nesmie tváriť ako doručenie a musí zostať dohľadateľná a obnoviteľná. Kariérny relay smie zopakovať pár iba vtedy, ak sú **obaja príjemcovia potvrdene nedoručení**; nie iba preto, že doručenie nebolo preukázané. Strechársky formulár overiť pre idempotenciu, DB/outbox a retry iba konkrétnemu potvrdene nedoručenému adresátovi. Každé úspešné nové strechárske podanie musí dostať nové ID. Všetky podania musia zostať označené `TEST – NEKONTAKTOVAŤ`, bez automatickej ponuky alebo kontaktovania uchádzača.
6. **Zdieľaný rate limit:** dva súbežné aplikačné procesy alebo rovnocenný integračný dôkaz nad jednou stagingovou DB musia preukázať spoločný limit; lokálna pamäť jedného procesu nestačí.
7. **Cenová ponuka/PDF:** vytvoriť iba administrátorom schválený testovací draft, overiť PDF, dopravu, dokumentáciu a typ objektu. Tlačidlo odoslania zákazníkovi sa nesmie použiť.
8. **Browser matica:** Chrome, Opera a fyzický mobil; dopyt bez fotografie, dopyt s dvoma fotografiami, kariéra/CV, klávesnica, fokus, chybový a úspešný stav. Zachytiť konzolu, sieť a výsledné počty bez ďalších externých originov.

## 8. Crony po promote a po rollbacku

Pred produkčným promote sa vo Vercel Cron Jobs read-only inventári overí, že existuje práve jedna aktívna definícia každého plánovaného endpointu a žiadny starý duplikát:

```text
/api/cron/backup/                    0 3 * * 0
/api/cron/notifications/             0 7 * * *
/api/cron/application-notifications/ */5 * * * *
/api/cron/lead-email-delivery/       */5 * * * *
/api/cron/meta-capi/                 */5 * * * *
/api/cron/photo-intake-retention/    20 4 * * *
/api/cron/lead-upload-retention/     40 4 * * *
/api/cron/lead-file-deletions/       */5 * * * *
/api/cron/career-cv-retention/       10 5 * * *
```

Každý endpoint musí bez autorizácie vrátiť `401`. Po promote sa pri štyroch päťminútových worker endpointoch čaká na prvý prirodzený beh a overí sa deployment, HTTP stav, claimy a backlog bez ručného opakovania. Denné a týždenné úlohy ostávajú **WAITING** až do prvého prirodzeného behu; zelený deploy ich nenahrádza. Po prípadnom rollbacku sa inventár, `401` a prvý prirodzený päťminútový beh overia znova, pretože správanie Vercel cronov pri rollbacku sa nesmie predpokladať.

## Stop podmienky

Okamžite zastaviť pri nesprávnom projekte, targete, SHA, ne-READY stave, prekrytí environment scope produkčných a stagingových zdrojov, zhode stagingovej a produkčnej identity, konflikte markerov, viacnásobnom inboxe, aktívnom relayi, stagingovom crone, produkčnom cron duplikáte alebo neznámom výsledku deploymentu.

Pri neznámom výsledku deployment neopakovať. Najprv ho dohľadať read-only. Produkčný promote je samostatná brána s novým súhlasom, novou kontrolou rollbacku a následným ostrým smoke testom.
