import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import PDFDocument from 'pdfkit';
import sharp from 'sharp';

const testRoot = path.resolve('tmp', 'job-private-mail-tests');
await mkdir(testRoot, { recursive: true });
const directory = await mkdtemp(path.join(testRoot, 'isolated-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = '';
process.env.ASTANA_LOCAL_DB_PATH = path.join(directory, 'local-db.json');
process.env.ASTANA_JOB_PRIVATE_ROOT = path.join(directory, 'private-files');
process.env.ASTANA_JOB_GMAIL_VERIFIED = '';
process.env.PHOTO_INTAKE_PRIVATE_STORE_VERIFIED = '';
process.env.VERCEL = '';
after(async () => {
  assert.ok(path.resolve(directory).startsWith(testRoot + path.sep));
  await rm(directory, { recursive: true, force: true });
});

const { validateJobPdf, extractJobPdf, suggestJobPdfFields } = await import('../src/server/job-pdf-extraction.ts');
const { prepareJobPhoto, storeJobPrivateUpload, readJobPrivateBytes, privateDocumentPublicView } = await import('../src/server/job-private-storage.ts');
const { parseJobGmailMessage, listScopedJobGmailMessages, readJobGmailMessage, readJobGmailPdfAttachment } = await import('../src/server/job-mail-api.ts');
const { saveJobMailConfiguration, stageJobMailMessages, readJobMailStore, disableJobMailSync } = await import('../src/server/job-mail-store.ts');
const { suggestJobMailMatches, reviewJobMailMessage, synchronizeJobMail } = await import('../src/server/job-mail-service.ts');
const { migrateJobMailSchema } = await import('../src/server/job-mail-migration.ts');
const actor = { email: 'owner@example.test', role: 'SUPER_ADMIN' };
const operator = { email: 'operator@example.test', role: 'OPERATOR' };
const reviewer = { email: 'reviewer@example.test', role: 'META_REVIEWER' };

async function pdf(text) {
  const document = new PDFDocument({ size: 'A4', compress: true });
  const chunks = [];
  document.on('data', (data) => chunks.push(data));
  const completion = new Promise((resolve) => document.on('end', () => resolve(Buffer.concat(chunks))));
  if (text) document.font('Helvetica').fontSize(12).text(text);
  document.end();
  return completion;
}

test('PDF proposals preserve provenance and never invent invalid dates or totals', () => {
  const proposals = suggestJobPdfFields('Cenova ponuka CP-2026-007\nDatum vystavenia: 31. 2. 2026\nCelkom s DPH: 1 234,56 EUR\nDodavatel astana@astana.sk\nObjednavatel Email: client@example.test');
  assert.equal(proposals.find((p) => p.field === 'originalNumber').value, 'CP-2026-007');
  assert.equal(proposals.find((p) => p.field === 'totalWithVatCents').value, '123456');
  assert.equal(proposals.find((p) => p.field === 'email').value, 'client@example.test');
  assert.equal(proposals.some((p) => p.field === 'issuedOn'), false);
  assert.ok(proposals.every((p) => p.confidence === 'REVIEW_REQUIRED' && p.sourceText));
  assert.throws(() => validateJobPdf(Buffer.from('not a pdf')), /platný PDF/);
  assert.throws(() => validateJobPdf(Buffer.alloc(4 * 1024 * 1024)), /3 MB/);
});

test('local worker extracts compressed digital PDF; empty or encrypted/invalid requires manual correction', async () => {
  const bytes = await pdf('Cenova ponuka: CP-2026-0042\nDatum vystavenia: 27. 10. 2026\nCelkom s DPH: 1234,56 EUR');
  const result = await extractJobPdf(bytes);
  assert.equal(result.state, 'TEXT', JSON.stringify(result));
  assert.equal(result.pages, 1);
  assert.match(result.text, /CP-2026-0042/);
  assert.equal(result.suggestions.find((p) => p.field === 'issuedOn').value, '2026-10-27');
  const blank = await extractJobPdf(await pdf(''));
  assert.equal(blank.state, 'MANUAL_REQUIRED');
  assert.equal(blank.reason, 'scanned_or_empty');
  const invalid = await extractJobPdf(Buffer.from('%PDF-1.7\ninvalid'));
  assert.equal(invalid.state, 'MANUAL_REQUIRED');
  assert.equal(invalid.reason, 'encrypted_or_invalid');
});

test('private original PDF bytes/hash stay unchanged and public projection excludes storage keys', async () => {
  const source = await pdf('Original CP-2026-0001');
  let registered;
  const result = await storeJobPrivateUpload({ bytes: source, originalName: '../original.pdf', mime: 'application/pdf', kind: 'PDF' }, operator, {
    register: async (document, user) => (registered = { ...document, createdAt: '2026-10-27T00:00:00Z', createdBy: user.email }),
  });
  assert.equal(result.document.sha256, createHash('sha256').update(source).digest('hex'));
  assert.deepEqual(await readJobPrivateBytes(registered.storageKey), source);
  const view = privateDocumentPublicView(result.document);
  assert.equal('storageKey' in view, false);
  assert.equal('thumbnailStorageKey' in view, false);
  assert.match(view.href, /^\/api\/admin\/job-workspace\/documents\//);
  await assert.rejects(readJobPrivateBytes('local:../../secrets.env'), /Neplatný/);
  await assert.rejects(storeJobPrivateUpload({ bytes: source, originalName: 'a.pdf', mime: 'application/pdf', kind: 'PDF' }, reviewer, { register: async () => assert.fail('must not persist') }), /oprávnenie/);
  let uncertainRecord;
  await assert.rejects(storeJobPrivateUpload({ bytes: source, originalName: 'uncertain.pdf', mime: 'application/pdf', kind: 'PDF' }, operator, { register: async (record) => { uncertainRecord = record; throw new Error('unknown database acknowledgement'); } }), /acknowledgement/);
  assert.deepEqual(await readJobPrivateBytes(uncertainRecord.storageKey), source, 'a database commit may have succeeded; ambiguous persistence must not delete the private original');
});

test('photo is WebP with a small thumbnail, stripped EXIF/GPS and rotation applied', async () => {
  const original = await sharp({ create: { width: 1800, height: 1200, channels: 3, background: '#1f7c88' } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const result = await prepareJobPhoto(original);
  const full = await sharp(result.optimized).metadata();
  const thumbnail = await sharp(result.thumbnail).metadata();
  assert.equal(full.format, 'webp');
  assert.equal(full.width, 1200);
  assert.equal(full.height, 1800);
  assert.equal(full.exif, undefined);
  assert.equal(full.orientation, undefined);
  assert.ok(thumbnail.width <= 480 && thumbnail.height <= 360);
  assert.ok(result.optimized.length < original.length);
  await assert.rejects(prepareJobPhoto(Buffer.from('<svg onload="alert(1)"/>')), /JPG, PNG alebo WebP/);
});

const message = {
  id: '18e000ff', threadId: '18e000aa', internalDate: String(Date.UTC(2026, 9, 20)), labelIds: ['SENT', 'Label_Business'],
  payload: { mimeType: 'multipart/mixed', headers: [{ name: 'Subject', value: 'CP-2026-0042 klient' }, { name: 'From', value: 'Firma <owner@example.test>' }, { name: 'To', value: 'Klient <client@example.test>' }], parts: [
    { mimeType: 'text/plain', body: { data: Buffer.from('Pekny den. Ponuka CP-2026-0042 je v prilohe.').toString('base64url') } },
    { mimeType: 'application/pdf', filename: 'ponuka.pdf', body: { attachmentId: 'ANGjd18', size: 100 } },
    { mimeType: 'application/x-msdownload', filename: 'danger.exe', body: { attachmentId: 'ANGjd19', size: 100 } },
  ] },
};

test('Gmail extracts inert text and PDF descriptors only, preserves occurrence time and matches are review proposals', async () => {
  const parsed = parseJobGmailMessage(message);
  assert.equal(parsed.direction, 'OUTBOUND');
  assert.equal(parsed.occurredAt, '2026-10-20T00:00:00.000Z');
  assert.deepEqual(parsed.recipients, ['client@example.test']);
  assert.equal(parsed.pdfAttachments.length, 1);
  const htmlMessage = parseJobGmailMessage({ ...message, payload: { ...message.payload, parts: [{ mimeType: 'text/html', body: { data: Buffer.from('<script>steal()</script><img src="https://bad.test/pixel">Hello <b>client</b>').toString('base64url') } }] } });
  assert.equal(htmlMessage.text, 'Hello client');
  const one = randomUUID(), two = randomUUID();
  const matches = suggestJobMailMatches(parsed, [{ jobId: one, number: 'ZAK-1', email: 'client@example.test', phone: '', offerNumbers: ['CP-2026-0042'] }, { jobId: two, number: 'ZAK-2', email: 'client@example.test', phone: '', offerNumbers: [] }]);
  assert.equal(matches.length, 2);
  assert.equal(matches.find((m) => m.jobId === one).strength, 'EXACT_OFFER');
  assert.equal(matches.find((m) => m.jobId === two).strength, 'CONTACT_ONLY');
});

test('Gmail adapter uses GET only on fixed Google origin; scopes label union, dedupes and continues history pages', async () => {
  const calls = [];
  const transport = async (url, options) => {
    calls.push({ url: new URL(url), options });
    return Response.json({ messages: [{ id: '18e000ff' }], nextPageToken: 'NEXT_token' });
  };
  const result = await listScopedJobGmailMessages('fake-only', { labelIds: ['Label_A', 'Label_B'], since: '2026-01-01', limit: 10, pageTokens: { Label_A: 'OLDER_token' } }, transport);
  assert.deepEqual(result.messageIds, ['18e000ff']);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url.searchParams.get('pageToken'), 'OLDER_token');
  assert.equal(calls[0].url.searchParams.get('labelIds'), 'Label_A');
  assert.match(calls[0].url.searchParams.get('q'), /^after:\d+$/);
  assert.equal(result.pageTokens.Label_B, 'NEXT_token');
  assert.ok(calls.every((call) => call.options.method === 'GET' && call.url.origin === 'https://gmail.googleapis.com'));
  const outside = await readJobGmailMessage('fake-only', '18e000ff', async () => Response.json({ ...message, labelIds: ['INBOX'] }), ['Label_Business']);
  assert.equal(outside, null, 'message moved out of approved business label must not be staged');
  await assert.rejects(readJobGmailMessage('fake-only', '../other'), /gmail_response_invalid/);
  await assert.rejects(readJobGmailMessage('fake-only', '18e000ff', async () => Response.json({ error: 'private token detail' }, { status: 401 })), /gmail_authorization_failed/);
});

test('Gmail PDF attachment is size/magic checked and arbitrary attachment ids are refused', async () => {
  const bytes = Buffer.from('%PDF-1.7\noriginal');
  const attachment = { attachmentId: 'ANGjd18', filename: 'cp.pdf', mime: 'application/pdf', size: bytes.length };
  assert.deepEqual(await readJobGmailPdfAttachment('fake-only', '18e000ff', attachment, async () => Response.json({ data: bytes.toString('base64url'), size: bytes.length })), bytes);
  await assert.rejects(readJobGmailPdfAttachment('fake-only', '18e000ff', { ...attachment, attachmentId: '../forbidden' }), /gmail_response_invalid/);
  await assert.rejects(readJobGmailPdfAttachment('fake-only', '18e000ff', attachment, async () => Response.json({ data: Buffer.from('malicious').toString('base64url'), size: 9 })), /gmail_response_invalid/);
});

test('mail stage is SA-only, disabled by default, explicit Google verification gate and concurrent dedupe', async () => {
  assert.equal((await readJobMailStore(actor)).configuration.enabled, false);
  await assert.rejects(readJobMailStore(operator), /iba superadmin/);
  await assert.rejects(synchronizeJobMail(actor), /vypnutá/);
  const config = { enabled: true, labelIds: ['Label_Business'], since: '2026-01-01', maxMessages: 10, verificationAcknowledged: true, expectedRevision: 0 };
  await assert.rejects(saveJobMailConfiguration(config, actor), /overenia Google/);
  process.env.ASTANA_JOB_GMAIL_VERIFIED = 'true';
  const saved = await saveJobMailConfiguration(config, actor);
  await assert.rejects(saveJobMailConfiguration(config, actor), /medzičasom zmenilo/);
  const parsed = parseJobGmailMessage(message);
  const batch = { account: 'owner@example.test', messages: [{ message: parsed, matches: [] }], pageTokens: { Label_Business: 'NEXT' }, expectedRevision: saved.revision };
  const additions = await Promise.all([stageJobMailMessages(batch, actor), stageJobMailMessages(batch, actor)]);
  assert.equal(additions.reduce((a, b) => a + b), 1);
  const stage = await readJobMailStore(actor);
  assert.equal(stage.messages.length, 1);
  assert.equal(stage.messages[0].review, 'PENDING');
  await assert.rejects(reviewJobMailMessage({ id: stage.messages[0].id, decision: 'IGNORE', confirmed: false }, actor), /Potvrďte kontrolu/);
  await reviewJobMailMessage({ id: stage.messages[0].id, decision: 'IGNORE', confirmed: true }, actor);
  assert.equal((await readJobMailStore(actor)).messages[0].review, 'IGNORED');
  await disableJobMailSync(actor);
  await assert.rejects(stageJobMailMessages(batch, actor), /zastavená/);
  assert.equal((await readJobMailStore(actor)).messages.length, 1, 'disabling preserves reviewed private history');
  const persisted = await readFile(`${process.env.ASTANA_LOCAL_DB_PATH}.job-mail.json`, 'utf8');
  assert.equal(persisted.includes('refresh_token'), false);
  process.env.ASTANA_JOB_GMAIL_VERIFIED = '';
});

test('explicit PostgreSQL migration has default-off payload and is idempotent', async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const database = new PGlite();
  try {
    await migrateJobMailSchema(database);
    await migrateJobMailSchema(database);
    const result = await database.query('SELECT payload FROM job_mail_workspace_state WHERE id=1');
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].payload.configuration.enabled, false);
  } finally { await database.close(); }
});
