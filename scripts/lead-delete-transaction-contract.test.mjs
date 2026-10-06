import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const dbSource = readFileSync(new URL('../src/server/db.ts', import.meta.url), 'utf8');
const start = dbSource.indexOf('export async function destroyArchivedLead');
const end = dbSource.indexOf('type RooferRegistrationCreateResult', start);
const destroyArchivedLead = dbSource.slice(start, end);

test('permanent lead deletion uses one reserved PostgreSQL connection for its transaction', () => {
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  assert.match(destroyArchivedLead, /const client = await db\.connect\(\)/);
  assert.match(destroyArchivedLead, /await client\.query\('BEGIN'\)/);
  assert.match(destroyArchivedLead, /INSERT INTO lead_file_deletion_jobs/);
  assert.match(destroyArchivedLead, /'lead_deleted'/);
  assert.match(destroyArchivedLead, /fileDeletionJobsQueued/);
  assert.match(destroyArchivedLead, /await client\.query\('COMMIT'\)/);
  assert.match(destroyArchivedLead, /await client\.query\('ROLLBACK'\)/);
  assert.match(destroyArchivedLead, /finally\s*\{\s*client\.release\(discardConnection\)/);
  assert.doesNotMatch(destroyArchivedLead, /await db\.query\(/);
  assert.match(destroyArchivedLead, /catch \(rollbackError\)[\s\S]*?discardConnection\s*=\s*rollbackError[\s\S]*?new AggregateError\(\[error, rollbackError\]/);
  assert.match(destroyArchivedLead, /client\.release\(discardConnection\)/);
});
