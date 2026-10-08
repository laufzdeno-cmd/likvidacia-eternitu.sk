import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import {
  isRooferReferralEligible,
  resolveRooferReferralApproval,
  resolveRooferReferralApprovalUpdate,
} from '../src/server/roofer-referral-policy.ts';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbModuleUrl = pathToFileURL(path.join(projectRoot, 'src', 'server', 'db.ts')).href;
const read = (relative) => readFile(path.join(projectRoot, relative), 'utf8');

test('referral approval requires evidence and records the internal approver', () => {
  assert.throws(
    () => resolveRooferReferralApproval(true, 'krátke', 'admin@astana.sk'),
    /interný podklad súhlasu/,
  );
  const approved = resolveRooferReferralApproval(
    true,
    'Partnerská dohoda 2026-10-08',
    'ADMIN@ASTANA.SK',
    '2026-10-08T08:00:00.000Z',
  );
  assert.deepEqual(approved, {
    customerReferralApproved: true,
    customerReferralEvidence: 'Partnerská dohoda 2026-10-08',
    customerReferralApprovedAt: '2026-10-08T08:00:00.000Z',
    customerReferralApprovedBy: 'admin@astana.sk',
  });
  assert.deepEqual(resolveRooferReferralApproval(false, 'nesmie zostať', 'admin@astana.sk'), {
    customerReferralApproved: false,
    customerReferralEvidence: '',
    customerReferralApprovedAt: undefined,
    customerReferralApprovedBy: '',
  });
  assert.deepEqual(
    resolveRooferReferralApprovalUpdate(approved, true, approved.customerReferralEvidence, 'other-admin@astana.sk'),
    approved,
  );
  const replaced = resolveRooferReferralApprovalUpdate(
    approved,
    true,
    'Nová partnerská dohoda 2026-10-09',
    'other-admin@astana.sk',
    '2026-10-09T08:00:00.000Z',
  );
  assert.equal(replaced.customerReferralApprovedBy, 'other-admin@astana.sk');
  assert.equal(replaced.customerReferralApprovedAt, '2026-10-09T08:00:00.000Z');
});

test('active state alone never makes a roofer eligible for customer referral', () => {
  const complete = {
    active: true,
    customerReferralApproved: true,
    customerReferralEvidence: 'Partnerská dohoda 2026-10-08',
    customerReferralApprovedAt: '2026-10-08T08:00:00.000Z',
    customerReferralApprovedBy: 'admin@astana.sk',
  };
  assert.equal(isRooferReferralEligible(complete), true);
  assert.equal(isRooferReferralEligible({ ...complete, active: false }), false);
  assert.equal(isRooferReferralEligible({ ...complete, customerReferralApproved: false }), false);
  assert.equal(isRooferReferralEligible({ ...complete, customerReferralEvidence: '' }), false);
  assert.equal(isRooferReferralEligible({ ...complete, customerReferralApprovedAt: undefined }), false);
  assert.equal(isRooferReferralEligible({ ...complete, customerReferralApprovedBy: '' }), false);
});

test('local CRM keeps legacy/unapproved roofers internal and audit logs omit evidence text', async () => {
  const directory = await mkdtemp(path.join(projectRoot, '.tmp-roofer-referral-'));
  const localDbPath = path.join(directory, 'local-db.json');
  const evidence = 'Súhlas partnera zo zmluvy 2026-10-08';
  const childCode = `
    const db = await import(${JSON.stringify(dbModuleUrl)});
    const actor = 'admin@astana.sk';
    const base = { region: 'Prešovský', districts: ['Poprad'], active: true, verifiedPartner: true, inVerification: false, preferredPartner: false };
    const legacy = await db.createRoofer({ ...base, name: 'Interný partner' }, actor);
    const approved = await db.createRoofer({ ...base, name: 'Partner so súhlasom', customerReferralApproved: true, customerReferralEvidence: ${JSON.stringify(evidence)} }, actor);
    await db.createRoofer({ ...base, name: 'Neaktívny partner', active: false, customerReferralApproved: true, customerReferralEvidence: ${JSON.stringify(evidence)} }, actor);
    try {
      await db.createRoofer({ ...base, name: 'Neplatný súhlas', customerReferralApproved: true, customerReferralEvidence: 'krátke' }, actor);
      throw new Error('Missing evidence must fail');
    } catch (error) {
      if (!String(error).includes('interný podklad súhlasu')) throw error;
    }
    let eligible = await db.listReferralEligibleRoofers();
    if (eligible.length !== 1 || eligible[0].id !== approved.id) throw new Error('Unexpected eligible set after create');
    if (await db.getReferralEligibleRoofer(legacy.id)) throw new Error('Unapproved ID bypassed the referral policy');
    const originalApproval = await db.getRoofer(approved.id);
    await db.updateRooferFlags(approved.id, { ...base, preferredPartner: true, customerReferralApproved: true, customerReferralEvidence: ${JSON.stringify(evidence)} }, 'other-admin@astana.sk');
    const afterFlagEdit = await db.getRoofer(approved.id);
    if (afterFlagEdit.customerReferralApprovedAt !== originalApproval.customerReferralApprovedAt) throw new Error('Unrelated edit replaced approval time');
    if (afterFlagEdit.customerReferralApprovedBy !== originalApproval.customerReferralApprovedBy) throw new Error('Unrelated edit replaced approver');
    await db.updateRooferFlags(legacy.id, { ...base, customerReferralApproved: true, customerReferralEvidence: ${JSON.stringify(evidence)} }, actor);
    eligible = await db.listReferralEligibleRoofers();
    if (eligible.length !== 2) throw new Error('Approval update did not enable referral');
    await db.updateRooferFlags(legacy.id, { ...base, customerReferralApproved: false, customerReferralEvidence: 'must be cleared' }, actor);
    eligible = await db.listReferralEligibleRoofers();
    if (eligible.length !== 1 || eligible[0].id !== approved.id) throw new Error('Revocation did not fail closed');
    console.log('REFERRAL_POLICY_OK');
  `;
  try {
    const environment = {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: '',
      ASTANA_LOCAL_DB_PATH: localDbPath,
    };
    for (const key of ['VERCEL', 'VERCEL_ENV', 'VERCEL_TARGET_ENV']) delete environment[key];
    const child = spawnSync(
      process.execPath,
      ['--import', 'tsx', '--input-type=module', '-e', childCode],
      { cwd: projectRoot, env: environment, encoding: 'utf8', timeout: 30_000 },
    );
    assert.equal(child.status, 0, child.stderr || child.stdout);
    assert.match(child.stdout, /REFERRAL_POLICY_OK/);

    const localDatabase = JSON.parse(await readFile(localDbPath, 'utf8'));
    assert.doesNotMatch(JSON.stringify(localDatabase.auditLogs), new RegExp(evidence));
    assert.equal(localDatabase.roofers.some((roofer) => roofer.customerReferralEvidence === evidence), true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('SQL migration is additive, legacy-safe, and recommendation query requires approval provenance', async () => {
  const db = await read('src/server/db.ts');
  assert.match(db, /ALTER TABLE roofers ADD COLUMN IF NOT EXISTS customer_referral_approved boolean NOT NULL DEFAULT false/);
  assert.match(db, /ALTER TABLE roofers ADD COLUMN IF NOT EXISTS customer_referral_evidence text NOT NULL DEFAULT ''/);
  assert.match(db, /ALTER TABLE roofers ADD COLUMN IF NOT EXISTS customer_referral_approved_at timestamptz/);
  assert.match(db, /ALTER TABLE roofers ADD COLUMN IF NOT EXISTS customer_referral_approved_by text NOT NULL DEFAULT ''/);
  assert.match(db, /ADD CONSTRAINT roofers_customer_referral_approval_check CHECK/);
  assert.match(db, /customer_referral_approved = true[\s\S]*customer_referral_approved_at IS NOT NULL[\s\S]*customer_referral_approved_by/);
  assert.doesNotMatch(db, /listPublicRoofers/);
  assert.match(db, /const all = await listReferralEligibleRoofers\(\)/);
});

test('the exact roofer referral migration upgrades a legacy row and enforces complete provenance', async () => {
  const source = await read('src/server/db.ts');
  const migration = source.match(
    /ALTER TABLE roofers ADD COLUMN IF NOT EXISTS customer_referral_approved boolean NOT NULL DEFAULT false;[\s\S]*?ALTER TABLE roofers VALIDATE CONSTRAINT roofers_customer_referral_approval_check;/,
  )?.[0];
  assert.ok(migration, 'The exact additive migration must stay extractable for compatibility verification.');

  const { PGlite } = await import('@electric-sql/pglite');
  const database = new PGlite();
  try {
    await database.exec(`
      CREATE TABLE roofers (
        id uuid PRIMARY KEY,
        active boolean NOT NULL DEFAULT true
      );
      INSERT INTO roofers (id, active) VALUES ('00000000-0000-4000-8000-000000000001', true);
    `);
    await database.exec(migration);
    const legacy = await database.query(`
      SELECT customer_referral_approved, customer_referral_evidence,
             customer_referral_approved_at, customer_referral_approved_by
      FROM roofers WHERE id = '00000000-0000-4000-8000-000000000001'
    `);
    assert.deepEqual(legacy.rows[0], {
      customer_referral_approved: false,
      customer_referral_evidence: '',
      customer_referral_approved_at: null,
      customer_referral_approved_by: '',
    });
    await assert.rejects(
      database.exec(`UPDATE roofers SET customer_referral_approved = true
        WHERE id = '00000000-0000-4000-8000-000000000001'`),
      /roofers_customer_referral_approval_check/,
    );
    await database.exec(`UPDATE roofers SET
      customer_referral_approved = true,
      customer_referral_evidence = 'Partnerská dohoda 2026-10-08',
      customer_referral_approved_at = '2026-10-08T08:00:00.000Z',
      customer_referral_approved_by = 'admin@astana.sk'
      WHERE id = '00000000-0000-4000-8000-000000000001'`);
    const approved = await database.query('SELECT customer_referral_approved FROM roofers');
    assert.equal(approved.rows[0].customer_referral_approved, true);
  } finally {
    await database.close();
  }
});

test('admin boundary validates string evidence and imports never auto-authorize referrals', async () => {
  const [actions, page, publicRoofers, partnerPage, quoteAction, quotePage, leadDetail] = await Promise.all([
    read('app/admin/(protected)/strechari/actions.ts'),
    read('app/admin/(protected)/strechari/page.tsx'),
    read('app/strechari/page.tsx'),
    read('app/spolupracujuci-strechari/page.tsx'),
    read('app/admin/(protected)/dopyty/[id]/cenova-ponuka/actions.ts'),
    read('app/admin/(protected)/dopyty/[id]/cenova-ponuka/page.tsx'),
    read('app/admin/(protected)/dopyty/[id]/page.tsx'),
  ]);
  assert.match(actions, /typeof value === 'string' \? value\.trim\(\) : ''/);
  assert.match(actions, /customerReferralApproved: false,[\s\S]*customerReferralEvidence: ''/);
  assert.match(actions, /customerReferralApproved && customerReferralEvidence\.length < 8/);
  assert.match(page, /Interný podklad súhlasu na odporúčanie/);
  assert.match(page, /Importovaný partner sa bez samostatného potvrdenia neponúkne zákazníkovi/);
  assert.doesNotMatch(publicRoofers, /listRoofers|listReferralEligibleRoofers|customerReferralEvidence/);
  assert.doesNotMatch(partnerPage, /listRoofers|listReferralEligibleRoofers|customerReferralEvidence/);
  assert.match(quoteAction, /getReferralEligibleRoofer\(recommendedRooferId\)/);
  assert.match(quotePage, /getReferralEligibleRoofer\(lead\.selectedRooferId\)/);
  assert.match(leadDetail, /getReferralEligibleRoofer\(lead\.selectedRooferId\)/);
  assert.doesNotMatch(quoteAction, /\bgetRoofer\b/);
});
