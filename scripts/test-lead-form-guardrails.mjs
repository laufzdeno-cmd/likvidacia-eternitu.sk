import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

for (const page of ['app/page.tsx', 'app/strechari/page.tsx']) {
  const source = read(page);
  assert(source.includes('name="companyWebsite"'), `${page}: chýba anti-spamové pole.`);
  assert(source.includes('autoComplete="new-password"'), `${page}: anti-spamové pole nesmie používať bežné autofill.`);
  assert(source.includes('data-submit-disabled="true"'), `${page}: anti-spamové pole musí zostať vypnuté.`);
  assert(/name="companyWebsite"[^>]*\bdisabled\b/.test(source), `${page}: anti-spamové pole musí byť disabled.`);
}

for (const client of ['app/homepage-critical-client.tsx', 'app/landing-client.tsx']) {
  const source = read(client);
  assert(!source.includes('HTMLFormElement.prototype.submit'), `${client}: automatický native submit by mohol vytvoriť duplicitný dopyt.`);
  assert(!source.includes('dataset.nativeSubmit'), `${client}: native fallback nesmie obnoviť druhé odoslanie.`);
  assert(!source.includes('/OPR\\//i.test(navigator.userAgent)'), `${client}: Opera nesmie mať samostatnú odosielaciu cestu.`);
  assert(source.includes('controller.abort(), 30000'), `${client}: timeout musí byť 30 sekúnd.`);
  assert(source.includes("form.classList.contains('is-submitting')"), `${client}: chýba zámok proti dvojkliku.`);
  assert(source.includes("control.hasAttribute('data-submit-disabled')"), `${client}: vypnutý honeypot sa nesmie znova aktivovať.`);
  assert(source.includes('responseReceived'), `${client}: odpoveď servera sa nesmie potichu opakovať.`);
  assert(source.includes('ensureSubmissionId'), `${client}: chýba stabilné id odoslania.`);
}

const endpoint = read('app/api/dopyt/route.ts');
assert(endpoint.includes("export { POST } from '../lead/route';"), '/api/dopyt/ musí delegovať na chránený lead endpoint.');

const leadRoute = read('app/api/lead/route.ts');
assert(!leadRoute.includes("import { randomUUID } from 'node:crypto';"), 'Lead route nesmie generovať náhradný submissionId na serveri.');
assert(leadRoute.includes('? raw : null;'), 'Neplatný submissionId musí byť odmietnutý, nie nahradený novým UUID.');
assert(leadRoute.includes('const validatedSubmissionId = submissionId(formData.get(\'submissionId\'));'), 'Lead route musí validovať submissionId pred zápisom.');
assert(leadRoute.includes('if (!validatedSubmissionId)'), 'Chýbajúci alebo neplatný submissionId musí skončiť validačnou chybou.');

const database = read('src/server/db.ts');
assert(database.includes('ON CONFLICT (submission_id) DO NOTHING'), 'Serverová idempotencia leadu chýba.');
assert(database.includes('SELECT * FROM leads WHERE submission_id = $1 LIMIT 1'), 'Pri duplicitnom odoslaní sa musí vrátiť pôvodný lead.');

console.log('Lead form guardrails passed.');
