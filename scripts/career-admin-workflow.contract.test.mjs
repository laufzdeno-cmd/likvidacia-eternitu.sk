import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (relativePath) => {
  const url = new URL(`../${relativePath}`, import.meta.url);
  return existsSync(url) ? readFileSync(url, 'utf8') : '';
};

const db = read('src/server/db.ts');
const types = read('src/server/types.ts');
const listPage = read('app/admin/(protected)/kariera/page.tsx');
const detailPage = read('app/admin/(protected)/kariera/[id]/page.tsx');
const adminCss = read('app/admin/admin-route.css');
const page = `${listPage}\n${detailPage}`;
const actions = [
  read('app/admin/(protected)/kariera/actions.ts'),
  read('app/admin/(protected)/kariera/[id]/actions.ts'),
].filter(Boolean).join('\n');

function exportedFunctionBlock(source, functionName) {
  const start = source.indexOf(`export async function ${functionName}`);
  if (start === -1) return '';
  const next = source.indexOf('\nexport ', start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

function functionBlock(source, functionName) {
  const exported = exportedFunctionBlock(source, functionName);
  if (exported) return exported;
  const start = source.indexOf(`async function ${functionName}`);
  if (start === -1) return '';
  const nextExport = source.indexOf('\nexport ', start + 1);
  const nextFunction = source.indexOf('\nasync function ', start + 1);
  const endings = [nextExport, nextFunction].filter((position) => position !== -1);
  return source.slice(start, endings.length ? Math.min(...endings) : source.length);
}

test('career workflow exposes the requested typed database API', () => {
  assert.match(types, /export type CareerApplicationFilters\s*=\s*\{/);
  assert.match(types, /status\?:\s*CareerApplicationStatus/);
  assert.match(types, /ownerEmail\?:\s*string/);
  assert.match(types, /unassignedOnly\?:\s*boolean/);
  assert.match(types, /dueOnly\?:\s*boolean/);
  assert.match(types, /ownerEmail:\s*string/);
  assert.match(types, /nextAction:\s*string/);
  assert.match(types, /followupDate:\s*string/);
  assert.match(types, /expectedUpdatedAt:\s*string/);

  assert.match(db, /export async function countCareerApplications\(filters(?:\s*=\s*\{\})?\s*:\s*CareerApplicationFilters/);
  assert.match(db, /export async function listCareerApplications\(page\s*=\s*1,\s*limit\s*=\s*50,\s*filters(?:\s*=\s*\{\})?\s*:\s*CareerApplicationFilters/);
  assert.match(db, /export async function getCareerApplication\(id:\s*string\)/);
  assert.ok(
    /export async function updateCareerApplicationWorkflow\(\s*id:\s*string/.test(db),
    'Chýba export updateCareerApplicationWorkflow(id, input, actorEmail).',
  );
  assert.match(types, /status:\s*Exclude<CareerApplicationStatus,\s*'archived'>/);
  assert.match(db, /export async function archiveCareerApplication\(id:\s*string,\s*actorEmail:\s*string\)/);
  assert.match(db, /export async function restoreCareerApplication\(id:\s*string,\s*actorEmail:\s*string\)/);
});

test('career workflow schema is additive and old rows receive safe defaults', () => {
  assert.match(db, /ALTER TABLE career_applications ADD COLUMN IF NOT EXISTS owner_email text NOT NULL DEFAULT ''/);
  assert.match(db, /ALTER TABLE career_applications ADD COLUMN IF NOT EXISTS next_action text NOT NULL DEFAULT ''/);
  assert.match(db, /ALTER TABLE career_applications ADD COLUMN IF NOT EXISTS followup_date date/);
  assert.match(db, /CHECK\s*\(status IN \('new',\s*'reviewed',\s*'archived'\)\)/);
  assert.match(db, /ownerEmail:\s*String\(row\.owner_email\s*\?\?\s*row\.ownerEmail\s*\?\?\s*''\)/);
  assert.match(db, /nextAction:\s*cleanSlovakText\(String\(row\.next_action\s*\?\?\s*row\.nextAction\s*\?\?\s*''\)\)/);
  assert.match(db, /followupDate:\s*dateOnly\(row\.followup_date\s*\?\?\s*row\.followupDate\)/);
});

test('career workflow mutations keep state and privacy-safe audit in one atomic operation', () => {
  for (const functionName of ['updateCareerApplicationWorkflow', 'setCareerApplicationArchived']) {
    const source = functionBlock(db, functionName);
    assert.ok(source, `${functionName} musí byť exportovaná`);
    assert.match(source, /withLocalLeadSubmissionLock/);
    assert.match(source, /local\.auditLogs\.(?:unshift|push)/);
    assert.match(source, /await writeLocalDb\(local\)/);
    assert.match(source, /const client = await db\.connect\(\)/);
    assert.match(source, /await client\.query\('BEGIN'\)/);
    assert.match(source, /INSERT INTO audit_logs/);
    assert.match(source, /await client\.query\('COMMIT'\)/);
    assert.match(source, /await client\.query\('ROLLBACK'\)/);
  }

  assert.match(exportedFunctionBlock(db, 'archiveCareerApplication'), /setCareerApplicationArchived\(id,\s*true,\s*actorEmail\)/);
  assert.match(exportedFunctionBlock(db, 'restoreCareerApplication'), /setCareerApplicationArchived\(id,\s*false,\s*actorEmail\)/);

  const workflow = exportedFunctionBlock(db, 'updateCareerApplicationWorkflow');
  assert.match(workflow, /changedFields/);
  assert.match(workflow, /previous\.updatedAt !== normalized\.expectedUpdatedAt/);
  assert.match(workflow, /previousStatus/);
  assert.match(workflow, /nextStatus/);
  assert.doesNotMatch(workflow, /changes:\s*\{[^}]*\b(?:fullName|phone|email|experience|note|nextAction|cvOriginalName|originalName)\s*:/s);
});

test('career admin actions are authenticated, CSRF-protected and validate bounded workflow input', () => {
  assert.ok(actions, 'Chýba app/admin/(protected)/kariera/actions.ts.');
  assert.match(actions, /^'use server';/);
  assert.match(actions, /verifyCsrf\(formData\)/);
  assert.match(actions, /requireAdmin\(\)/);
  assert.match(actions, /requireSuperAdmin\(\)/);
  assert.match(actions, /rawStatus !== 'new'\s*&&\s*rawStatus !== 'reviewed'/);
  assert.match(actions, /ownerEmail[\s\S]*\.trim\(\)\.toLowerCase\(\)/);
  assert.match(actions, /nextAction\.length\s*>\s*\d+/);
  assert.match(actions, /DATE_PATTERN\s*=\s*\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\//);
  assert.match(actions, /requiredString\(formData, 'expectedUpdatedAt'\)/);
  assert.match(actions, /updateCareerApplicationWorkflow\(/);
  assert.match(actions, /archiveCareerApplication\(/);
  assert.match(actions, /restoreCareerApplication\(/);
});

test('career admin UI exposes filters, workflow editing and explicit archive/restore controls', () => {
  assert.ok(
    /countCareerApplications\(filters\)/.test(page),
    'Kariérny admin ešte neposiela filtre do countCareerApplications(filters).',
  );
  assert.match(listPage, /listCareerApplications\(page,\s*PAGE_SIZE,\s*filters\)/);
  assert.match(listPage, /name="status"/);
  assert.match(listPage, /name="owner"/);
  assert.match(listPage, /defaultValue=\{filters\.unassignedOnly \? '__unassigned__' : filters\.ownerEmail \?\? ''\}/);
  assert.match(listPage, /value="__unassigned__">Bez vlastníka/);
  assert.match(listPage, /name="due"[\s\S]*filters\.dueOnly/);
  assert.match(listPage, /Termín dnes alebo skôr/);
  assert.match(detailPage, /name="ownerEmail"/);
  assert.match(detailPage, /name="nextAction"/);
  assert.match(detailPage, /name="followupDate"/);
  assert.match(detailPage, /name="expectedUpdatedAt" value=\{application\.updatedAt\}/);
  assert.match(detailPage, /updateCareerApplicationWorkflowAction/);
  assert.match(detailPage, /archiveCareerApplicationAction/);
  assert.match(detailPage, /restoreCareerApplicationAction/);
  assert.match(page, /Archivovan/);
  assert.match(detailPage, /Obnoviť/);
  assert.match(detailPage, /name="confirm" value="archive" required/);
  assert.match(actions, /requiredString\(formData, 'confirm'\) !== 'archive'/);
  assert.match(detailPage, /currentOwnerIsActive/);
  assert.match(detailPage, /Pôvodný vlastník už nie je aktívny/);
  assert.match(adminCss, /@media \(max-width: 900px\)[\s\S]*?\.admin-detail-grid\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)\s*!important;/);
  assert.match(adminCss, /@media \(max-width: 480px\)[\s\S]*?\.admin-stat-grid\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)\s*!important;/);
});
