import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const ownedTestRoot = path.join(process.cwd(), 'tmp');
await mkdir(ownedTestRoot, { recursive: true });
const temporaryDirectory = await mkdtemp(path.join(ownedTestRoot, 'astana-work-items-local-'));
const databasePath = path.join(temporaryDirectory, 'local-db.json');
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = '';
process.env.ASTANA_LOCAL_DB_PATH = databasePath;
process.env.ADMIN_EMAIL = 'admin@local.test';

const {
  createAdminWorkItem,
  listAdminTaskAssignees,
  listAdminWorkItems,
  transitionAdminWorkItem,
  updateAdminWorkItem,
} = await import(`../src/server/db.ts?admin-work-items-local=${randomUUID()}`);

const actor = 'admin@local.test';
const input = {
  title: 'Zavolať zákazníkovi', note: 'Overiť termín bez odoslania emailu.', priority: 'NORMAL',
  dueDate: '2026-10-14', ownerEmail: actor, visibility: 'TEAM',
};

try {
  assert.deepEqual(await listAdminTaskAssignees(), [{ email: actor, name: 'ASTANA' }]);
  const requestId = randomUUID();
  const created = await createAdminWorkItem(input, actor, 'SUPER_ADMIN', requestId);
  const duplicate = await createAdminWorkItem(input, actor, 'SUPER_ADMIN', requestId);
  assert.equal(duplicate.id, created.id, 'opakovaný requestId musí byť idempotentný');

  const updated = await updateAdminWorkItem(created.id, { ...input, priority: 'HIGH', note: 'Manuálne overiť termín.' }, 1, actor, 'SUPER_ADMIN');
  assert.equal(updated.revision, 2);
  await assert.rejects(
    updateAdminWorkItem(created.id, { ...input, title: 'Stará úprava' }, 1, actor, 'SUPER_ADMIN'),
    /medzičasom/,
  );
  const completed = await transitionAdminWorkItem({ id: created.id, status: 'DONE', expectedRevision: 2, actorEmail: actor, actorRole: 'SUPER_ADMIN' });
  assert.equal(completed.revision, 3);
  await assert.rejects(updateAdminWorkItem(created.id, input, 3, actor, 'SUPER_ADMIN'), /najprv znovu otvoriť/);
  await assert.rejects(
    transitionAdminWorkItem({ id: created.id, status: 'CANCELLED', expectedRevision: 3, cancelReason: 'Zakázaný skok.', actorEmail: actor, actorRole: 'SUPER_ADMIN' }),
    /najprv znovu otvoriť/,
  );
  const completedAgain = await transitionAdminWorkItem({ id: created.id, status: 'DONE', expectedRevision: 2, actorEmail: actor, actorRole: 'SUPER_ADMIN' });
  assert.equal(completedAgain.revision, 3, 'opakované dokončenie nesmie vytvoriť novú revíziu');
  const reopened = await transitionAdminWorkItem({ id: created.id, status: 'OPEN', expectedRevision: 3, actorEmail: actor, actorRole: 'SUPER_ADMIN' });
  const cancelled = await transitionAdminWorkItem({ id: created.id, status: 'CANCELLED', expectedRevision: reopened.revision, cancelReason: 'Úloha už nie je potrebná.', actorEmail: actor, actorRole: 'SUPER_ADMIN' });
  assert.equal(cancelled.status, 'CANCELLED');
  await assert.rejects(updateAdminWorkItem(created.id, input, cancelled.revision, actor, 'SUPER_ADMIN'), /najprv znovu otvoriť/);
  await assert.rejects(
    transitionAdminWorkItem({ id: created.id, status: 'DONE', expectedRevision: cancelled.revision, actorEmail: actor, actorRole: 'SUPER_ADMIN' }),
    /najprv znovu otvoriť/,
  );

  await assert.rejects(
    createAdminWorkItem({ ...input, ownerEmail: 'inactive@local.test' }, actor, 'SUPER_ADMIN', randomUUID()),
    /vlastník nie je aktívny/,
  );
  await assert.rejects(
    transitionAdminWorkItem({ id: created.id, status: 'CANCELLED', expectedRevision: cancelled.revision, cancelReason: '', actorEmail: actor, actorRole: 'SUPER_ADMIN' }),
    /uveďte dôvod/,
  );

  const privateItem = await createAdminWorkItem({ ...input, title: 'Majiteľská interná kontrola', visibility: 'SUPER_ADMIN' }, actor, 'SUPER_ADMIN', randomUUID());
  assert.equal((await listAdminWorkItems('SUPER_ADMIN')).some((item) => item.id === privateItem.id), true);
  assert.equal((await listAdminWorkItems('OPERATOR')).some((item) => item.id === privateItem.id), false);

  const concurrentItem = await createAdminWorkItem({ ...input, title: 'Súbežná lokálna úloha' }, actor, 'SUPER_ADMIN', randomUUID());
  const workerPath = path.join(process.cwd(), 'scripts', 'admin-work-items.local-worker.mjs');
  const workerEnvironment = { ...process.env, ASTANA_LOCAL_DB_PATH: databasePath, DATABASE_URL: '', NODE_ENV: 'test' };
  const childResults = await Promise.all([
    execFileAsync(process.execPath, ['--import', 'tsx', workerPath, concurrentItem.id, 'Prvá procesová úprava'], { cwd: process.cwd(), env: workerEnvironment }),
    execFileAsync(process.execPath, ['--import', 'tsx', workerPath, concurrentItem.id, 'Druhá procesová úprava'], { cwd: process.cwd(), env: workerEnvironment }),
  ]);
  const childStates = childResults.map(({ stdout }) => stdout.trim().split(/\r?\n/).at(-1));
  assert.deepEqual(childStates.sort(), ['STALE', 'SUCCESS']);
  const afterConcurrent = (await listAdminWorkItems('SUPER_ADMIN')).find((item) => item.id === concurrentItem.id);
  assert.equal(afterConcurrent.revision, 2);

  const local = JSON.parse(await readFile(databasePath, 'utf8'));
  const workAudit = local.auditLogs.filter((entry) => entry.entityType === 'admin_work_item' && entry.entityId === created.id);
  assert.deepEqual(workAudit.map((entry) => entry.action).sort(), [
    'admin_work_item_cancelled', 'admin_work_item_completed', 'admin_work_item_created', 'admin_work_item_reopened', 'admin_work_item_updated',
  ].sort());
  for (const entry of workAudit) {
    const serialized = JSON.stringify(entry.changes);
    assert.doesNotMatch(serialized, /Zavolať|Manuálne overiť|Úloha už nie je potrebná|admin@local\.test/);
  }
  console.log('PASS: manuálne úlohy majú idempotentné vytvorenie, revízie, role, životný cyklus a bezpečný audit.');
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
