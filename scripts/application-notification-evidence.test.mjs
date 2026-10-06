import assert from 'node:assert/strict';
import test from 'node:test';
import { isApplicationNotificationEvidenceValid } from '../src/server/application-notification-evidence.mjs';

test('notification audit evidence accepts only a resolution-matched safe code', () => {
  assert.equal(isApplicationNotificationEvidenceValid('delivered', 'inbox_message_found'), true);
  assert.equal(isApplicationNotificationEvidenceValid('not_delivered', 'provider_rejected'), true);
  for (const [resolution, evidence] of [
    ['delivered', 'provider_rejected'],
    ['not_delivered', 'inbox_message_found'],
    ['delivered', 'Overil som schránku, email test@example.com'],
    ['not_delivered', 'telefón 0905123456'],
    ['not_delivered', { text: 'provider rejected' }],
    ['other', 'provider_rejected'],
  ]) {
    assert.equal(isApplicationNotificationEvidenceValid(resolution, evidence), false);
  }
});
