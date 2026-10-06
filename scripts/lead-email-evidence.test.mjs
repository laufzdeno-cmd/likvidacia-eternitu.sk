import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { isLeadEmailEvidenceValid } from '../src/server/lead-email-evidence.mjs';

const actions = readFileSync(new URL('../app/admin/(protected)/dopyty/[id]/actions.ts', import.meta.url), 'utf8');

test('lead email resolution only accepts evidence that agrees with the recorded outcome', () => {
  assert.equal(isLeadEmailEvidenceValid('sent', 'inbox_message_found'), true);
  assert.equal(isLeadEmailEvidenceValid('failed', 'provider_rejected'), true);
  for (const evidence of ['inbox_no_message', 'provider_accepted', 'provider_rejected']) assert.equal(isLeadEmailEvidenceValid('sent', evidence), false);
  for (const evidence of ['inbox_message_found', 'provider_accepted', 'inbox_no_message']) assert.equal(isLeadEmailEvidenceValid('failed', evidence), false);
  assert.equal(isLeadEmailEvidenceValid('sent', 'customer@example.com'), false);
  assert.equal(isLeadEmailEvidenceValid('unknown', 'provider_accepted'), false);
});

test('admin actions validate a fixed evidence code before writing delivery resolution or retry audit', () => {
  assert.match(actions, /isLeadEmailEvidenceValid\(outcome, evidence\)/);
  assert.match(actions, /isLeadEmailEvidenceValid\('failed', evidence\)/);
  assert.match(actions, /confirmation !== 'yes' \|\| !isLeadEmailEvidenceValid\(outcome, evidence\)/);
  assert.doesNotMatch(actions, /evidence\.trim\(\)\.slice|evidence\.length/);
});
