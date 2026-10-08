import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

let pglite;
let server;

async function availablePort() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const { port } = probe.address();
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  return port;
}

let exitCode = 0;
try {
  const port = await availablePort();
  pglite = await PGlite.create();
  await pglite.exec(`
    CREATE TABLE astana_schema_revisions (
      signature text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
    INSERT INTO astana_schema_revisions (signature) VALUES ('legacy-before-ops-alerts');
  `);
  server = new PGLiteSocketServer({ db: pglite, port, host: '127.0.0.1', maxConnections: 16 });
  await server.start();
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = `postgres://astana_test:astana_test@127.0.0.1:${port}/astana_test`;
  process.env.ADMIN_EMAIL = '';
  const db = await import('../src/server/db.ts');

  const baseMs = Date.now() - 120 * 60_000;
  const atMinutes = (minutes) => new Date(baseMs + minutes * 60_000).toISOString();
  const request = {
    worker: 'application_notifications',
    state: 'unhealthy',
    fingerprint: 'c'.repeat(64),
    repeatAfterMinutes: 60,
    now: atMinutes(0),
  };
  const claims = (await Promise.all(Array.from({ length: 12 }, () => db.claimOpsAlert(request)))).filter(Boolean);
  assert.equal(claims.length, 1, 'FOR UPDATE musí vydať iba jeden súbežný claim');
  assert.equal(claims[0].transition, 'degraded');
  assert.equal(await db.completeOpsAlert({
    worker: request.worker,
    claimId: claims[0].claimId,
    deliveredAt: atMinutes(0),
    summary: { reasonCodes: ['failed_delivery', 'person@example.test'], metrics: { failed: 2, customer_email: 1 } },
  }), true);

  assert.equal(await db.claimOpsAlert({ ...request, now: atMinutes(59) }), null);
  const repeated = await db.claimOpsAlert({ ...request, now: atMinutes(60) });
  assert.equal(repeated?.transition, 'repeated');
  assert.equal(await db.completeOpsAlert({
    worker: request.worker,
    claimId: repeated.claimId,
    deliveredAt: atMinutes(60),
    summary: { reasonCodes: ['failed_delivery'], metrics: { failed: 2 } },
  }), true);

  const recovery = await db.claimOpsAlert({
    ...request,
    state: 'healthy',
    fingerprint: 'd'.repeat(64),
    now: atMinutes(61),
  });
  assert.equal(recovery?.transition, 'recovered');
  assert.equal(await db.completeOpsAlert({
    worker: request.worker,
    claimId: recovery.claimId,
    deliveredAt: atMinutes(61),
    summary: { reasonCodes: [], metrics: { pending: 0 } },
  }), true);

  const ambiguousRequest = {
    ...request,
    worker: 'lead_email_delivery',
    fingerprint: 'e'.repeat(64),
    now: atMinutes(120),
  };
  const ambiguousClaim = await db.claimOpsAlert(ambiguousRequest);
  assert.ok(ambiguousClaim);
  assert.equal(await db.claimOpsAlert({ ...ambiguousRequest, now: atMinutes(124) }), null);
  const recoveredAfterUnknown = await db.claimOpsAlert({
    ...ambiguousRequest,
    state: 'healthy',
    fingerprint: 'f'.repeat(64),
    now: atMinutes(125),
  });
  assert.equal(recoveredAfterUnknown?.transition, 'recovered', 'obnova po nejasnom degraded alarme nesmie zaniknúť');
  assert.notEqual(recoveredAfterUnknown?.claimId, ambiguousClaim.claimId);
  assert.equal(await db.claimOpsAlert({
    ...ambiguousRequest,
    state: 'healthy',
    fingerprint: 'f'.repeat(64),
    now: atMinutes(129),
  }), null);
  const recoveryRetry = await db.claimOpsAlert({
    ...ambiguousRequest,
    state: 'healthy',
    fingerprint: 'f'.repeat(64),
    now: atMinutes(130),
  });
  assert.equal(recoveryRetry?.claimId, recoveredAfterUnknown.claimId, 'nejasná recovery musí zachovať event ID');
  assert.equal(recoveryRetry?.transition, 'recovered');
  assert.equal(await db.completeOpsAlert({
    worker: ambiguousRequest.worker,
    claimId: recoveryRetry.claimId,
    deliveredAt: atMinutes(130),
    summary: { reasonCodes: [], metrics: { pending: 0 } },
  }), true);

  const stableUnknown = await db.claimOpsAlert({
    ...request,
    fingerprint: 'a'.repeat(64),
    now: atMinutes(180),
  });
  assert.ok(stableUnknown);
  assert.equal(await db.claimOpsAlert({ ...request, fingerprint: 'a'.repeat(64), now: atMinutes(184) }), null);
  const stableUnknownRetry = await db.claimOpsAlert({ ...request, fingerprint: 'a'.repeat(64), now: atMinutes(185) });
  assert.equal(stableUnknownRetry?.claimId, stableUnknown.claimId, 'nejasný webhook retry musí zachovať event ID');
  assert.equal(await db.completeOpsAlert({
    worker: request.worker,
    claimId: stableUnknownRetry.claimId,
    deliveredAt: atMinutes(185),
    summary: { reasonCodes: ['failed_delivery'], metrics: { failed: 1 } },
  }), true);

  const unknownRecovery = await db.claimOpsAlert({
    ...request,
    state: 'healthy',
    fingerprint: 'b'.repeat(64),
    now: atMinutes(186),
  });
  assert.equal(unknownRecovery?.transition, 'recovered');
  assert.equal(await db.claimOpsAlert({ ...request, now: atMinutes(190) }), null);
  const degradedAfterUnknownRecovery = await db.claimOpsAlert({ ...request, now: atMinutes(191) });
  assert.equal(degradedAfterUnknownRecovery?.transition, 'degraded', 'nový výpadok po nejasnej recovery nesmie zaniknúť');
  assert.notEqual(degradedAfterUnknownRecovery?.claimId, unknownRecovery.claimId);
  assert.equal(await db.completeOpsAlert({
    worker: request.worker,
    claimId: degradedAfterUnknownRecovery.claimId,
    deliveredAt: atMinutes(191),
    summary: { reasonCodes: ['failed_delivery'], metrics: { failed: 1 } },
  }), true);

  const states = await pglite.query('SELECT * FROM ops_alert_states ORDER BY worker_key');
  assert.equal(states.rows.length, 2);
  assert.equal(states.rows.find((row) => row.worker_key === 'lead_email_delivery').last_delivered_state, 'healthy');
  assert.equal(states.rows.find((row) => row.worker_key === 'application_notifications').last_delivered_state, 'unhealthy');
  assert.ok(states.rows.every((row) => row.claim_id === null));
  const audits = await pglite.query("SELECT changes FROM audit_logs WHERE action='ops_alert_delivered' ORDER BY created_at");
  assert.equal(audits.rows.length, 6);
  const serialized = JSON.stringify(audits.rows);
  assert.doesNotMatch(serialized, /person@example\.test|customer_email/);
  assert.match(serialized, /application_notifications/);
  assert.equal((await pglite.query("SELECT count(*)::int AS count FROM astana_schema_revisions WHERE signature='legacy-before-ops-alerts'")).rows[0].count, 1);
  assert.ok((await pglite.query("SELECT to_regclass('ops_alert_states') AS relation")).rows[0].relation);
  console.log('PASS: PostgreSQL prevádzkové alerty majú kompatibilnú migráciu, súbežný claim, opakovanie, obnovu a audit bez PII.');
} catch (error) {
  console.error(error);
  exitCode = 1;
} finally {
  try {
    await server?.stop();
    await pglite?.close();
  } catch (error) {
    console.error('Cleanup failed:', error);
    exitCode = 1;
  }
}
process.exit(exitCode);
