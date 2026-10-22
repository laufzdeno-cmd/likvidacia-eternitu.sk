import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { Pool } from 'pg';
import { parseImportCsv, importColumns } from '../app/admin/(protected)/import/csv-import.ts';

async function availablePort() {
  const probe = createServer();
  await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
  const { port } = probe.address();
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  return port;
}

const row = (name, sourceId = name.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^A-Za-z0-9._/-]/g, '-')) =>
  `${sourceId},2025-03-15,${name},Košice,210,12,CASH,DEMONTAZ,0,INA,Robo,45,0,12,0,0`;
const parse = (...names) => {
  const preview = parseImportCsv(`${importColumns.join(',')}\n${names.map((name) => row(name)).join('\n')}`, ['Robo'], '2026-10-22');
  assert.deepEqual(preview.errors, []);
  assert.deepEqual(preview.rows.flatMap((item) => item.errors), []);
  return preview.rows.map((item) => item.job);
};

let database;
let socket;
let exitCode = 0;
try {
  const port = await availablePort();
  database = await PGlite.create();
  socket = new PGLiteSocketServer({ db: database, port, host: '127.0.0.1', maxConnections: 8 });
  await socket.start();
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = `postgres://astana_test:astana_test@127.0.0.1:${port}/astana_test`;
  await database.exec(`
    CREATE TABLE workers (
      id uuid PRIMARY KEY, name text NOT NULL, rate_per_m2 numeric(12,2) NOT NULL,
      active boolean NOT NULL DEFAULT true
    );
    CREATE TABLE business_jobs (
      id uuid PRIMARY KEY, demolition_date date NOT NULL, customer_name text NOT NULL,
      location text NOT NULL, m2 numeric(12,2) NOT NULL, price_per_m2 numeric(12,2) NOT NULL,
      total_price numeric(12,2) NOT NULL, payment_type text NOT NULL, work_type text NOT NULL,
      waste_kg numeric(12,2) NOT NULL, landfill text NOT NULL, status text NOT NULL
    );
    CREATE TABLE business_job_costs (
      job_id uuid PRIMARY KEY REFERENCES business_jobs(id), fuel numeric(12,2), suits numeric(12,2),
      gloves numeric(12,2), penetrant numeric(12,2), landfill_cost numeric(12,2),
      other_name text, other_amount numeric(12,2), total numeric(12,2)
    );
    CREATE TABLE business_job_workers (
      id uuid PRIMARY KEY, job_id uuid REFERENCES business_jobs(id), worker_id uuid NOT NULL,
      worker_name text, m2_share numeric(12,2), rate numeric(12,2), reward numeric(12,2), manually_edited boolean
    );
    CREATE TABLE audit_logs (
      id uuid PRIMARY KEY, entity_type text, entity_id uuid, action text,
      actor_email text, changes jsonb, created_at timestamptz
    );
  `);
  const { importJobsAtomically } = await import('../app/admin/(protected)/import/import-storage.ts');
  const workers = [{ id: randomUUID(), name: 'Robo', ratePerM2: 2, active: true }];
  await database.query('INSERT INTO workers (id, name, rate_per_m2) VALUES ($1,$2,$3)', [workers[0].id, workers[0].name, workers[0].ratePerM2]);
  const actor = 'admin@example.invalid';
  const count = async () => (await database.query('SELECT count(*)::int AS count FROM business_jobs')).rows[0].count;
  const importWriteCounts = async () => (await database.query(`
    SELECT (SELECT count(*)::int FROM business_jobs) AS jobs,
           (SELECT count(*)::int FROM business_job_costs) AS costs,
           (SELECT count(*)::int FROM business_job_workers) AS payouts,
           (SELECT count(*)::int FROM audit_logs) AS audits
  `)).rows[0];
  const zeroWrites = { jobs: 0, costs: 0, payouts: 0, audits: 0 };

  const ambiguousJobs = parse('Bez pracovníka', 'Nejednoznačný');
  ambiguousJobs[0] = { ...ambiguousJobs[0], workerNames: [] };
  const duplicate = { ...workers[0], id: randomUUID(), name: 'Róbo' };
  await assert.rejects(importJobsAtomically(ambiguousJobs, [...workers, duplicate], [], actor), /nie je jednoznačný/);
  assert.deepEqual(await importWriteCounts(), zeroWrites, 'nejednoznačný vstupný zoznam nesmie zapísať ani prvú zákazku');

  await database.query('INSERT INTO workers (id, name, rate_per_m2) VALUES ($1,$2,$3)', [duplicate.id, duplicate.name, duplicate.ratePerM2]);
  await assert.rejects(importJobsAtomically(ambiguousJobs, workers, [], actor), /nie je jednoznačný/);
  assert.deepEqual(await importWriteCounts(), zeroWrites, 'nová kolízia v databáze nesmie zapísať žiadnu tabuľku importu');
  await database.query('DELETE FROM workers WHERE id = $1', [duplicate.id]);

  const writerPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const writer = await writerPool.connect();
  let racingImport;
  try {
    await writer.query('BEGIN');
    await writer.query('INSERT INTO workers (id, name, rate_per_m2) VALUES ($1,$2,$3)', [duplicate.id, duplicate.name, duplicate.ratePerM2]);
    racingImport = importJobsAtomically(ambiguousJobs, workers, [], actor);
    const status = await Promise.race([
      racingImport.then(() => 'settled', () => 'settled'),
      new Promise((resolve) => setTimeout(() => resolve('waiting'), 100)),
    ]);
    assert.equal(status, 'waiting', 'import musí počkať na súbežnú zmenu pracovníkov');
    await writer.query('COMMIT');
    await assert.rejects(racingImport, /nie je jednoznačný/);
    assert.deepEqual(await importWriteCounts(), zeroWrites, 'po súbežnom zápise pracovníka nesmie import nič zapísať');
  } finally {
    await writer.query('ROLLBACK').catch(() => undefined);
    writer.release();
    await writerPool.end();
    await racingImport?.catch(() => undefined);
  }
  await database.query('DELETE FROM workers WHERE id = $1', [duplicate.id]);

  await database.query('UPDATE workers SET name = $1 WHERE id = $2', ['Iný pracovník', workers[0].id]);
  await database.query('INSERT INTO workers (id, name, rate_per_m2) VALUES ($1,$2,$3)', [duplicate.id, 'Robo', duplicate.ratePerM2]);
  await assert.rejects(importJobsAtomically(ambiguousJobs, workers, [], actor), /Zoznam pracovníkov sa počas importu zmenil/);
  assert.deepEqual(await importWriteCounts(), zeroWrites, 'meno presunuté na iné ID nesmie priradiť odmenu ani zapísať zákazku');
  await database.query('DELETE FROM workers WHERE id = $1', [duplicate.id]);
  await database.query('UPDATE workers SET name = $1 WHERE id = $2', ['Robo', workers[0].id]);

  await database.exec("ALTER TABLE business_jobs ADD CONSTRAINT qa_fail_late_row CHECK (customer_name <> 'Zlyha')");
  await assert.rejects(importJobsAtomically(parse('Prvý', 'Zlyha'), workers, [], actor), /qa_fail_late_row|check constraint/i);
  assert.equal(await count(), 0, 'neskorá chyba musí vrátiť aj prvý riadok');
  assert.equal((await database.query('SELECT count(*)::int AS count FROM audit_logs')).rows[0].count, 0);
  await database.exec('ALTER TABLE business_jobs DROP CONSTRAINT qa_fail_late_row');

  const first = await importJobsAtomically(parse('Prvý', 'Druhý'), workers, [], actor);
  assert.deepEqual(first, { imported: 2, alreadyImported: 0 });
  assert.equal(await count(), 2);
  assert.equal((await database.query('SELECT count(*)::int AS count FROM business_job_costs')).rows[0].count, 2);
  assert.equal((await database.query('SELECT count(*)::int AS count FROM business_job_workers')).rows[0].count, 2);
  const retry = await importJobsAtomically(parse('Prvý', 'Druhý'), workers, [], actor);
  assert.deepEqual(retry, { imported: 0, alreadyImported: 2 });
  assert.equal(await count(), 2);

  const concurrent = await Promise.all([
    importJobsAtomically(parse('Tretí'), workers, [], actor),
    importJobsAtomically(parse('Tretí'), workers, [], actor),
  ]);
  assert.deepEqual(concurrent.map((item) => item.imported).sort(), [0, 1]);
  assert.equal(await count(), 3);

  const legacyId = randomUUID();
  await database.query(
    `INSERT INTO business_jobs
      (id,demolition_date,customer_name,location,m2,price_per_m2,total_price,payment_type,work_type,waste_kg,landfill,status)
     VALUES ($1,'2025-03-15','Starý','Košice',210,12,2520,'CASH','DEMONTAZ',0,'INA','DOKONCENA')`,
    [legacyId],
  );
  await database.query(
    `INSERT INTO audit_logs (id,entity_type,entity_id,action,actor_email,changes,created_at)
     VALUES ($1,'business_job',$2,'business_job_created',$3,$4,now())`,
    [randomUUID(), legacyId, actor, { legacyCompletedImportReason: 'CSV_HISTORICAL_IMPORT' }],
  );
  await assert.rejects(importJobsAtomically(parse('Nový', 'Starý'), workers, [], actor), /staršieho importu/);
  assert.equal(await count(), 4, 'konflikt so starým importom musí zrušiť celý nový súbor');
  const audits = await database.query("SELECT changes FROM audit_logs WHERE action = 'business_job_created'");
  assert.equal(audits.rows.length, 4);
  assert.doesNotMatch(JSON.stringify(audits.rows), /Prvý|Druhý|Tretí/);
  const identicalPreview = parseImportCsv(
    `${importColumns.join(',')}\n${row('Rovnaká zákazka', 'ZDROJ-A')}\n${row('Rovnaká zákazka', 'ZDROJ-B')}`,
    ['Robo'], '2026-10-22',
  );
  assert.deepEqual(identicalPreview.rows.flatMap((item) => item.errors), []);
  const identicalJobs = identicalPreview.rows.map((item) => item.job);
  assert.deepEqual(await importJobsAtomically(identicalJobs, workers, [], actor), { imported: 2, alreadyImported: 0 },
    'dve skutočné zákazky s rovnakým obsahom majú rôzne stabilné ID');
  assert.equal(await count(), 6);
  await assert.rejects(
    importJobsAtomically([{ ...identicalJobs[0], pricePerM2: 13 }], workers, [], actor),
    /Identifikátor importu už patrí inej zákazke/,
    'opravený riadok s rovnakým ID sa nesmie zapísať ako druhá zákazka',
  );
  assert.equal(await count(), 6);

  for (const [asciiId, unicodeId] of [['SS-1', 'ß-1'], ['I-1', 'ı-1']]) {
    const csvFor = (sourceId) => `${importColumns.join(',')}\n${row('Kolízna zákazka', sourceId)}`;
    const firstUpload = parseImportCsv(csvFor(asciiId), ['Robo'], '2026-10-22');
    assert.deepEqual(firstUpload.rows.flatMap((item) => item.errors), []);
    assert.deepEqual(await importJobsAtomically(firstUpload.rows.map((item) => item.job), workers, [], actor),
      { imported: 1, alreadyImported: 0 });
    const beforeSecondUpload = await importWriteCounts();

    const secondUpload = parseImportCsv(csvFor(unicodeId), ['Robo'], '2026-10-22');
    assert.match(secondUpload.rows[0].errors.join(' '), /ID zákazky/);
    assert.equal(secondUpload.rows[0].job, undefined, 'neplatné ID nesmie prejsť z náhľadu na databázový zápis');
    assert.deepEqual(await importWriteCounts(), beforeSecondUpload,
      'druhý upload nesmie pridať ani zmeniť zákazku, náklady, odmenu či audit');
  }
  console.log('PASS: CSV import je atomický a opakovaný či súbežný pokus nevytvorí duplicity.');
} catch (error) {
  console.error(error);
  exitCode = 1;
} finally {
  try { await socket?.stop(); await database?.close(); } catch (error) { console.error(error); exitCode = 1; }
}
process.exit(exitCode);
