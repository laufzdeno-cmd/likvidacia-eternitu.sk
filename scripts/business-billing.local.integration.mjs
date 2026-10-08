import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'astana-business-billing-local-'));
const databasePath = path.join(temporaryDirectory, 'local-db.json');
process.env.NODE_ENV = 'test';
process.env.TZ = 'Europe/Bratislava';
process.env.DATABASE_URL = '';
process.env.ASTANA_LOCAL_DB_PATH = databasePath;
process.env.ADMIN_EMAIL = '';

const {
  cancelBusinessInvoice,
  deleteBusinessJob,
  destroyBusinessJob,
  getBusinessFinanceSummary,
  getBusinessJobFinance,
  listBusinessFinanceMonthlySummary,
  recordBusinessInvoice,
  recordBusinessPayment,
  reverseBusinessPayment,
  saveBusinessJob,
} = await import(`../src/server/db.ts?business-billing-local=${randomUUID()}`);

const actor = 'superadmin@example.invalid';

async function createJob(label) {
  return saveBusinessJob({
    demolitionDate: '2026-10-08', customerName: `QA ${label}`, customerPhone: '', customerEmail: '',
    location: 'Poprad', district: 'Poprad', materialType: 'Vlnitý eternit', objectType: 'Rodinný dom',
    term: 'Dohodou', leadSource: 'qa', preferredContact: 'Email', m2: 100, pricePerM2: 10,
    paymentType: 'FAKTURA', workType: 'DEMONTAZ_A_ODVOZ', wasteKg: 0, landfill: 'INA', status: 'DOPYT', note: '',
    workers: [], costs: { fuel: 0, suits: 0, gloves: 0, penetrant: 0, landfillCost: 0, otherName: '', otherAmount: 0 },
  }, actor);
}

function invoiceInput(operationId, invoiceNumber = '2026-TEST-001') {
  return {
    operationId, invoiceNumber, issuedOn: '2026-10-01', dueOn: '2026-10-15',
    amountWithoutVatCents: 10_000, vatRateBasisPoints: 2300, amountWithVatCents: 12_300,
  };
}

try {
  const job = await createJob('Finance');
  const operationId = randomUUID();
  const [first, retry] = await Promise.all([
    recordBusinessInvoice(job.id, invoiceInput(operationId), actor),
    recordBusinessInvoice(job.id, invoiceInput(operationId), actor),
  ]);
  assert.equal(first.id, retry.id, 'súbežný retry musí vrátiť tú istú faktúru');
  await assert.rejects(
    recordBusinessInvoice(job.id, invoiceInput(operationId, '2026-TEST-CONFLICT'), actor),
    /inými údajmi/,
  );

  const secondJob = await createJob('Duplicate');
  await assert.rejects(
    recordBusinessInvoice(secondJob.id, invoiceInput(randomUUID()), actor),
    /týmto číslom/,
  );
  await assert.rejects(
    recordBusinessPayment(job.id, {
      operationId, occurredOn: '2026-10-05', amountCents: 100, method: 'CASH', reference: '',
    }, actor),
    /inú finančnú udalosť/,
  );

  const paymentOperation = randomUUID();
  await assert.rejects(recordBusinessPayment(job.id, {
    operationId: randomUUID(), invoiceId: first.id, occurredOn: '2999-01-01',
    amountCents: 100, method: 'CASH', reference: '',
  }, actor), /budúcnosti/);
  await assert.rejects(cancelBusinessInvoice(job.id, first.id, {
    operationId: randomUUID(), cancelledOn: '2999-01-01', reasonCode: 'DATA_ERROR',
  }, actor), /budúcnosti/);
  const payment = await recordBusinessPayment(job.id, {
    operationId: paymentOperation, invoiceId: first.id, occurredOn: '2026-10-05',
    amountCents: 5_000, method: 'BANK_TRANSFER', reference: 'NEUKLADAŤ DO AUDITU',
  }, actor);
  assert.equal((await recordBusinessPayment(job.id, {
    operationId: paymentOperation, invoiceId: first.id, occurredOn: '2026-10-05',
    amountCents: 5_000, method: 'BANK_TRANSFER', reference: 'NEUKLADAŤ DO AUDITU',
  }, actor)).id, payment.id);

  let finance = await getBusinessJobFinance(job.id);
  assert.equal(finance.activeInvoicedCents, 12_300);
  assert.equal(finance.netReceivedCents, 5_000);
  assert.equal(finance.outstandingCents, 7_300);
  await assert.rejects(
    cancelBusinessInvoice(job.id, first.id, { operationId: randomUUID(), cancelledOn: '2026-10-06', reasonCode: 'DATA_ERROR' }, actor),
    /aktívnou úhradou/,
  );

  const reversalOperation = randomUUID();
  const reversal = await reverseBusinessPayment(job.id, payment.id, {
    operationId: reversalOperation, occurredOn: '2026-10-06', reasonCode: 'DATA_ERROR',
  }, actor);
  assert.equal(reversal.eventType, 'REVERSAL');
  assert.equal((await reverseBusinessPayment(job.id, payment.id, {
    operationId: reversalOperation, occurredOn: '2026-10-06', reasonCode: 'DATA_ERROR',
  }, actor)).id, reversal.id);
  await assert.rejects(
    reverseBusinessPayment(job.id, payment.id, { operationId: randomUUID(), occurredOn: '2026-10-06', reasonCode: 'DATA_ERROR' }, actor),
    /už bola stornovaná/,
  );

  const cancelled = await cancelBusinessInvoice(job.id, first.id, {
    operationId: randomUUID(), cancelledOn: '2026-10-07', reasonCode: 'DATA_ERROR',
  }, actor);
  assert.ok(cancelled.cancelledAt);
  finance = await getBusinessJobFinance(job.id);
  assert.equal(finance.activeInvoicedCents, 0);
  assert.equal(finance.netReceivedCents, 0);
  const summary = await getBusinessFinanceSummary('2026-10-01', '2026-10-31');
  assert.equal(summary.invoicedInPeriodCents, 12_300);
  assert.equal(summary.cancelledInPeriodCents, 12_300);
  assert.equal(summary.receivedInPeriodCents, 5_000);
  assert.equal(summary.reversedInPeriodCents, 5_000);
  assert.equal(summary.netReceivedInPeriodCents, 0);
  const october = (await listBusinessFinanceMonthlySummary(2026))[9];
  assert.deepEqual(october, { month: 10, invoicedCents: 12_300, cancelledCents: 12_300, receivedCents: 5_000, reversedCents: 5_000, netReceivedCents: 0 });

  const foreignInvoice = await recordBusinessInvoice(
    secondJob.id,
    invoiceInput(randomUUID(), '2026-TEST-FOREIGN'),
    actor,
  );
  await assert.rejects(
    cancelBusinessInvoice(secondJob.id, foreignInvoice.id, {
      operationId: randomUUID(), cancelledOn: '2026-09-30', reasonCode: 'DATA_ERROR',
    }, actor),
    /pred dátumom vystavenia/,
  );
  await assert.rejects(
    recordBusinessPayment(job.id, {
      operationId: randomUUID(), invoiceId: foreignInvoice.id, occurredOn: '2026-10-05',
      amountCents: 100, method: 'CASH', reference: '',
    }, actor),
    /nepatrí k tejto zákazke/,
  );

  const raceJob = await createJob('Cancel payment race');
  const raceInvoice = await recordBusinessInvoice(raceJob.id, invoiceInput(randomUUID(), '2026-TEST-RACE'), actor);
  const raceResults = await Promise.allSettled([
    cancelBusinessInvoice(raceJob.id, raceInvoice.id, {
      operationId: randomUUID(), cancelledOn: '2026-10-06', reasonCode: 'DATA_ERROR',
    }, actor),
    recordBusinessPayment(raceJob.id, {
      operationId: randomUUID(), invoiceId: raceInvoice.id, occurredOn: '2026-10-06',
      amountCents: 12_300, method: 'BANK_TRANSFER', reference: '',
    }, actor),
  ]);
  assert.equal(raceResults.filter((result) => result.status === 'fulfilled').length, 1, 'storno a prijatie úhrady sa nesmú uložiť súčasne');
  assert.equal(raceResults.filter((result) => result.status === 'rejected').length, 1, 'jedna zo súperiacich operácií musí byť bezpečne odmietnutá');

  const retryJob = await createJob('Archived retry');
  const retryInvoiceOperation = randomUUID();
  const retryInvoiceInput = invoiceInput(retryInvoiceOperation, '2026-TEST-ARCHIVED-RETRY');
  const retryInvoice = await recordBusinessInvoice(retryJob.id, retryInvoiceInput, actor);
  const retryPaymentOperation = randomUUID();
  const retryPaymentInput = {
    operationId: retryPaymentOperation, invoiceId: retryInvoice.id, occurredOn: '2026-10-08',
    amountCents: 12_300, method: 'BANK_TRANSFER', reference: 'ARCHIVED-RETRY',
  };
  const retryPayment = await recordBusinessPayment(retryJob.id, retryPaymentInput, actor);
  await deleteBusinessJob(retryJob.id, actor);
  assert.equal((await recordBusinessInvoice(retryJob.id, retryInvoiceInput, actor)).id, retryInvoice.id, 'retry faktúry musí fungovať aj po archivácii');
  assert.equal((await recordBusinessPayment(retryJob.id, retryPaymentInput, actor)).id, retryPayment.id, 'retry úhrady musí fungovať aj po archivácii');
  await assert.rejects(
    cancelBusinessInvoice(retryJob.id, retryInvoice.id, {
      operationId: retryPaymentOperation, cancelledOn: '2026-10-08', reasonCode: 'DATA_ERROR',
    }, actor),
    /inú finančnú udalosť/,
  );

  await assert.rejects(destroyBusinessJob(job.id, actor), /nemožno natrvalo vymazať/);
  await deleteBusinessJob(job.id, actor);
  await assert.rejects(
    recordBusinessInvoice(job.id, invoiceInput(randomUUID(), '2026-TEST-ARCHIVE'), actor),
    /archivovanej zákazke/,
  );
  await assert.rejects(
    recordBusinessPayment(job.id, { operationId: randomUUID(), occurredOn: '2026-10-08', amountCents: 100, method: 'CASH' }, actor),
    /archivovanej zákazke/,
  );

  const persisted = JSON.parse(await readFile(databasePath, 'utf8'));
  assert.equal(persisted.businessJobInvoices.length, 4);
  assert.ok(persisted.businessJobPaymentEvents.length >= 3);
  const financeAudit = persisted.auditLogs.filter((entry) => entry.action.startsWith('business_invoice_') || entry.action.startsWith('business_payment_'));
  assert.equal(financeAudit.length, 9);
  assert.doesNotMatch(JSON.stringify(financeAudit), /NEUKLADAŤ DO AUDITU|QA Finance/i, 'audit nesmie obsahovať referenciu ani PII');
  console.log('PASS: lokálna evidencia faktúr a úhrad je idempotentná, auditovaná a chráni finančnú históriu.');
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
