import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('manual work items have additive schema, visibility, revision and no hard-delete API', async () => {
  const [db, types] = await Promise.all([read('../src/server/db.ts'), read('../src/server/types.ts')]);
  assert.match(db, /CREATE TABLE IF NOT EXISTS admin_work_items/);
  assert.match(db, /visibility text NOT NULL DEFAULT 'TEAM'/);
  assert.match(db, /revision integer NOT NULL DEFAULT 1/);
  assert.match(db, /admin_work_items_visibility_check CHECK \(visibility IN \('TEAM','SUPER_ADMIN'\)\)/);
  assert.match(db, /admin_work_items_status_due_idx/);
  assert.match(db, /admin_work_items_owner_status_idx/);
  assert.match(db, /const where = \[`\(\$1::boolean = true OR visibility = 'TEAM'\)`\]/);
  assert.match(db, /withLocalLeadSubmissionLock\(async \(\) =>/);
  assert.match(db, /withLocalFileLock/);
  assert.match(db, /SELECT \* FROM admin_work_items WHERE id = \$1 FOR UPDATE/);
  assert.match(db, /ON CONFLICT \(id\) DO NOTHING RETURNING \*/);
  assert.match(db, /current\.status !== 'OPEN'/);
  assert.match(db, /transitionAllowed/);
  assert.match(db, /INSERT INTO audit_logs/);
  assert.doesNotMatch(db, /deleteAdminWorkItem|DELETE FROM admin_work_items/);
  assert.match(types, /AdminWorkItemVisibility = 'TEAM' \| 'SUPER_ADMIN'/);
  assert.match(types, /revision: number/);
});

test('every manual task action checks CSRF, session, strict input and refreshes only the queue', async () => {
  const [actions, page] = await Promise.all([
    read('../app/admin/(protected)/asistent/actions.ts'),
    read('../app/admin/(protected)/asistent/page.tsx'),
  ]);
  assert.equal((actions.match(/verifyCsrf\(formData\)/g) || []).length, 4);
  assert.equal((actions.match(/requireAdminUser\(\)/g) || []).length, 4);
  assert.match(actions, /z\.enum\(\['CRITICAL', 'HIGH', 'NORMAL', 'LOW'\]\)/);
  assert.match(actions, /z\.enum\(\['TEAM', 'SUPER_ADMIN'\]\)/);
  assert.match(actions, /revision: z\.coerce\.number\(\)\.int\(\)\.positive\(\)/);
  assert.equal((actions.match(/revalidatePath\('\/admin\/asistent'\)/g) || []).length, 4);
  assert.doesNotMatch(actions, /send[A-Z]|priceOffer|payment|publish|delete[A-Z]/i);
  assert.ok((page.match(/name="_csrf"/g) || []).length >= 1);
  assert.match(page, /name="revision"/);
  assert.match(page, /name="requestId"/);
  assert.match(page, /name="visibility"/);
  assert.match(page, /name="ownerEmail"/);
});

test('audit presents work-item events in Slovak without exposing task text fields', async () => {
  const [auditPage, db] = await Promise.all([read('../app/admin/(protected)/audit/page.tsx'), read('../src/server/db.ts')]);
  assert.match(auditPage, /admin_work_item: 'Interná úloha'/);
  for (const action of ['created', 'updated', 'completed', 'reopened', 'cancelled']) {
    assert.match(auditPage, new RegExp(`admin_work_item_${action}`));
  }
  const auditFunction = db.slice(db.indexOf('function workItemAuditChanges'), db.indexOf('export async function listAdminTaskAssignees'));
  assert.doesNotMatch(auditFunction, /\b(title|note|ownerEmail|cancelReason)\s*:/);
  assert.match(auditFunction, /hasOwner/);
  assert.match(auditFunction, /visibility/);
});
