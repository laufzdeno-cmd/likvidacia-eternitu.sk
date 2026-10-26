import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  decryptGmailSecret,
  encryptGmailSecret,
  getGmailPriceOfferConfiguration,
  gmailPriceOfferLabelName,
} from '../src/server/gmail-price-offer-config.ts';
import {
  gmailMessageSearchQuery,
  gmailRetryDelayMinutes,
  normalizeRfc822MessageId,
} from '../src/server/gmail-price-offer-policy.ts';

const repo = new URL('../', import.meta.url);

test('Gmail configuration is server-only, complete and pinned to the production callback', () => {
  const base = {
    GMAIL_OAUTH_CLIENT_ID: 'client.apps.googleusercontent.com',
    GMAIL_OAUTH_CLIENT_SECRET: 'server-secret',
    GMAIL_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    GMAIL_ALLOWED_ACCOUNT_EMAIL: 'ASTANA@EXAMPLE.COM',
    NEXT_PUBLIC_SITE_URL: 'https://likvidacia-eternitu.sk/',
  };
  const config = getGmailPriceOfferConfiguration(base);
  assert.equal(config.configured, true);
  assert.equal(config.redirectUri, 'https://likvidacia-eternitu.sk/api/google/gmail/oauth/callback');
  assert.equal(config.allowedAccountEmail, 'astana@example.com');
  assert.equal(getGmailPriceOfferConfiguration({ ...base, GMAIL_TOKEN_ENCRYPTION_KEY: 'bad' }).configured, false);
  assert.equal(getGmailPriceOfferConfiguration({ ...base, NEXT_PUBLIC_SITE_URL: 'http://localhost:3000' }).configured, false);
  assert.equal(getGmailPriceOfferConfiguration({ ...base, GMAIL_ALLOWED_ACCOUNT_EMAIL: '' }).configured, false);
});

test('refresh tokens and PKCE verifiers are encrypted with authenticated encryption', () => {
  const key = randomBytes(32);
  const encrypted = encryptGmailSecret('refresh-token-never-log', key);
  assert.equal(encrypted.includes('refresh-token-never-log'), false);
  assert.equal(decryptGmailSecret(encrypted, key), 'refresh-token-never-log');
  assert.throws(() => decryptGmailSecret(encrypted, randomBytes(32)));
});

test('Message-ID matching is exact and retry is bounded', () => {
  const id = '<cp-11111111-1111-4111-8111-111111111111@likvidacia-eternitu.sk>';
  assert.equal(normalizeRfc822MessageId(id), id);
  assert.equal(normalizeRfc822MessageId('customer@example.com'), '');
  assert.equal(gmailMessageSearchQuery(id), 'in:sent rfc822msgid:cp-11111111-1111-4111-8111-111111111111@likvidacia-eternitu.sk');
  assert.deepEqual([1, 2, 3, 8, 20].map(gmailRetryDelayMinutes), [2, 5, 10, 360, 360]);
  assert.equal(gmailPriceOfferLabelName, '✓ CP odoslaná');
});

test('Gmail matching rejects a matching message outside Sent', async () => {
  const { findExactSentGmailMessage } = await import('../src/server/gmail-price-offer-api.ts');
  const originalFetch = globalThis.fetch;
  const requested = [];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    requested.push(url);
    if (url.pathname.endsWith('/messages')) {
      return new Response(JSON.stringify({ messages: [{ id: 'inbox-copy' }] }), { status: 200 });
    }
    return new Response(JSON.stringify({ id: 'inbox-copy', labelIds: ['INBOX'] }), { status: 200 });
  };
  try {
    const result = await findExactSentGmailMessage('synthetic-token', '<cp-test@likvidacia-eternitu.sk>');
    assert.equal(result.status, 'not_found');
    assert.equal(requested.length, 2);
    assert.match(requested[0].searchParams.get('q') || '', /^in:sent rfc822msgid:/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('OAuth, outbox and worker preserve approval and no-resend boundaries', async () => {
  const [start, callback, actions, mail, worker, cron, database, settings, privacy, schedule] = await Promise.all([
    readFile(new URL('app/api/google/gmail/oauth/start/route.ts', repo), 'utf8'),
    readFile(new URL('app/api/google/gmail/oauth/callback/route.ts', repo), 'utf8'),
    readFile(new URL('app/admin/(protected)/ponuky/actions.ts', repo), 'utf8'),
    readFile(new URL('src/server/mail.ts', repo), 'utf8'),
    readFile(new URL('src/server/gmail-price-offer-worker.ts', repo), 'utf8'),
    readFile(new URL('app/api/cron/gmail-price-offers/route.ts', repo), 'utf8'),
    readFile(new URL('src/server/db.ts', repo), 'utf8'),
    readFile(new URL('app/admin/(protected)/nastavenia/page.tsx', repo), 'utf8'),
    readFile(new URL('app/ochrana-osobnych-udajov/page.tsx', repo), 'utf8'),
    readFile(new URL('vercel.json', repo), 'utf8'),
  ]);
  assert.match(start, /requireSuperAdmin/);
  assert.match(start, /createGmailPkcePair/);
  assert.match(callback, /consumeGmailOAuthState/);
  assert.match(callback, /allowedAccountEmail/);
  assert.match(actions, /confirmedPreflight/);
  assert.match(actions, /finishPriceOfferSending[\s\S]{0,250}result\.messageId/);
  assert.match(mail, /messageId:\s*requestedMessageId/);
  assert.match(database, /gmail_price_offer_label_jobs/);
  assert.match(database, /UNIQUE \(offer_id\)/);
  assert.match(database, /gmailLabelQueued/);
  assert.doesNotMatch(worker, /sendPriceOfferDocumentEmail|sendMail|transporter/);
  assert.match(worker, /findExactSentGmailMessage/);
  assert.match(worker, /outcome:\s*'attention'/);
  assert.match(cron, /timingSafeEqual/);
  assert.match(cron, /CRON_SECRET/);
  assert.match(settings, /requireSuperAdmin/);
  assert.match(settings, /Gmail heslo sa sem nikdy nezadáva/);
  assert.match(privacy, /Aplikácia neukladá telo Gmail správ/);
  assert.match(schedule, /\/api\/cron\/gmail-price-offers\//);
});
