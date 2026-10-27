import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { Socket } from 'node:net';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { analyticsRetentionCutoff } from '../src/server/analytics-retention-policy.ts';

test('standalone analytics retention on an isolated local database', { timeout: 25_000 }, async (t) => {
  const directory = await fs.mkdtemp(path.join(process.cwd(), '.tmp-analytics-retention-'));
  const databasePath = path.join(directory, 'local-db.json');
  Object.assign(process.env, { NODE_ENV: 'test', DATABASE_URL: '', ASTANA_LOCAL_DB_PATH: databasePath, ADMIN_EMAIL: '', VERCEL: '', VERCEL_ENV: '', VERCEL_TARGET_ENV: '' });
  t.mock.method(Socket.prototype, 'connect', () => { throw new Error('No network in local retention test.'); });
  t.mock.method(globalThis, 'fetch', () => { throw new Error('No network in local retention test.'); });
  const snapshot = async () => JSON.parse(await fs.readFile(databasePath, 'utf8'));
  const save = (data) => fs.writeFile(databasePath, JSON.stringify(data), 'utf8');
  try {
    const db = await import('../src/server/db.ts');
    await db.listAnalyticsEvents();
    const referenceTime = new Date();
    const cutoff = analyticsRetentionCutoff(referenceTime);
    const old = new Date(Date.parse(cutoff) - 1).toISOString();
    const fresh = referenceTime.toISOString();
    const leadFixture = (createdAt, valid = true) => ({ id: randomUUID(), createdAt, updatedAt: fresh, status: 'novy', fullName: 'Local fixture', phone: '', email: 'fixture@example.invalid', city: 'Test', objectType: 'Test', materialType: 'Test', areaEstimate: 10, rawData: { analyticsConsentAtSubmit: true, analyticsSessionId: valid ? randomUUID() : 'broken', attribution: { utmSource: 'fixture', gclid: 'retained-business-attribution' } } });
    const oldLead = leadFixture(old);
    const oldInvalidLead = leadFixture(old, false);
    const recentLead = leadFixture(fresh);
    const eventFixture = (createdAt, eventType = 'page_view', id = randomUUID()) => ({ id, createdAt, eventType, sessionId: randomUUID(), path: '/fixture/', device: 'mobile', metadata: { fixture: true } });
    let seeded = await snapshot();
    seeded.leads.push(oldLead, oldInvalidLead, recentLead);
    seeded.businessJobs.push({ id: randomUUID(), customerName: 'Fixture', createdAt: fresh, updatedAt: fresh, costs: { fuel: 15, suits: 0, gloves: 0, penetrant: 0, landfillCost: 30, otherName: '', otherAmount: 0 } });
    seeded.businessJobInvoices.push({ id: randomUUID(), jobId: seeded.businessJobs[0].id, invoiceNumber: 'FIXTURE-001', amountWithVatCents: 12300, createdAt: fresh });
    seeded.businessJobPaymentEvents.push({ id: randomUUID(), jobId: seeded.businessJobs[0].id, amountCents: 5000, createdAt: fresh });
    seeded.priceOffers.push({ id: randomUUID(), number: 'FIXTURE-CP-001', status: 'ODOSLANA', createdAt: fresh, updatedAt: fresh });
    seeded.auditLogs.push({ id: randomUUID(), entityType: 'lead', entityId: oldLead.id, action: 'fixture', actorEmail: 'fixture@example.invalid', changes: { kept: true }, createdAt: old });
    seeded.metaCapiOutbox.push({ id: randomUUID(), leadId: oldLead.id, eventId: `lead:${'a'.repeat(64)}`, consentSubject: randomUUID(), eventTime: old, eventSourceUrl: 'https://likvidacia-eternitu.sk/', material: 'vlnity', status: 'sent', attempts: 1, maxAttempts: 6, retryable: false, createdAt: old, updatedAt: old });
    seeded.metaCapiConsentRevocations.push({ consentSubject: randomUUID(), revokedAt: old });
    seeded.analyticsEvents = [eventFixture(old), eventFixture(old, 'form_submit_success', oldLead.id), eventFixture(cutoff), eventFixture(fresh), eventFixture('damaged')];
    await save(seeded);
    // Normalize the fixture once using the existing business writer before comparison.
    await db.upsertLandfillPrice({ year: 2026, landfill: 'fixture', pricePerTon: 1 });
    const before = await snapshot();
    for (const key of ['leads', 'businessJobs', 'businessJobInvoices', 'businessJobPaymentEvents', 'priceOffers', 'auditLogs', 'metaCapiOutbox', 'metaCapiConsentRevocations']) assert.ok(before[key].length > 0, `nonempty isolation fixture: ${key}`);

    await t.test('purge changes only expired analytics and preserves malformed records for inspection', async () => {
      const result = await db.purgeExpiredAnalyticsEvents({ referenceTime });
      assert.deepEqual(result, { cutoff, deleted: 2, remaining: false, invalidDates: 1 });
      const after = await snapshot();
      assert.deepEqual(after.analyticsEvents.map((event) => event.id).sort(), before.analyticsEvents.filter((event) => event.createdAt !== old).map((event) => event.id).sort());
      for (const key of Object.keys(before).filter((key) => !['analyticsEvents', 'analyticsRetentionCutoff'].includes(key))) assert.deepEqual(after[key], before[key], key);
      assert.equal(after.analyticsRetentionCutoff, cutoff);
      assert.equal((await db.purgeExpiredAnalyticsEvents({ referenceTime: new Date(referenceTime.getTime() - 86_400_000) })).cutoff, cutoff);
      await assert.rejects(db.purgeExpiredAnalyticsEvents({ referenceTime: new Date('invalid') }), /Invalid analytics retention clock/);
      assert.equal((await snapshot()).analyticsRetentionCutoff, cutoff);
    });

    await t.test('delayed business snapshots and concurrent events cannot resurrect purged analytics', async (st) => {
      // Use a fresh expired fixture so this snapshot predates a second cleanup.
      const data = await snapshot();
      data.analyticsEvents.push(eventFixture(old));
      await save(data);
      let capturedResolve;
      let resumeResolve;
      const captured = new Promise((resolve) => { capturedResolve = resolve; });
      const resume = new Promise((resolve) => { resumeResolve = resolve; });
      const originalRead = fs.readFile;
      let captureNext = true;
      const reader = st.mock.method(fs, 'readFile', async (file, ...args) => {
        const capture = captureNext && String(file) === databasePath;
        if (capture) captureNext = false;
        const contents = await originalRead(file, ...args);
        if (capture) { capturedResolve(); await resume; }
        return contents;
      });
      syncBuiltinESMExports();
      const staleWrite = db.upsertLandfillPrice({ year: 2026, landfill: 'fixture', pricePerTon: 2 });
      staleWrite.catch(() => capturedResolve());
      try {
        await captured;
        await promisify(execFile)(process.execPath, ['--import', 'tsx', '--input-type=module', '-e',
          "const db = await import('./src/server/db.ts'); await db.purgeExpiredAnalyticsEvents({ referenceTime: new Date(process.env.ASTANA_RETENTION_TEST_REFERENCE) });"],
        { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: '', ASTANA_LOCAL_DB_PATH: databasePath, ASTANA_RETENTION_TEST_REFERENCE: referenceTime.toISOString() }, timeout: 10_000 });
        const next = await db.recordAnalyticsEvent({ eventType: 'page_view', path: '/new/', sessionId: randomUUID() });
        resumeResolve();
        await staleWrite;
        await Promise.all([db.purgeExpiredAnalyticsEvents({ referenceTime }), db.recordAnalyticsEvent({ eventType: 'form_start', path: '/new/', sessionId: randomUUID() })]);
        const final = await snapshot();
        assert.equal(final.analyticsRetentionCutoff, cutoff);
        assert.ok(final.analyticsEvents.every((event) => event.createdAt !== old));
        assert.ok(final.analyticsEvents.some((event) => event.id === next.id));
        assert.ok(final.analyticsEvents.some((event) => event.eventType === 'form_start'));
        assert.equal(final.landfillPrices.find((price) => price.landfill === 'fixture').pricePerTon, 2);
        assert.deepEqual(final.businessJobInvoices, before.businessJobInvoices);
        assert.deepEqual(final.metaCapiOutbox, before.metaCapiOutbox);
      } finally {
        resumeResolve(); await staleWrite.catch(() => undefined); reader.mock.restore(); syncBuiltinESMExports();
      }
    });

    await t.test('old lead recovery stays empty while fresh recovery is idempotent', async () => {
      assert.equal(await db.recordAcceptedLeadAnalytics(oldLead), null);
      assert.equal(await db.recordAnalyticsEvent({ createdAt: old, eventType: 'page_view', sessionId: randomUUID() }), null);
      assert.deepEqual(await db.recoverAcceptedLeadAnalytics(), { recovered: 1, failed: false, remaining: false, unrecoverable: 0 });
      assert.deepEqual(await db.recoverAcceptedLeadAnalytics(), { recovered: 0, failed: false, remaining: false, unrecoverable: 0 });
      const data = await snapshot();
      assert.equal(data.analyticsEvents.filter((event) => event.id === oldLead.id).length, 0);
      assert.equal(data.analyticsEvents.filter((event) => event.id === recentLead.id).length, 1);
      assert.deepEqual(data.leads, before.leads);
    });

    await t.test('reports exclude expired events even before cleanup and future backups omit raw analytics', async () => {
      const data = await snapshot();
      data.analyticsEvents.push(eventFixture(old));
      await save(data);
      assert.ok((await db.getAnalyticsEventsWithCoverage(365, '2000-01-01T00:00:00.000Z')).events.every((event) => Date.parse(event.createdAt) >= Date.parse(cutoff)));
      const total = await db.getAnalyticsTrafficSummary();
      assert.equal(total.allTime.pageViews, data.analyticsEvents.filter((event) => event.eventType === 'page_view' && Date.parse(event.createdAt) >= Date.parse(analyticsRetentionCutoff())).length);
      const backup = await db.exportDatabaseBackup();
      assert.equal('analyticsEvents' in backup.tables, false);
      assert.deepEqual(backup.excludedTables, ['analyticsEvents']);
      const serializedBackup = JSON.parse(JSON.stringify(backup));
      for (const key of ['leads', 'businessJobs', 'businessJobInvoices', 'businessJobPaymentEvents', 'priceOffers', 'metaCapiOutbox', 'metaCapiConsentRevocations', 'auditLogs']) assert.deepEqual(serializedBackup.tables[key], before[key], key);
    });
  } finally {
    assert.equal(path.dirname(directory), process.cwd());
    await fs.rm(directory, { recursive: true, force: true });
  }
});
