import assert from 'node:assert/strict';

const configuredOrigin = process.env.PREVIEW_ORIGIN?.replace(/\/$/, '');
if (!configuredOrigin) throw new Error('PREVIEW_ORIGIN is required');
const origin: string = configuredOrigin;

const now = Date.now();
const submissionId = `qa-preview-${now}`;
const validEmail = `preview-valid-${now}@preview.invalid`;

async function acceptMarketingConsent() {
  const response = await fetch(`${origin}/api/consent/`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ choice: 'accepted' }),
  });
  assert.equal(response.status, 200, 'consent endpoint accepts first-party consent');
  const cookie = response.headers.getSetCookie().find((value) => value.startsWith('astana_marketing_consent_v1='));
  assert.ok(cookie, 'signed consent cookie is set');
  return cookie.split(';', 1)[0];
}

function payload(overrides: Record<string, string> = {}) {
  return new URLSearchParams({
    fullName: 'Preview Validácia',
    phone: '+421900000000',
    email: validEmail,
    city: 'Košice',
    district: 'Košice',
    objectType: 'Rodinný dom',
    materialType: 'Eternit',
    areaEstimate: '120',
    preferredContact: 'Zavolajte mi',
    term: 'Čo najskôr',
    note: 'Kontrolovaný preview test merania.',
    gdpr: 'on',
    submissionId,
    ...overrides,
  });
}

async function submit(body: URLSearchParams, cookie: string) {
  const response = await fetch(`${origin}/api/lead/`, {
    method: 'POST',
    headers: {
      Origin: origin,
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookie,
    },
    body,
  });
  return { response, json: await response.json() as Record<string, unknown> };
}

const cookie = await acceptMarketingConsent();
const first = await submit(payload(), cookie);
assert.equal(first.response.status, 200, 'valid preview lead is accepted');
assert.equal(first.json.conversionEligible, true, 'valid consented lead is conversion-eligible');
assert.equal(first.json.duplicate, false, 'first lead is not duplicate');
assert.equal(first.json.isQa, false, 'ordinary preview lead is not QA');

const duplicate = await submit(payload(), cookie);
assert.equal(duplicate.response.status, 200, 'duplicate response is idempotently successful');
assert.equal(duplicate.json.duplicate, true, 'duplicate is explicitly identified');
assert.equal(duplicate.json.conversionEligible, false, 'duplicate cannot create an Ads conversion');

const qa = await submit(payload({
  email: `qa-preview-${now}@example.test`,
  submissionId: `qa-preview-controlled-${now}`,
  fullName: 'QA-PREVIEW-API',
}), cookie);
assert.equal(qa.response.status, 200, 'controlled QA lead is accepted for test traceability');
assert.equal(qa.json.isQa, true, 'controlled QA lead is identified');
assert.equal(qa.json.conversionEligible, false, 'controlled QA lead cannot create an Ads conversion');

const spam = await submit(payload({ companyWebsite: 'https://spam.example', submissionId: `spam-preview-${now}` }), cookie);
assert.equal(spam.response.status, 400, 'honeypot submission is rejected');
assert.equal(spam.json.ok, false, 'honeypot never reaches conversion handling');

console.log('PASS — preview API permits exactly one consented valid lead and blocks Ads eligibility for duplicate, QA, and honeypot spam.');
