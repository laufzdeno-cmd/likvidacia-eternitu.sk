import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('completion wizard keeps human approval, role separation and no-send semantics visible', async () => {
  const [wizard, actions, detail, db, jobForm, operatorForm] = await Promise.all([
    read('app/admin/(protected)/zakazky/[id]/completion-wizard.tsx'),
    read('app/admin/(protected)/zakazky/actions.ts'),
    read('app/admin/(protected)/zakazky/[id]/page.tsx'),
    read('src/server/db.ts'),
    read('app/admin/(protected)/zakazky/job-form.tsx'),
    read('app/admin/(protected)/zakazky/operational-job-form.tsx'),
  ]);
  assert.match(wizard, /Nič sa neodošle ani nezverejní/);
  assert.match(wizard, /role === 'SUPER_ADMIN'/);
  assert.match(wizard, /name="confirmed" required/);
  assert.match(actions, /await verifyCsrf\(formData\)/);
  assert.match(actions, /await requireSuperAdmin\(\)/);
  assert.match(actions, /reminderAllowed: false/);
  assert.doesNotMatch(actions, /sendReviewRequestEmail|sendPriceOfferDocumentEmail/);
  assert.match(detail, /getBusinessJobPhotoEvidence/);
  assert.match(detail, /getOperationalBusinessJobCompletion/);
  assert.doesNotMatch(detail, /listPhotoIntakeRecords/);
  assert.doesNotMatch(wizard, /name="costsDecision" value=\{completion\.costsDecision\}/);
  assert.doesNotMatch(wizard, /name="costsReason" value=\{completion\.costsReason\}/);
  assert.match(db, /status='pending_approval'/);
  assert.match(db, /business_job_completion_documents_reason_check/);
  assert.match(db, /Pri výnimke z dokladov chýba dôvod/);
  assert.match(db, /photos_decision <> 'not_available'/);
  assert.match(db, /Fotografia je dôkazom uzavretej zákazky/);
  assert.match(jobForm, /status !== 'DOKONCENA'/);
  assert.match(operatorForm, /status !== 'DOKONCENA'/);
});

test('completion cannot be entered or left through generic job mutations', async () => {
  const db = await read('src/server/db.ts');
  assert.match(db, /current\.status !== 'DOKONCENA' && normalized\.status === 'DOKONCENA'/);
  assert.match(db, /current\.status === 'DOKONCENA' && normalized\.status !== 'DOKONCENA'/);
  assert.match(db, /legacyCompletedImportReason\?: 'CSV_HISTORICAL_IMPORT' \| 'TEST_FIXTURE'/);
  assert.match(db, /bez výslovného režimu historického importu/);
});
