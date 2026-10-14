import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';

const temporaryDirectory = await mkdtemp(path.join(process.cwd(), '.tmp-operator-job-'));
process.env.NODE_ENV = 'test';
process.env.TZ = 'Europe/Bratislava';
process.env.DATABASE_URL = '';
process.env.ASTANA_LOCAL_DB_PATH = path.join(temporaryDirectory, 'local-db.json');
process.env.ADMIN_EMAIL = '';

const db = await import(`../src/server/db.ts?operator-job=${randomUUID()}`);
const superadmin = 'superadmin@example.invalid';

try {
  const created = await db.saveBusinessJob({
    demolitionDate: '2026-10-14', customerName: 'Bezpečný test', customerPhone: '0900000000', customerEmail: 'test@example.invalid',
    location: 'Poprad', district: 'Poprad', materialType: 'Vlnitý eternit', objectType: 'Rodinný dom', term: 'Dohodou',
    leadSource: 'qa', preferredContact: 'Email', m2: 100, pricePerM2: 12.5, paymentType: 'FAKTURA',
    workType: 'DEMONTAZ_A_ODVOZ', wasteKg: 500, landfill: 'INA', status: 'DOPYT', note: 'Pôvodná poznámka', workers: [],
    costs: { fuel: 55, suits: 20, gloves: 10, penetrant: 15, landfillCost: 30, otherName: 'Test', otherAmount: 5 },
  }, superadmin);

  const safeBefore = await db.getOperationalBusinessJobWithActivity(created.id);
  assert.ok(safeBefore);
  for (const forbidden of ['pricePerM2', 'totalPrice', 'paymentType', 'costs', 'rewardsTotal', 'grossProfit', 'marginPercent']) {
    assert.equal(forbidden in safeBefore, false, `${forbidden} nesmie byť v operátorskej projekcii`);
  }

  await db.updateBusinessJobOperational(created.id, {
    demolitionDate: '2026-10-15', customerName: 'Bezpečný test upravený', customerPhone: '0911111111',
    customerEmail: 'operator@example.invalid', location: 'Kežmarok', district: 'Kežmarok', materialType: 'Vlnitý eternit',
    objectType: 'Rodinný dom', term: '15. 10.', preferredContact: 'Email', status: 'DOPYT_PRIJATY', note: 'Operatívna poznámka',
  }, 'operator@example.invalid');

  const fullAfter = await db.getBusinessJob(created.id);
  assert.ok(fullAfter);
  assert.equal(fullAfter.pricePerM2, 12.5);
  assert.equal(fullAfter.totalPrice, 1250);
  assert.equal(fullAfter.paymentType, 'FAKTURA');
  assert.equal(fullAfter.costs.total, 135);
  assert.equal(fullAfter.customerName, 'Bezpečný test upravený');
  assert.equal(fullAfter.status, 'DOPYT_PRIJATY');

  const [safeAfter] = await db.listOperationalBusinessJobs({ q: 'Bezpečný test upravený' });
  assert.ok(safeAfter);
  assert.equal('totalPrice' in safeAfter, false);
  assert.equal('costs' in safeAfter, false);
  assert.ok((await db.getOperationalBusinessJobWithActivity(created.id)).activityLogs.every((log) => !log.action.includes('invoice') && !log.action.includes('payment')));
  assert.ok((await db.listOperationalWorkers(true)).every((worker) => !('ratePerM2' in worker)));
  console.log('PASS: operatívna úprava zachovala financie a operátorské projekcie neobsahujú finančné polia.');
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
