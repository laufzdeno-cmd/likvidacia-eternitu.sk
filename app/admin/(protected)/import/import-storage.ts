import { createHash, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { assertDatabaseConfiguredForRuntime, databasePoolConfig, normalizeDatabaseUrl } from '@/src/server/database-config';
import { deploymentDatabaseAccessBlocked } from '@/src/server/preview-safety';
import type { LandfillPrice, Worker } from '@/src/server/types';
import { matchesImportWorkerName, type ImportJob } from './csv-import';

const maxMoney = 9_999_999_999.99;
const money = (value: number) => Math.round(value * 100) / 100;

function importIdentity(job: ImportJob) {
  const fingerprint = createHash('sha256').update('astana-csv-import-content-v2\0').update(JSON.stringify(job)).digest('hex');
  const identityHash = createHash('sha256').update('astana-csv-import-id-v2\0').update(job.sourceId).digest('hex');
  const variant = ((Number.parseInt(identityHash[16], 16) & 3) | 8).toString(16);
  const id = `${identityHash.slice(0, 8)}-${identityHash.slice(8, 12)}-5${identityHash.slice(13, 16)}-${variant}${identityHash.slice(17, 20)}-${identityHash.slice(20, 32)}`;
  return { id, fingerprint };
}

type ImportWorker = Pick<Worker, 'id' | 'name' | 'ratePerM2'>;

function prepareJob(job: ImportJob, workers: ImportWorker[], prices: LandfillPrice[]) {
  const selectedWorkers = job.workerNames.map((name) => {
    const matches = workers.filter((item) => matchesImportWorkerName(item.name, name));
    if (matches.length === 0) throw new Error(`Pracovník „${name}“ už nie je dostupný. Obnovte stránku.`);
    if (matches.length > 1) throw new Error(`Pracovník „${name}“ nie je jednoznačný. Import bol zrušený.`);
    return matches[0];
  });
  const price = prices.find((item) => item.year === Number(job.demolitionDate.slice(0, 4)) && item.landfill === job.landfill);
  const landfillCost = job.landfill === 'INA' || !job.wasteKg || !price ? 0 : money(job.wasteKg / 1000 * price.pricePerTon);
  const totalPrice = money(job.m2 * job.pricePerM2);
  const totalCosts = money(job.fuel + job.suits + job.gloves + job.penetrant + job.otherAmount + landfillCost);
  if (totalPrice > maxMoney || totalCosts > maxMoney) throw new Error('Cena alebo náklady presahujú povolený rozsah.');
  const share = selectedWorkers.length ? money(job.m2 / selectedWorkers.length) : 0;
  return { job, selectedWorkers, landfillCost, totalPrice, totalCosts, share, ...importIdentity(job) };
}

export async function importJobsAtomically(jobs: ImportJob[], workers: Worker[], prices: LandfillPrice[], actorEmail: string) {
  const databaseUrl = normalizeDatabaseUrl(process.env.DATABASE_URL);
  assertDatabaseConfiguredForRuntime(databaseUrl);
  if (deploymentDatabaseAccessBlocked()) throw new Error('Databázový prístup nie je v tomto prostredí povolený.');
  if (!databaseUrl) throw new Error('Hromadný import vyžaduje databázu PostgreSQL.');
  const previewed = jobs.map((job) => prepareJob(job, workers, prices));
  const pool = new Pool({ ...databasePoolConfig(databaseUrl, process.env.DATABASE_POOL_MAX), max: 1 });
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Worker changes take a ROW EXCLUSIVE lock; hold this SHARE lock through commit so
      // the name-to-ID mapping cannot change between validation and payout writes.
      await client.query('LOCK TABLE workers IN SHARE MODE');
      const current = await client.query('SELECT id, name, rate_per_m2 FROM workers');
      const currentWorkers: ImportWorker[] = current.rows.map((row) => ({
        id: String(row.id), name: String(row.name), ratePerM2: Number(row.rate_per_m2),
      }));
      // A stable lock order avoids deadlocks when two uploads share rows in a different order.
      const prepared = jobs.map((job, index) => {
        const item = prepareJob(job, currentWorkers, prices);
        if (item.selectedWorkers.some((worker, workerIndex) => worker.id !== previewed[index].selectedWorkers[workerIndex].id)) {
          throw new Error('Zoznam pracovníkov sa počas importu zmenil. Obnovte stránku a skontrolujte CSV.');
        }
        return item;
      }).sort((a, b) => a.id.localeCompare(b.id));
      let imported = 0;
      let alreadyImported = 0;
      for (const item of prepared) {
        const { job } = item;
        const inserted = await client.query(
          `INSERT INTO business_jobs
            (id, demolition_date, customer_name, location, m2, price_per_m2, total_price,
             payment_type, work_type, waste_kg, landfill, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'DOKONCENA')
           ON CONFLICT (id) DO NOTHING RETURNING id`,
          [item.id, job.demolitionDate, job.customerName, job.location, job.m2,
            job.pricePerM2, item.totalPrice, job.paymentType, job.workType, job.wasteKg, job.landfill],
        );
        if (!inserted.rowCount) {
          const existing = await client.query(
            `SELECT changes->>'csvImportFingerprint' AS fingerprint FROM audit_logs
              WHERE entity_type = 'business_job' AND entity_id = $1 AND action = 'business_job_created'
                AND changes->>'legacyCompletedImportReason' = 'CSV_HISTORICAL_IMPORT' LIMIT 1`,
            [item.id],
          );
          if (existing.rows[0]?.fingerprint !== item.fingerprint) {
            throw new Error('Identifikátor importu už patrí inej zákazke. Import bol zrušený.');
          }
          alreadyImported += 1;
          continue;
        }
        const legacyMatch = await client.query(
          `SELECT 1 FROM business_jobs AS historical
             JOIN audit_logs AS audit ON audit.entity_type = 'business_job' AND audit.entity_id = historical.id
            WHERE historical.id <> $1 AND historical.demolition_date = $2 AND historical.customer_name = $3
              AND historical.location = $4 AND historical.m2 = $5 AND historical.price_per_m2 = $6
              AND historical.payment_type = $7 AND historical.work_type = $8
              AND historical.waste_kg = $9 AND historical.landfill = $10
              AND audit.action = 'business_job_created'
              AND audit.changes->>'legacyCompletedImportReason' = 'CSV_HISTORICAL_IMPORT'
              AND audit.changes->>'csvImportFingerprint' IS NULL LIMIT 1`,
          [item.id, job.demolitionDate, job.customerName, job.location, job.m2,
            job.pricePerM2, job.paymentType, job.workType, job.wasteKg, job.landfill],
        );
        if (legacyMatch.rowCount) {
          throw new Error('Rovnaká historická zákazka už môže existovať zo staršieho importu. Skontrolujte ju ručne.');
        }
        await client.query(
          `INSERT INTO business_job_costs
            (job_id, fuel, suits, gloves, penetrant, landfill_cost, other_name, other_amount, total)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [item.id, job.fuel, job.suits, job.gloves, job.penetrant, item.landfillCost,
            job.otherAmount ? 'Iné náklady' : '', job.otherAmount, item.totalCosts],
        );
        for (const worker of item.selectedWorkers) {
          await client.query(
            `INSERT INTO business_job_workers
              (id, job_id, worker_id, worker_name, m2_share, rate, reward, manually_edited)
             VALUES ($1,$2,$3,$4,$5,$6,$7,false)`,
            [randomUUID(), item.id, worker.id, worker.name, item.share, money(worker.ratePerM2), money(item.share * worker.ratePerM2)],
          );
        }
        await client.query(
          `INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at)
           VALUES ($1,'business_job',$2,'business_job_created',$3,$4,now())`,
          [randomUUID(), item.id, actorEmail, {
            status: 'DOKONCENA', legacyCompletedImportReason: 'CSV_HISTORICAL_IMPORT',
            csvImportFingerprint: item.fingerprint,
          }],
        );
        imported += 1;
      }
      await client.query('COMMIT');
      return { imported, alreadyImported };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}
