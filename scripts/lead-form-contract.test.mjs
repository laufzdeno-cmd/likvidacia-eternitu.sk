import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const [route, uploadRoute, retentionRoute, db, uploadSchema, client, uploadClient, validation, mail, packageJson, vercelJson] = await Promise.all([
  readFile(new URL('../app/api/lead/route.ts', import.meta.url), 'utf8'),
  readFile(new URL('../app/api/lead-upload/route.ts', import.meta.url), 'utf8'),
  readFile(new URL('../app/api/cron/lead-upload-retention/route.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/server/db.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/server/lead-upload-schema.ts', import.meta.url), 'utf8'),
  readFile(new URL('../app/homepage-critical-client.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/client/lead-photo-upload.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/server/validation.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/server/mail.ts', import.meta.url), 'utf8'),
  readFile(new URL('../package.json', import.meta.url), 'utf8'),
  readFile(new URL('../vercel.json', import.meta.url), 'utf8'),
]);

function includes(source, text, message) {
  assert.ok(source.includes(text), message);
}

includes(validation, "submissionId: z.string().uuid", 'Server musí odmietnuť chýbajúce alebo neplatné submissionId.');
includes(route, "submissionId: formData.get('submissionId')", 'API musí submissionId naozaj načítať z formulára.');
includes(client, 'ensureSubmissionId', 'Prehliadač musí pred odoslaním vytvoriť stabilné submissionId.');
includes(client, "const endpoints = ['/api/dopyt/'];", 'Formulár musí mať iba jeden odosielací endpoint.');
includes(client, "form.classList.contains('is-submitting')", 'Druhý klik počas odosielania musí byť zablokovaný.');
includes(route, 'createLeadSubmission(input, verifiedDirectPhotos)', 'API musí uložiť dopyt aj overené fotky jednou idempotentnou cestou.');
includes(route, 'const directFileRows = submission.files', 'API nesmie priraďovať súkromné fotky až po uložení dopytu.');
includes(route, "duplicate: true, emailSent: false", 'Identický retry nesmie poslať druhý e-mail.');
includes(route, 'emailSent: false', 'Neúspešné odovzdanie e-mailu musí byť v odpovedi rozlíšené.');
includes(db, 'CREATE UNIQUE INDEX IF NOT EXISTS leads_submission_id_uq', 'Databáza musí chrániť submissionId unikátnym indexom.');
includes(db, 'CREATE UNIQUE INDEX IF NOT EXISTS business_jobs_lead_id_uq', 'Databáza musí mať maximálne jednu zákazku na dopyt.');
includes(db, 'lead_id uuid REFERENCES leads(id)', 'Zákazka musí odkazovať na konkrétny dopyt.');
includes(db, 'const client = await db.connect();', 'Kritický zápis musí používať jednu databázovú transakciu.');
assert.ok(!client.includes("from '@vercel/blob/client'") && !uploadClient.includes("from '@vercel/blob/client'"), 'Súkromné fotky sa nesmú nahrávať cez nepodporovanú klientsku tokenovú cestu.');
includes(uploadRoute, 'issueSignedToken', 'Server musí vydať úzko obmedzený podpis pre súkromný upload.');
includes(uploadRoute, "operations: ['put']", 'Podpis musí povoľovať iba zápis jedného súboru.');
includes(uploadRoute, "access: 'private'", 'Upload musí zostať v súkromnom Blob úložisku.');
includes(uploadRoute, 'maximumSizeInBytes: sizeBytes', 'Podpis musí byť obmedzený presnou veľkosťou súboru.');
includes(uploadRoute, 'allowedContentTypes: [contentType]', 'Podpis musí byť obmedzený presným typom súboru.');
includes(uploadRoute, "if (!origin) return false", 'Endpoint nesmie vydávať podpis bez overeného pôvodu požiadavky.');
includes(uploadRoute, "'Cache-Control': 'no-store'", 'Odpoveď s krátkodobým podpisom sa nesmie ukladať do cache.');
includes(uploadRoute, "'x-allow-overwrite': '0'", 'Upload nesmie prepísať existujúci súbor.');
includes(uploadRoute, 'reserveLeadUploadDraft', 'Cestu a rezerváciu súkromnej fotky musí vytvoriť server.');
includes(uploadRoute, 'consumeLeadUploadRateLimit', 'Vydávanie upload podpisov musí mať zdieľaný databázový limit.');
includes(uploadRoute, "request.headers.get('x-vercel-forwarded-for')", 'Rate limit musí preferovať dôveryhodnú IP hlavičku platformy.');
includes(uploadClient, "method: 'PUT'", 'Prehliadač musí fotku odoslať priamo cez krátkodobý podpísaný PUT.');
includes(client, 'if (state.uploaded) return state.uploaded', 'Opakovanie nesmie znova nahrať už potvrdenú fotku.');
includes(uploadClient, "requestLeadPhotoUpload(options.input, 'confirm'", 'Neistý výsledok uploadu sa musí pred retry overiť na serveri.');
includes(client, 'const uploadedPhotos = await uploadLeadPhotos();', 'Dopyt sa smie odoslať až po úspešnom nahratí fotiek.');
includes(db, 'assertLeadUploadCapacity(Number(count.rows[0]?.count ?? 0))', 'Limit desiatich príloh musí byť vynútený atomicky v databáze.');
includes(db, 'pg_advisory_xact_lock(hashtext($1))', 'Súbežné rezervácie a priradenia musia byť serializované.');
includes(uploadSchema, 'DROP CONSTRAINT IF EXISTS lead_upload_drafts_status_check', 'Migrácia musí bezpečne nahradiť staršie stavové obmedzenie uploadov.');
includes(db, 'attachLeadUploadDrafts', 'Priradenie fotiek k dopytu musí prebehnúť v databázovej transakcii.');
includes(retentionRoute, 'mayDeleteClaimedLeadUploadDraft', 'Čistenie musí pred zmazaním znova overiť vlastníctvo claimu.');
includes(retentionRoute, 'completeLeadUploadDraftDeletion', 'Audit sa smie zapísať až po zmazaní súkromného Blobu.');
includes(retentionRoute, "process.env.VERCEL_ENV !== 'production'", 'Preview deployment nesmie čistiť produkčné súbory.');
includes(retentionRoute, "token !== secret", 'Retention endpoint musí vyžadovať CRON_SECRET.');
includes(vercelJson, '"path": "/api/cron/lead-upload-retention"', 'Čistenie opustených uploadov musí byť naplánované.');
includes(packageJson, '"@vercel/blob": "2.8.0"', 'Podpísané URL vyžadujú aktuálnu fixnú verziu Blob SDK.');
includes(packageJson, '"undici": "^6.28.1"', 'HTTP klient musí mať opravenú bezpečnostnú verziu.');
includes(mail, "customerLeadEmailSubject = '✅ ASTANA, s.r.o. prijala váš dopyt | likvidacia-eternitu.sk'", 'Predmet musí jasne pomenovať firmu ASTANA, s.r.o.');
includes(mail, "customerLeadLogoUrl = 'https://likvidacia-eternitu.sk/assets/astana-logo-dark.png'", 'Zákaznícky email musí používať oficiálne logo ASTANA.');
includes(mail, 'alt="ASTANA, s.r.o."', 'Logo musí mať zrozumiteľný náhradný text.');
includes(mail, '>ASTANA, s.r.o.</div>', 'Názov firmy musí zostať viditeľný aj pri zablokovaných obrázkoch.');
includes(mail, 'ASTANA, s.r.o. – odborná likvidácia azbestu a eternitu', 'Textová verzia emailu musí pomenovať firmu.');
await access(new URL('../public/assets/astana-logo-dark.png', import.meta.url));

console.log('lead-form contract: PASS');
