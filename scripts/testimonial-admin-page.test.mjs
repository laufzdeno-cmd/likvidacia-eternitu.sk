import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const testRoot = join(fileURLToPath(new URL('..', import.meta.url)));

test('admin referencie exposes paged list, direct edit lookup and private audit/consent history', async () => {
  const [page, database] = await Promise.all([
    readFile(new URL('../app/admin/(protected)/referencie/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/server/db.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(page, /listTestimonialsPage/);
  assert.match(page, /getTestimonial/);
  assert.match(page, /listTestimonialAdminHistory/);
  assert.match(page, /História úprav a súhlasov/);
  assert.match(page, /Otvorená referencia je mimo aktuálnej strany alebo zvoleného filtra/);
  assert.match(database, /export async function getTestimonial\(id: string\)/);
  assert.match(database, /export async function listTestimonialsPage/);
  assert.match(database, /export async function listTestimonialAdminHistory/);
  assert.match(database, /WHERE entity_type='testimonial' AND entity_id=\$1/);
});

test('local testimonial paging filters by status and history retains exact prior consent', () => {
  const directory = mkdtempSync(join(testRoot, '.astana-testimonial-admin-page-'));
  const localDbPath = join(directory, 'local-db.json');
  const dbModuleUrl = new URL('../src/server/db.ts', import.meta.url).href;
  const code = `
    const dbModule = await import(${JSON.stringify(dbModuleUrl)});
    const db = dbModule.default ?? dbModule;
    const consentModule = await import(${JSON.stringify(new URL('../src/lib/testimonial-consent.ts', import.meta.url).href)});
    const consent = consentModule.default ?? consentModule;
    const policyModule = await import(${JSON.stringify(new URL('../src/server/testimonial-policy.ts', import.meta.url).href)});
    const policy = policyModule.default ?? policyModule;
    const firstText = 'Presná skúšobná referencia A.';
    const firstEvidence = consent.formatAdminTestimonialConsentEvidence('Súhlasím s pôvodným presným textom.', 'e-mail', new Date().toISOString().slice(0, 10), policy.testimonialPublicContentHash('Izolovaný admin záznam A', 5, firstText));
    const first = await db.createTestimonial({ customerName: 'Izolovaný admin záznam A', text: firstText, rating: 5, status: 'draft', consentPublication: true, consentEvidence: firstEvidence, consentCapturedAt: new Date().toISOString(), consentVersion: consent.adminTestimonialConsentVersion }, 'admin-a@example.invalid');
    await db.createTestimonial({ customerName: 'Izolovaný admin záznam B', text: 'Presná skúšobná referencia B.', rating: 5, status: 'draft', consentPublication: false }, 'admin-b@example.invalid');
    await db.createTestimonial({ customerName: 'Izolovaný admin záznam C', text: 'Presná skúšobná referencia C.', rating: 5, status: 'draft', consentPublication: false }, 'admin-c@example.invalid');
    const approvedText = 'Text testovacej referencie so súhlasom.';
    const evidence = consent.formatAdminTestimonialConsentEvidence('Súhlasím s presným testovacím znením.', 'e-mail', new Date().toISOString().slice(0, 10), policy.testimonialPublicContentHash(first.customerName, 5, approvedText));
    const updated = await db.updateTestimonial(first.id, { ...first, text: approvedText, status: 'approved', consentPublication: true, consentEvidence: evidence, consentCapturedAt: new Date().toISOString(), consentVersion: consent.adminTestimonialConsentVersion }, 'admin-a@example.invalid');
    const approvedPage = await db.listTestimonialsPage({ page: 1, pageSize: 1, status: 'approved' });
    const draftPage = await db.listTestimonialsPage({ page: 2, pageSize: 1, status: 'draft' });
    const history = await db.listTestimonialAdminHistory(first.id);
    process.stdout.write(JSON.stringify({ first, updated, approvedPage, draftPage, fetched: await db.getTestimonial(first.id), history }));
  `;
  try {
    const output = execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', code], {
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: '', ASTANA_LOCAL_DB_PATH: localDbPath },
      timeout: 20_000,
    });
    const result = JSON.parse(output);
    assert.equal(result.approvedPage.total, 1);
    assert.equal(result.approvedPage.records[0].id, result.updated.id);
    assert.equal(result.draftPage.total, 2);
    assert.equal(result.draftPage.records.length, 1);
    assert.notEqual(result.draftPage.records[0].id, result.first.id);
    assert.equal(result.fetched.id, result.first.id);
    assert.ok(result.history.some((entry) => entry.source === 'audit' && entry.event === 'testimonial_created'));
    assert.ok(result.history.some((entry) => entry.source === 'consent' && entry.event === 'granted' && entry.snapshot.text === 'Text testovacej referencie so súhlasom.'));
    assert.ok(result.history.some((entry) => entry.source === 'consent' && entry.event === 'superseded'));
  } finally {
    if (resolve(directory, '..') !== resolve(testRoot) || !directory.split(/[\\/]/).at(-1)?.startsWith('.astana-testimonial-admin-page-')) {
      throw new Error('Neočakávaná cesta testových dát; odmietam ju odstrániť.');
    }
    rmSync(directory, { recursive: true, force: true });
  }
});
