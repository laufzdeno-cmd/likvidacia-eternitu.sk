import assert from 'node:assert/strict';
import test from 'node:test';

const mailModule = await import('../src/server/mail.ts');
const {
  adminLeadEmailHtml,
  adminLeadEmailText,
  prepareInternalLeadPhotoAttachments,
} = mailModule.default ?? mailModule;

const lead = {
  id: 'lead-email-template-test',
  fullName: 'Testovací dopyt',
  email: 'zakaznik@example.invalid',
  phone: '0905123456',
  city: 'Poprad',
  district: 'Poprad',
  objectType: 'Rodinný dom',
  materialType: 'Vlnitý eternit',
  areaEstimate: 120,
  preferredContact: 'Emailom',
  term: 'Do mesiaca',
  note: 'Test šablóny',
  gdpr: true,
  source: 'test',
  status: 'novy',
  createdAt: '2026-10-11T09:37:00.000Z',
};

test('interný email má logo a Gmail nemôže automaticky stmaviť odkaz v hlavičke', () => {
  const html = adminLeadEmailHtml(lead, undefined, 1, 1);

  assert.match(html, /astana-logo-dark\.png/);
  assert.match(html, /bgcolor="#263451"/);
  assert.match(html, /href="https:\/\/likvidacia-eternitu\.sk\/" style="color:#F2B24A!important/);
  assert.match(html, /1 fotografia · priložená k tomuto e-mailu/);
  assert.match(html, /11:37/);
});

test('textová verzia presne rozlišuje fotku v emaile od fotky iba v chránenom admine', () => {
  assert.match(adminLeadEmailText(lead, undefined, 1, 1), /Fotky: 1 fotografia · priložená k tomuto e-mailu/);
  assert.match(adminLeadEmailText(lead, undefined, 1, 0), /Fotky: 1 fotografia · uložené v chránenom admine/);
});

test('interné prílohy rešpektujú limit a čistia názov bez straty chráneného originálu', async () => {
  const firstContent = Buffer.alloc(8 * 1024 * 1024, 0x41);
  const secondContent = Buffer.alloc(8 * 1024 * 1024, 0x42);
  const files = [firstContent, secondContent].map((content, index) => ({
    id: `file-${index + 1}`,
    leadId: lead.id,
    originalName: index === 0 ? 'strecha\r\n.jpg' : 'detail.webp',
    storageDriver: 'local',
    storageKey: `test-${index + 1}`,
    mimeType: index === 0 ? 'image/jpeg' : 'image/webp',
    sizeBytes: content.length,
    createdAt: lead.createdAt,
  }));

  const bundle = await prepareInternalLeadPhotoAttachments(files, async (file) => (
    file.id === files[0].id ? firstContent : secondContent
  ));

  assert.equal(bundle.attachedCount, 1);
  assert.equal(bundle.skippedCount, 1);
  assert.equal(bundle.attachments[0].filename, 'strecha-.jpg');
  assert.equal(bundle.attachments[0].contentType, 'image/jpeg');
  assert.equal(bundle.attachments[0].content.length, firstContent.length);
});
