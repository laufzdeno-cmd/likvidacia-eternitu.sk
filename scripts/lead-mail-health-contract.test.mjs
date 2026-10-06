import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('admin health labels active mail mode honestly and does not print raw SMTP errors', () => {
  const database = read('../src/server/db.ts');
  const dashboard = read('../app/admin/(protected)/dashboard/page.tsx');
  const healthPage = read('../app/admin/(protected)/health/page.tsx');
  assert.match(database, /smtpAttemptConfigured = isLeadSmtpConfigured\(\)/);
  assert.match(database, /leadMail: describeLeadMailHealth\(deliveryMode, smtpAttemptConfigured, false, relayConfigured\)/);
  assert.match(database, /base\.leadMail = describeLeadMailHealth\(deliveryMode, smtpAttemptConfigured, base\.smtp\.ok, relayConfigured\)/);
  assert.doesNotMatch(database, /error instanceof Error \? error\.message : 'SMTP server je nedostupný\.'/);
  assert.match(dashboard, /health\.leadMail\.level/);
  assert.match(healthPage, /health\.leadMail\.label/);
  assert.doesNotMatch(dashboard, /health\.smtp\.ok \? 'Funkčný'/);
  assert.doesNotMatch(healthPage, /SMTP_HOST nie je nastavený, emaily sa preskočia/);
});
