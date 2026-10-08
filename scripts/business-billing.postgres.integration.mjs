import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

let pglite;
let server;

async function availablePort() {
  const probe = createServer();
  await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
  const { port } = probe.address();
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function startDatabase() {
  const port = await availablePort();
  pglite = await PGlite.create();
  server = new PGLiteSocketServer({ db: pglite, port, host: '127.0.0.1', maxConnections: 8 });
  await server.start();
  process.env.NODE_ENV = 'test';
  process.env.TZ = 'Europe/Bratislava';
  process.env.DATABASE_URL = `postgres://astana_test:astana_test@127.0.0.1:${port}/astana_test`;
  process.env.ADMIN_EMAIL = '';
}

const actor = 'superadmin@example.invalid';
let db;

async function createJob(label) {
  return db.saveBusinessJob({
    demolitionDate: '2026-10-08', customerName: `QA ${label}`, customerPhone: '', customerEmail: '',
    location: 'Poprad', district: 'Poprad', materialType: 'Vlnitý eternit', objectType: 'Rodinný dom',
    term: 'Dohodou', leadSource: 'qa', preferredContact: 'Email', m2: 100, pricePerM2: 10,
    paymentType: 'FAKTURA', workType: 'DEMONTAZ_A_ODVOZ', wasteKg: 0, landfill: 'INA', status: 'DOPYT', note: '',
    workers: [], costs: { fuel: 0, suits: 0, gloves: 0, penetrant: 0, landfillCost: 0, otherName: '', otherAmount: 0 },
  }, actor);
}

function invoiceInput(operationId, invoiceNumber) {
  return { operationId, invoiceNumber, issuedOn: '2026-10-01', dueOn: '2026-10-15', amountWithoutVatCents: 10_000, vatRateBasisPoints: 2300, amountWithVatCents: 12_300 };
}

let exitCode = 0;
try {
  await startDatabase();
  await pglite.exec(`
    CREATE TABLE astana_schema_revisions (
      signature text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
    INSERT INTO astana_schema_revisions (signature) VALUES ('legacy-schema-before-business-finance');
  `);
  db = await import('../src/server/db.ts');

  const job = await createJob('Postgres finance');
  const operationId = randomUUID();
  const [first, retry] = await Promise.all([
    db.recordBusinessInvoice(job.id, invoiceInput(operationId, 'PG-2026-001'), actor),
    db.recordBusinessInvoice(job.id, invoiceInput(operationId, 'PG-2026-001'), actor),
  ]);
  assert.equal(first.id, retry.id);
  assert.equal((await pglite.query('SELECT count(*)::int AS count FROM business_job_invoices')).rows[0].count, 1);
  await assert.rejects(db.recordBusinessInvoice(job.id, invoiceInput(operationId, 'PG-CONFLICT'), actor), /inými údajmi/);

  const otherJob = await createJob('Postgres duplicate');
  await assert.rejects(db.recordBusinessInvoice(otherJob.id, invoiceInput(randomUUID(), 'PG-2026-001'), actor), /týmto číslom/);
  await assert.rejects(db.recordBusinessPayment(job.id, {
    operationId, occurredOn: '2026-10-05', amountCents: 100, method: 'CASH', reference: '',
  }, actor), /inú finančnú udalosť/);

  const paymentOperation = randomUUID();
  await assert.rejects(db.recordBusinessPayment(job.id, {
    operationId: randomUUID(), invoiceId: first.id, occurredOn: '2999-01-01',
    amountCents: 100, method: 'CASH', reference: '',
  }, actor), /budúcnosti/);
  await assert.rejects(db.cancelBusinessInvoice(job.id, first.id, {
    operationId: randomUUID(), cancelledOn: '2999-01-01', reasonCode: 'DATA_ERROR',
  }, actor), /budúcnosti/);
  const [payment, paymentRetry] = await Promise.all([
    db.recordBusinessPayment(job.id, { operationId: paymentOperation, invoiceId: first.id, occurredOn: '2026-10-05', amountCents: 5_000, method: 'BANK_TRANSFER', reference: 'TAJNÁ REFERENCIA' }, actor),
    db.recordBusinessPayment(job.id, { operationId: paymentOperation, invoiceId: first.id, occurredOn: '2026-10-05', amountCents: 5_000, method: 'BANK_TRANSFER', reference: 'TAJNÁ REFERENCIA' }, actor),
  ]);
  assert.equal(payment.id, paymentRetry.id);
  await assert.rejects(db.cancelBusinessInvoice(job.id, first.id, { operationId: randomUUID(), cancelledOn: '2026-10-06', reasonCode: 'DATA_ERROR' }, actor), /aktívnou úhradou/);

  const reversalOperation = randomUUID();
  const [reversal, reversalRetry] = await Promise.all([
    db.reverseBusinessPayment(job.id, payment.id, { operationId: reversalOperation, occurredOn: '2026-10-06', reasonCode: 'DATA_ERROR' }, actor),
    db.reverseBusinessPayment(job.id, payment.id, { operationId: reversalOperation, occurredOn: '2026-10-06', reasonCode: 'DATA_ERROR' }, actor),
  ]);
  assert.equal(reversal.id, reversalRetry.id);
  await assert.rejects(db.reverseBusinessPayment(job.id, payment.id, { operationId: randomUUID(), occurredOn: '2026-10-06', reasonCode: 'DATA_ERROR' }, actor), /už bola stornovaná/);
  await db.cancelBusinessInvoice(job.id, first.id, { operationId: randomUUID(), cancelledOn: '2026-10-07', reasonCode: 'DATA_ERROR' }, actor);

  const finance = await db.getBusinessJobFinance(job.id);
  assert.equal(finance.invoices.length, 1);
  assert.equal(finance.invoices[0].issuedOn, '2026-10-01');
  assert.equal(finance.invoices[0].amountWithVatCents, 12_300);
  assert.equal(finance.paymentEvents.length, 2);
  assert.equal(finance.activeInvoicedCents, 0);
  assert.equal(finance.netReceivedCents, 0);
  const reportable = await pglite.query(`SELECT invoice.issued_on, invoice.cancelled_on, job.is_test_data, lead.is_test_data AS lead_test
    FROM business_job_invoices invoice JOIN business_jobs job ON job.id = invoice.job_id
    LEFT JOIN leads lead ON lead.id = job.lead_id
    WHERE COALESCE(job.is_test_data, false) = false AND COALESCE(lead.is_test_data, false) = false`);
  assert.equal(reportable.rows.length, 1, JSON.stringify(reportable.rows));
  const evidence = await db.listBusinessFinanceEvidence();
  assert.equal(evidence.invoices.length, 1, JSON.stringify(evidence));
  assert.equal(evidence.invoices[0].issuedOn, '2026-10-01');
  const summary = await db.getBusinessFinanceSummary('2026-10-01', '2026-10-31');
  assert.equal(summary.invoicedInPeriodCents, 12_300);
  assert.equal(summary.cancelledInPeriodCents, 12_300);
  assert.equal(summary.netReceivedInPeriodCents, 0);
  assert.deepEqual((await db.listBusinessFinanceMonthlySummary(2026))[9], {
    month: 10, invoicedCents: 12_300, cancelledCents: 12_300,
    receivedCents: 5_000, reversedCents: 5_000, netReceivedCents: 0,
  });
  await assert.rejects(db.destroyBusinessJob(job.id, actor), /nemožno natrvalo vymazať/);

  const foreignInvoice = await db.recordBusinessInvoice(otherJob.id, invoiceInput(randomUUID(), 'PG-2026-FOREIGN'), actor);
  await assert.rejects(db.cancelBusinessInvoice(otherJob.id, foreignInvoice.id, {
    operationId: randomUUID(), cancelledOn: '2026-09-30', reasonCode: 'DATA_ERROR',
  }, actor), /pred dátumom vystavenia/);
  await assert.rejects(db.recordBusinessPayment(job.id, {
    operationId: randomUUID(), invoiceId: foreignInvoice.id, occurredOn: '2026-10-05',
    amountCents: 100, method: 'CASH', reference: '',
  }, actor), /nepatrí k tejto zákazke/);

  const raceJob = await createJob('Postgres cancel payment race');
  const raceInvoice = await db.recordBusinessInvoice(raceJob.id, invoiceInput(randomUUID(), 'PG-2026-RACE'), actor);
  const raceResults = await Promise.allSettled([
    db.cancelBusinessInvoice(raceJob.id, raceInvoice.id, {
      operationId: randomUUID(), cancelledOn: '2026-10-06', reasonCode: 'DATA_ERROR',
    }, actor),
    db.recordBusinessPayment(raceJob.id, {
      operationId: randomUUID(), invoiceId: raceInvoice.id, occurredOn: '2026-10-06',
      amountCents: 12_300, method: 'BANK_TRANSFER', reference: '',
    }, actor),
  ]);
  assert.equal(raceResults.filter((result) => result.status === 'fulfilled').length, 1, 'storno a prijatie úhrady sa nesmú uložiť súčasne');
  assert.equal(raceResults.filter((result) => result.status === 'rejected').length, 1, 'jedna zo súperiacich operácií musí byť bezpečne odmietnutá');

  const retryJob = await createJob('Postgres archived retry');
  const retryInvoiceOperation = randomUUID();
  const retryInvoiceInput = invoiceInput(retryInvoiceOperation, 'PG-2026-ARCHIVED-RETRY');
  const retryInvoice = await db.recordBusinessInvoice(retryJob.id, retryInvoiceInput, actor);
  const retryPaymentOperation = randomUUID();
  const retryPaymentInput = {
    operationId: retryPaymentOperation, invoiceId: retryInvoice.id, occurredOn: '2026-10-08',
    amountCents: 12_300, method: 'BANK_TRANSFER', reference: 'PG-ARCHIVED-RETRY',
  };
  const retryPayment = await db.recordBusinessPayment(retryJob.id, retryPaymentInput, actor);
  await db.deleteBusinessJob(retryJob.id, actor);
  assert.equal((await db.recordBusinessInvoice(retryJob.id, retryInvoiceInput, actor)).id, retryInvoice.id, 'retry faktúry musí fungovať aj po archivácii');
  assert.equal((await db.recordBusinessPayment(retryJob.id, retryPaymentInput, actor)).id, retryPayment.id, 'retry úhrady musí fungovať aj po archivácii');
  await assert.rejects(db.cancelBusinessInvoice(retryJob.id, retryInvoice.id, {
    operationId: retryPaymentOperation, cancelledOn: '2026-10-08', reasonCode: 'DATA_ERROR',
  }, actor), /inú finančnú udalosť/);

  const rollbackJob = await createJob('Postgres rollback');
  await pglite.query("ALTER TABLE audit_logs ADD CONSTRAINT qa_forbid_finance_audit CHECK (action <> 'business_invoice_recorded') NOT VALID");
  await assert.rejects(db.recordBusinessInvoice(rollbackJob.id, invoiceInput(randomUUID(), 'PG-ROLLBACK'), actor), /qa_forbid_finance_audit|check constraint/i);
  assert.equal((await pglite.query("SELECT count(*)::int AS count FROM business_job_invoices WHERE invoice_number = 'PG-ROLLBACK'")).rows[0].count, 0);
  await pglite.query('ALTER TABLE audit_logs DROP CONSTRAINT qa_forbid_finance_audit');

  const audits = await pglite.query("SELECT changes FROM audit_logs WHERE action LIKE 'business_invoice_%' OR action LIKE 'business_payment_%'");
  const auditJson = JSON.stringify(audits.rows);
  assert.doesNotMatch(auditJson, /TAJNÁ REFERENCIA|QA Postgres/i);
  assert.equal((await pglite.query("SELECT count(*)::int AS count FROM astana_schema_revisions WHERE signature = 'legacy-schema-before-business-finance'")).rows[0].count, 1);
  assert.ok((await pglite.query("SELECT to_regclass('business_job_invoices') AS relation")).rows[0].relation, 'nová finančná schéma musí vzniknúť nad staršou revíziou');
  console.log('PASS: PostgreSQL evidencia faktúr a úhrad má súbežnú idempotenciu, rollback, migráciu a lokálnu paritu.');
} catch (error) {
  console.error(error);
  exitCode = 1;
} finally {
  try { await server?.stop(); await pglite?.close(); } catch (error) { console.error('Cleanup failed:', error); exitCode = 1; }
}
process.exit(exitCode);
