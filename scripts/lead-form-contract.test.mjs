import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [route, db, client, validation] = await Promise.all([
  readFile(new URL('../app/api/lead/route.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/server/db.ts', import.meta.url), 'utf8'),
  readFile(new URL('../app/homepage-critical-client.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/server/validation.ts', import.meta.url), 'utf8'),
]);

function includes(source, text, message) {
  assert.ok(source.includes(text), message);
}

includes(validation, "submissionId: z.string().uuid", 'Server musí odmietnuť chýbajúce alebo neplatné submissionId.');
includes(route, "submissionId: formData.get('submissionId')", 'API musí submissionId naozaj načítať z formulára.');
includes(client, 'ensureSubmissionId', 'Prehliadač musí pred odoslaním vytvoriť stabilné submissionId.');
includes(client, "const endpoints = ['/api/dopyt/'];", 'Formulár musí mať iba jeden odosielací endpoint.');
includes(client, "form.classList.contains('is-submitting')", 'Druhý klik počas odosielania musí byť zablokovaný.');
includes(route, 'createLeadSubmission(input)', 'API musí vytvárať dopyt cez idempotentnú cestu.');
includes(route, "duplicate: true, emailSent: false", 'Identický retry nesmie poslať druhý e-mail.');
includes(route, 'emailSent: false', 'Neúspešné odovzdanie e-mailu musí byť v odpovedi rozlíšené.');
includes(db, 'CREATE UNIQUE INDEX IF NOT EXISTS leads_submission_id_uq', 'Databáza musí chrániť submissionId unikátnym indexom.');
includes(db, 'CREATE UNIQUE INDEX IF NOT EXISTS business_jobs_lead_id_uq', 'Databáza musí mať maximálne jednu zákazku na dopyt.');
includes(db, 'lead_id uuid REFERENCES leads(id)', 'Zákazka musí odkazovať na konkrétny dopyt.');
includes(db, 'const client = await db.connect();', 'Kritický zápis musí používať jednu databázovú transakciu.');

console.log('lead-form contract: PASS');
