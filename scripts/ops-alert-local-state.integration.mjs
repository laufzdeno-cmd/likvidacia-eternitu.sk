import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('local operations alert state is atomic, migration-safe, repeatable, and auditable without PII', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'astana-ops-alert-'));
  const localDbPath = path.join(root, 'local-db.json');
  const previousPath = process.env.ASTANA_LOCAL_DB_PATH;
  const previousDatabase = process.env.DATABASE_URL;
  process.env.ASTANA_LOCAL_DB_PATH = localDbPath;
  delete process.env.DATABASE_URL;
  await writeFile(localDbPath, JSON.stringify({ leads: [] }), 'utf8');

  try {
    const database = await import(`../src/server/db.ts?ops-alert-local=${Date.now()}`);
    const baseMs = Date.now() - 120 * 60_000;
    const at = new Date(baseMs).toISOString();
    const atMinutes = (minutes) => new Date(baseMs + minutes * 60_000).toISOString();
    const request = {
      worker: 'lead_email_delivery',
      state: 'unhealthy',
      fingerprint: 'a'.repeat(64),
      repeatAfterMinutes: 60,
      now: at,
    };
    const concurrent = await Promise.all(Array.from({ length: 12 }, () => database.claimOpsAlert(request)));
    const claims = concurrent.filter(Boolean);
    assert.equal(claims.length, 1);
    assert.equal(claims[0].transition, 'degraded');

    const completed = await database.completeOpsAlert({
      worker: 'lead_email_delivery',
      claimId: claims[0].claimId,
      deliveredAt: at,
      summary: {
        reasonCodes: ['unknown_delivery', 'private-person@example.test'],
        metrics: { unknown: 1, customer_email: 99 },
      },
    });
    assert.equal(completed, true);
    assert.equal(await database.claimOpsAlert({ ...request, now: new Date(baseMs + 60 * 60_000 - 1).toISOString() }), null);

    const repeat = await database.claimOpsAlert({ ...request, now: atMinutes(60) });
    assert.equal(repeat?.transition, 'repeated');
    assert.equal(await database.releaseOpsAlertClaim('lead_email_delivery', repeat.claimId), true);

    const repeatAgain = await database.claimOpsAlert({ ...request, now: atMinutes(121) });
    assert.equal(repeatAgain?.transition, 'repeated');
    assert.equal(await database.completeOpsAlert({
      worker: 'lead_email_delivery', claimId: repeatAgain.claimId, deliveredAt: atMinutes(121),
      summary: { reasonCodes: ['unknown_delivery'], metrics: { unknown: 1 } },
    }), true);

    const recovery = await database.claimOpsAlert({
      ...request,
      state: 'healthy',
      fingerprint: 'b'.repeat(64),
      now: atMinutes(122),
    });
    assert.equal(recovery?.transition, 'recovered');
    assert.equal(await database.completeOpsAlert({
      worker: 'lead_email_delivery', claimId: recovery.claimId, deliveredAt: atMinutes(122),
      summary: { reasonCodes: [], metrics: { pending: 0 } },
    }), true);
    assert.equal(await database.claimOpsAlert({
      ...request,
      state: 'healthy',
      fingerprint: 'b'.repeat(64),
      now: atMinutes(240),
    }), null);

    const unknownDelivery = await database.claimOpsAlert({
      ...request,
      worker: 'application_notifications',
      fingerprint: 'c'.repeat(64),
      now: atMinutes(300),
    });
    assert.ok(unknownDelivery);
    assert.equal(await database.claimOpsAlert({
      ...request,
      worker: 'application_notifications',
      fingerprint: 'c'.repeat(64),
      now: atMinutes(304),
    }), null);
    const recoveredAfterUnknown = await database.claimOpsAlert({
      ...request,
      worker: 'application_notifications',
      state: 'healthy',
      fingerprint: 'd'.repeat(64),
      now: atMinutes(305),
    });
    assert.equal(recoveredAfterUnknown?.transition, 'recovered', 'obnova po nejasnom degraded alarme nesmie zaniknúť');
    assert.notEqual(recoveredAfterUnknown?.claimId, unknownDelivery.claimId);
    assert.equal(await database.claimOpsAlert({
      ...request,
      worker: 'application_notifications',
      state: 'healthy',
      fingerprint: 'd'.repeat(64),
      now: atMinutes(309),
    }), null);
    const recoveryRetry = await database.claimOpsAlert({
      ...request,
      worker: 'application_notifications',
      state: 'healthy',
      fingerprint: 'd'.repeat(64),
      now: atMinutes(310),
    });
    assert.equal(recoveryRetry?.claimId, recoveredAfterUnknown.claimId, 'nejasná recovery musí zachovať event ID');
    assert.equal(recoveryRetry?.transition, 'recovered');
    assert.equal(await database.completeOpsAlert({
      worker: 'application_notifications', claimId: recoveryRetry.claimId, deliveredAt: atMinutes(310),
      summary: { reasonCodes: [], metrics: { pending: 0 } },
    }), true);

    const stableUnknown = await database.claimOpsAlert({
      ...request,
      fingerprint: 'e'.repeat(64),
      now: atMinutes(400),
    });
    assert.ok(stableUnknown);
    assert.equal(await database.claimOpsAlert({ ...request, fingerprint: 'e'.repeat(64), now: atMinutes(404) }), null);
    const stableUnknownRetry = await database.claimOpsAlert({
      ...request,
      fingerprint: 'e'.repeat(64),
      now: atMinutes(405),
    });
    assert.equal(stableUnknownRetry?.claimId, stableUnknown.claimId, 'nejasný webhook retry musí zachovať event ID');
    assert.equal(await database.completeOpsAlert({
      worker: 'lead_email_delivery', claimId: stableUnknownRetry.claimId, deliveredAt: atMinutes(405),
      summary: { reasonCodes: ['failed_delivery'], metrics: { failed: 1 } },
    }), true);

    const unknownRecovery = await database.claimOpsAlert({
      ...request,
      state: 'healthy',
      fingerprint: 'f'.repeat(64),
      now: atMinutes(406),
    });
    assert.equal(unknownRecovery?.transition, 'recovered');
    assert.equal(await database.claimOpsAlert({ ...request, now: atMinutes(410) }), null);
    const degradedAfterUnknownRecovery = await database.claimOpsAlert({ ...request, now: atMinutes(411) });
    assert.equal(degradedAfterUnknownRecovery?.transition, 'degraded', 'nový výpadok po nejasnej recovery nesmie zaniknúť');
    assert.notEqual(degradedAfterUnknownRecovery?.claimId, unknownRecovery.claimId);
    assert.equal(await database.completeOpsAlert({
      worker: 'lead_email_delivery', claimId: degradedAfterUnknownRecovery.claimId, deliveredAt: atMinutes(411),
      summary: { reasonCodes: ['unknown_delivery'], metrics: { unknown: 1 } },
    }), true);

    const persisted = await readFile(localDbPath, 'utf8');
    assert.doesNotMatch(persisted, /private-person@example\.test|customer_email/);
    const parsed = JSON.parse(persisted);
    assert.equal(parsed.opsAlertStates.length, 2);
    assert.equal(parsed.opsAlertStates.find((item) => item.workerKey === 'application_notifications').lastDeliveredState, 'healthy');
    assert.equal(parsed.opsAlertStates.find((item) => item.workerKey === 'lead_email_delivery').lastDeliveredState, 'unhealthy');
    const alerts = parsed.auditLogs.filter((item) => item.action === 'ops_alert_delivered');
    assert.equal(alerts.length, 6);
    assert.deepEqual(alerts.at(-1).changes.reasonCodes, ['unknown_delivery']);
    assert.deepEqual(alerts.at(-1).changes.metrics, { unknown: 1 });
  } finally {
    if (previousPath === undefined) delete process.env.ASTANA_LOCAL_DB_PATH;
    else process.env.ASTANA_LOCAL_DB_PATH = previousPath;
    if (previousDatabase === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabase;
    await rm(root, { recursive: true, force: true });
  }
});
