import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import {
  adminTestimonialConsentVersion,
  formatAdminTestimonialConsentEvidence,
} from '../src/lib/testimonial-consent.ts';
import { testimonialPublicContentHash } from '../src/server/testimonial-policy.ts';

let pglite;
let server;
let exitCode = 0;

async function availablePort() {
  const probe = createServer();
  await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
  const { port } = probe.address();
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  return port;
}

try {
  const port = await availablePort();
  pglite = await PGlite.create();
  server = new PGLiteSocketServer({ db: pglite, port, host: '127.0.0.1', maxConnections: 8 });
  await server.start();
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = `postgres://astana_test:astana_test@127.0.0.1:${port}/astana_test`;
  process.env.ADMIN_EMAIL = '';
  const db = await import(`../src/server/db.ts?review-workflow-pg=${randomUUID()}`);
  const { NextRequest } = await import('next/server');
  const interactionRoute = await import(`../app/api/testimonial/interaction/route.ts?review-interaction-pg=${randomUUID()}`);
  await db.listReviewRequests();
  const actor = 'operator@example.invalid';
  const jobInput = (customerName, customerEmail) => ({ demolitionDate:'2026-10-01', customerName, customerPhone:'0900000000',
    customerEmail, location:'Poprad', district:'Poprad', materialType:'Vlnitý eternit', objectType:'Rodinný dom',
    term:'', leadSource:'postgres-harness', preferredContact:'email', m2:100, pricePerM2:10, paymentType:'FAKTURA',
    workType:'DEMONTAZ_A_ODVOZ', wasteKg:1000, landfill:'INA', status:'DOKONCENA', note:'', workers:[],
    costs:{ fuel:0,suits:0,gloves:0,penetrant:0,landfillCost:0,otherName:'',otherAmount:0 } });
  const job = await db.saveBusinessJob(jobInput('Postgres zákazník','postgres-customer@example.invalid'), actor);
  const input = { jobId:job.id, customerName:job.customerName, customerEmail:job.customerEmail, phone:job.customerPhone,
    location:job.location, objectType:job.objectType, realizationDate:job.demolitionDate, googleReviewLink:'https://example.com/google',
    subject:'Spätná väzba', message:'Dobrý deň {{meno}} {{odkaz}}', status:'pending_approval', reminderAllowed:true, createdBy:actor };
  const prepared = await Promise.all([db.createReviewRequest(input), db.createReviewRequest(input)]);
  assert.equal(new Set(prepared.map((item) => item.id)).size, 1, 'one job may have only one request');
  const claims = await Promise.all([db.claimReviewRequestForDelivery(prepared[0].id, 1, actor), db.claimReviewRequestForDelivery(prepared[0].id, 1, actor)]);
  assert.equal(claims.filter(Boolean).length, 1, 'only one concurrent sender may claim a request');
  const claim = claims.find(Boolean);
  const smtpAccepted = await db.completeReviewRequestDelivery(claim.request.id, claim.request.revision, { status:'smtp_accepted', messageId:'private-smtp-id' }, actor, 5);
  assert.equal(smtpAccepted.status, 'smtp_accepted');
  assert.ok((new Date(smtpAccepted.tokenExpiresAt).getTime() - new Date(claim.request.updatedAt).getTime()) / 86400000 >= 29.99);
  assert.ok(await db.openPublicReviewRequest(claim.token));
  const afterGet = (await db.listReviewRequests()).find((item) => item.id === prepared[0].id);
  assert.equal(afterGet.status, 'smtp_accepted', 'GET must not claim that a person opened the link');
  assert.equal(afterGet.revision, smtpAccepted.revision, 'GET must not mutate the review request');
  const interactionA = await db.recordPublicReviewInteraction(claim.token);
  const interactionB = await db.recordPublicReviewInteraction(claim.token);
  assert.equal(interactionA.status, 'opened');
  assert.ok(interactionA.openedAt);
  assert.equal(interactionA.revision, smtpAccepted.revision + 1);
  assert.equal(interactionB.revision, interactionA.revision, 'PostgreSQL interaction recording is idempotent');
  const testimonial = await db.submitRequestedTestimonial({ token:claim.token, submissionId:randomUUID(), customerName:'Postgres Z.', rating:4,
    text:'Komunikácia aj vykonanie prác boli profesionálne.' });
  const approved = await db.approveRequestedTestimonial(testimonial.id, actor);
  assert.equal(approved.status, 'approved');
  assert.equal((await db.listApprovedTestimonials(20)).some((item) => item.id === testimonial.id), false);
  const published = await db.publishRequestedTestimonial(testimonial.id, 'superadmin@example.invalid');
  assert.equal(published.status, 'approved');
  assert.equal((await db.listApprovedTestimonials(20)).some((item) => item.id === testimonial.id), true);
  const revisedText = 'Upravená a zákazníkom znovu odsúhlasená PostgreSQL referencia.';
  const revisedEvidence = formatAdminTestimonialConsentEvidence(
    'Súhlasím so zverejnením upravenej referencie v uvedenom znení.',
    'e-mail',
    '2026-10-14',
    testimonialPublicContentHash(testimonial.customerName, testimonial.rating, revisedText),
  );
  const edited = await db.updateTestimonial(testimonial.id, { ...testimonial, realizationDate:'2026-10-01', text:revisedText, status:'draft',
    consentPublication:true, consentEvidence:revisedEvidence, consentCapturedAt:new Date().toISOString(),
    consentVersion:adminTestimonialConsentVersion }, actor);
  assert.equal(edited.status, 'draft');
  assert.equal((await db.listReviewRequests()).find((item) => item.id === prepared[0].id).status, 'submitted');
  assert.equal((await db.listApprovedTestimonials(20)).some((item) => item.id === testimonial.id), false);
  assert.equal((await db.approveRequestedTestimonial(testimonial.id, actor)).status, 'approved');
  assert.equal((await db.publishRequestedTestimonial(testimonial.id, 'superadmin@example.invalid')).status, 'approved');
  assert.equal((await db.updateTestimonialStatus(testimonial.id, 'hidden', actor)).status, 'hidden');
  assert.equal((await db.listReviewRequests()).find((item) => item.id === prepared[0].id).status, 'submitted');
  assert.equal((await db.listApprovedTestimonials(20)).some((item) => item.id === testimonial.id), false);
  await db.updateTestimonialStatus(testimonial.id, 'draft', actor);
  assert.equal((await db.approveRequestedTestimonial(testimonial.id, actor)).status, 'approved');
  assert.equal((await db.publishRequestedTestimonial(testimonial.id, 'superadmin@example.invalid')).status, 'approved');

  const prepareDeliveredReminder = async (name, email) => {
    const reminderJob = await db.saveBusinessJob(jobInput(name, email), actor);
    const reminderRequest = await db.createReviewRequest({ jobId:reminderJob.id, customerName:reminderJob.customerName,
      customerEmail:reminderJob.customerEmail, phone:reminderJob.customerPhone, location:reminderJob.location,
      objectType:reminderJob.objectType, realizationDate:reminderJob.demolitionDate, googleReviewLink:'',
      subject:'Spätná väzba', message:'Dobrý deň {{meno}} {{odkaz}}', status:'pending_approval', reminderAllowed:true, createdBy:actor });
    const initialClaim = await db.claimReviewRequestForDelivery(reminderRequest.id, reminderRequest.revision, actor);
    const delivered = await db.completeReviewRequestDelivery(reminderRequest.id, initialClaim.request.revision,
      { status:'smtp_accepted', messageId:'private-initial-' + name }, actor, 5);
    const due = await pglite.query("UPDATE review_requests SET reminder_due_at='2026-01-01T00:00:00.000Z', revision=revision+1 WHERE id=$1 RETURNING revision", [reminderRequest.id]);
    return { job:reminderJob, request:reminderRequest, initialClaim, delivered, revision:Number(due.rows[0].revision) };
  };

  const failedFlow = await prepareDeliveredReminder('Postgres zlyhanie', 'pg-failed@example.invalid');
  const failedClaim = await db.claimReviewReminder(failedFlow.request.id, failedFlow.revision, actor);
  assert.ok(await db.openPublicReviewRequest(failedFlow.initialClaim.token), 'claim must preserve the original link');
  const failedResult = await db.recordReviewReminderResult(failedFlow.request.id, failedClaim.request.revision,
    { status:'delivery_failed', reasonCode:'smtp_send_failed' }, actor);
  assert.equal(failedResult.reminderStatus, 'delivery_failed');
  assert.ok(await db.openPublicReviewRequest(failedFlow.initialClaim.token), 'failed reminder preserves original link');
  assert.equal(await db.openPublicReviewRequest(failedClaim.token), null, 'failed reminder revokes only its own token');
  assert.equal(await db.claimReviewReminder(failedFlow.request.id, failedResult.revision, actor), null, 'one failed attempt is final');

  const acceptedFlow = await prepareDeliveredReminder('Postgres prijatie', 'pg-accepted@example.invalid');
  const acceptedClaim = await db.claimReviewReminder(acceptedFlow.request.id, acceptedFlow.revision, actor);
  const acceptedResult = await db.recordReviewReminderResult(acceptedFlow.request.id, acceptedClaim.request.revision,
    { status:'smtp_accepted', messageId:'private-reminder-accepted' }, actor);
  assert.equal(acceptedResult.reminderStatus, 'smtp_accepted');
  assert.ok(await db.openPublicReviewRequest(acceptedClaim.token), 'accepted reminder keeps the new link usable');
  assert.ok(await db.openPublicReviewRequest(acceptedFlow.initialClaim.token), 'accepted reminder preserves original link');

  const interactionRequest = (token, origin = 'https://likvidacia-eternitu.sk') => new NextRequest(
    'https://likvidacia-eternitu.sk/api/testimonial/interaction/',
    { method:'POST', headers:{ Origin:origin, 'Sec-Fetch-Site':'same-origin', 'Content-Type':'application/json',
      'X-Forwarded-For':'192.0.2.80', 'X-Vercel-Forwarded-For':'192.0.2.80' }, body:JSON.stringify({ token }) },
  );
  assert.equal((await interactionRoute.POST(new NextRequest(
    'https://likvidacia-eternitu.sk/api/testimonial/interaction/',
    { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ token:acceptedClaim.token }) },
  ))).status, 403, 'interaction POST requires a same-origin browser signal');
  const savedNodeEnv = process.env.NODE_ENV;
  const savedAuthSecret = process.env.AUTH_SECRET;
  process.env.NODE_ENV = 'production';
  delete process.env.AUTH_SECRET;
  assert.equal((await interactionRoute.POST(interactionRequest(acceptedClaim.token))).status, 503,
    'production interaction tracking fails closed without a rate-limit secret');
  process.env.NODE_ENV = savedNodeEnv;
  if (savedAuthSecret === undefined) delete process.env.AUTH_SECRET; else process.env.AUTH_SECRET = savedAuthSecret;
  process.env.AUTH_SECRET = 'review-interaction-test-secret';
  assert.equal((await interactionRoute.POST(interactionRequest(acceptedClaim.token))).status, 200);
  const interactionRouteFirst = (await db.listReviewRequests()).find((item) => item.id === acceptedFlow.request.id);
  assert.equal(interactionRouteFirst.status, 'opened');
  assert.ok(interactionRouteFirst.openedAt);
  assert.equal((await interactionRoute.POST(interactionRequest(acceptedClaim.token))).status, 200);
  const interactionRouteSecond = (await db.listReviewRequests()).find((item) => item.id === acceptedFlow.request.id);
  assert.equal(interactionRouteSecond.revision, interactionRouteFirst.revision, 'same-origin route is idempotent');

  const staleFlow = await prepareDeliveredReminder('Postgres neznámy', 'pg-unknown@example.invalid');
  const staleClaim = await db.claimReviewReminder(staleFlow.request.id, staleFlow.revision, actor);
  await pglite.query("UPDATE review_requests SET updated_at='2026-01-01T00:00:00.000Z' WHERE id=$1", [staleFlow.request.id]);
  assert.equal(await db.recoverStaleReviewRequestDeliveries(), 1);
  const staleRecovered = (await db.listReviewRequests()).find((item) => item.id === staleFlow.request.id);
  assert.equal(staleRecovered.reminderStatus, 'delivery_unknown');
  assert.ok(await db.openPublicReviewRequest(staleClaim.token), 'unknown reminder keeps its potentially delivered link');
  assert.ok(await db.openPublicReviewRequest(staleFlow.initialClaim.token));
  assert.equal(await db.claimReviewReminder(staleFlow.request.id, staleRecovered.revision, actor), null, 'unknown result is not retried');

  const recipientFlow = await prepareDeliveredReminder('Postgres zmena adresy', 'pg-before@example.invalid');
  await pglite.query("UPDATE business_jobs SET customer_email='pg-after@example.invalid' WHERE id=$1", [recipientFlow.job.id]);
  assert.equal((await db.listDueReviewReminders(20)).some((item) => item.id === recipientFlow.request.id), false,
    'changed recipient is excluded from the due queue');
  assert.equal(await db.claimReviewReminder(recipientFlow.request.id, recipientFlow.revision, actor), null,
    'changed recipient also fails closed during claim');

  const reminderTokens = await pglite.query(
    'SELECT id, token_hash, reminder_token_hash, reminder_status FROM review_requests WHERE id = ANY($1::uuid[]) ORDER BY id',
    [[failedFlow.request.id, acceptedFlow.request.id, staleFlow.request.id]],
  );
  const failedStored = reminderTokens.rows.find((row) => row.id === failedFlow.request.id);
  const acceptedStored = reminderTokens.rows.find((row) => row.id === acceptedFlow.request.id);
  const staleStored = reminderTokens.rows.find((row) => row.id === staleFlow.request.id);
  assert.match(String(failedStored.token_hash), /^[a-f0-9]{64}$/);
  assert.equal(failedStored.reminder_token_hash, null);
  assert.match(String(acceptedStored.reminder_token_hash), /^[a-f0-9]{64}$/);
  assert.match(String(staleStored.reminder_token_hash), /^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(reminderTokens.rows), new RegExp([failedClaim.token, acceptedClaim.token, staleClaim.token].join('|')));
  const storedToken = await pglite.query('SELECT token_hash FROM review_requests WHERE id=$1', [prepared[0].id]);
  assert.match(String(storedToken.rows[0].token_hash), /^[a-f0-9]{64}$/);
  assert.notEqual(storedToken.rows[0].token_hash, claim.token);
  const audits = await pglite.query("SELECT changes FROM audit_logs WHERE entity_type='review_request' AND entity_id=$1", [prepared[0].id]);
  const interactionAudits = await pglite.query(
    "SELECT count(*)::integer AS count FROM audit_logs WHERE entity_type='review_request' AND entity_id=$1 AND action='review_request_form_interaction_recorded'",
    [prepared[0].id],
  );
  assert.equal(Number(interactionAudits.rows[0].count), 1, 'repeated PostgreSQL interaction signals create one audit event');
  assert.doesNotMatch(JSON.stringify(audits.rows), /postgres-customer@example\.invalid|Postgres zákazník|private-smtp-id/);
  console.log('PASS: PostgreSQL review workflow protects interaction tracking, uniqueness, claims, token hashes and publication gates.');
} catch (error) {
  console.error(error);
  exitCode = 1;
} finally {
  try { await server?.stop(); await pglite?.close(); } catch (error) { console.error('Cleanup failed:', error); exitCode = 1; }
}
process.exit(exitCode);
