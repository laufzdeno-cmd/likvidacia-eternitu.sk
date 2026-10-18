import assert from 'node:assert/strict';
import test from 'node:test';
import { careerApplicationEmailContent } from '../src/server/career-application-email.ts';

const application = {
  id: '11111111-1111-4111-8111-111111111111',
  submissionId: '22222222-2222-4222-8222-222222222222',
  createdAt: '2026-10-18T08:30:00.000Z',
  updatedAt: '2026-10-18T08:30:00.000Z',
  status: 'new',
  ownerEmail: '',
  nextAction: '',
  followupDate: '',
  fullName: '<Ján & tím>',
  phone: '+421 900 000 000',
  email: 'jan@example.invalid',
  city: 'Poprad',
  cooperationType: 'szco',
  workRegions: 'Prešovský kraj',
  hasTradeLicense: true,
  workAtHeights: true,
  hasAsbestosExperience: false,
  asbestosExperience: '',
  experience: '<script>alert(1)</script>',
  note: 'Bez poznámky',
  privacyConsent: true,
  cvExpected: true,
  cv: {
    originalName: 'zivotopis.pdf',
    storageDriver: 'vercel_blob',
    storageKey: 'private/career/test.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 100,
  },
};

test('applicant receives a branded readable Slovak confirmation with a text fallback', () => {
  const message = careerApplicationEmailContent(application, 'applicant', 'https://example.invalid/admin');
  assert.match(message.subject, /ASTANA prijala vašu žiadosť/);
  assert.match(message.html, /https:\/\/likvidacia-eternitu\.sk\/assets\/astana-logo-dark\.png/);
  assert.match(message.html, /background:#263451;color:#FFFFFF/);
  assert.match(message.html, /Prosíme, nevolajte kvôli overeniu prijatia/);
  assert.match(message.text, /Prosíme, nevolajte kvôli overeniu prijatia/);
  assert.match(message.html, /&lt;Ján &amp; tím&gt;/);
  assert.doesNotMatch(message.html, /<Ján & tím>/);
});

test('internal notification keeps CV private, escapes user content and links only to protected admin', () => {
  const adminUrl = 'https://likvidacia-eternitu.sk/admin/kariera/11111111/?from=mail&safe=1';
  const message = careerApplicationEmailContent(application, 'internal', adminUrl);
  assert.match(message.html, /priložený v chránenom admine/);
  assert.match(message.text, /Životopis: priložený v chránenom admine/);
  assert.match(message.html, /https:\/\/likvidacia-eternitu\.sk\/admin\/kariera\/11111111\/\?from=mail&amp;safe=1/);
  assert.doesNotMatch(message.html, /<script>alert\(1\)<\/script>/);
  assert.match(message.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(message.html, /private\/career\/test\.pdf/);
});
