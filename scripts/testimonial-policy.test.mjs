import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { canUseTestimonialStatus } from '../src/server/testimonial-policy.ts';
import {
  bindPublicTestimonialConsent,
  adminTestimonialConsentVersion,
  formatAdminTestimonialConsentEvidence,
  isValidAdminTestimonialConsentEvidence,
  publicTestimonialConsentVersion,
  publicTestimonialConsentWording,
} from '../src/lib/testimonial-consent.ts';
import { testimonialPublicContentHash } from '../src/server/testimonial-policy.ts';
import { testimonialConsentHistoryEntries } from '../src/server/testimonial-consent-history.ts';

const testRoot = join(fileURLToPath(new URL('..', import.meta.url)));
function removeTestDirectory(directory, prefix) {
  if (resolve(directory, '..') !== resolve(testRoot) || !directory.split(/[\\/]/).at(-1)?.startsWith(prefix)) {
    throw new Error('Neočakávaná cesta testových dát; odmietam ju odstrániť.');
  }
  rmSync(directory, { recursive: true, force: true });
}

test('testimonial consent changes retain the superseded evidence and record grant or revocation', () => {
  const prior = {
    consentPublication: true,
    consentEvidence: 'presný pôvodný súhlas',
    consentCapturedAt: '2026-09-01T10:00:00.000Z',
    consentVersion: adminTestimonialConsentVersion,
    consentRevokedAt: undefined,
    customerName: 'Ján P.', rating: 5, text: 'Pôvodný schválený text.',
  };
  const updated = {
    ...prior,
    consentEvidence: 'presný nový súhlas',
    consentCapturedAt: '2026-10-01T10:00:00.000Z',
    text: 'Nový schválený text.',
  };
  const changed = testimonialConsentHistoryEntries(prior, updated);
  assert.deepEqual(changed.map((item) => item.event), ['superseded', 'granted']);
  assert.equal(changed[0].snapshot.consentEvidence, 'presný pôvodný súhlas');
  assert.equal(changed[0].snapshot.customerName, 'Ján P.');
  assert.equal(changed[0].snapshot.rating, 5);
  assert.equal(changed[0].snapshot.text, 'Pôvodný schválený text.');
  assert.equal(changed[1].snapshot.consentEvidence, 'presný nový súhlas');
  assert.deepEqual(testimonialConsentHistoryEntries(prior, {
    ...prior, consentPublication: false, consentRevokedAt: '2026-10-01T11:00:00.000Z',
  }).map((item) => item.event), ['superseded', 'revoked']);
  assert.deepEqual(testimonialConsentHistoryEntries({
    ...prior, consentPublication: false, consentEvidence: '', consentCapturedAt: undefined, consentVersion: '', consentRevokedAt: undefined,
  }, {
    ...prior, consentPublication: false, consentEvidence: '', consentCapturedAt: undefined, consentVersion: '', consentRevokedAt: undefined,
  }), []);
});

test('approval requires exact consent version, matching evidence, capture timestamp and active consent', () => {
  const captured = '2026-09-30T10:00:00.000Z';
  const customerName = 'Ján P.';
  const rating = 5;
  const text = 'S prácou firmy sme boli spokojní.';
  const hash = testimonialPublicContentHash(customerName, rating, text);
  const publicEvidence = bindPublicTestimonialConsent(hash);
  assert.equal(canUseTestimonialStatus('approved', false), false);
  assert.equal(canUseTestimonialStatus('approved', true, publicEvidence, captured), false);
  assert.equal(canUseTestimonialStatus('approved', true, publicEvidence, captured, undefined, ''), false);
  assert.equal(canUseTestimonialStatus('approved', true, publicEvidence, 'not-a-time', undefined, publicTestimonialConsentVersion, customerName, rating, text), false);
  assert.equal(canUseTestimonialStatus('approved', true, `${publicEvidence} navyše`, captured, undefined, publicTestimonialConsentVersion, customerName, rating, text), false);
  assert.equal(canUseTestimonialStatus('approved', true, publicEvidence, captured, undefined, publicTestimonialConsentVersion, customerName, rating, text), true);
  assert.equal(canUseTestimonialStatus('approved', true, publicEvidence, captured, '2026-09-30T11:00:00.000Z', publicTestimonialConsentVersion, customerName, rating, text), false);
  assert.equal(canUseTestimonialStatus('approved', true, publicEvidence, captured, undefined, publicTestimonialConsentVersion, customerName, rating, `${text} zmena`), false);
  const adminEvidence = formatAdminTestimonialConsentEvidence('Súhlasím so zverejnením presného znenia uvedeného v tejto správe.', 'e-mail', '2026-09-30', hash);
  assert.equal(canUseTestimonialStatus('approved', true, adminEvidence, captured, undefined, adminTestimonialConsentVersion, customerName, rating, text), true);
  assert.equal(canUseTestimonialStatus('approved', true, adminEvidence, captured, undefined, adminTestimonialConsentVersion, customerName, rating, `${text} zmena`), false);
  assert.equal(canUseTestimonialStatus('approved', true, 'Zdroj súhlasu: e-mail; dátum súhlasu: 2026-09-30.', captured, undefined, adminTestimonialConsentVersion, customerName, rating, text), false);
  assert.equal(canUseTestimonialStatus('approved', true, 'Mám doložený súhlas zákazníka.', captured, undefined, adminTestimonialConsentVersion, customerName, rating, text), false);
  assert.equal(canUseTestimonialStatus('approved', true, adminEvidence, captured, undefined, ''), false);
  assert.equal(canUseTestimonialStatus('approved', true, 'ok', captured, undefined, adminTestimonialConsentVersion, customerName, rating, text), false);
});

test('public consent precisely matches public output; manual admin evidence requires exact wording, source and real ISO date', () => {
  assert.match(publicTestimonialConsentWording, /meno alebo iniciály, text skúsenosti, hodnotenie a dátum odoslania/);
  assert.match(publicTestimonialConsentWording, /E-mail nebude zverejnený/);
  assert.match(publicTestimonialConsentWording, /žiadnych ďalších údajov/);
  const hash = 'a'.repeat(64);
  const today = new Date().toISOString().slice(0, 10);
  assert.equal(isValidAdminTestimonialConsentEvidence(formatAdminTestimonialConsentEvidence('Zákazník výslovne odsúhlasil toto presné znenie.', 'webový formulár', today, hash), hash), true);
  assert.equal(isValidAdminTestimonialConsentEvidence(formatAdminTestimonialConsentEvidence('', 'e-mail', today, hash)), false);
  assert.equal(isValidAdminTestimonialConsentEvidence(formatAdminTestimonialConsentEvidence('Súhlas zákazníka je doložený.', 'e-mail', '2026-02-31', hash)), false);
  assert.equal(isValidAdminTestimonialConsentEvidence(formatAdminTestimonialConsentEvidence('x'.repeat(2001), 'e-mail', today, hash)), false);
  assert.equal(isValidAdminTestimonialConsentEvidence(formatAdminTestimonialConsentEvidence('Zákazník súhlasil s konkrétnou referenciou.', 'e-mail', '2000-01-01', hash)), true);
  assert.equal(isValidAdminTestimonialConsentEvidence(formatAdminTestimonialConsentEvidence('Zákazník súhlasil s konkrétnou referenciou.', 'e-mail', '2099-12-31', hash)), false);
  assert.equal(isValidAdminTestimonialConsentEvidence(formatAdminTestimonialConsentEvidence('Zákazník súhlasil s konkrétnou referenciou.', 'e-mail', '1900-01-01', hash)), false);
  assert.equal(isValidAdminTestimonialConsentEvidence('súhlas ústne'), false);
});

test('draft and hidden references do not require publication consent', () => {
  assert.equal(canUseTestimonialStatus('draft', false), true);
  assert.equal(canUseTestimonialStatus('hidden', false), true);
});

test('every canonical reference mutation form submits its CSRF token and legacy admin URL consolidates', async () => {
  const [page, legacyPage, nav, database, adminActions] = await Promise.all([
    readFile(new URL('../app/admin/(protected)/referencie/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/admin/(protected)/reviews/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/admin/(protected)/admin-nav.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/server/db.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/admin/(protected)/referencie/actions.ts', import.meta.url), 'utf8'),
  ]);
  assert.equal((page.match(/name="_csrf"/g) || []).length, 4);
  assert.match(page, /csrfTokenForEmail, requireAdminUser/);
  assert.match(legacyPage, /redirect\('\/admin\/referencie'\)/);
  assert.doesNotMatch(nav, /href: '\/admin\/reviews', label: 'Recenzie'/);
  assert.match(database, /testimonial\.consentEvidence \|\| ''/);
  assert.match(database, /BTRIM\(consent_evidence\) <> '' AND consent_captured_at IS NOT NULL AND BTRIM\(consent_version\) <> '' AND consent_revoked_at IS NULL/);
  assert.match(database, /consent_version IN \(\$2, \$3\)/);
  assert.match(database, /Odtlačok schváleného znenia: \[a-f0-9\]\{64\}/);
  assert.match(adminActions, /formatAdminTestimonialConsentEvidence/);
  assert.match(page, /Pole sa zámerne nepredvyplní/);
  assert.match(adminActions, /consentWording', 2000/);
  assert.match(adminActions, /adminTestimonialConsentVersion/);
  assert.match(adminActions, /isValidAdminTestimonialConsentEvidence/);
  assert.match(page, /name="consentWording"[^>]*maxLength=\{2000\}/);
  assert.match(page, /listTestimonialsPage/);
  assert.match(page, /listTestimonialAdminHistory/);
  assert.match(page, /Otvorená referencia je mimo aktuálnej strany alebo zvoleného filtra/);
  assert.match(page, /História úprav a súhlasov/);
  assert.match(database, /export async function getTestimonial\(id: string\)/);
  assert.match(database, /export async function listTestimonialsPage/);
  assert.match(database, /export async function listTestimonialAdminHistory/);
});

test('public review page passes an explicit allow-list and never serializes internal consent data', async () => {
  const [page, form, route, database] = await Promise.all([
    readFile(new URL('../app/recenzie/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/recenzie/testimonial-form.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/testimonial/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/server/db.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(page, /map\(\(\{ id, customerName, rating, text, createdAt \}\)/);
  assert.doesNotMatch(page, /consentEvidence|consentCapturedAt|customerEmail|internalNote|photoUrl|approvedBy/);
  assert.match(page, /export const dynamic = 'force-dynamic'/);
  assert.match(form, /publicTestimonialConsentWording/);
  assert.match(route, /consentEvidence: bindPublicTestimonialConsent\(testimonialPublicContentHash/);
  assert.match(route, /consentVersion: publicTestimonialConsentVersion/);
  assert.match(route, /rating: z\.coerce\.number\(\)\.int\(\)\.min\(1\)\.max\(5\)/);
  assert.doesNotMatch(database, /changes:\s*\{[^}]*consentEvidence\s*:/);
  assert.match(database, /consentEvidenceRecorded: Boolean\(testimonial\.consentEvidence\)/);
  const updateImplementation = database.slice(database.indexOf('export async function updateTestimonial('), database.indexOf('export async function updateTestimonialStatus('));
  assert.match(updateImplementation, /INSERT INTO audit_logs/);
  assert.match(updateImplementation, /await client\.query\('BEGIN'\)/);
  assert.match(updateImplementation, /await client\.query\('COMMIT'\)/);
  assert.match(updateImplementation, /await client\.query\('ROLLBACK'\)/);
  assert.match(updateImplementation, /consentEvidenceRecorded:\s*Boolean\(/);
  assert.doesNotMatch(updateImplementation, /changes:\s*\{[^}]*consentEvidence\s*[:,]/s);
});

test('public testimonial form cannot leak personal fields through a native GET submission', async () => {
  const [page, form, route] = await Promise.all([
    readFile(new URL('../app/recenzie/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/recenzie/testimonial-form.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/testimonial/route.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(page, /randomUUID\(\)/);
  assert.match(form, /method="post" action="\/api\/testimonial"/);
  assert.match(form, /type="hidden" name="submissionId" value=\{submissionId\.current\}/);
  assert.match(route, /request\.formData\(\)/);
  assert.match(route, /createTestimonialReceiptToken\(testimonialReceiptSecret\(\)\)/);
  assert.match(route, /Location: `\/recenzie\/\?referencia_receipt=\$\{encodeURIComponent\(receipt\)\}`/);
  assert.match(page, /verifyTestimonialReceiptToken\(params\.referencia_receipt, testimonialReceiptSecret\(\)\)/);
  assert.doesNotMatch(page, /params\.odoslane === '1'/);
  assert.doesNotMatch(form, /method="get"/i);
});

test('public testimonial throttle uses the shared Postgres limiter and only an HMAC client key', async () => {
  const [route, form, database] = await Promise.all([
    readFile(new URL('../app/api/testimonial/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/recenzie/testimonial-form.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/server/db.ts', import.meta.url), 'utf8'),
  ]);
  assert.doesNotMatch(route, /new Map\s*</);
  assert.match(route, /consumeApiRateLimit/);
  assert.match(route, /createHmac\('sha256', secret\)/);
  assert.match(route, /trustedRateLimitClientIp\(request\.headers\)/);
  assert.doesNotMatch(route, /function clientIp|x-real-ip|x-forwarded-for/);
  assert.match(route, /originAllowed\(request\)/);
  assert.match(route, /parsed\.data\.website/);
  assert.match(route, /submissionId: z\.string\(\)\.uuid/);
  assert.match(form, /submissionId\.current = crypto\.randomUUID\(\)/);
  assert.match(form, /body\.set\('submissionId', submissionId\.current\)/);
  assert.match(database, /testimonials_submission_id_unique_idx/);
  assert.match(database, /ON CONFLICT \(submission_id\)[\s\S]*DO NOTHING/);
  assert.match(database, /BEGIN[\s\S]*testimonial_created[\s\S]*COMMIT/);
  assert.match(database, /await client\.query\('ROLLBACK'\)/);
  assert.match(database, /if \(!db\) \{\s*return withLocalLeadSubmissionLock\(async \(\) => \{[\s\S]*local\.testimonials\.find/);
  for (const field of ['customerName', 'customerEmail', 'rating', 'text', 'consentPublication']) {
    assert.match(form, new RegExp(`name="${field}"[^>]*disabled=\\{pending\\}`));
  }
  assert.match(route, /Formulár je momentálne nedostupný[\s\S]*503/);
});

test('local testimonial fallback serializes duplicate and independent concurrent writes', () => {
  const directory = mkdtempSync(join(testRoot, '.astana-testimonial-local-'));
  const localDbPath = join(directory, 'local-db.json');
  const dbModuleUrl = new URL('../src/server/db.ts', import.meta.url).href;
  const code = `
    const imported = await import(${JSON.stringify(dbModuleUrl)});
    const { createTestimonial } = imported.default ?? imported;
    const base = { customerName: 'Test lokálnej súbežnosti', text: 'Izolovaný lokálny súbežný test, nezverejňovať.', rating: 5, status: 'draft', consentPublication: false, source: 'public' };
    const records = await Promise.all([
      createTestimonial({ ...base, submissionId: 'same-submission-id' }, 'local-test'),
      createTestimonial({ ...base, submissionId: 'same-submission-id' }, 'local-test'),
      createTestimonial({ ...base, customerName: 'Druhý paralelný záznam', submissionId: 'other-submission-id' }, 'local-test'),
    ]);
    process.stdout.write(JSON.stringify(records.map((record) => record.id)));
  `;
  try {
    const output = execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', code], {
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: '', ASTANA_LOCAL_DB_PATH: localDbPath },
      timeout: 20_000,
    });
    const returnedIds = JSON.parse(output);
    assert.equal(returnedIds[0], returnedIds[1], 'súbežný retry s rovnakým ID vráti tú istú referenciu');
    assert.notEqual(returnedIds[0], returnedIds[2], 'nezávislé podanie dostane vlastné ID');
    const saved = JSON.parse(readFileSync(localDbPath, 'utf8'));
    assert.equal(saved.testimonials.length, 2, 'žiadna z dvoch nezávislých referencií sa nesmie stratiť');
    assert.equal(saved.auditLogs.filter((log) => log.action === 'testimonial_created').length, 2, 'každý nový záznam má práve jeden audit');
  } finally {
    removeTestDirectory(directory, '.astana-testimonial-local-');
  }
});

test('local testimonial edits serialize and retain every exact consented content version', () => {
  const directory = mkdtempSync(join(testRoot, '.astana-testimonial-edit-'));
  const localDbPath = join(directory, 'local-db.json');
  const dbModuleUrl = new URL('../src/server/db.ts', import.meta.url).href;
  const consentModuleUrl = new URL('../src/lib/testimonial-consent.ts', import.meta.url).href;
  const policyModuleUrl = new URL('../src/server/testimonial-policy.ts', import.meta.url).href;
  const code = `
    const dbModule = await import(${JSON.stringify(dbModuleUrl)});
    const { createTestimonial, updateTestimonial, setAdminSetting } = dbModule.default ?? dbModule;
    const consentModule = await import(${JSON.stringify(consentModuleUrl)});
    const { formatAdminTestimonialConsentEvidence, adminTestimonialConsentVersion } = consentModule.default ?? consentModule;
    const policyModule = await import(${JSON.stringify(policyModuleUrl)});
    const { testimonialPublicContentHash } = policyModule.default ?? policyModule;
    const RealDate = Date;
    const fixedTime = RealDate.parse('2026-10-01T12:00:00.000Z');
    globalThis.Date = class extends RealDate {
      constructor(...args) { super(...(args.length ? args : [fixedTime])); }
      static now() { return fixedTime; }
    };
    const base = await createTestimonial({ customerName: 'Test lokálnej histórie', text: 'Pôvodná neveřejná referencia.', rating: 5, status: 'draft', consentPublication: false, source: 'admin' }, 'local-test');
    const makeInput = (text, consentText) => ({ ...base, text, status: 'approved', consentPublication: true,
      consentEvidence: formatAdminTestimonialConsentEvidence(consentText, 'e-mail', '2026-10-01', testimonialPublicContentHash(base.customerName, 5, text)),
      consentCapturedAt: new Date().toISOString(), consentVersion: adminTestimonialConsentVersion });
    await updateTestimonial(base.id, makeInput('Prvá schválená verzia.', 'Súhlasím s prvou presnou verziou.'), 'local-test');
    await Promise.all([
      updateTestimonial(base.id, makeInput('Súbežná verzia A.', 'Súhlasím s presnou verziou A.'), 'local-test'),
      updateTestimonial(base.id, makeInput('Súbežná verzia B.', 'Súhlasím s presnou verziou B.'), 'local-test'),
    ]);
    const revokedInput = { ...makeInput('Text po odvolaní súhlasu.', ''), status: 'hidden', consentPublication: false, consentEvidence: '', consentCapturedAt: undefined, consentVersion: '' };
    await Promise.all([
      setAdminSetting('simultaneous_content_save', 'uložené počas zmeny referencie', 'local-test'),
      updateTestimonial(base.id, revokedInput, 'local-test'),
    ]);
  `;
  try {
    execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', code], {
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: '', ASTANA_LOCAL_DB_PATH: localDbPath },
      timeout: 20_000,
    });
    const saved = JSON.parse(readFileSync(localDbPath, 'utf8'));
    const history = saved.testimonialConsentHistory;
    assert.equal(history.filter((item) => item.testimonialId === saved.testimonials[0].id).length, 7,
      'každá lokálna úprava vrátane súbežného odvolania zachová predchádzajúci aj aktuálny súhlas');
    assert.deepEqual(new Set(history.map((item) => item.snapshotText)), new Set([
      'Prvá schválená verzia.', 'Súbežná verzia A.', 'Súbežná verzia B.', 'Text po odvolaní súhlasu.',
    ]));
    assert.equal(saved.auditLogs.filter((item) => item.action === 'testimonial_updated').length, 4);
    const current = saved.testimonials.find((item) => item.id === history[0].testimonialId);
    assert.equal(current.status, 'hidden', 'súbežné uloženie nastavení nesmie obnoviť starý schválený stav');
    assert.equal(current.consentPublication, false, 'odvolaný súhlas zostane odvolaný');
    assert.ok(current.consentRevokedAt, 'odvolanie zostane zaznamenané');
    assert.equal(saved.adminSettings.simultaneous_content_save, 'uložené počas zmeny referencie');
  } finally {
    removeTestDirectory(directory, '.astana-testimonial-edit-');
  }
});
