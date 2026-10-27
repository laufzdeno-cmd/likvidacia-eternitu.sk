import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { JOB_WORKSPACE_RELEASE_ENABLED } from '../src/server/job-workspace-release-mode.ts';
import { assertJobWorkspaceEnabled, jobWorkspaceEnabled, resolveJobWorkspaceEnabled } from '../src/server/job-workspace-feature.ts';
import { deliverApprovedAuthorityNotice } from '../src/server/job-authority-delivery.ts';
import { getJobMailAdminView, synchronizeJobMail } from '../src/server/job-mail-service.ts';

test('immutable fallback cannot be enabled by an environment variable', () => {
  for (const value of [undefined, '', 'true', 'false', ' FALSE ']) assert.equal(resolveJobWorkspaceEnabled(false, value), false);
});
test('active release defaults to enabled and explicit runtime false disables it', () => {
  for (const value of [undefined, '', 'true']) assert.equal(resolveJobWorkspaceEnabled(true, value), true);
  for (const value of ['false', ' FALSE ']) assert.equal(resolveJobWorkspaceEnabled(true, value), false);
});
test('actual server mode combines the tracked default with runtime environment', () => {
  const previous = process.env.ASTANA_JOB_WORKSPACE_ENABLED;
  try {
    process.env.ASTANA_JOB_WORKSPACE_ENABLED = 'true';
    assert.equal(jobWorkspaceEnabled(), JOB_WORKSPACE_RELEASE_ENABLED);
    process.env.ASTANA_JOB_WORKSPACE_ENABLED = 'false';
    assert.equal(jobWorkspaceEnabled(), false);
    assert.throws(assertJobWorkspaceEnabled, /dočasne vypnuté/);
  } finally { if (previous === undefined) delete process.env.ASTANA_JOB_WORKSPACE_ENABLED; else process.env.ASTANA_JOB_WORKSPACE_ENABLED = previous; }
});
test('disabled authority delivery cannot claim or send and Gmail cannot read its store or provider', async () => {
  const previous = process.env.ASTANA_JOB_WORKSPACE_ENABLED;
  let claims = 0;
  try {
    process.env.ASTANA_JOB_WORKSPACE_ENABLED = 'false';
    const actor = { role: 'SUPER_ADMIN', email: 'fallback@example.invalid' };
    await assert.rejects(deliverApprovedAuthorityNotice('unused', actor, { claim: async () => { claims++; }, finalize: async () => { throw new Error('must not finalize'); }, send: async () => { throw new Error('must not send'); } }), /dočasne vypnuté/);
    await assert.rejects(getJobMailAdminView(actor), /dočasne vypnuté/);
    await assert.rejects(synchronizeJobMail(actor), /dočasne vypnuté/);
    assert.equal(claims, 0);
  } finally { if (previous === undefined) delete process.env.ASTANA_JOB_WORKSPACE_ENABLED; else process.env.ASTANA_JOB_WORKSPACE_ENABLED = previous; }
});
test('every new user mutation and authenticated file endpoint gates before its I/O', async () => {
  const expected = [
    ['app/admin/(protected)/ponuky/rucna/actions.ts', 5],
    ['app/admin/(protected)/zakazky/[id]/job-linked-actions.ts', 3],
    ['app/admin/(protected)/zakazky/[id]/workspace-actions.ts', 1],
    ['app/admin/(protected)/nastavenia/gmail/actions.ts', 1],
    ['app/admin/(protected)/nastavenia/job-settings-actions.ts', 1],
    ['app/api/admin/job-workspace/upload/route.ts', 1],
    ['app/api/admin/job-workspace/documents/[id]/route.ts', 1],
  ];
  for (const [file, mutations] of expected) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.equal((source.match(/if \(!jobWorkspaceEnabled\(\)\)/g) || []).length, mutations, `${file}: missing per-entrypoint disabled guard`);
  }
});
