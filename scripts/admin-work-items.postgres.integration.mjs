import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

let pglite;
let server;
let exitCode = 0;

async function availablePort() {
  const probe = createServer();
  await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
  const { port } = probe.address();
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  return port;
}

try {
  const port = await availablePort();
  pglite = await PGlite.create();
  server = new PGLiteSocketServer({ db: pglite, port, host: '127.0.0.1', maxConnections: 8 });
  await server.start();
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = `postgres://astana_test:astana_test@127.0.0.1:${port}/astana_test`;
  process.env.ADMIN_EMAIL = '';
  const db = await import(`../src/server/db.ts?admin-work-items-pg=${randomUUID()}`);
  await db.listAdminWorkItems('SUPER_ADMIN');
  const actor = 'admin@example.invalid';
  const operator = 'operator@example.invalid';
  await pglite.query(
    `INSERT INTO admin_users (id,email,name,role,active,password_hash) VALUES ($1,$2,'QA superadmin','SUPER_ADMIN',true,'')`,
    [randomUUID(), actor],
  );
  await pglite.query(
    `INSERT INTO admin_users (id,email,name,role,active,password_hash) VALUES ($1,$2,'QA operator','OPERATOR',true,'')`,
    [randomUUID(), operator],
  );
  const base = { title: 'PostgreSQL pracovná úloha', note: 'Bez externého zásahu.', priority: 'NORMAL', dueDate: '2026-10-14', ownerEmail: actor, visibility: 'TEAM' };
  const sharedRequestId = randomUUID();
  const duplicateCreates = await Promise.allSettled([
    db.createAdminWorkItem({ ...base, title: 'Idempotentná úloha' }, actor, 'SUPER_ADMIN', sharedRequestId),
    db.createAdminWorkItem({ ...base, title: 'Idempotentná úloha' }, actor, 'SUPER_ADMIN', sharedRequestId),
  ]);
  assert.equal(duplicateCreates.filter((result) => result.status === 'fulfilled').length, 2);
  assert.equal(new Set(duplicateCreates.map((result) => result.status === 'fulfilled' ? result.value.id : '')).size, 1);
  const created = await db.createAdminWorkItem(base, actor, 'SUPER_ADMIN', randomUUID());
  const teamSuggestion = await db.getAdminWorkItemSuggestion({ actorRole: 'SUPER_ADMIN', priority: 'NORMAL', visibility: 'TEAM', at: new Date('2026-10-16T08:00:00Z') });
  assert.equal(teamSuggestion.suggestedOwnerEmail, operator);
  const privateSuggestion = await db.getAdminWorkItemSuggestion({ actorRole: 'SUPER_ADMIN', priority: 'NORMAL', visibility: 'SUPER_ADMIN', at: new Date('2026-10-16T08:00:00Z') });
  assert.equal(privateSuggestion.suggestedOwnerEmail, actor);
  await assert.rejects(
    db.createAdminWorkItem({ ...base, title: 'Neplatný vlastník súkromnej úlohy', ownerEmail: operator, visibility: 'SUPER_ADMIN' }, actor, 'SUPER_ADMIN', randomUUID()),
    /vlastník nie je aktívny|oprávnený/i,
  );
  const competing = await Promise.allSettled([
    db.updateAdminWorkItem(created.id, { ...base, priority: 'HIGH' }, 1, actor, 'SUPER_ADMIN'),
    db.updateAdminWorkItem(created.id, { ...base, priority: 'LOW' }, 1, actor, 'SUPER_ADMIN'),
  ]);
  assert.equal(competing.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(competing.filter((result) => result.status === 'rejected').length, 1);
  const current = (await db.listAdminWorkItems('SUPER_ADMIN')).find((item) => item.id === created.id);
  assert.equal(current.revision, 2);

  const privateItem = await db.createAdminWorkItem({ ...base, title: 'Súkromná majiteľská úloha', visibility: 'SUPER_ADMIN' }, actor, 'SUPER_ADMIN', randomUUID());
  assert.equal((await db.listAdminWorkItems('OPERATOR')).some((item) => item.id === privateItem.id), false);

  await pglite.query("ALTER TABLE audit_logs ADD CONSTRAINT qa_forbid_work_cancel CHECK (action <> 'admin_work_item_cancelled') NOT VALID");
  await assert.rejects(
    db.transitionAdminWorkItem({ id: created.id, status: 'CANCELLED', expectedRevision: current.revision, cancelReason: 'Kontrola transakčného rollbacku.', actorEmail: actor, actorRole: 'SUPER_ADMIN' }),
    /qa_forbid_work_cancel|check constraint/i,
  );
  const afterRollback = (await db.listAdminWorkItems('SUPER_ADMIN')).find((item) => item.id === created.id);
  assert.equal(afterRollback.status, 'OPEN');
  assert.equal(afterRollback.revision, current.revision);
  await pglite.query('ALTER TABLE audit_logs DROP CONSTRAINT qa_forbid_work_cancel');

  const auditRows = await pglite.query("SELECT action,changes FROM audit_logs WHERE entity_type='admin_work_item' AND entity_id=$1", [created.id]);
  assert.equal(auditRows.rows.filter((row) => row.action === 'admin_work_item_updated').length, 1);
  assert.doesNotMatch(JSON.stringify(auditRows.rows), /PostgreSQL pracovná úloha|Bez externého zásahu|admin@example\.invalid/);
  console.log('PASS: PostgreSQL pracovné úlohy chránia súbeh, role, transakčný audit a rollback.');
} catch (error) {
  console.error(error);
  exitCode = 1;
} finally {
  try { await server?.stop(); await pglite?.close(); } catch (error) { console.error('Cleanup failed:', error); exitCode = 1; }
}
process.exit(exitCode);
