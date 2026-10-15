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

const jobInput = {
  demolitionDate: '2026-10-14', customerName: 'Postgres Completion', customerPhone: '0900000000',
  customerEmail: 'completion@example.invalid', location: 'Poprad', district: 'Poprad', materialType: 'Vlnitý eternit',
  objectType: 'Rodinný dom', term: '', preferredContact: 'email', m2: 100, pricePerM2: 10,
  paymentType: 'FAKTURA', workType: 'DEMONTAZ_A_ODVOZ', wasteKg: 1000, landfill: 'INA',
  status: 'DEMONT_DOKONCENA', note: '', workers: [],
  costs: { fuel: 0, suits: 0, gloves: 0, penetrant: 0, landfillCost: 0, otherName: '', otherAmount: 0 },
};

let exitCode = 0;
try {
  await startDatabase();
  const db = await import('../src/server/db.ts');
  const job = await db.saveBusinessJob(jobInput, 'superadmin@example.invalid');
  const initial = await db.getBusinessJobCompletion(job.id);
  const operator = await db.saveBusinessJobCompletion({
    jobId: job.id, expectedRevision: initial.revision, actorEmail: 'operator@example.invalid', actorRole: 'OPERATOR',
    values: { documentsDecision: 'confirmed', documentsReason: '', costsDecision: 'confirmed_recorded', costsReason: 'forged',
      photosDecision: 'not_available', photosReason: 'Zákazník fotografie neposkytol', reviewDecision: 'prepare', reviewBlockReason: '' },
  });
  assert.equal(operator.costsDecision, 'pending');
  assert.equal(operator.costsReason, '');
  const operatorView = await db.getOperationalBusinessJobCompletion(job.id);
  assert.equal(Object.hasOwn(operatorView, 'costsDecision'), false);
  assert.equal(Object.hasOwn(operatorView, 'costsReason'), false);
  await assert.rejects(db.saveBusinessJobCompletion({
    jobId: job.id, expectedRevision: operator.revision, actorEmail: 'superadmin@example.invalid', actorRole: 'SUPER_ADMIN',
    values: { documentsDecision: 'not_applicable', documentsReason: '', costsDecision: 'confirmed_recorded', costsReason: '',
      photosDecision: 'not_available', photosReason: 'Zákazník fotografie neposkytol', reviewDecision: 'prepare', reviewBlockReason: '' },
  }));

  const raceValues = { documentsDecision: 'confirmed', documentsReason: '', costsDecision: 'confirmed_zero',
    costsReason: 'Bez externých nákladov', photosDecision: 'not_available', photosReason: 'Zákazník fotografie neposkytol', reviewDecision: 'prepare', reviewBlockReason: '' };
  const race = await Promise.allSettled([
    db.saveBusinessJobCompletion({ jobId: job.id, expectedRevision: operator.revision, actorEmail: 'superadmin@example.invalid', actorRole: 'SUPER_ADMIN', values: raceValues }),
    db.saveBusinessJobCompletion({ jobId: job.id, expectedRevision: operator.revision, actorEmail: 'superadmin@example.invalid', actorRole: 'SUPER_ADMIN', values: raceValues }),
  ]);
  assert.equal(race.filter((item) => item.status === 'fulfilled').length, 1);
  assert.equal(race.filter((item) => item.status === 'rejected').length, 1);
  const saved = await db.getBusinessJobCompletion(job.id);
  const finalized = await db.finalizeBusinessJobCompletion({
    jobId: job.id, expectedRevision: saved.revision, actorEmail: 'superadmin@example.invalid', actorRole: 'SUPER_ADMIN',
    reviewRequestTemplate: { subject: 'Ako ste boli spokojní?', message: 'Dobrý deň {{meno}}, prosíme o spätnú väzbu {{odkaz}}.',
      googleReviewLink: 'https://example.invalid/review', reminderAllowed: false },
  });
  assert.equal(finalized.job.status, 'DOKONCENA');
  const repeated = await db.finalizeBusinessJobCompletion({
    jobId: job.id, expectedRevision: saved.revision, actorEmail: 'superadmin@example.invalid', actorRole: 'SUPER_ADMIN',
    reviewRequestTemplate: { subject: 'Ako ste boli spokojní?', message: 'Dobrý deň {{meno}}, prosíme o spätnú väzbu {{odkaz}}.',
      googleReviewLink: '', reminderAllowed: false },
  });
  assert.equal(repeated.completion.revision, finalized.completion.revision);
  const requests = await pglite.query('SELECT status,reminder_allowed,token_hash,sent_at FROM review_requests WHERE job_id=$1', [job.id]);
  assert.equal(requests.rows.length, 1);
  assert.deepEqual(requests.rows[0], { status: 'pending_approval', reminder_allowed: false, token_hash: null, sent_at: null });
  assert.equal((await pglite.query('SELECT count(*)::int AS count FROM lead_email_outbox')).rows[0].count, 0);
  assert.equal((await pglite.query("SELECT count(*)::int AS count FROM audit_logs WHERE action='business_job_completion_finalized'" )).rows[0].count, 1);
  assert.equal((await pglite.query("SELECT count(*)::int AS count FROM audit_logs WHERE action='review_request_prepared'" )).rows[0].count, 1);
  const auditText = JSON.stringify((await pglite.query("SELECT changes FROM audit_logs WHERE action IN ('business_job_completion_finalized','review_request_prepared')")).rows);
  assert.doesNotMatch(auditText, /completion@example\.invalid|Postgres Completion/);

  const photoJob = await db.saveBusinessJob({ ...jobInput, customerName:'Photo race', customerEmail:'photo-race@example.invalid' }, 'superadmin@example.invalid');
  const inviteId = randomUUID();
  const mediaId = randomUUID();
  await pglite.query(
    `INSERT INTO photo_upload_invites (id,token_hash,created_by,worker_label,expires_at,business_job_id)
     VALUES ($1,$2,'qa','qa',now()+interval '1 day',$3)`,
    [inviteId, 'a'.repeat(64), photoJob.id],
  );
  await pglite.query(
    `INSERT INTO realization_media_intake (id,invite_id,storage_key,original_name,mime_type,size_bytes,content_hash,
       sanitized_at,locality,categories,metadata_version,status)
     VALUES ($1,$2,$3,'strecha.jpg','image/jpeg',1200,$4,now(),'Poprad','["family_house"]'::jsonb,1,'approved_private')`,
    [mediaId, inviteId, `qa/${mediaId}.jpg`, 'b'.repeat(64)],
  );
  const photoCompletion = await db.saveBusinessJobCompletion({
    jobId: photoJob.id, expectedRevision: 0, actorEmail: 'superadmin@example.invalid', actorRole: 'SUPER_ADMIN',
    values: { documentsDecision:'confirmed',documentsReason:'',costsDecision:'confirmed_zero',costsReason:'Bez externých nákladov',
      photosDecision:'ready_private',photosReason:'',reviewDecision:'blocked',reviewBlockReason:'Zákazník si neželá oslovenie' },
  });
  const photoRace = await Promise.allSettled([
    db.finalizeBusinessJobCompletion({ jobId:photoJob.id,expectedRevision:photoCompletion.revision,
      actorEmail:'superadmin@example.invalid',actorRole:'SUPER_ADMIN' }),
    db.withdrawApprovedPhotoIntakeRecord({ id:mediaId,withdrawnBy:'superadmin@example.invalid',expectedMetadataVersion:1 }),
  ]);
  assert.equal(photoRace.filter((item) => item.status === 'fulfilled').length, 1, JSON.stringify(photoRace));
  assert.equal(photoRace.filter((item) => item.status === 'rejected').length, 1, JSON.stringify(photoRace));
  const photoState = (await pglite.query(
    `SELECT job.status AS job_status,media.status AS media_status,completion.finalized_at
     FROM business_jobs job JOIN business_job_completion completion ON completion.job_id=job.id
     JOIN photo_upload_invites invite ON invite.business_job_id=job.id
     JOIN realization_media_intake media ON media.invite_id=invite.id WHERE job.id=$1`, [photoJob.id],
  )).rows[0];
  assert.ok(
    (photoState.job_status === 'DOKONCENA' && photoState.media_status === 'approved_private' && photoState.finalized_at)
      || (photoState.job_status === 'DEMONT_DOKONCENA' && photoState.media_status === 'deletion_pending' && !photoState.finalized_at),
    JSON.stringify(photoState),
  );
  console.log('PASS: PostgreSQL sprievodca dokončením má CAS, role gate a pripraví iba neodoslaný koncept referencie.');
} catch (error) {
  console.error(error);
  exitCode = 1;
} finally {
  try { await server?.stop(); await pglite?.close(); } catch (error) { console.error('Cleanup failed:', error); exitCode = 1; }
}
process.exit(exitCode);
