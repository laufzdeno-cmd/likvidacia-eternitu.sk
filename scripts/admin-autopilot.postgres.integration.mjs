import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

let database;
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

function jobInput() {
  return {
    demolitionDate: '2026-10-18', customerName: 'Test parity', customerPhone: '0900123456',
    customerEmail: 'parity@example.invalid', location: 'Poprad', district: 'Poprad',
    materialType: 'Vlnitý eternit', objectType: 'Rodinný dom', term: 'dohodou',
    leadSource: 'test', preferredContact: 'email', m2: 120, pricePerM2: 10.5,
    paymentType: 'FAKTURA', workType: 'DEMONTAZ_A_ODVOZ', wasteKg: 1_000, landfill: 'INA',
    status: 'DOPYT', note: '', workers: [],
    costs: { fuel: 0, suits: 0, gloves: 0, penetrant: 0, landfillCost: 0, otherName: '', otherAmount: 0 },
  };
}

let exitCode = 0;
try {
  const port = await availablePort();
  database = await PGlite.create();
  server = new PGLiteSocketServer({ db: database, port, host: '127.0.0.1', maxConnections: 8 });
  await server.start();
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = `postgres://astana_test:astana_test@127.0.0.1:${port}/astana_test`;
  process.env.ADMIN_EMAIL = 'superadmin@example.invalid';

  const db = await import('../src/server/db.ts');
  const { reconcileAdminAutopilot } = await import('../src/server/admin-autopilot.ts');
  const job = await db.saveBusinessJob(jobInput(), process.env.ADMIN_EMAIL);
  const first = await reconcileAdminAutopilot({ actorEmail: 'system:test-autopilot', trigger: 'test' });
  assert.equal(first.priceOffersCreated, 1);
  const [prepared] = await db.listPriceOffers({ jobId: job.id });
  assert.ok(prepared);

  await db.deletePriceOffer(prepared.id, process.env.ADMIN_EMAIL);
  assert.equal((await db.listPriceOffers({ jobId: job.id })).length, 0);

  const restored = await reconcileAdminAutopilot({ actorEmail: 'system:test-autopilot', trigger: 'test' });
  assert.equal(restored.priceOffersCreated, 1);
  const visible = await db.listPriceOffers({ jobId: job.id });
  assert.equal(visible.length, 1, 'PostgreSQL musí po obnovení vrátiť koncept medzi nearchivované ponuky');
  assert.equal(visible[0].id, prepared.id, 'PostgreSQL a lokálny režim musia obnoviť rovnaký deterministický koncept');
  assert.equal(visible[0].deletedAt, undefined);

  const idempotent = await reconcileAdminAutopilot({ actorEmail: 'system:test-autopilot', trigger: 'test' });
  assert.equal(idempotent.priceOffersCreated, 0);
  assert.equal((await db.listPriceOffers({ jobId: job.id })).length, 1);
  const manualRun = await reconcileAdminAutopilot({ actorEmail: process.env.ADMIN_EMAIL, trigger: 'manual' });
  const metricWindow = await db.listAdminAutopilotMetricWindow(
    new Date(Date.now() - 3_600_000).toISOString(),
    new Date(Date.now() + 60_000).toISOString(),
  );
  assert.equal(metricWindow.runs.some((run) => run.id === manualRun.runId), true,
    'PostgreSQL zdroj metrík musí načítať netestovací beh z časového okna');
  assert.equal(metricWindow.runs.some((run) => run.trigger === 'test'), false);
  assert.equal(metricWindow.truncated, false);
  console.log('PASS: PostgreSQL autopilot bezpečne obnoví archivovaný deterministický koncept a zostane idempotentný.');
} catch (error) {
  console.error(error);
  exitCode = 1;
} finally {
  try {
    await server?.stop();
    await database?.close();
  } catch (error) {
    console.error('Cleanup failed:', error);
    exitCode = 1;
  }
}
process.exit(exitCode);
