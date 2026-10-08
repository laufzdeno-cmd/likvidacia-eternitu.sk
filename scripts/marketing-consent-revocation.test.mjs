import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const consent = readFileSync(new URL('../src/lib/marketing-consent.ts', import.meta.url), 'utf8');
const widgets = readFileSync(new URL('../app/public-widgets.tsx', import.meta.url), 'utf8');
const leadRoute = readFileSync(new URL('../app/api/lead/route.ts', import.meta.url), 'utf8');
const revokeRoute = readFileSync(new URL('../app/api/marketing-consent/revoke/route.ts', import.meta.url), 'utf8');
const db = readFileSync(new URL('../src/server/db.ts', import.meta.url), 'utf8');

test('marketing consent receives a pseudonymous subject and accepted leads bind it server-side', () => {
  assert.match(consent, /marketingConsentSubjectCookieName/);
  assert.match(consent, /window\.crypto\?\.randomUUID/);
  assert.match(leadRoute, /isMarketingConsentSubject\(marketingConsentSubject\)/);
  assert.match(leadRoute, /marketingConsentSubjectAtSubmit/);
  assert.match(db, /consent_subject uuid/);
  assert.match(db, /marketingConsentSubjectAtSubmit.*outbox\.consent_subject::text/s);
});

test('turning marketing off invokes same-origin revocation and clears future delivery capability', () => {
  assert.match(widgets, /if \(!next\.marketing\) void revokePendingMetaCapiOutbox/);
  assert.match(widgets, /hasPendingMarketingRevocation\(\) \|\| marketingConsentSubject\(\)/);
  assert.match(widgets, /addEventListener\('online', retryRevocation\)/);
  assert.match(widgets, /addEventListener\('visibilitychange', retryVisibleRevocation\)/);
  assert.match(consent, /const existingRequest = marketingRevocationRequests\.get\(subject\)/);
  assert.match(consent, /marketingRevocationRequests\.set\(subject, request\)/);
  assert.match(consent, /fetch\('\/api\/marketing-consent\/revoke\/'/);
  assert.match(consent, /marketingRevocationTimeoutMs\s*=\s*8_000/);
  assert.match(consent, /controller\.abort\(\)/);
  assert.match(consent, /signal:\s*controller\.signal/);
  assert.match(consent, /marketingRevocationPendingStorageKey/);
  assert.match(consent, /if \(!response\.ok\) return false/);
  assert.match(consent, /clearMarketingConsentSubject\(subject\)/);
  assert.match(consent, /if \(hasMarketingConsent\(\)\) ensureMarketingConsentSubject\(\)/);
  assert.match(revokeRoute, /origin === request\.nextUrl\.origin/);
  assert.doesNotMatch(revokeRoute, /response\.cookies\.set|Max-Age=0/,
    'server response must not clear a newer consent subject after an in-flight revocation');
  assert.match(db, /export async function revokeMetaCapiOutboxForConsentSubject/);
  assert.match(db, /status='cancelled'.*last_error_code='consent_revoked'/s);
});

test('public consent copy states the identifiers that Meta receives', () => {
  assert.match(widgets, /Google Ads poslať konverznú udalosť\. Meta môže dostať aj zahashovaný email a telefón/);
  assert.doesNotMatch(widgets, /bez mena, telefónu a emailu/);
});
