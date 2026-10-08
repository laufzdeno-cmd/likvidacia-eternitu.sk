# Staging execution runbook — 8. 10. 2026

Tento dokument je vykonávací checklist pre poslednú bezpečnú bránu pred produkciou. Neobsahuje heslá, tokeny ani oprávnenie na cloudové zmeny, odoslanie formulára alebo produkčný deploy.

## Nemenný kandidát

- Zdroj určený na staging deploy: `bd61a709677f9a24a04fd5f5d61ef9f3984c8f5a`.
- Otestovaný tree: `7156f6b731bd684c8481a7a6ac8503c16bfba73b`.
- Chránený baseline: `8b8775d05ca638d6a602829e7527b573be3321c9`.
- Manifest: [LOCAL-BUILD-EVIDENCE-bd61a709.json](LOCAL-BUILD-EVIDENCE-bd61a709.json).
- Commit `9fb623e5` a novšie commity sú iba dôkazové/dokumentačné. Nesmú nahradiť presne otestovaný zdroj pri staging deploymente.

Pred deployom sa vytvorí izolovaný Git worktree na novej vetve `codex/astana-staging-bd61a709`. Pokračovať možno iba pri presnom SHA, prázdnom pracovnom stave a správnom `.vercel/project.json` pre projekt `likvidacia-eternitu-sk`.

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
app/admin/(protected)/zakazky/export-financie/route.ts
docs/upgrade-2026-09-30/U02-PRIMARY-CTA-AUDIT-2026-10-08.md
scripts/business-billing-actions.contract.test.mjs
scripts/capture-local-release-evidence.mjs
scripts/csv.test.mjs
scripts/current-acceptance-checkpoint.test.mjs
```

Guard musí potvrdiť expected head `bd61a709…`, release vetvu, baseline `8b8775d0…`, rollback SHA/deployment a čerstvo skontrolovanú IAM hranicu.

## 6. Deploy iba do custom stagingu

Deployment sa vytvorí výhradne s targetom `staging`. Nepoužije sa existujúci `.vercel/output` ani `--prebuilt`.

Po stave READY sa deployment overí cez `scripts/deploy-reviewed-release.mjs --staging --candidate-deployment <dpl_...>` s rovnakými guard argumentmi. Overenie musí preukázať:

- správny Vercel projekt,
- target `staging`,
- stav READY,
- presný Git SHA `bd61a709677f9a24a04fd5f5d61ef9f3984c8f5a`.

## 7. Akceptácia stagingu

Najprv iba read-only smoke:

- homepage,
- `robots.txt`,
- `sitemap.xml`,
- cron endpoint musí zostať zablokovaný.

Po samostatnom čerstvom súhlase nasledujú presne označené testovacie toky:

1. dopyt bez fotografie,
2. dopyt s platnou fotografiou,
3. interný e-mail a zákaznícke potvrdenie v jedinom testovacom inboxe,
4. správne väzby v adminovi a súkromný prístup k prílohám,
5. cenová ponuka/PDF bez jej odoslania zákazníkovi,
6. mobilná a desktopová browser matica.

## Stop podmienky

Okamžite zastaviť pri nesprávnom projekte, targete, SHA, ne-READY stave, prekrytí environment scope produkčných a stagingových zdrojov, zhode stagingovej a produkčnej identity, konflikte markerov, viacnásobnom inboxe, aktívnom relayi, povolenom crone alebo neznámom výsledku deploymentu.

Pri neznámom výsledku deployment neopakovať. Najprv ho dohľadať read-only. Produkčný promote je samostatná brána s novým súhlasom, novou kontrolou rollbacku a následným ostrým smoke testom.
