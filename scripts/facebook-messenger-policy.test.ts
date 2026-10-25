import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  facebookAttachmentTypes,
  isWithinFacebookReplyWindow,
  normalizeFacebookReply,
  verifyFacebookWebhookSignature,
  verifyFacebookWebhookToken,
} from '../src/server/facebook-messenger-policy';
import {
  decryptFacebookPageToken,
  encryptFacebookPageToken,
  getFacebookMessengerConfiguration,
} from '../src/server/facebook-messenger-config';

test('webhook signature accepts the exact raw body and rejects tampering', () => {
  const secret = 'a-secure-app-secret';
  const body = JSON.stringify({ object: 'page', entry: [] });
  const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
  assert.equal(verifyFacebookWebhookSignature(body, signature, secret), true);
  assert.equal(verifyFacebookWebhookSignature(`${body} `, signature, secret), false);
  assert.equal(verifyFacebookWebhookSignature(body, 'sha256=broken', secret), false);
  assert.equal(verifyFacebookWebhookSignature(body, null, secret), false);
});
test('webhook verify token comparison fails closed', () => {
  assert.equal(verifyFacebookWebhookToken('expected-token', 'expected-token'), true);
  assert.equal(verifyFacebookWebhookToken('wrong-token', 'expected-token'), false);
  assert.equal(verifyFacebookWebhookToken(null, 'expected-token'), false);
  assert.equal(verifyFacebookWebhookToken('expected-token', ''), false);
});

test('reply window includes exactly 24 hours and rejects future or invalid values', () => {
  const at = new Date('2026-10-24T12:00:00.000Z');
  assert.equal(isWithinFacebookReplyWindow('2026-10-23T12:00:00.000Z', at), true);
  assert.equal(isWithinFacebookReplyWindow('2026-10-23T11:59:59.999Z', at), false);
  assert.equal(isWithinFacebookReplyWindow('2026-10-24T12:00:01.000Z', at), false);
  assert.equal(isWithinFacebookReplyWindow('not-a-date', at), false);
});

test('reply normalization blocks empty and oversized messages', () => {
  assert.equal(normalizeFacebookReply('  Dobrý deň\r\nĎakujeme.  '), 'Dobrý deň\nĎakujeme.');
  assert.throws(() => normalizeFacebookReply('   '));
  assert.throws(() => normalizeFacebookReply('x'.repeat(2001)));
});

test('attachment parsing keeps only bounded private attachment types', () => {
  assert.deepEqual(
    facebookAttachmentTypes([{ type: 'image' }, { type: 'IMAGE' }, { type: 'file' }, { type: 'location' }, null]),
    ['image', 'file'],
  );
});

test('configuration is complete only with every server-side safety input', () => {
  const key = randomBytes(32).toString('base64');
  const base = {
    META_MESSENGER_APP_ID: '123',
    META_MESSENGER_APP_SECRET: 'secret',
    META_MESSENGER_ENCRYPTION_KEY: key,
    META_MESSENGER_VERIFY_TOKEN: 'verify',
    META_MESSENGER_PAGE_ID: '456',
    META_GRAPH_API_VERSION: 'v24.0',
    NEXT_PUBLIC_SITE_URL: 'https://likvidacia-eternitu.sk/',
  };
  const configured = getFacebookMessengerConfiguration(base);
  assert.equal(configured.configured, true);
  assert.equal(configured.redirectUri, 'https://likvidacia-eternitu.sk/api/meta/messenger/oauth/callback');
  assert.equal(getFacebookMessengerConfiguration({ ...base, META_MESSENGER_ENCRYPTION_KEY: 'bad' }).configured, false);
  assert.equal(getFacebookMessengerConfiguration({ ...base, NEXT_PUBLIC_SITE_URL: 'http://localhost:3000' }).configured, false);
  assert.equal(getFacebookMessengerConfiguration({ ...base, META_GRAPH_API_VERSION: 'latest' }).configured, false);
});

test('page token encryption round-trips and rejects the wrong key', () => {
  const key = randomBytes(32);
  const otherKey = randomBytes(32);
  const encrypted = encryptFacebookPageToken('never-log-this-page-token', key);
  assert.notEqual(encrypted.includes('never-log-this-page-token'), true);
  assert.equal(decryptFacebookPageToken(encrypted, key), 'never-log-this-page-token');
  assert.throws(() => decryptFacebookPageToken(encrypted, otherKey));
});

test('admin mutations stay authenticated, CSRF protected and human initiated', () => {
  const actions = readFileSync(new URL('../app/admin/(protected)/facebook/actions.ts', import.meta.url), 'utf8');
  const composer = readFileSync(new URL('../app/admin/(protected)/facebook/facebook-reply-composer.tsx', import.meta.url), 'utf8');
  const startRoute = readFileSync(new URL('../app/api/meta/messenger/oauth/start/route.ts', import.meta.url), 'utf8');
  const database = readFileSync(new URL('../src/server/facebook-messenger-db.ts', import.meta.url), 'utf8');
  const api = readFileSync(new URL('../src/server/facebook-messenger-api.ts', import.meta.url), 'utf8');
  assert.match(actions, /await verifyCsrf\(formData\)/);
  assert.match(actions, /await requireAdminUser\(\)/);
  assert.match(actions, /isWithinFacebookReplyWindow/);
  assert.match(actions, /prepareFacebookOutboundMessage/);
  assert.match(database, /now\(\) - interval '24 hours'/);
  assert.match(api, /page\.tasks\?\.includes\('MESSAGING'\)/);
  assert.match(startRoute, /await requireSuperAdmin\(\)/);
  assert.match(
    startRoute,
    /pages_show_list,pages_read_engagement,pages_messaging,pages_manage_metadata/,
  );
  assert.match(composer, /type="submit"/);
  assert.match(composer, /Správa sa odošle až po vašom kliknutí/);
  assert.doesNotMatch(composer, /useEffect|setInterval|setTimeout/);
});

test('webhook stores bounded message facts without copying attachment URLs', () => {
  const webhook = readFileSync(new URL('../app/api/meta/messenger/webhook/route.ts', import.meta.url), 'utf8');
  const database = readFileSync(new URL('../src/server/facebook-messenger-db.ts', import.meta.url), 'utf8');
  assert.match(webhook, /request\.text\(\)/);
  assert.match(webhook, /verifyFacebookWebhookSignature/);
  assert.match(webhook, /facebookAttachmentTypes\(message\.attachments\)/);
  assert.doesNotMatch(database, /attachment_url|attachment_urls|payload\.url/);
  assert.match(database, /ON CONFLICT \(provider_message_id\).*DO NOTHING/s);
});
