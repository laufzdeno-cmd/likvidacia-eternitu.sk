import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHmac } from 'node:crypto';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { createAcceptedLeadConversion } = require('../src/server/lead-conversion.ts');
const { isValidLeadSubmissionId } = require('../src/lib/lead-submission-id.mjs');
const { leadSchema } = require('../src/server/validation.ts');
const route = readFileSync(new URL('../app/api/lead/route.ts', import.meta.url), 'utf8');
const landingClient = readFileSync(new URL('../app/landing-client.tsx', import.meta.url), 'utf8');
const id = '019a4321-5e89-4aa9-9b09-775123456789';
const secret = 'lead-conversion-test-only-secret';
const eventId = (value) => `lead:${createHmac('sha256', secret).update(`accepted-lead:${value.toLowerCase()}`).digest('hex')}`;

test('accepted conversion is stable, pseudonymous and material is a bounded category', () => {
  const first = createAcceptedLeadConversion(id, 'Vlnitý eternit', secret);
  assert.deepEqual(first, { eventId: eventId(id), material: 'vlnity' });
  assert.deepEqual(createAcceptedLeadConversion(id.toUpperCase(), 'Vlnitý eternit', secret), first);
  assert.deepEqual(createAcceptedLeadConversion('019a4321-5e89-7aa9-9b09-775123456789', 'Vlnitý eternit', secret), {
    eventId: eventId('019a4321-5e89-7aa9-9b09-775123456789'), material: 'vlnity',
  });
  assert.notEqual(first.eventId, `lead:${id}`);
  assert.notEqual(createAcceptedLeadConversion(id, 'Iné', 'another-secret')?.eventId, first.eventId);
  assert.equal(createAcceptedLeadConversion('019a4321-5e89-8aa9-9b09-775123456789', 'Iné', secret)?.material, 'iny');
  assert.equal(createAcceptedLeadConversion(id, 'Hladký / štvorcový eternit', secret)?.material, 'plocha');
  assert.equal(createAcceptedLeadConversion(id, 'Neviem posúdiť', secret)?.material, 'neviem');
  assert.equal(createAcceptedLeadConversion(id, 'Azbestocementové rúry', secret)?.material, 'iny');
  assert.equal(createAcceptedLeadConversion(id, 'customer@example.com', secret)?.material, 'iny');
  assert.equal(createAcceptedLeadConversion('customer@example.com', 'Vlnitý eternit', secret), null);
  assert.equal(createAcceptedLeadConversion('', 'Vlnitý eternit', secret), null);
});

test('lead input and direct conversion reject shared nil/max UUIDs but accept newer versions', () => {
  for (const invalid of ['00000000-0000-0000-0000-000000000000', 'ffffffff-ffff-ffff-ffff-ffffffffffff']) {
    assert.equal(isValidLeadSubmissionId(invalid), false);
    assert.equal(leadSchema.shape.submissionId.safeParse(invalid).success, false);
    assert.equal(createAcceptedLeadConversion(invalid, 'Vlnitý eternit', secret), null);
  }
  for (const valid of [id, '019a4321-5e89-7aa9-9b09-775123456789', '019a4321-5e89-8aa9-9b09-775123456789']) {
    assert.equal(isValidLeadSubmissionId(valid), true);
    assert.equal(leadSchema.shape.submissionId.safeParse(valid).success, true);
    assert.ok(createAcceptedLeadConversion(valid, 'Vlnitý eternit', secret));
  }
});

test('all four confirmed JSON success paths expose conversion but errors and HTML do not', () => {
  assert.equal((route.match(/return success\(/g) || []).length, 4);
  assert.equal((route.match(/createAcceptedLeadConversion\(input\.submissionId,/g) || []).length, 4);
  assert.match(route, /if \(wantsHtml\(request\)\) \{[\s\S]*?return NextResponse\.redirect\(/);
  assert.match(route, /return NextResponse\.json\(\{ ok: true, message, emailSent, \.+\(metaLead \? \{ metaLead \} : \{\}\) \}\)/);
  assert.match(route, /marketingConsentAtSubmit: true/);
  assert.match(route, /existing\.lead\.rawData\?\.marketingConsentAtSubmit === true/);
  assert.match(route, /submission\.lead\.rawData\?\.marketingConsentAtSubmit === true/);
  assert.doesNotMatch(route.slice(route.indexOf('function failure('), route.indexOf('function success(')), /metaLead/);
});

test('the shared landing form publishes the API conversion only after the response passes success validation', () => {
  const submitHandler = landingClient.slice(landingClient.indexOf('const submitLeadForm'), landingClient.indexOf('const onRooferContactClick'));
  assert.match(landingClient, /import \{ publishAcceptedLeadResponse \} from '@\/src\/lib\/ad-conversion-tracking\.mjs'/);
  assert.match(submitHandler, /if \(!response\.ok \|\| !result\.ok\) \{[\s\S]*throw new Error/);
  assert.match(submitHandler, /const result = await submitLeadForm\(payload\);\s*if \(result\.metaLead\) publishAcceptedLeadResponse\(result\);/);
});
