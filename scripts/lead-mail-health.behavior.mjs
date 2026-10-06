import assert from 'node:assert/strict';
import test from 'node:test';
import healthModule from '../src/server/lead-mail-health.ts';
import relayModule from '../src/server/astana-local-relay.ts';
import mailModule from '../src/server/mail.ts';

const { describeLeadMailHealth } = healthModule;
const { isAstanaLocalRelayConfigured } = relayModule;
const { isLeadSmtpConfigured } = mailModule;

test('active lead-mail mode distinguishes a connected SMTP path from an unprobed relay', () => {
  assert.equal(describeLeadMailHealth('smtp', false, false, true).level, 'error');
  assert.equal(describeLeadMailHealth('smtp', true, true, false).level, 'ok');
  assert.equal(describeLeadMailHealth('local_relay', false, false, false).level, 'error');
  const relayOnly = describeLeadMailHealth('local_relay', false, false, true);
  assert.equal(relayOnly.level, 'warning');
  assert.match(relayOnly.detail, /doručenie do schránky táto kontrola neoveruje/);
  assert.equal(describeLeadMailHealth('smtp_then_local_relay', false, false, false).level, 'error');
  assert.equal(describeLeadMailHealth('smtp_then_local_relay', false, false, true).level, 'warning');
  const brokenSmtp = describeLeadMailHealth('smtp_then_local_relay', true, false, true);
  assert.equal(brokenSmtp.level, 'error');
  assert.match(brokenSmtp.detail, /relay automaticky nespustí/);
  assert.equal(describeLeadMailHealth('smtp_then_local_relay', true, true, true).level, 'ok');
  assert.match(describeLeadMailHealth('smtp_then_local_relay', true, true, true).detail, /Doručenie do schránky musí potvrdiť/);
});

test('hybrid relay fallback is eligible only when the SMTP attempt is not configured', () => {
  const previousHost = process.env.SMTP_HOST;
  const previousRecipient = process.env.LEAD_TO_EMAIL;
  try {
    delete process.env.SMTP_HOST;
    process.env.LEAD_TO_EMAIL = 'astana@astana.sk';
    assert.equal(isLeadSmtpConfigured(), false);
    assert.equal(describeLeadMailHealth('smtp_then_local_relay', isLeadSmtpConfigured(), false, true).level, 'warning');
    process.env.SMTP_HOST = 'smtp.example.test';
    assert.equal(isLeadSmtpConfigured(), true);
    assert.equal(describeLeadMailHealth('smtp_then_local_relay', isLeadSmtpConfigured(), false, true).level, 'error');
  } finally {
    if (previousHost === undefined) delete process.env.SMTP_HOST;
    else process.env.SMTP_HOST = previousHost;
    if (previousRecipient === undefined) delete process.env.LEAD_TO_EMAIL;
    else process.env.LEAD_TO_EMAIL = previousRecipient;
  }
});

test('relay readiness uses the same URL allow-list and secret length as sending', () => {
  const previousUrl = process.env.ASTANA_RELAY_URL;
  const previousSecret = process.env.ASTANA_RELAY_SECRET;
  try {
    process.env.ASTANA_RELAY_URL = 'https://www.astana.sk/api/relay';
    process.env.ASTANA_RELAY_SECRET = 'x'.repeat(32);
    assert.equal(isAstanaLocalRelayConfigured(), true);
    process.env.ASTANA_RELAY_URL = 'https://attacker.example/api/relay';
    assert.equal(isAstanaLocalRelayConfigured(), false);
    process.env.ASTANA_RELAY_URL = 'http://www.astana.sk/api/relay';
    assert.equal(isAstanaLocalRelayConfigured(), false);
    process.env.ASTANA_RELAY_URL = 'https://www.astana.sk/api/relay';
    process.env.ASTANA_RELAY_SECRET = 'short';
    assert.equal(isAstanaLocalRelayConfigured(), false);
  } finally {
    if (previousUrl === undefined) delete process.env.ASTANA_RELAY_URL;
    else process.env.ASTANA_RELAY_URL = previousUrl;
    if (previousSecret === undefined) delete process.env.ASTANA_RELAY_SECRET;
    else process.env.ASTANA_RELAY_SECRET = previousSecret;
  }
});
