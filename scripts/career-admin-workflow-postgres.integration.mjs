import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const runToken = process.env.ASTANA_ISOLATED_PG_RUN_TOKEN;
const suppliedUrl = process.env.ASTANA_ISOLATED_PG_URL;
assert.match(runToken || '', /^[a-f0-9]{32}$/, 'A disposable PostgreSQL runner token is required.');
assert.ok(suppliedUrl, 'A disposable PostgreSQL runner URL is required.');
const parsed = new URL(suppliedUrl);
const port = Number(parsed.port);
assert.ok(
  ['postgres:', 'postgresql:'].includes(parsed.protocol)
  && parsed.hostname === '127.0.0.1'
  && parsed.username === 'astana_test'
  && !parsed.password && !parsed.search && !parsed.hash
  && parsed.pathname === `/astana_isolated_${runToken}`
  && Number.isInteger(port) && port > 0 && port <= 65535,
  'Only the runner-owned loopback PostgreSQL database may be tested.',
);

const connectionString = `postgres://astana_test@127.0.0.1:${port}/astana_isolated_${runToken}`;
const inspectPool = new pg.Pool({ connectionString, max: 2, connectionTimeoutMillis: 3000 });
const legacyId = randomUUID();
const activeOwner = 'owner@example.invalid';
const inactiveOwner = 'inactive@example.invalid';
const actorEmail = 'admin@example.invalid';

try {
  const guard = await inspectPool.query(
    'SELECT run_token FROM astana_isolated_runner_guard WHERE run_token = $1',
    [runToken],
  );
  assert.equal(guard.rowCount, 1, 'The database must belong to this runner invocation.');

  await inspectPool.query(`
    CREATE TABLE career_applications (
      id uuid PRIMARY KEY,
      submission_id text NOT NULL UNIQUE,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      status text NOT NULL DEFAULT 'new',
      full_name text NOT NULL,
      phone text NOT NULL,
      email text NOT NULL,
      city text NOT NULL,
      cooperation_type text NOT NULL DEFAULT 'szco',
      work_regions text NOT NULL DEFAULT '',
      has_trade_license boolean NOT NULL DEFAULT false,
      work_at_heights boolean NOT NULL DEFAULT false,
      experience text NOT NULL DEFAULT '',
      note text NOT NULL DEFAULT '',
      privacy_consent boolean NOT NULL DEFAULT false,
      cv_original_name text NOT NULL DEFAULT '',
      cv_storage_driver text NOT NULL DEFAULT '',
      cv_storage_key text NOT NULL DEFAULT '',
      cv_mime_type text NOT NULL DEFAULT '',
      cv_size_bytes integer NOT NULL DEFAULT 0
    )
  `);
  await inspectPool.query(
    `INSERT INTO career_applications (
       id, submission_id, status, full_name, phone, email, city, cooperation_type,
       work_regions, has_trade_license, work_at_heights, experience, note, privacy_consent
     ) VALUES ($1,$2,'contacted',$3,$4,$5,'Poprad','szco','Celé Slovensko',true,true,$6,$7,true)`,
    [legacyId, randomUUID(), 'Citlivé meno', '+421900123456', 'candidate@example.invalid', 'Citlivé skúsenosti', 'Citlivá poznámka'],
  );
  await inspectPool.query("UPDATE career_applications SET updated_at='2026-10-01T08:00:00.000Z' WHERE id=$1", [legacyId]);

  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = connectionString;
  process.env.ADMIN_EMAIL = '';
  const database = await import('../src/server/db.ts');

  const migrated = await database.getCareerApplication(legacyId);
  assert.equal(migrated?.status, 'new', 'Starý neplatný stav sa musí bezpečne normalizovať.');
  assert.equal(migrated?.ownerEmail, '');
  assert.equal(migrated?.nextAction, '');
  assert.equal(migrated?.followupDate, '');
  assert.equal((await database.listCareerApplications(1, 25, { unassignedOnly: true })).length, 1);

  const columns = await inspectPool.query(
    `SELECT column_name, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_schema='public' AND table_name='career_applications'
       AND column_name IN ('owner_email','next_action','followup_date')`,
  );
  assert.deepEqual(new Set(columns.rows.map((row) => row.column_name)), new Set(['owner_email', 'next_action', 'followup_date']));
  assert.equal(columns.rows.find((row) => row.column_name === 'owner_email')?.is_nullable, 'NO');
  assert.equal(columns.rows.find((row) => row.column_name === 'next_action')?.is_nullable, 'NO');
  const constraint = await inspectPool.query(
    `SELECT pg_get_constraintdef(oid) AS definition
     FROM pg_constraint WHERE conname='career_applications_status_check'`,
  );
  assert.match(constraint.rows[0]?.definition || '', /new.*reviewed.*archived/);

  await inspectPool.query(
    `INSERT INTO admin_users (id,email,name,role,active) VALUES
     ($1,$2,'Aktívny vlastník','OPERATOR',true),
     ($3,$4,'Neaktívny vlastník','OPERATOR',false)`,
    [randomUUID(), activeOwner, randomUUID(), inactiveOwner],
  );

  await assert.rejects(
    database.updateCareerApplicationWorkflow(legacyId, {
      status: 'reviewed', ownerEmail: inactiveOwner, nextAction: 'Toto sa nesmie uložiť', followupDate: '2026-10-20', expectedUpdatedAt: migrated.updatedAt,
    }, actorEmail),
    /aktívny administrátor/,
  );
  assert.equal((await database.getCareerApplication(legacyId))?.status, 'new', 'Neplatný vlastník nesmie zanechať čiastočnú zmenu.');

  const nextAction = 'Telefonicky overiť dostupnosť';
  const updated = await database.updateCareerApplicationWorkflow(legacyId, {
    status: 'reviewed', ownerEmail: activeOwner, nextAction, followupDate: '2000-01-01', expectedUpdatedAt: migrated.updatedAt,
  }, actorEmail);
  assert.equal(updated?.ownerEmail, activeOwner);
  assert.equal(updated?.nextAction, nextAction);
  assert.equal((await database.listCareerApplications(1, 25, { ownerEmail: activeOwner })).length, 1);
  assert.equal((await database.listCareerApplications(1, 25, { dueOnly: true })).length, 1);
  await assert.rejects(
    database.updateCareerApplicationWorkflow(legacyId, {
      status: 'new', ownerEmail: '', nextAction: 'Starší formulár', followupDate: '', expectedUpdatedAt: migrated.updatedAt,
    }, actorEmail),
    /medzitým zmenená/,
  );
  assert.equal((await database.getCareerApplication(legacyId))?.nextAction, nextAction, 'starší formulár nesmie prepísať novší PostgreSQL workflow');

  const archiveResults = await Promise.all([
    database.archiveCareerApplication(legacyId, actorEmail),
    database.archiveCareerApplication(legacyId, actorEmail),
  ]);
  assert.ok(archiveResults.every((item) => item?.status === 'archived'));
  assert.equal((await database.countCareerApplications()).total, 0, 'Archív nesmie byť v predvolenej pracovnej fronte.');
  assert.equal((await database.countCareerApplications({ status: 'archived' })).total, 1);
  assert.equal((await database.restoreCareerApplication(legacyId, actorEmail))?.status, 'reviewed');

  const audit = await inspectPool.query(
    `SELECT action, actor_email, changes
     FROM audit_logs WHERE entity_type='career_application' AND entity_id=$1 ORDER BY created_at`,
    [legacyId],
  );
  assert.deepEqual(new Set(audit.rows.map((row) => row.action)), new Set([
    'career_application_workflow_updated',
    'career_application_archived',
    'career_application_restored',
  ]));
  assert.equal(audit.rows.filter((row) => row.action === 'career_application_archived').length, 1, 'Súbežná archivácia musí zapísať iba jeden audit.');
  const auditJson = JSON.stringify(audit.rows);
  for (const forbidden of ['Citlivé meno', '+421900123456', 'candidate@example.invalid', 'Citlivé skúsenosti', 'Citlivá poznámka', nextAction]) {
    assert.equal(auditJson.includes(forbidden), false, `Audit prezradil citlivú hodnotu: ${forbidden}`);
  }

  console.log('PASS: migrácia starých kariérnych žiadostí, constrainty, vlastník, filtre, súbeh archivácie a audit bez PII na izolovanom PostgreSQL 17.');
} finally {
  await inspectPool.end();
}
