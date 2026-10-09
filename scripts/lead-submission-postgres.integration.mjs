import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import pg from 'pg';
import { createHash, randomUUID } from 'node:crypto';
const publicTestimonialConsentVersion = 'testimonial-public-fields-v3';
const publicTestimonialConsentWording = 'Súhlasím so zverejnením presne týchto údajov: moje meno alebo iniciály, text skúsenosti, hodnotenie a dátum odoslania. E-mail nebude zverejnený. Tento súhlas nepokrýva zverejnenie žiadnych ďalších údajov.';
const adminTestimonialConsentVersion = 'testimonial-admin-exact-wording-v4';
const testimonialContentHash = (name, rating, text) => createHash('sha256').update(JSON.stringify([name.trim(), rating, text.trim()]), 'utf8').digest('hex');
const publicConsentEvidence = (hash) => `${publicTestimonialConsentWording}\nOdtlačok schváleného znenia: ${hash}`;
const adminConsentEvidence = (wording, source, date, hash) => `Presné znenie súhlasu: ${wording}\nOdtlačok schváleného znenia: ${hash}\nZdroj súhlasu: ${source}; dátum súhlasu: ${date}.`;

const { Pool } = pg;
let pglite;
let server;
let inspectPool;
let createLeadSubmission;
let recordAcceptedLeadAnalytics;
let recoverAcceptedLeadAnalytics;
let persistAcceptedLeadAnalyticsBatch;
let getLeadAttributionReport;
let getLeadEmailOutboxAttention;
let getSystemHealth;
let markStaleLeadEmailClaimsUnknown;
let claimLeadEmailOutbox;
let listPendingLeadEmailDeliveries;
let recordLeadEmailRecipientResult;
let addAuditLog;
let resolveLeadEmailRecipientDelivery;
let prepareLeadEmailRecipientManualRetry;
let deleteLeadFileRecord;
let claimLeadFileDeletionJobs;
let failLeadFileDeletionJob;
let completeLeadFileDeletionJob;
let archiveLead;
let restoreLead;
let destroyArchivedLead;
let reserveLeadUploadDraft;
let markLeadUploadDraftUploaded;
let claimExpiredLeadUploadDrafts;
let completeLeadUploadDraftDeletion;
let trackUnreservedLegacyLeadPhoto;
let claimLeadBlobReconciliation;
let advanceLeadBlobReconciliation;
let releaseLeadBlobReconciliation;
let reconcileLegacyLeadBlobs;
let oldPrivateLeadPhoto;
let leadBlobRetentionBindingHash;
let leadBlobRetentionBound;
let consumeApiRateLimit;
let consumeSharedRateLimit;
let createRateLimitBucketKey;
let trustedRateLimitClientIp;
let purgeExpiredApiRateLimitBuckets;
let claimDuePhotoIntakeDeletions;
let listRevokedPendingPhotoRecords;
let listPhotoIntakeRecords;
let markPhotoIntakeUploadTokenIssued;
let reservePhotoIntakeSanitizationAttempt;
let abandonPhotoIntakeSanitizationAttempt;
let claimPhotoIntakeSanitizationCleanups;
let completePhotoIntakeSanitizationCleanup;
let failPhotoIntakeSanitizationCleanup;
let markPhotoIntakeDeletionFailed;
let completePhotoIntakeDeletion;
let updatePhotoIntakeMetadata;
let withdrawApprovedPhotoIntakeRecord;
let completePhotoIntakeRecord;
let reviewPhotoIntakeRecord;
let createTestimonial;
let updateTestimonial;
let updateTestimonialStatus;
let getTestimonial;
let listTestimonialsPage;
let listTestimonialAdminHistory;
let listApprovedTestimonials;
let createCareerApplication;
let listCareerApplications;
let countCareerApplications;
let createRooferRegistration;
let getRooferRegistrationBySubmissionId;
let attachCareerApplicationCv;
let listApplicationNotificationStatuses;
let listDueApplicationNotifications;
let getApplicationNotificationHealth;
let claimApplicationNotification;
let claimCareerNotificationBatch;
let recordCareerNotificationBatchResult;
let recordApplicationNotificationResult;
let markStaleApplicationNotificationClaimsUnknown;
let resolveUnknownApplicationNotification;
let prepareConfirmedApplicationNotificationRetry;
let LeadSubmissionConflictError;
let createRealization;
let updateRealizationStatus;
let listPublishedRealizations;
let listRealizationCaseDrafts;
let saveRealizationCaseDraft;
let createCaseDraftFromApprovedPhoto;
let setRealizationCaseDraftMedia;
let updateRealizationCaseDraftMediaMetadata;
let transitionRealizationCaseDraft;
let listPublishedRealizationCases;
let countPublishedRealizationCases;
let getPublishedRealizationCasePhoto;
let listPhotoIntakeJobOptions;
let createPhotoUploadInvite;
let consumePhotoUploadInviteByHash;
let getActivePhotoUploadInvite;
let listBusinessJobs;
let listBusinessJobDashboardRows;
let countBusinessJobs;
let getBusinessJobsSummary;
let getLeadDashboardMetrics;
let getLeadQueueCounts;
let setLeadTestData;
let setBusinessJobTestData;
let getPriceOfferEventMetrics;
let getPriceOfferStatusSummary;
let listPriceOffers;
let destroyBusinessJob;
let deleteBusinessJob;
let getBusinessJobWithActivity;
let saveBusinessJob;
let savePriceOffer;
let listLeadSummaryPage;
let connectionString;
let usingRealPostgres = false;

async function findAvailablePort() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const { port } = probe.address();
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function completePhotoIntakeForTest(input) {
  const attempt = await reservePhotoIntakeSanitizationAttempt(input.id, input.inviteId);
  if (!attempt) return null;
  try {
    return await completePhotoIntakeRecord({
      ...input,
      storageKey: attempt.sourceStorageKey,
      targetStorageKey: attempt.targetStorageKey,
      sanitizationAttemptId: attempt.id,
    });
  } finally {
    await abandonPhotoIntakeSanitizationAttempt(attempt.id);
  }
}

async function startIsolatedDatabase() {
  // An explicit real-PG URL is accepted only for a disposable loopback database.
  // Normal test runs keep the existing isolated PGlite socket.
  const realPgUrl = process.env.ASTANA_ISOLATED_PG_URL;
  if (realPgUrl) {
    const parsed = new URL(realPgUrl);
    const runToken = process.env.ASTANA_ISOLATED_PG_RUN_TOKEN;
    const port = Number(parsed.port);
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol)
      || parsed.hostname !== '127.0.0.1'
      || !/^[a-f0-9]{32}$/.test(runToken || '')
      || parsed.pathname !== `/astana_isolated_${runToken}`
      || parsed.username !== 'astana_test'
      || parsed.password || parsed.search || parsed.hash
      || !Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error('ASTANA_ISOLATED_PG_URL musí smerovať na jednorazovú databázu lokálneho servera bez presmerovacích parametrov a mať zhodný token.');
    }
    // Never pass the supplied URL through pg-connection-string: query parameters
    // such as host/port can override the URL authority in that parser.
    connectionString = `postgres://astana_test@127.0.0.1:${port}/astana_isolated_${runToken}`;
    const guardPool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 3000 });
    try {
      const guard = await guardPool.query('SELECT run_token FROM astana_isolated_runner_guard WHERE run_token = $1', [runToken]);
      if (guard.rowCount !== 1) throw new Error('Jednorazovú databázu nevytvoril tento testovací beh.');
    } finally {
      await guardPool.end();
    }
    usingRealPostgres = true;
  } else {
    const port = await findAvailablePort();
    pglite = await PGlite.create();
    server = new PGLiteSocketServer({ db: pglite, port, host: '127.0.0.1', maxConnections: 16 });
    await server.start();
    connectionString = `postgres://astana_test:astana_test@127.0.0.1:${port}/astana_test`;
  }
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = connectionString;
  process.env.ADMIN_EMAIL = '';

  ({ createLeadSubmission, recordAcceptedLeadAnalytics, recoverAcceptedLeadAnalytics, getLeadAttributionReport, getLeadEmailOutboxAttention, reserveLeadUploadDraft, markLeadUploadDraftUploaded, claimExpiredLeadUploadDrafts, completeLeadUploadDraftDeletion, trackUnreservedLegacyLeadPhoto, consumeApiRateLimit, purgeExpiredApiRateLimitBuckets, claimDuePhotoIntakeDeletions, listRevokedPendingPhotoRecords, listPhotoIntakeRecords, markPhotoIntakeUploadTokenIssued, reservePhotoIntakeSanitizationAttempt, abandonPhotoIntakeSanitizationAttempt, claimPhotoIntakeSanitizationCleanups, completePhotoIntakeSanitizationCleanup, failPhotoIntakeSanitizationCleanup, markPhotoIntakeDeletionFailed, completePhotoIntakeDeletion, updatePhotoIntakeMetadata, withdrawApprovedPhotoIntakeRecord, completePhotoIntakeRecord, reviewPhotoIntakeRecord, createTestimonial, updateTestimonial, updateTestimonialStatus, listApprovedTestimonials, createCareerApplication, createRooferRegistration, getRooferRegistrationBySubmissionId, attachCareerApplicationCv, listApplicationNotificationStatuses, listDueApplicationNotifications, getApplicationNotificationHealth, claimApplicationNotification, claimCareerNotificationBatch, recordApplicationNotificationResult, recordCareerNotificationBatchResult, markStaleApplicationNotificationClaimsUnknown, resolveUnknownApplicationNotification, prepareConfirmedApplicationNotificationRetry, LeadSubmissionConflictError, createRealization, updateRealizationStatus, listPublishedRealizations, listRealizationCaseDrafts, saveRealizationCaseDraft, setRealizationCaseDraftMedia, updateRealizationCaseDraftMediaMetadata, transitionRealizationCaseDraft, listPublishedRealizationCases, countPublishedRealizationCases, getPublishedRealizationCasePhoto, listPhotoIntakeJobOptions, createPhotoUploadInvite, consumePhotoUploadInviteByHash, getActivePhotoUploadInvite } = await import('../src/server/db.ts'));
  ({ createCaseDraftFromApprovedPhoto } = await import('../src/server/db.ts'));
  ({ getTestimonial, listTestimonialsPage, listTestimonialAdminHistory } = await import('../src/server/db.ts'));
  ({ persistAcceptedLeadAnalyticsBatch } = await import('../src/server/analytics-recovery.ts'));
  ({ markStaleLeadEmailClaimsUnknown } = await import('../src/server/db.ts'));
  ({ claimLeadEmailOutbox, listPendingLeadEmailDeliveries, recordLeadEmailRecipientResult, addAuditLog, getSystemHealth } = await import('../src/server/db.ts'));
  ({ resolveLeadEmailRecipientDelivery, prepareLeadEmailRecipientManualRetry } = await import('../src/server/db.ts'));
  ({ deleteLeadFileRecord, claimLeadFileDeletionJobs, failLeadFileDeletionJob, completeLeadFileDeletionJob } = await import('../src/server/db.ts'));
  ({ archiveLead, restoreLead, destroyArchivedLead } = await import('../src/server/db.ts'));
  ({ claimLeadBlobReconciliation, advanceLeadBlobReconciliation, releaseLeadBlobReconciliation } = await import('../src/server/db.ts'));
  ({ reconcileLegacyLeadBlobs, oldPrivateLeadPhoto } = await import('../src/server/lead-blob-reconciliation.ts'));
  ({ leadBlobRetentionBindingHash, leadBlobRetentionBound } = await import('../src/server/lead-blob-retention-binding.ts'));
  ({ consumeSharedRateLimit, createRateLimitBucketKey, trustedRateLimitClientIp } = await import('../src/server/shared-rate-limit.ts'));
  ({ listCareerApplications, countCareerApplications } = await import('../src/server/db.ts'));
  ({ listBusinessJobs, listBusinessJobDashboardRows, countBusinessJobs, getBusinessJobsSummary } = await import('../src/server/db.ts'));
  ({ getLeadDashboardMetrics, getLeadQueueCounts, getPriceOfferEventMetrics, getPriceOfferStatusSummary, listPriceOffers, listLeadSummaryPage, setLeadTestData, setBusinessJobTestData } = await import('../src/server/db.ts'));
  ({ destroyBusinessJob, deleteBusinessJob, getBusinessJobWithActivity, saveBusinessJob, savePriceOffer } = await import('../src/server/db.ts'));
  inspectPool = new Pool({ connectionString, max: 1, idleTimeoutMillis: 1000 });
}

async function runBusinessJobsQueryRegression() {
  // One isolated >1,000-row fixture verifies SQL filters, full counts, paging, and canceled summaries.
  await listBusinessJobs({ limit: 1 }); // Initializes the isolated PGlite schema first.
  const token = randomUUID();
  const district = `Regression District ${token}`;
  const workerId = randomUUID();
  const canceledJobId = randomUUID();
  const archivedJobId = randomUUID();
  const olderCustomerName = `OLDER NEEDLE ${token}`;
  await inspectPool.query(
    'INSERT INTO workers (id, name) VALUES ($1, $2)',
    [workerId, `Test worker ${token}`],
  );
  await inspectPool.query(
    `INSERT INTO business_jobs (id, demolition_date, customer_name, location, district, payment_type, landfill, status, total_price)
     SELECT gen_random_uuid(),
       CASE WHEN job_number = 1 THEN DATE '2000-01-01' ELSE DATE '2024-01-01' - job_number END,
       CASE WHEN job_number = 1 THEN $2 ELSE 'Customer ' || job_number::text END,
       CASE WHEN job_number = 2 THEN 'Žilina' ELSE 'Location ' || job_number::text END, $1, 'CASH', 'KOSICE', 'DOPYT',
       CASE WHEN job_number = 1 THEN 123.45 ELSE 100 END
     FROM generate_series(1, 1001) AS job_number`,
    [district, olderCustomerName],
  );
  await inspectPool.query(
    `INSERT INTO business_jobs (id, demolition_date, customer_name, location, district, payment_type, landfill, status, total_price)
     VALUES ($1, DATE '1999-01-01', 'Canceled customer', 'Canceled location', $2, 'CASH', 'KOSICE', 'ZRUSENA', 777)`,
    [canceledJobId, district],
  );
  await inspectPool.query(
    `INSERT INTO business_jobs (id, demolition_date, customer_name, location, district, payment_type, landfill, status, total_price, deleted_at)
     VALUES ($1, DATE '1998-01-01', 'Archived customer', 'Archived location', $2, 'CASH', 'KOSICE', 'DOKONCENA', 9999, now())`,
    [archivedJobId, district],
  );
  await inspectPool.query(
    `INSERT INTO business_job_costs (job_id, fuel, total)
     SELECT id, CASE WHEN status = 'ZRUSENA' THEN 9999 ELSE 20 END, CASE WHEN status = 'ZRUSENA' THEN 9999 ELSE 20 END
     FROM business_jobs WHERE district = $1`,
    [district],
  );
  await inspectPool.query(
    `INSERT INTO business_job_workers (id, job_id, worker_id, worker_name, reward)
     SELECT gen_random_uuid(), id, $2, 'Regression worker', CASE WHEN status = 'ZRUSENA' THEN 888 ELSE 5 END
     FROM business_jobs WHERE district = $1`,
    [district, workerId],
  );

  const filters = {
    from: '1990-01-01',
    to: '2025-01-01',
    paymentType: 'CASH',
    landfill: 'KOSICE',
    workerId,
    q: district.toLowerCase(),
  };
  assert.equal(await countBusinessJobs(filters), 1002, 'count query musí vrátiť všetky zhody aj nad 1 000');
  const firstPage = await listBusinessJobs({ ...filters, limit: 1000, offset: 0 });
  const secondPage = await listBusinessJobs({ ...filters, limit: 1000, offset: 1000 });
  assert.equal(firstPage.length, 1000);
  assert.equal(secondPage.length, 2);
  assert.equal(new Set([...firstPage, ...secondPage].map((job) => job.id)).size, 1002, 'stránky sa nesmú prekrývať ani vynechať zákazky');
  assert.ok(secondPage.some((job) => job.customerName === olderCustomerName), 'staršia filtrovaná zhoda musí byť dostupná na ďalšej strane');
  assert.ok(secondPage.some((job) => job.id === canceledJobId));
  assert.equal((await listBusinessJobs({ ...filters, status: 'ZRUSENA', limit: null })).length, 1, 'stavový filter musí fungovať aj bez limitu');
  assert.equal(await countBusinessJobs({ ...filters, q: 'older needle' }), 1, 'vyhľadávanie musí byť case-insensitive a hľadať meno zákazníka');
  assert.equal(await countBusinessJobs({ ...filters, q: 'canceled location' }), 1, 'vyhľadávanie musí pokrývať aj lokalitu');
  assert.equal(await countBusinessJobs({ ...filters, q: 'zilina' }), 1, 'vyhľadávanie má nájsť slovenskú lokalitu aj bez diakritiky');
  assert.equal(await countBusinessJobs({ ...filters, q: 'Žilina' }), 1, 'vyhľadávanie má fungovať aj pri zadaní slovenskej diakritiky');
  assert.equal(await countBusinessJobs({ ...filters, includeArchived: true }), 1003, 'SUPER_ADMIN filter archívu sprístupní archívny riadok');
  assert.equal((await listBusinessJobs({ ...filters, includeArchived: true, limit: null })).some((job) => job.id === archivedJobId && job.deletedAt), true);

  const summary = await getBusinessJobsSummary(filters);
  assert.deepEqual(summary, {
    totalCount: 1002,
    activeCount: 1001,
    recordedValue: 100123.45,
    recordedCost: 20020,
    recordedRewards: 5005,
    remainder: 75098.45,
    canceledCount: 1,
    canceledValue: 777,
    archivedCount: 0,
    archivedValue: 0,
  }, 'súhrn musí vylúčiť zrušenú zákazku z aktívnych súm a uviesť ju samostatne');
  const archivedSummary = await getBusinessJobsSummary({ ...filters, includeArchived: true });
  assert.equal(archivedSummary.activeCount, 1001, 'archív sa nesmie zahrnúť medzi aktívne zákazky');
  assert.equal(archivedSummary.recordedValue, 100123.45, 'archív sa nesmie pripočítať k aktívnym evidovaným sumám');
  assert.equal(archivedSummary.archivedCount, 1);
  assert.equal(archivedSummary.archivedValue, 9999);

  const dashboardRows = await listBusinessJobDashboardRows('1990-01-01', '2025-01-01');
  const dashboardCanceledRow = dashboardRows.find((job) => job.id === canceledJobId);
  assert.ok(dashboardCanceledRow, 'dashboard projection includes matching non-archived rows');
  assert.deepEqual(dashboardCanceledRow.workers, [{ workerId, reward: 888 }]);
  assert.equal(dashboardCanceledRow.costsTotal, 9999);
  assert.equal('customerName' in dashboardCanceledRow, false, 'chart projection must not hydrate customer PII');
  assert.equal(dashboardRows.some((job) => job.id === archivedJobId), false, 'dashboard projection excludes archived jobs');
}

async function runDashboardMetricsRegression() {
  const token = randomUUID();
  await inspectPool.query(
    `INSERT INTO leads (id, created_at, status, full_name, phone, email, city, object_type, material_type, area_estimate, followup_date)
     SELECT gen_random_uuid(),
       CASE WHEN row_number <= 12 THEN TIMESTAMPTZ '2026-10-01 06:00:00+00' ELSE TIMESTAMPTZ '2026-09-30 06:00:00+00' END,
       CASE WHEN row_number <= 8 THEN 'novy' WHEN row_number <= 20 THEN 'kontaktovany' WHEN row_number <= 35 THEN 'naceneny' ELSE 'nevyslo' END,
       'Dashboard test ' || $1, '+421900000001', 'dashboard-' || row_number::text || '@example.invalid', 'Test mesto', 'Rodinný dom', 'Eternit', 100,
       CASE WHEN row_number <= 7 THEN DATE '2026-09-30' ELSE NULL END
     FROM generate_series(1, 305) AS rows(row_number)`,
    [token],
  );
  const testLeads = await inspectPool.query("SELECT id FROM leads WHERE email IN ('dashboard-1@example.invalid', 'dashboard-36@example.invalid') ORDER BY email");
  assert.equal(testLeads.rowCount, 2);
  assert.equal(await setLeadTestData(String(testLeads.rows[0].id), true, 'superadmin@example.invalid', 'Lokálny test formulára'), true);
  assert.equal(await setLeadTestData(String(testLeads.rows[1].id), true, 'superadmin@example.invalid', 'Testovacie CRM údaje'), true);
  await assert.rejects(setLeadTestData(String(testLeads.rows[0].id), false, 'superadmin@example.invalid', 'Dôvod s osobným emailom test@example.invalid'), /povolený dôvod/);
  const leads = await getLeadDashboardMetrics('2026-09-30', '2026-10-01', '2026-10-01');
  assert.deepEqual(leads, { receivedInPeriod: 303, newToday: 11, waitingForOffer: 34, followupsDue: 6 },
    'dashboard vylúči iba explicitne označené testy a zostane presný nad limitom 300');
  const recentLeads = await listLeadSummaryPage({ page: 1, pageSize: 10 });
  const lostLeads = await listLeadSummaryPage({ page: 1, pageSize: 10, status: 'nevyslo' });
  const recentBusinessLeads = await listLeadSummaryPage({ page: 1, pageSize: 10, excludeTestData: true });
  const lostBusinessLeads = await listLeadSummaryPage({ page: 1, pageSize: 10, status: 'nevyslo', excludeTestData: true });
  assert.deepEqual([recentLeads.total, recentLeads.items.length, recentLeads.pageSize], [305, 10, 10], 'bežné CRM naďalej zobrazuje aj testy');
  assert.deepEqual([recentBusinessLeads.total, recentBusinessLeads.items.length], [303, 10], 'dashboard preview vylúči iba explicitne označené testy');
  assert.deepEqual([lostLeads.total, lostBusinessLeads.total, lostBusinessLeads.items.length], [270, 269, 10], 'testy sa odpočítajú aj zo stratených dopytov');
  assert.equal((await getLeadQueueCounts('2026-10-01', true)).total, 303, 'dashboard fronty vylúčia označené testy');
  const classificationAudit = await inspectPool.query("SELECT count(*)::int AS count FROM audit_logs WHERE action = 'lead_test_classification_changed' AND entity_id = ANY($1::uuid[])", [testLeads.rows.map((row) => String(row.id))]);
  assert.equal(Number(classificationAudit.rows[0].count), 2, 'každá zmena klasifikácie sa audituje');

  await inspectPool.query(
    `INSERT INTO price_offers (id, number, valid_until, created_at, status, sent_at, accepted_at)
     SELECT gen_random_uuid(), $1 || '-' || row_number::text, DATE '2026-12-31',
       CASE WHEN row_number = 1001 THEN TIMESTAMPTZ '2026-10-01 22:30:00+00' ELSE TIMESTAMPTZ '2026-09-30 22:30:00+00' END,
       'PRIPRAVENA',
       CASE WHEN row_number <= 700 THEN TIMESTAMPTZ '2026-10-01 21:30:00+00' ELSE NULL END,
       CASE WHEN row_number <= 250 THEN TIMESTAMPTZ '2026-10-01 21:30:00+00' ELSE NULL END
     FROM generate_series(1, 1001) AS rows(row_number)`,
    [`DashboardOffer-${token}`],
  );
  assert.deepEqual(await getPriceOfferEventMetrics('2026-10-01', '2026-10-01'), { created: 1000, sent: 700, accepted: 250 },
    'počty ponúk nesmú byť skrátené na 1 000 a udalosti sa majú priradiť k bratislavskému kalendárnemu dňu');
  assert.equal((await getPriceOfferStatusSummary('2026-10')).created, 1001, 'mesačný súhrn zahŕňa UTC polnoc podľa času v Bratislave a nie je limitovaný zoznamom');
  const testJobId = randomUUID();
  const standaloneTestJobId = randomUUID();
  const testOfferId = randomUUID();
  const standaloneTestOfferId = randomUUID();
  const directTestOfferId = randomUUID();
  await inspectPool.query(
    `INSERT INTO business_jobs (id, lead_id, demolition_date, customer_name, location, status, total_price)
     VALUES ($1, $2, DATE '2026-10-01', 'Synthetic dashboard test', 'Test locality', 'DOKONCENA', 8888)`,
    [testJobId, String(testLeads.rows[0].id)],
  );
  await inspectPool.query(
    `INSERT INTO business_jobs (id, demolition_date, customer_name, location, status, total_price)
     VALUES ($1, DATE '2026-10-01', 'Synthetic standalone test', 'Test locality', 'DOKONCENA', 7777)`,
    [standaloneTestJobId],
  );
  assert.equal(await setBusinessJobTestData(standaloneTestJobId, true, 'superadmin@example.invalid', 'Testovacie CRM údaje'), true);
  const savedOfferInput = {
    jobId: standaloneTestJobId, objectType: 'Rodinný dom', objectAddress: 'Testovacia lokalita', municipality: 'Poprad', district: 'Poprad',
    contactPerson: 'Synthetic QA', phone: '+421900000000', email: 'test@example.invalid', realizationTerm: 'test',
    materialType: 'VLNITY_ETERNIT', areaM2: 50, pricePerM2WithoutVat: 1, documentationFeeWithoutVat: 0,
    includeDocumentation: false, documentationPromotion: false, includeTransport: false,
    transportFrom: '', transportTo: '', transportRoundTripKm: 0, transportPricePerKm: 0.7,
    validUntil: '2026-12-31', sourceInquiry: 'test',
  };
  const savedTestOffer = await savePriceOffer(savedOfferInput, 'superadmin@example.invalid');
  await savePriceOffer({ ...savedOfferInput, jobId: '' }, 'superadmin@example.invalid', savedTestOffer.id);
  const detachedSavedOffer = await inspectPool.query('SELECT job_id, source_job_ids, is_test_data FROM price_offers WHERE id = $1', [savedTestOffer.id]);
  assert.equal(detachedSavedOffer.rows[0].job_id, null);
  assert.ok(detachedSavedOffer.rows[0].source_job_ids.includes(standaloneTestJobId));
  assert.equal(detachedSavedOffer.rows[0].is_test_data, false, 'kým zákazka existuje, jej opraviteľná klasifikácia sa nelepí na ponuku');
  const beforeCorrection = (await getPriceOfferStatusSummary('2026-10')).created;
  assert.equal(await setBusinessJobTestData(standaloneTestJobId, false, 'superadmin@example.invalid', 'Testovacie CRM údaje'), true);
  assert.equal((await getPriceOfferStatusSummary('2026-10')).created, beforeCorrection + 1, 'odznačenie stále existujúcej zákazky opraví aj odpojenú ponuku');
  assert.equal(await setBusinessJobTestData(standaloneTestJobId, true, 'superadmin@example.invalid', 'Testovacie CRM údaje'), true);
  assert.equal((await getPriceOfferStatusSummary('2026-10')).created, beforeCorrection);
  const lateTestJobId = randomUUID();
  await inspectPool.query(
    `INSERT INTO business_jobs (id, demolition_date, customer_name, location, status, total_price)
      VALUES ($1, DATE '2026-10-01', 'Synthetic later classification', 'Test locality', 'DOKONCENA', 100)`,
    [lateTestJobId],
  );
  const baselineMonth = (await getPriceOfferStatusSummary('2026-10')).created;
  const lateOffer = await savePriceOffer({ ...savedOfferInput, jobId: lateTestJobId }, 'superadmin@example.invalid');
  await savePriceOffer({ ...savedOfferInput, jobId: '' }, 'superadmin@example.invalid', lateOffer.id);
  assert.equal((await getPriceOfferStatusSummary('2026-10')).created, baselineMonth + 1);
  assert.equal(await setBusinessJobTestData(lateTestJobId, true, 'superadmin@example.invalid', 'Testovacie CRM údaje'), true);
  assert.equal((await getPriceOfferStatusSummary('2026-10')).created, baselineMonth, 'neskoršie označenie pôvodnej zákazky vylúči odpojenú ponuku');
  await destroyBusinessJob(lateTestJobId, 'superadmin@example.invalid');
  const preservedLateOffer = await inspectPool.query('SELECT source_job_ids, is_test_data FROM price_offers WHERE id = $1', [lateOffer.id]);
  assert.ok(preservedLateOffer.rows[0].source_job_ids.includes(lateTestJobId));
  assert.equal(preservedLateOffer.rows[0].is_test_data, true, 'po zmazaní testovacej zákazky si odpojená ponuka ponechá klasifikáciu');
  assert.equal((await getPriceOfferStatusSummary('2026-10')).created, baselineMonth);
  await inspectPool.query(
    `INSERT INTO price_offers (id, number, job_id, valid_until, created_at, status, sent_at, accepted_at)
     VALUES ($1, $2, $3, DATE '2026-12-31', TIMESTAMPTZ '2026-10-01 20:30:00+00', 'PRIJATA', TIMESTAMPTZ '2026-10-01 20:30:00+00', TIMESTAMPTZ '2026-10-01 20:30:00+00'),
            ($4, $5, $6, DATE '2026-12-31', TIMESTAMPTZ '2026-10-01 20:30:00+00', 'PRIJATA', TIMESTAMPTZ '2026-10-01 20:30:00+00', TIMESTAMPTZ '2026-10-01 20:30:00+00')`,
    [testOfferId, `DashboardTest-${token}`, testJobId, standaloneTestOfferId, `DashboardStandaloneTest-${token}`, standaloneTestJobId],
  );
  await inspectPool.query(
    `INSERT INTO price_offers (id, number, source_inquiry, valid_until, created_at, status, sent_at, accepted_at)
     VALUES ($1, $2, $3, DATE '2026-12-31', TIMESTAMPTZ '2026-10-01 20:30:00+00', 'PRIJATA', TIMESTAMPTZ '2026-10-01 20:30:00+00', TIMESTAMPTZ '2026-10-01 20:30:00+00')`,
    [directTestOfferId, `DashboardDirectTest-${token}`, `dopyt:${testLeads.rows[0].id}`],
  );
  const boundaryOfferId = randomUUID();
  await inspectPool.query(`INSERT INTO price_offers (id, number, job_id, valid_until, created_at, status)
    VALUES ($1, $2, $3, DATE '2026-12-31', TIMESTAMPTZ '2026-09-30 22:30:00+00', 'PRIPRAVENA')`,
  [boundaryOfferId, `DashboardBoundary-${token}`, testJobId]);
  assert.ok((await listPriceOffers({ month: '2026-10', jobId: testJobId })).some((offer) => offer.id === boundaryOfferId),
    'októbrový zoznam a októbrový súhrn používajú rovnaké bratislavské hranice');
  const businessJobs = await listBusinessJobs({ from: '2026-10-01', to: '2026-10-01', excludeTestData: true, limit: null });
  assert.equal(businessJobs.some((job) => job.id === testJobId), false, 'obchodný prehľad vynechá zákazku naviazanú na testovací dopyt');
  assert.equal(businessJobs.some((job) => job.id === standaloneTestJobId), false, 'obchodný prehľad vynechá aj samostatne označenú testovaciu zákazku');
  const chartJobs = await listBusinessJobDashboardRows('2026-10-01', '2026-10-01');
  assert.equal(chartJobs.some((job) => job.id === testJobId), false, 'graf a odmeny vynechajú zákazku naviazanú na test');
  assert.equal(chartJobs.some((job) => job.id === standaloneTestJobId), false, 'graf a odmeny vynechajú samostatne označený test');
  assert.deepEqual(await getPriceOfferEventMetrics('2026-10-01', '2026-10-01'), { created: 1000, sent: 700, accepted: 250 },
    'ponuka naviazaná na testovací lead ani priama ponuka z dopytu sa nezapočítajú');
  await deleteBusinessJob(standaloneTestJobId, 'superadmin@example.invalid');
  assert.ok((await getBusinessJobWithActivity(standaloneTestJobId))?.deletedAt, 'archivovaná zákazka zostáva otvoriteľná pre klasifikáciu');
  const archivedEdit = {
    demolitionDate: '2026-10-01', customerName: 'Nesmie nahradiť archív', location: 'Poprad', m2: 50, pricePerM2: 1,
    paymentType: 'FAKTURA', workType: 'DEMONTAZ_A_ODVOZ', landfill: 'INA', status: 'DOKONCENA', workers: [],
    costs: { fuel: 0, suits: 0, gloves: 0, penetrant: 0, landfillCost: 0, otherName: '', otherAmount: 0 },
  };
  await assert.rejects(saveBusinessJob(archivedEdit, 'superadmin@example.invalid', standaloneTestJobId), /Archivovanú zákazku/);
  assert.equal((await getBusinessJobWithActivity(standaloneTestJobId))?.customerName, 'Synthetic standalone test');
  assert.equal(await setBusinessJobTestData(standaloneTestJobId, false, 'superadmin@example.invalid', 'Testovacie CRM údaje'), true);
  assert.equal(await setBusinessJobTestData(standaloneTestJobId, true, 'superadmin@example.invalid', 'Testovacie CRM údaje'), true);
  assert.ok(await archiveLead(String(testLeads.rows[1].id), 'superadmin@example.invalid', 'Izolovaný test'));
  assert.equal(await setLeadTestData(String(testLeads.rows[1].id), false, 'superadmin@example.invalid', 'Testovacie CRM údaje'), true, 'archivovaný dopyt možno opraviť');
  assert.equal(await setLeadTestData(String(testLeads.rows[1].id), true, 'superadmin@example.invalid', 'Testovacie CRM údaje'), true);
  assert.ok(await archiveLead(String(testLeads.rows[0].id), 'superadmin@example.invalid', 'Izolovaný test'));
  assert.ok(await destroyArchivedLead(String(testLeads.rows[0].id), 'superadmin@example.invalid', 'Izolovaný test trvalého odstránenia'));
  const preservedJob = await inspectPool.query('SELECT lead_id, is_test_data FROM business_jobs WHERE id = $1', [testJobId]);
  assert.equal(preservedJob.rows[0].lead_id, null);
  assert.equal(preservedJob.rows[0].is_test_data, true, 'testovacia zákazka zostane označená po vymazaní zdrojového dopytu');
  const directOffer = await inspectPool.query('SELECT is_test_data FROM price_offers WHERE id = $1', [directTestOfferId]);
  assert.equal(directOffer.rows[0].is_test_data, true, 'priama ponuka zostane označená po vymazaní dopytu');
  await assert.rejects(savePriceOffer({
    objectType: 'Rodinný dom', objectAddress: 'Testovacia lokalita', municipality: 'Poprad', district: 'Poprad',
    contactPerson: 'Synthetic QA', phone: '+421900000000', email: 'test@example.invalid', realizationTerm: 'test',
    materialType: 'VLNITY_ETERNIT', areaM2: 50, pricePerM2WithoutVat: 1, documentationFeeWithoutVat: 0,
    includeDocumentation: false, documentationPromotion: false, includeTransport: false,
    transportFrom: '', transportTo: '', transportRoundTripKm: 0, transportPricePerKm: 0.7,
    validUntil: '2026-12-31', sourceInquiry: `dopyt:${testLeads.rows[0].id}`,
  }, 'superadmin@example.invalid'), /Zdrojový dopyt už neexistuje/);
  await destroyBusinessJob(testJobId, 'superadmin@example.invalid');
  await destroyBusinessJob(standaloneTestJobId, 'superadmin@example.invalid');
  await assert.rejects(saveBusinessJob(archivedEdit, 'superadmin@example.invalid', standaloneTestJobId), /Zákazka už neexistuje/, 'starý formulár nesmie obnoviť trvalo vymazanú zákazku');
  const detachedOffers = await inspectPool.query('SELECT id, job_id, is_test_data FROM price_offers WHERE id = ANY($1::uuid[])', [[testOfferId, standaloneTestOfferId]]);
  assert.equal(detachedOffers.rowCount, 2);
  assert.ok(detachedOffers.rows.every((row) => row.job_id === null && row.is_test_data === true), 'odpojené ponuky si zachovajú testovaciu klasifikáciu');
  assert.deepEqual(await getPriceOfferEventMetrics('2026-10-01', '2026-10-01'), { created: 1000, sent: 700, accepted: 250 },
    'trvalé odstránenie testov nesmie nafúknuť udalosti ponúk');
  const ambiguousLeads = await inspectPool.query(
    "SELECT id, email FROM leads WHERE email IN ('dashboard-100@example.invalid', 'dashboard-101@example.invalid') ORDER BY email",
  );
  assert.equal(ambiguousLeads.rowCount, 2);
  const ambiguousJobIds = [randomUUID(), randomUUID()];
  for (const [index, row] of ambiguousLeads.rows.entries()) {
    await inspectPool.query('UPDATE leads SET raw_data = $2::jsonb WHERE id = $1',
      [row.id, JSON.stringify({ attribution: { utmSource: `qa-ambiguous-${index}` } })]);
    await inspectPool.query(`INSERT INTO business_jobs (id, lead_id, demolition_date, customer_name, location)
      VALUES ($1, $2, DATE '2026-10-01', 'Synthetic attribution', 'Test locality')`, [ambiguousJobIds[index], row.id]);
  }
  const ambiguousOfferId = randomUUID();
  await inspectPool.query(`INSERT INTO price_offers (id, number, source_job_ids, valid_until, status)
    VALUES ($1, $2, $3::uuid[], DATE '2026-12-31', 'PRIJATA')`,
  [ambiguousOfferId, `DashboardAmbiguous-${token}`, ambiguousJobIds]);
  const attributionRows = await getLeadAttributionReport(365, '2026-09-01T00:00:00.000Z', null);
  for (const index of [0, 1]) {
    const row = attributionRows.find((item) => item.source === `qa-ambiguous-${index}`);
    assert.ok(row);
    assert.equal(row.leadsWithIssuedOffer, 0, 'nejednoznačná historická ponuka sa nesmie priradiť k obom kampaniam');
    assert.equal(row.leadsWithAcceptedOffer, 0);
  }
  await inspectPool.query('UPDATE price_offers SET job_id = $2 WHERE id = $1', [ambiguousOfferId, ambiguousJobIds[1]]);
  const currentOwnerRows = await getLeadAttributionReport(365, '2026-09-01T00:00:00.000Z', null);
  assert.equal(currentOwnerRows.find((row) => row.source === 'qa-ambiguous-0')?.leadsWithAcceptedOffer, 0);
  assert.equal(currentOwnerRows.find((row) => row.source === 'qa-ambiguous-1')?.leadsWithAcceptedOffer, 1,
    'aktuálna jednoznačná zákazka má prednosť pred historickým auditom');
  await inspectPool.query('UPDATE price_offers SET source_inquiry = $2 WHERE id = $1',
    [ambiguousOfferId, `dopyt:${ambiguousLeads.rows[0].id}`]);
  const staleDirectSourceRows = await getLeadAttributionReport(365, '2026-09-01T00:00:00.000Z', null);
  assert.equal(staleDirectSourceRows.find((row) => row.source === 'qa-ambiguous-0')?.leadsWithAcceptedOffer, 0);
  assert.equal(staleDirectSourceRows.find((row) => row.source === 'qa-ambiguous-1')?.leadsWithAcceptedOffer, 1,
    'starý priamy zdroj nesmie prepísať aktuálnu naviazanú zákazku');
  await inspectPool.query('UPDATE leads SET is_test_data = true WHERE id = $1', [ambiguousLeads.rows[0].id]);
  const testSourceRows = await getLeadAttributionReport(365, '2026-09-01T00:00:00.000Z', null);
  assert.equal(testSourceRows.find((row) => row.source === 'qa-ambiguous-1')?.leadsWithAcceptedOffer, 0,
    'ponuka s testovacím priamym zdrojom nesmie zvýšiť obchodnú konverziu');
  await inspectPool.query('UPDATE leads SET is_test_data = false WHERE id = $1', [ambiguousLeads.rows[0].id]);
  await inspectPool.query("UPDATE price_offers SET source_inquiry = '' WHERE id = $1", [ambiguousOfferId]);
  await inspectPool.query('UPDATE business_jobs SET lead_id = NULL WHERE id = $1', [ambiguousJobIds[1]]);
  const missingCurrentOwnerRows = await getLeadAttributionReport(365, '2026-09-01T00:00:00.000Z', null);
  assert.equal(missingCurrentOwnerRows.find((row) => row.source === 'qa-ambiguous-0')?.leadsWithAcceptedOffer, 0,
    'aktuálna zákazka bez dopytu nesmie priradiť ponuku staršiemu dopytu');
  assert.equal(missingCurrentOwnerRows.find((row) => row.source === 'qa-ambiguous-1')?.leadsWithAcceptedOffer, 0);
  await inspectPool.query('DELETE FROM price_offers WHERE id = $1', [ambiguousOfferId]);
  await inspectPool.query('DELETE FROM business_jobs WHERE id = ANY($1::uuid[])', [ambiguousJobIds]);
  await inspectPool.query('UPDATE leads SET raw_data = $1::jsonb WHERE id = ANY($2::uuid[])', ['{}', ambiguousLeads.rows.map((row) => row.id)]);
}

async function runIntegrationChecks() {
  assert.match(connectionString, /^postgres:\/\/[^@]+@127\.0\.0\.1:\d+\//, 'test smie používať iba lokálnu dočasnú DB');
  await runBusinessJobsQueryRegression();
  await runDashboardMetricsRegression();

  const submissionId = randomUUID();
  const makeInput = (id, submissionHash, overrides = {}) => ({
    submissionId: id,
    submissionHash,
    fullName: 'Test integračného formulára',
    phone: '+421900000001',
    email: 'integration-test@example.invalid',
    city: 'Poprad',
    district: 'Poprad',
    objectType: 'Rodinný dom',
    materialType: 'Vlnitý eternit',
    areaEstimate: 100,
    preferredContact: 'Emailom',
    term: 'Do mesiaca',
    note: 'Izolovaný automatický test — nekontaktovať.',
    gdpr: true,
    source: 'integration-test',
    ...overrides,
  });
  const attachments = [
    {
      leadId: randomUUID(),
      originalName: 'test-strecha-1.jpg',
      storageDriver: 'vercel_blob',
      storageKey: `private/integration-test/${submissionId}/1.jpg`,
      mimeType: 'image/jpeg',
      sizeBytes: 1234,
    },
    {
      leadId: randomUUID(),
      originalName: 'test-strecha-2.jpg',
      storageDriver: 'vercel_blob',
      storageKey: `private/integration-test/${submissionId}/2.jpg`,
      mimeType: 'image/jpeg',
      sizeBytes: 2345,
    },
  ];

  const analyticsSessionId = randomUUID();
  const first = await createLeadSubmission(makeInput(submissionId, 'hash-1', {
    rawData: { analyticsConsentAtSubmit: true, analyticsSessionId, attribution: { utmSource: 'google', utmMedium: 'cpc', utmCampaign: 'strecha Poprad', landingPath: '/cena-likvidacie-azbestu/', gclid: 'consented-test-click-id' } },
  }), attachments);
  assert.equal(first.duplicate, false);
  assert.equal(first.files.length, 2);
  assert.ok(first.files.every((file) => file.leadId === first.lead.id));
  const freshMailQueue = await getLeadEmailOutboxAttention();
  assert.equal(freshMailQueue.pending, 2);
  assert.equal(freshMailQueue.overduePending, 0);
  await inspectPool.query("UPDATE lead_email_outbox SET created_at = now() - interval '31 minutes' WHERE lead_id = $1 AND recipient_role = 'customer'", [first.lead.id]);
  const overdueMailQueue = await getLeadEmailOutboxAttention();
  assert.equal(overdueMailQueue.pending, 2);
  assert.equal(overdueMailQueue.overduePending, 1);
  assert.equal(overdueMailQueue.oldestAttentionLeadId, first.lead.id);
  await inspectPool.query("UPDATE lead_email_outbox SET status = 'unknown', created_at = now() WHERE lead_id = $1 AND recipient_role = 'customer'", [first.lead.id]);
  const unknownMailQueue = await getLeadEmailOutboxAttention();
  assert.equal(unknownMailQueue.unknown, 1);
  assert.equal(unknownMailQueue.overduePending, 0);
  assert.equal(unknownMailQueue.oldestAttentionLeadId, first.lead.id);
  await inspectPool.query("UPDATE lead_email_outbox SET status = 'pending' WHERE lead_id = $1 AND recipient_role = 'customer'", [first.lead.id]);
  await inspectPool.query("UPDATE lead_email_outbox SET status = 'sending', locked_at = now() - interval '16 minutes' WHERE lead_id = $1 AND recipient_role = 'internal'", [first.lead.id]);
  const staleSendingQueue = await getLeadEmailOutboxAttention();
  assert.equal(staleSendingQueue.staleSending, 1);
  assert.equal(staleSendingQueue.oldestAttentionLeadId, first.lead.id);
  await inspectPool.query("UPDATE lead_email_outbox SET locked_at = NULL, retryable = true, updated_at = now() - interval '16 minutes' WHERE lead_id = $1 AND recipient_role = 'internal'", [first.lead.id]);
  assert.equal((await getLeadEmailOutboxAttention()).staleSending, 1, 'orphaned sending without a lock is visible to the monitor');
  await markStaleLeadEmailClaimsUnknown();
  const recoveredOrphanedSend = await inspectPool.query("SELECT status, retryable FROM lead_email_outbox WHERE lead_id = $1 AND recipient_role = 'internal'", [first.lead.id]);
  assert.equal(recoveredOrphanedSend.rows[0].status, 'unknown', 'orphaned sending becomes unknown, never an automatic retry');
  assert.equal(recoveredOrphanedSend.rows[0].retryable, false);
  const manualRetryEnv = { mode: process.env.LEAD_EMAIL_DELIVERY_MODE, host: process.env.SMTP_HOST, to: process.env.LEAD_TO_EMAIL, from: process.env.FROM_EMAIL };
  process.env.LEAD_EMAIL_DELIVERY_MODE = 'smtp_then_local_relay';
  process.env.SMTP_HOST = 'smtp.invalid';
  process.env.LEAD_TO_EMAIL = 'admin@astana.sk';
  process.env.FROM_EMAIL = 'info@astana.sk';
  assert.equal(await prepareLeadEmailRecipientManualRetry(first.lead.id, 'internal', 'admin@example.invalid', 'provider_rejected'), false, 'unknown cannot be resent even with a strong evidence code');
  await inspectPool.query("UPDATE lead_email_outbox SET status = 'failed', retryable = true, next_attempt_at = now() - interval '1 minute' WHERE lead_id = $1 AND recipient_role = 'internal'", [first.lead.id]);
  assert.equal(await prepareLeadEmailRecipientManualRetry(first.lead.id, 'internal', 'admin@example.invalid', 'provider_rejected'), false, 'automatic retryable failure is not a manually resolved non-delivery');
  const automaticRetryToken = await claimLeadEmailOutbox(first.lead.id, 'internal');
  assert.ok(automaticRetryToken, 'a retryable failed recipient can be claimed');
  const claimedRetry = await inspectPool.query("SELECT status, retryable FROM lead_email_outbox WHERE lead_id = $1 AND recipient_role = 'internal'", [first.lead.id]);
  assert.equal(claimedRetry.rows[0].status, 'sending');
  assert.equal(claimedRetry.rows[0].retryable, false, 'claiming clears the old retry permission before an uncertain outcome');
  assert.equal(await recordLeadEmailRecipientResult(first.lead.id, 'internal', {
    status: 'failed', retryable: true, reason: 'SMTP refused integration-test@example.invalid', messageId: '<integration-test@example.invalid>',
  }, automaticRetryToken), true);
  const safeFailedResult = await inspectPool.query("SELECT last_error, message_id FROM lead_email_outbox WHERE lead_id = $1 AND recipient_role = 'internal'", [first.lead.id]);
  assert.equal(safeFailedResult.rows[0].last_error, 'Odoslanie zlyhalo.');
  assert.doesNotMatch(JSON.stringify(safeFailedResult.rows[0]), /integration-test@example\.invalid/);
  await inspectPool.query("UPDATE lead_email_outbox SET status = 'pending', retryable = false, attempts = 0, locked_at = NULL WHERE lead_id = $1 AND recipient_role = 'internal'", [first.lead.id]);
  await inspectPool.query("UPDATE lead_email_outbox SET status = 'unknown', retryable = false WHERE lead_id = $1 AND recipient_role = 'customer'", [first.lead.id]);
  const beforeUnsafeRetry = await inspectPool.query("SELECT attempts FROM lead_email_outbox WHERE lead_id = $1 AND recipient_role = 'customer'", [first.lead.id]);
  assert.equal(await prepareLeadEmailRecipientManualRetry(first.lead.id, 'customer', 'admin@example.invalid', 'provider_rejected'), false, 'direct DB retry must reject unresolved unknown');
  assert.equal((await inspectPool.query("SELECT attempts FROM lead_email_outbox WHERE lead_id = $1 AND recipient_role = 'customer'", [first.lead.id])).rows[0].attempts, beforeUnsafeRetry.rows[0].attempts, 'rejected retry must not claim or increment the attempt');
  assert.equal(await resolveLeadEmailRecipientDelivery(first.lead.id, 'customer', 'sent', 'admin@example.invalid', 'provider_accepted', 'yes'), false, 'provider acceptance is not proof of inbox delivery');
  assert.equal(await resolveLeadEmailRecipientDelivery(first.lead.id, 'customer', 'failed', 'admin@example.invalid', 'inbox_no_message', 'yes'), false, 'missing inbox message is not proof of non-delivery');
  assert.equal(await resolveLeadEmailRecipientDelivery(first.lead.id, 'customer', 'sent', 'admin@example.invalid', 'inbox_message_found', ''), false, 'direct DB resolution requires the explicit checked-delivery attestation');
  await inspectPool.query(`
    CREATE FUNCTION fail_lead_email_resolution_audit() RETURNS trigger AS $$
    BEGIN
      IF NEW.action = 'lead_email_delivery_resolved' THEN RAISE EXCEPTION 'ASTANA_TEST_FORCED_LEAD_EMAIL_AUDIT_FAILURE'; END IF;
      RETURN NEW;
    END; $$ LANGUAGE plpgsql;
    CREATE TRIGGER fail_lead_email_resolution_audit_trigger BEFORE INSERT ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION fail_lead_email_resolution_audit();
  `);
  await assert.rejects(resolveLeadEmailRecipientDelivery(first.lead.id, 'customer', 'sent', 'admin@example.invalid', 'inbox_message_found', 'yes'), /ASTANA_TEST_FORCED_LEAD_EMAIL_AUDIT_FAILURE/);
  const unresolvedAfterAuditFailure = await inspectPool.query("SELECT status FROM lead_email_outbox WHERE lead_id = $1 AND recipient_role = 'customer'", [first.lead.id]);
  assert.equal(unresolvedAfterAuditFailure.rows[0].status, 'unknown', 'audit failure rolls back the resolution status');
  await inspectPool.query('DROP TRIGGER fail_lead_email_resolution_audit_trigger ON audit_logs');
  await inspectPool.query('DROP FUNCTION fail_lead_email_resolution_audit()');
  assert.equal(await resolveLeadEmailRecipientDelivery(first.lead.id, 'customer', 'sent', 'admin@example.invalid', 'inbox_message_found', 'yes'), true);
  const healthAfterConfirmedDelivery = await getSystemHealth();
  assert.equal(healthAfterConfirmedDelivery.lastEmailSent?.entityId, first.lead.id);
  assert.equal(healthAfterConfirmedDelivery.lastEmailSent?.action, 'lead_email_delivery_resolved', 'inbox-confirmed delivery must appear in PostgreSQL admin health');
  assert.equal(await resolveLeadEmailRecipientDelivery(first.lead.id, 'customer', 'failed', 'admin@example.invalid', 'inbox_message_found', 'yes'), false, 'already resolved email cannot be changed again');
  assert.equal(await prepareLeadEmailRecipientManualRetry(first.lead.id, 'customer', 'admin@example.invalid', 'inbox_message_found'), false, 'confirmed delivery cannot be resent');
  await inspectPool.query("UPDATE lead_email_outbox SET status = 'failed', retryable = false, last_error = 'Provider rejected without admin resolution' WHERE lead_id = $1 AND recipient_role = 'internal'", [first.lead.id]);
  assert.equal(await prepareLeadEmailRecipientManualRetry(first.lead.id, 'internal', 'admin@example.invalid', 'provider_rejected'), false, 'failed without a separate resolution is not a manual retry candidate');
  assert.equal(await resolveLeadEmailRecipientDelivery(first.lead.id, 'internal', 'sent', 'admin@example.invalid', 'inbox_message_found', 'yes'), false, 'failed cannot be relabelled delivered by this path');
  assert.equal(await resolveLeadEmailRecipientDelivery(first.lead.id, 'internal', 'failed', 'admin@example.invalid', 'provider_rejected', 'yes'), true, 'definitive failed can be separately confirmed before retry');
  const manualRetryAudit = await inspectPool.query("SELECT action, changes FROM audit_logs WHERE entity_id = $1 AND action = 'lead_email_delivery_resolved' ORDER BY created_at DESC LIMIT 1", [first.lead.id]);
  assert.equal(manualRetryAudit.rows[0].changes.outcome, 'failed');
  assert.equal(manualRetryAudit.rows[0].changes.evidence, 'provider_rejected');
  assert.equal(await prepareLeadEmailRecipientManualRetry(first.lead.id, 'internal', 'admin@example.invalid', 'inbox_no_message'), false, 'weak retry evidence cannot start a send');
  const beforeMissingSmtp = (await inspectPool.query("SELECT attempts FROM lead_email_outbox WHERE lead_id = $1 AND recipient_role = 'internal'", [first.lead.id])).rows[0].attempts;
  delete process.env.SMTP_HOST;
  assert.equal(await prepareLeadEmailRecipientManualRetry(first.lead.id, 'internal', 'admin@example.invalid', 'provider_rejected'), false, 'hybrid mode without SMTP must not claim a manual retry');
  assert.equal((await inspectPool.query("SELECT attempts FROM lead_email_outbox WHERE lead_id = $1 AND recipient_role = 'internal'", [first.lead.id])).rows[0].attempts, beforeMissingSmtp);
  process.env.SMTP_HOST = 'smtp.invalid';
  assert.ok(await prepareLeadEmailRecipientManualRetry(first.lead.id, 'internal', 'admin@example.invalid', 'provider_rejected'), 'confirmed nondelivery enables an explicit retry');
  const retryAudit = await inspectPool.query("SELECT action FROM audit_logs WHERE entity_id = $1 AND action = 'lead_email_manual_retry_started' ORDER BY created_at DESC LIMIT 1", [first.lead.id]);
  assert.equal(retryAudit.rowCount, 1, 'retry claim and its audit are committed together');
  for (const [key, value] of Object.entries({ LEAD_EMAIL_DELIVERY_MODE: manualRetryEnv.mode, SMTP_HOST: manualRetryEnv.host, LEAD_TO_EMAIL: manualRetryEnv.to, FROM_EMAIL: manualRetryEnv.from })) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  await inspectPool.query("UPDATE lead_email_outbox SET status = 'pending', retryable = false, attempts = 0, locked_at = NULL WHERE lead_id = $1", [first.lead.id]);
  assert.deepEqual(await recoverAcceptedLeadAnalytics(10), { recovered: 1, remaining: false, failed: false, unrecoverable: 0 }, 'scheduled recovery writes a missing accepted conversion');
  await recordAcceptedLeadAnalytics(first.lead);
  await recordAcceptedLeadAnalytics(first.lead);
  const acceptedAnalytics = await inspectPool.query('SELECT id, created_at, session_id, event_type, path, utm_source, utm_medium, utm_campaign, metadata FROM analytics_events WHERE id = $1', [first.lead.id]);
  assert.equal(acceptedAnalytics.rowCount, 1, 'accepted lead analytics is idempotent by stored lead id');
  assert.equal(acceptedAnalytics.rows[0].session_id, analyticsSessionId);
  assert.equal(acceptedAnalytics.rows[0].event_type, 'form_submit_success');
  assert.equal(new Date(acceptedAnalytics.rows[0].created_at).toISOString(), first.lead.createdAt, 'recovered conversion keeps the original lead submission timestamp');
  assert.equal(acceptedAnalytics.rows[0].path, '/cena-likvidacie-azbestu/');
  assert.equal(acceptedAnalytics.rows[0].utm_campaign, 'strecha Poprad');
  assert.equal(acceptedAnalytics.rows[0].metadata.adClickIds.gclid, 'consented-test-click-id');
  assert.equal(JSON.stringify(acceptedAnalytics.rows[0]).includes('integration-test@example.invalid'), false, 'analytics event must not include customer contact data');
  const noConsentId = randomUUID();
  const noConsentLead = await createLeadSubmission(makeInput(noConsentId, `hash-${noConsentId}`, { rawData: { attribution: { utmSource: 'google' } } }), []);
  await recordAcceptedLeadAnalytics(noConsentLead.lead);
  assert.deepEqual(await recoverAcceptedLeadAnalytics(10), { recovered: 0, remaining: false, failed: false, unrecoverable: 0 }, 'scheduled recovery never tracks leads without analytics consent');

  const recoveryLeadIds = [randomUUID(), randomUUID()];
  const recoveryLeads = [];
  for (const id of recoveryLeadIds) {
    const recoveredLead = await createLeadSubmission(makeInput(id, `hash-${id}`, {
      rawData: { analyticsConsentAtSubmit: true, analyticsSessionId: randomUUID(), userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile', attribution: { landingPath: '/mobile/' } },
    }), []);
    recoveryLeads.push(recoveredLead.lead);
  }
  assert.deepEqual(await recoverAcceptedLeadAnalytics(1), { recovered: 1, remaining: true, failed: false, unrecoverable: 0 }, 'look-ahead identifies a genuinely pending recovery batch');
  assert.deepEqual(await recoverAcceptedLeadAnalytics(1), { recovered: 1, remaining: false, failed: false, unrecoverable: 0 }, 'a full but final recovery batch does not falsely keep cron unhealthy');
  const mobileConversion = await inspectPool.query('SELECT device FROM analytics_events WHERE id = $1', [recoveryLeads[0].id]);
  assert.equal(mobileConversion.rows[0].device, 'mobile');
  const invalidSessionId = randomUUID();
  const invalidSessionLead = await createLeadSubmission(makeInput(invalidSessionId, `hash-${invalidSessionId}`, {
    rawData: { analyticsConsentAtSubmit: true, analyticsSessionId: 'invalid-session' },
  }), []);
  assert.deepEqual(await recoverAcceptedLeadAnalytics(1), { recovered: 0, remaining: false, failed: false, unrecoverable: 1 }, 'invalid consented legacy session is surfaced separately without blocking valid recoveries');
  assert.equal((await inspectPool.query('SELECT 1 FROM analytics_events WHERE id = $1', [invalidSessionLead.lead.id])).rowCount, 0);
  const validBehindInvalidId = randomUUID();
  const validBehindInvalid = await createLeadSubmission(makeInput(validBehindInvalidId, `hash-${validBehindInvalidId}`, {
    rawData: { analyticsConsentAtSubmit: true, analyticsSessionId: randomUUID() },
  }), []);
  assert.deepEqual(await recoverAcceptedLeadAnalytics(1), { recovered: 1, remaining: false, failed: false, unrecoverable: 1 }, 'unrecoverable legacy records do not block later valid leads');
  assert.equal((await inspectPool.query('SELECT 1 FROM analytics_events WHERE id = $1', [validBehindInvalid.lead.id])).rowCount, 1);
  const batchAttempts = [];
  const partialBatch = await persistAcceptedLeadAnalyticsBatch(['first', 'fails', 'last'], async (item) => {
    batchAttempts.push(item);
    if (item === 'fails') throw new Error('synthetic recovery write failure');
    return { id: item };
  });
  assert.deepEqual(partialBatch, { recovered: 2, failed: true }, 'one transient row failure preserves successful counts and does not stop later rows');
  assert.deepEqual(batchAttempts, ['first', 'fails', 'last']);
  assert.equal((await inspectPool.query('SELECT 1 FROM analytics_events WHERE id = $1', [noConsentLead.lead.id])).rowCount, 0, 'no event without analytics consent recorded at submission');
  assert.deepEqual((await getLeadAttributionReport(30)).find((row) => row.campaign === 'strecha Poprad'), {
    source: 'google', medium: 'cpc', campaign: 'strecha Poprad', leads: 1, leadsWithIssuedOffer: 0, leadsWithAcceptedOffer: 0, progressedLeads: 0,
  });
  const gbraidLeadId = randomUUID();
  const wbraidLeadId = randomUUID();
  await createLeadSubmission(makeInput(gbraidLeadId, `hash-${gbraidLeadId}`, {
    rawData: { attribution: { gbraid: 'test-google-gbraid' } },
  }), []);
  await createLeadSubmission(makeInput(wbraidLeadId, `hash-${wbraidLeadId}`, {
    rawData: { attribution: { wbraid: 'test-google-wbraid' } },
  }), []);
  assert.deepEqual((await getLeadAttributionReport(30)).find((row) => row.source === 'Google Ads'), {
    source: 'Google Ads', medium: 'Neuvedené', campaign: 'Bez označenia', leads: 2, leadsWithIssuedOffer: 0, leadsWithAcceptedOffer: 0, progressedLeads: 0,
  }, 'PGlite report maps gbraid and wbraid to Google Ads');
  await inspectPool.query(`
    INSERT INTO quotes (id, lead_id, quote_number, status, valid_until, area_estimate, price_per_m2, total_without_vat, total_with_vat, created_by)
    VALUES
      ($1, $5, 'TEST-ATTR-DRAFT', 'draft', CURRENT_DATE, 100, 10, 1000, 1230, 'integration-test'),
      ($2, $5, 'TEST-ATTR-SENT', 'sent', CURRENT_DATE, 100, 10, 1000, 1230, 'integration-test'),
      ($3, $5, 'TEST-ATTR-ACCEPTED', 'accepted', CURRENT_DATE, 100, 10, 1000, 1230, 'integration-test'),
      ($4, $5, 'TEST-ATTR-CANCELLED', 'cancelled', CURRENT_DATE, 100, 10, 1000, 1230, 'integration-test')
  `, [randomUUID(), randomUUID(), randomUUID(), randomUUID(), first.lead.id]);
  assert.deepEqual((await getLeadAttributionReport(30)).find((row) => row.campaign === 'strecha Poprad'), {
    source: 'google', medium: 'cpc', campaign: 'strecha Poprad', leads: 1, leadsWithIssuedOffer: 1, leadsWithAcceptedOffer: 1, progressedLeads: 0,
  });
  assert.deepEqual(
    first.files.map(({ originalName, storageDriver, storageKey, mimeType, sizeBytes }) => ({ originalName, storageDriver, storageKey, mimeType, sizeBytes }))
      .sort((a, b) => a.originalName.localeCompare(b.originalName)),
    attachments.map(({ originalName, storageDriver, storageKey, mimeType, sizeBytes }) => ({ originalName, storageDriver, storageKey, mimeType, sizeBytes }))
      .sort((a, b) => a.originalName.localeCompare(b.originalName)),
  );

  const readSubmissionSnapshot = async () => {
    const result = await inspectPool.query(
      `SELECT
        (SELECT to_jsonb(l) FROM leads l WHERE l.id = $2) AS lead,
        (SELECT to_jsonb(j) FROM business_jobs j WHERE j.id = $1) AS job,
        (SELECT to_jsonb(c) FROM business_job_costs c WHERE c.job_id = $1) AS costs,
        (SELECT COALESCE(jsonb_agg(to_jsonb(f) ORDER BY f.original_name, f.id), '[]'::jsonb) FROM lead_files f WHERE f.lead_id = $2) AS files,
        (SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.entity_type, a.action, a.id), '[]'::jsonb) FROM audit_logs a WHERE a.entity_id IN ($2, $1)) AS audits,
        (SELECT COALESCE(jsonb_agg(to_jsonb(o) ORDER BY o.recipient_role), '[]'::jsonb) FROM lead_email_outbox o WHERE o.lead_id = $2) AS outbox`,
      [first.businessJobId, first.lead.id],
    );
    return result.rows[0];
  };
  const beforeRetry = await readSubmissionSnapshot();
  assert.equal(beforeRetry.lead.full_name, 'Test integračného formulára');
  assert.equal(beforeRetry.lead.phone, '+421900000001');
  assert.equal(beforeRetry.lead.email, 'integration-test@example.invalid');
  assert.equal(beforeRetry.job.customer_name, 'Test integračného formulára');
  assert.equal(beforeRetry.job.customer_phone, '+421900000001');
  assert.equal(beforeRetry.job.customer_email, 'integration-test@example.invalid');
  assert.deepEqual(beforeRetry.costs, {
    job_id: first.businessJobId,
    fuel: 0,
    suits: 0,
    gloves: 0,
    penetrant: 0,
    landfill_cost: 0,
    other_name: '',
    other_amount: 0,
    total: 0,
  });
  assert.deepEqual(beforeRetry.audits.map((row) => row.action).filter((action) => ['business_job_created', 'business_job_lead_received', 'files_uploaded', 'lead_created'].includes(action)).sort(), [
    'business_job_created',
    'business_job_lead_received',
    'files_uploaded',
    'lead_created',
  ]);
  assert.deepEqual(beforeRetry.outbox.map((row) => `${row.recipient_role}:${row.status}`).sort(), ['customer:pending', 'internal:pending']);
  assert.equal(beforeRetry.files.length, 2);

  const duplicate = await createLeadSubmission(makeInput(submissionId, 'hash-1'), attachments);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.lead.id, first.lead.id);
  assert.equal(duplicate.businessJobId, first.businessJobId);
  assert.equal(duplicate.files.length, 2);
  assert.deepEqual(
    duplicate.files.map(({ id, originalName, storageDriver, storageKey, mimeType, sizeBytes }) => ({ id, originalName, storageDriver, storageKey, mimeType, sizeBytes })),
    first.files.map(({ id, originalName, storageDriver, storageKey, mimeType, sizeBytes }) => ({ id, originalName, storageDriver, storageKey, mimeType, sizeBytes })),
  );
  assert.deepEqual(await readSubmissionSnapshot(), beforeRetry, 'rovnaké ID a odtlačok nesmú zmeniť žiadny uložený záznam');

  await assert.rejects(
    createLeadSubmission(makeInput(submissionId, 'different-hash'), attachments),
    (error) => error instanceof LeadSubmissionConflictError,
  );

  const persisted = await inspectPool.query(
    `SELECT
      (SELECT count(*)::int FROM leads WHERE submission_id = $1) AS leads,
      (SELECT count(*)::int FROM business_jobs WHERE lead_id = $2) AS jobs,
      (SELECT count(*)::int FROM lead_files WHERE lead_id = $2) AS files,
      (SELECT count(*)::int FROM lead_email_outbox WHERE lead_id = $2) AS outbox`,
    [submissionId, first.lead.id],
  );
  assert.deepEqual(persisted.rows[0], { leads: 1, jobs: 1, files: 2, outbox: 2 });
  assert.deepEqual(await readSubmissionSnapshot(), beforeRetry, 'konfliktné ID nesmie prepísať ani doplniť existujúce údaje');

  const queuedFile = first.files[0];
  await inspectPool.query(`
    CREATE FUNCTION fail_lead_file_deletion_audit() RETURNS trigger AS $$
    BEGIN
      IF NEW.action = 'lead_file_deletion_queued' THEN RAISE EXCEPTION 'ASTANA_TEST_FORCED_FILE_DELETE_AUDIT_FAILURE'; END IF;
      RETURN NEW;
    END; $$ LANGUAGE plpgsql;
    CREATE TRIGGER fail_lead_file_deletion_audit_trigger BEFORE INSERT ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION fail_lead_file_deletion_audit();
  `);
  await assert.rejects(deleteLeadFileRecord(queuedFile.id, 'admin@example.invalid'), /ASTANA_TEST_FORCED_FILE_DELETE_AUDIT_FAILURE/);
  const fileAfterAuditFailure = await inspectPool.query('SELECT id FROM lead_files WHERE id = $1', [queuedFile.id]);
  const jobAfterAuditFailure = await inspectPool.query('SELECT id FROM lead_file_deletion_jobs WHERE file_id = $1', [queuedFile.id]);
  assert.equal(fileAfterAuditFailure.rowCount, 1, 'audit failure preserves the existing attachment record');
  assert.equal(jobAfterAuditFailure.rowCount, 0, 'audit failure rolls back the deletion job together with the file detachment');
  await inspectPool.query('DROP TRIGGER fail_lead_file_deletion_audit_trigger ON audit_logs');
  await inspectPool.query('DROP FUNCTION fail_lead_file_deletion_audit()');
  assert.ok(await deleteLeadFileRecord(queuedFile.id, 'admin@example.invalid'));
  const queuedDeletion = await inspectPool.query('SELECT status FROM lead_file_deletion_jobs WHERE file_id = $1', [queuedFile.id]);
  assert.equal(queuedDeletion.rows[0].status, 'pending', 'storage deletion is durably queued before the record is removed');
  const deletionAudit = await inspectPool.query("SELECT action FROM audit_logs WHERE entity_id = $1 AND action = 'lead_file_deletion_queued'", [first.lead.id]);
  assert.equal(deletionAudit.rowCount, 1, 'file detachment and deletion audit are committed together');
  const deletionClaims = await claimLeadFileDeletionJobs(10);
  const deletionClaim = deletionClaims.find((job) => job.fileId === queuedFile.id);
  assert.ok(deletionClaim?.claimId);
  assert.equal(await failLeadFileDeletionJob(deletionClaim.id, deletionClaim.claimId, 'simulated storage failure'), true);
  await inspectPool.query("UPDATE lead_file_deletion_jobs SET next_attempt_at = now() - interval '1 second' WHERE id = $1", [deletionClaim.id]);
  const retryClaims = await claimLeadFileDeletionJobs(10);
  const retryClaim = retryClaims.find((job) => job.id === deletionClaim.id);
  assert.ok(retryClaim?.claimId, 'a failed storage deletion remains retryable');
  assert.equal(await completeLeadFileDeletionJob(retryClaim.id, retryClaim.claimId), true);
  const completedDeletion = await inspectPool.query('SELECT status, deleted_at FROM lead_file_deletion_jobs WHERE id = $1', [retryClaim.id]);
  assert.equal(completedDeletion.rows[0].status, 'deleted');
  assert.ok(completedDeletion.rows[0].deleted_at);

  const purgeSubmissionId = randomUUID();
  const purgeLead = await createLeadSubmission(makeInput(purgeSubmissionId, `purge-${purgeSubmissionId}`), [{
    leadId: randomUUID(), originalName: 'purge-test.jpg', storageDriver: 'vercel_blob',
    storageKey: `private/integration-test/${purgeSubmissionId}/purge.jpg`, mimeType: 'image/jpeg', sizeBytes: 1200,
  }]);
  assert.ok((await listPendingLeadEmailDeliveries()).some((row) => row.lead.id === purgeLead.lead.id));
  const activeSendToken = await claimLeadEmailOutbox(purgeLead.lead.id, 'internal');
  assert.ok(activeSendToken);
  assert.equal(await archiveLead(purgeLead.lead.id, 'admin@example.invalid', 'Počas odosielania'), null, 'archive must wait for active send claim');
  const priorAuthSecret = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = 'isolated-hmac-only-test-secret';
  assert.equal(await recordLeadEmailRecipientResult(purgeLead.lead.id, 'internal', {
    status: 'unknown', messageId: '<customer-pii@example.invalid>', reason: 'SMTP raw error: customer-pii@example.invalid', retryable: false,
  }, activeSendToken), true);
  const safeEmailResult = await inspectPool.query("SELECT message_id, last_error FROM lead_email_outbox WHERE lead_id = $1 AND recipient_role = 'internal'", [purgeLead.lead.id]);
  assert.match(safeEmailResult.rows[0].message_id, /^hmac-sha256:[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(safeEmailResult.rows[0]), /customer-pii@example\.invalid/);
  const resultAudit = await inspectPool.query("SELECT changes FROM audit_logs WHERE entity_id = $1 AND action = 'lead_email_delivery_unknown'", [purgeLead.lead.id]);
  assert.equal(resultAudit.rows[0].changes.reasonCode, 'delivery_unknown');
  assert.doesNotMatch(JSON.stringify(resultAudit.rows[0].changes), /customer-pii@example\.invalid/);
  await addAuditLog('lead', purgeLead.lead.id, 'lead_email_error', 'system:test', { reason: 'customer-pii@example.invalid', messageId: '<customer-pii@example.invalid>', customerStatus: 'unknown' });
  const aggregateAudit = await inspectPool.query("SELECT changes FROM audit_logs WHERE entity_id = $1 AND action = 'lead_email_error' ORDER BY created_at DESC LIMIT 1", [purgeLead.lead.id]);
  assert.doesNotMatch(JSON.stringify(aggregateAudit.rows[0].changes), /customer-pii@example\.invalid/);
  if (priorAuthSecret === undefined) delete process.env.AUTH_SECRET; else process.env.AUTH_SECRET = priorAuthSecret;
  assert.ok(await archiveLead(purgeLead.lead.id, 'admin@example.invalid', 'Izolovaný test odstránenia'));
  const frozenOutbox = await inspectPool.query('SELECT status, retryable, attempts FROM lead_email_outbox WHERE lead_id = $1 ORDER BY recipient_role', [purgeLead.lead.id]);
  assert.ok(frozenOutbox.rows.every((row) => row.status === 'unknown' && row.retryable === false));
  assert.equal((await listPendingLeadEmailDeliveries()).some((row) => row.lead.id === purgeLead.lead.id), false);
  assert.equal(await claimLeadEmailOutbox(purgeLead.lead.id, 'customer'), false);
  assert.equal(await resolveLeadEmailRecipientDelivery(purgeLead.lead.id, 'internal', 'failed', 'admin@example.invalid', 'provider_rejected', 'yes'), false);
  await inspectPool.query("UPDATE lead_email_outbox SET status = 'pending' WHERE lead_id = $1 AND recipient_role = 'customer'", [purgeLead.lead.id]);
  assert.equal((await listPendingLeadEmailDeliveries()).some((row) => row.lead.id === purgeLead.lead.id), false, 'legacy pending archived lead is excluded before cron limit');
  assert.equal(await claimLeadEmailOutbox(purgeLead.lead.id, 'customer'), false, 'direct claim rejects archived lead even with pending row');
  assert.equal((await inspectPool.query("SELECT attempts FROM lead_email_outbox WHERE lead_id = $1 AND recipient_role = 'customer'", [purgeLead.lead.id])).rows[0].attempts, frozenOutbox.rows.find((row) => row.attempts === 0)?.attempts ?? 0);
  assert.ok(await restoreLead(purgeLead.lead.id, 'admin@example.invalid'));
  assert.equal((await listPendingLeadEmailDeliveries()).some((row) => row.lead.id === purgeLead.lead.id), false, 'restore cannot automatically send old email');
  assert.equal((await inspectPool.query("SELECT status FROM lead_email_outbox WHERE lead_id = $1 AND recipient_role = 'customer'", [purgeLead.lead.id])).rows[0].status, 'unknown', 'restore freezes a legacy archived pending row');
  assert.ok(await archiveLead(purgeLead.lead.id, 'admin@example.invalid', 'Opätovná archivácia'));
  await inspectPool.query(
    "INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_email, changes, created_at) VALUES ($1,'lead',$2,'historic_unsafe_error','system:test',$3,now())",
    [randomUUID(), purgeLead.lead.id, { rawReason: 'customer-pii@example.invalid' }],
  );
  assert.ok(await destroyArchivedLead(purgeLead.lead.id, 'admin@example.invalid', 'customer-pii@example.invalid'));
  const purgeState = await inspectPool.query(
    `SELECT (SELECT count(*)::int FROM leads WHERE id = $1) AS leads,
            (SELECT count(*)::int FROM lead_file_deletion_jobs WHERE lead_id = $1 AND status = 'pending') AS pending_deletions,
            (SELECT count(*)::int FROM lead_email_outbox WHERE lead_id = $1) AS outbox,
            (SELECT count(*)::int FROM audit_logs WHERE entity_type = 'lead' AND entity_id = $1) AS remaining_lead_audits,
            (SELECT count(*)::int FROM audit_logs WHERE entity_id = $1 AND action = 'lead_deleted') AS delete_audits`,
    [purgeLead.lead.id],
  );
  assert.deepEqual(purgeState.rows[0], { leads: 0, pending_deletions: 1, outbox: 0, remaining_lead_audits: 1, delete_audits: 1 }, 'lead deletion purges old lead email/audit data and leaves one minimal deletion record');
  const survivingAudit = await inspectPool.query("SELECT changes FROM audit_logs WHERE entity_type = 'lead' AND entity_id = $1", [purgeLead.lead.id]);
  assert.doesNotMatch(JSON.stringify(survivingAudit.rows[0].changes), /customer-pii@example\.invalid/);

  // Inject a deterministic SQL failure midway through the next write transaction.
  const failingSubmissionId = randomUUID();
  const failingFullName = `Rollback test ${failingSubmissionId}`;
  const failingAttachments = attachments.map((file, index) => ({
    ...file,
    storageKey: `private/integration-test/${failingSubmissionId}/${index + 1}.jpg`,
  }));
  const failingDirectStorageKey = `lead-drafts/${failingSubmissionId}/${randomUUID()}.jpg`;
  await reserveLeadUploadDraft(failingSubmissionId, failingDirectStorageKey);
  await markLeadUploadDraftUploaded(failingSubmissionId, failingDirectStorageKey);
  failingAttachments.push({
    leadId: randomUUID(),
    originalName: 'rollback-fotka.jpg',
    storageDriver: 'vercel_blob',
    storageKey: failingDirectStorageKey,
    mimeType: 'image/jpeg',
    sizeBytes: 1024,
  });
  const beforeFailure = await inspectPool.query(
    'SELECT (SELECT count(*)::int FROM business_job_costs) AS costs, (SELECT count(*)::int FROM audit_logs) AS audits',
  );
  await inspectPool.query(`
    CREATE FUNCTION astana_test_fail_internal_outbox() RETURNS trigger
    LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.dedupe_key = 'lead:${failingSubmissionId}:internal' THEN
        RAISE EXCEPTION 'ASTANA_TEST_FORCED_OUTBOX_FAILURE';
      END IF;
      RETURN NEW;
    END;
    $$;
    CREATE TRIGGER astana_test_fail_internal_outbox_trigger
      BEFORE INSERT ON lead_email_outbox
      FOR EACH ROW EXECUTE FUNCTION astana_test_fail_internal_outbox();
  `);
  await assert.rejects(createLeadSubmission(
    makeInput(failingSubmissionId, 'hash-failure', { fullName: failingFullName }),
    failingAttachments,
  ), /ASTANA_TEST_FORCED_OUTBOX_FAILURE/);
  await inspectPool.query('DROP TRIGGER astana_test_fail_internal_outbox_trigger ON lead_email_outbox');
  await inspectPool.query('DROP FUNCTION astana_test_fail_internal_outbox()');
  const rolledBack = await inspectPool.query(
    `SELECT
      (SELECT count(*)::int FROM leads WHERE submission_id = $1) AS leads,
      (SELECT count(*)::int FROM business_jobs WHERE customer_name = $2) AS jobs,
      (SELECT count(*)::int FROM lead_files WHERE storage_key LIKE $3) AS files,
      (SELECT count(*)::int FROM lead_email_outbox WHERE dedupe_key LIKE $4) AS outbox,
      (SELECT count(*)::int FROM audit_logs) AS audits,
      (SELECT count(*)::int FROM business_job_costs) AS costs`,
    [failingSubmissionId, failingFullName, `%/${failingSubmissionId}/%`, `lead:${failingSubmissionId}:%`],
  );
  assert.deepEqual(rolledBack.rows[0], {
    leads: 0,
    jobs: 0,
    files: 0,
    outbox: 0,
    audits: beforeFailure.rows[0].audits,
    costs: beforeFailure.rows[0].costs,
  });
  const uncommittedAttachment = await inspectPool.query(
    'SELECT status, lead_id FROM lead_upload_drafts WHERE storage_key = $1',
    [failingDirectStorageKey],
  );
  assert.deepEqual(uncommittedAttachment.rows[0], { status: 'uploaded', lead_id: null }, 'rollback nesmie označiť súkromnú fotku ako pripojenú k neuloženému dopytu');

  const directSubmissionId = randomUUID();
  const directStorageKey = `lead-drafts/${directSubmissionId}/${randomUUID()}.jpg`;
  await reserveLeadUploadDraft(directSubmissionId, directStorageKey);
  await markLeadUploadDraftUploaded(directSubmissionId, directStorageKey);
  const directFile = {
    leadId: randomUUID(),
    originalName: 'overena-fotka.jpg',
    storageDriver: 'vercel_blob',
    storageKey: directStorageKey,
    mimeType: 'image/jpeg',
    sizeBytes: 4096,
  };
  const directLead = await createLeadSubmission(makeInput(directSubmissionId, 'direct-photo-hash'), [directFile]);
  assert.equal(directLead.duplicate, false);
  assert.equal(directLead.files.length, 1);
  const attachedDraft = await inspectPool.query(
    'SELECT status, lead_id, submission_id FROM lead_upload_drafts WHERE storage_key = $1',
    [directStorageKey],
  );
  assert.deepEqual(attachedDraft.rows[0], { status: 'attached', lead_id: directLead.lead.id, submission_id: directSubmissionId });
  await markLeadUploadDraftUploaded(directSubmissionId, directStorageKey);
  const remainsAttached = await inspectPool.query('SELECT status, lead_id FROM lead_upload_drafts WHERE storage_key = $1', [directStorageKey]);
  assert.deepEqual(remainsAttached.rows[0], { status: 'attached', lead_id: directLead.lead.id });
  await assert.rejects(reserveLeadUploadDraft(directSubmissionId, directStorageKey), /už bola priradená/);

  const cappedSubmissionId = randomUUID();
  const cappedKeys = Array.from({ length: 10 }, () => `lead-drafts/${cappedSubmissionId}/${randomUUID()}.jpg`);
  const modernReservation = (key) => reserveLeadUploadDraft(cappedSubmissionId, key, undefined, 'vercel_blob', createHash('sha256').update(key).digest('hex'));
  const concurrentReservations = await Promise.all(cappedKeys.slice(0, 3).map(modernReservation));
  assert.equal(concurrentReservations.length, 3, 'paralelné rezervácie v rámci dostupnej izolovanej DB kapacity musia prejsť');
  for (const key of cappedKeys.slice(3)) await modernReservation(key);
  await reserveLeadUploadDraft(cappedSubmissionId, cappedKeys[0]);
  await assert.rejects(
    modernReservation(`lead-drafts/${cappedSubmissionId}/${randomUUID()}.jpg`),
    /najviac 10 súborov/,
  );

  const legacyRetryId = randomUUID();
  const legacyFirstKeys = Array.from({ length: 10 }, () => `lead-drafts/${legacyRetryId}/${randomUUID()}.jpg`);
  for (const key of legacyFirstKeys) await reserveLeadUploadDraft(legacyRetryId, key);
  for (const key of legacyFirstKeys.slice(0, 9)) await markLeadUploadDraftUploaded(legacyRetryId, key);
  // The tenth old upload is interrupted after token reservation; the old tab
  // retries all ten photos with new paths and no per-file fingerprint.
  const legacyRetryKeys = Array.from({ length: 10 }, () => `lead-drafts/${legacyRetryId}/${randomUUID()}.jpg`);
  // The socket-backed PGlite fixture has a small connection limit; exercise
  // concurrent token requests in a bounded batch and the remaining rollover serially.
  await Promise.all(legacyRetryKeys.slice(0, 3).map((key) => reserveLeadUploadDraft(legacyRetryId, key)));
  for (const key of legacyRetryKeys.slice(3)) await reserveLeadUploadDraft(legacyRetryId, key);
  const legacyDrafts = await inspectPool.query(
    `SELECT storage_key, status FROM lead_upload_drafts WHERE submission_id = $1`,
    [legacyRetryId],
  );
  assert.deepEqual(new Set(legacyDrafts.rows.filter((row) => row.status === 'superseded').map((row) => row.storage_key)), new Set(legacyFirstKeys));
  assert.deepEqual(new Set(legacyDrafts.rows.filter((row) => row.status === 'uploading').map((row) => row.storage_key)), new Set(legacyRetryKeys));
  await assert.rejects(markLeadUploadDraftUploaded(legacyRetryId, legacyFirstKeys[9]), /Rezervácia prílohy sa nenašla/,
    'a late callback from the interrupted old attempt cannot revive a superseded photo');
  for (const key of legacyRetryKeys) await markLeadUploadDraftUploaded(legacyRetryId, key);
  const recoveredFiles = legacyRetryKeys.map((storageKey) => ({
    leadId: randomUUID(), originalName: 'obnovena-fotka.jpg', storageDriver: 'vercel_blob',
    storageKey, mimeType: 'image/jpeg', sizeBytes: 4096,
  }));
  const recoveredLead = await createLeadSubmission(makeInput(legacyRetryId, 'legacy-ten-photo-retry'), recoveredFiles);
  assert.equal(recoveredLead.files.length, 10, 'all ten replacement photos must attach to one accepted lead');
  assert.equal((await inspectPool.query(
    `SELECT count(*)::int AS count FROM lead_upload_drafts WHERE submission_id = $1 AND status = 'attached'`, [legacyRetryId],
  )).rows[0].count, 10);

  const oldBackendSubmissionId = randomUUID();
  const oldBackendKey = `lead-drafts/${oldBackendSubmissionId}/${randomUUID()}.jpg`;
  await reserveLeadUploadDraft(oldBackendSubmissionId, oldBackendKey);
  await markLeadUploadDraftUploaded(oldBackendSubmissionId, oldBackendKey);
  await inspectPool.query("UPDATE lead_upload_drafts SET updated_at = now() - interval '25 hours' WHERE storage_key = $1", [oldBackendKey]);
  const oldBackendClient = await inspectPool.connect();
  const oldBackendFileId = randomUUID();
  try {
    await oldBackendClient.query('BEGIN');
    await oldBackendClient.query(
      `INSERT INTO lead_files (id, lead_id, original_name, storage_driver, storage_key, mime_type, size_bytes)
       VALUES ($1,$2,'old-backend.jpg','vercel_blob',$3,'image/jpeg',100)`,
      [oldBackendFileId, directLead.lead.id, oldBackendKey],
    );
    const overlappingClaim = claimExpiredLeadUploadDrafts(50);
    await new Promise((resolve) => setTimeout(resolve, 30));
    await oldBackendClient.query('COMMIT');
    assert.ok(!(await overlappingClaim).some((candidate) => candidate.storageKey === oldBackendKey),
      'a legacy lead-file insert committed during the claim must protect the photo');
  } finally {
    await oldBackendClient.query('ROLLBACK').catch(() => undefined);
    oldBackendClient.release();
  }
  await inspectPool.query('DELETE FROM lead_files WHERE id = $1', [oldBackendFileId]);
  await inspectPool.query('DELETE FROM lead_upload_drafts WHERE storage_key = $1', [oldBackendKey]);

  const deletingGuardSubmissionId = randomUUID();
  const deletingGuardKey = `lead-drafts/${deletingGuardSubmissionId}/${randomUUID()}.jpg`;
  await reserveLeadUploadDraft(deletingGuardSubmissionId, deletingGuardKey);
  await markLeadUploadDraftUploaded(deletingGuardSubmissionId, deletingGuardKey);
  await inspectPool.query("UPDATE lead_upload_drafts SET updated_at = now() - interval '25 hours' WHERE storage_key = $1", [deletingGuardKey]);
  const deletingGuardClaim = (await claimExpiredLeadUploadDrafts(50)).find((candidate) => candidate.storageKey === deletingGuardKey);
  assert.ok(deletingGuardClaim);
  const oldBackendInsert = () => inspectPool.query(
    `INSERT INTO lead_files (id, lead_id, original_name, storage_driver, storage_key, mime_type, size_bytes)
     VALUES ($1,$2,'old-backend.jpg','vercel_blob',$3,'image/jpeg',100)`,
    [randomUUID(), directLead.lead.id, deletingGuardKey],
  );
  await assert.rejects(oldBackendInsert(), /Príloha sa už bezpečne odstraňuje/,
    'an old backend cannot attach a Blob after the retention worker claims it');
  assert.equal(await completeLeadUploadDraftDeletion(deletingGuardKey, deletingGuardClaim.claimId), true);
  await assert.rejects(oldBackendInsert(), /Príloha sa už bezpečne odstraňuje/,
    'an old backend cannot attach a tombstoned Blob after deletion');

  const staleSubmissionId = randomUUID();
  const staleUploadingKey = `lead-drafts/${staleSubmissionId}/${randomUUID()}.jpg`;
  const staleUploadedKey = `lead-drafts/${staleSubmissionId}/${randomUUID()}.jpg`;
  const freshUploadingKey = `lead-drafts/${staleSubmissionId}/${randomUUID()}.jpg`;
  await reserveLeadUploadDraft(staleSubmissionId, staleUploadingKey);
  await reserveLeadUploadDraft(staleSubmissionId, staleUploadedKey);
  await markLeadUploadDraftUploaded(staleSubmissionId, staleUploadedKey);
  await reserveLeadUploadDraft(staleSubmissionId, freshUploadingKey);
  await inspectPool.query(
    `UPDATE lead_upload_drafts SET updated_at = now() - interval '25 hours'
     WHERE storage_key = ANY($1::text[])`,
    [[staleUploadingKey, staleUploadedKey]],
  );
  const [firstExpiredUploads, competingExpiredUploads] = await Promise.all([
    claimExpiredLeadUploadDrafts(50),
    claimExpiredLeadUploadDrafts(50),
  ]);
  const expiredUploads = [...firstExpiredUploads, ...competingExpiredUploads];
  assert.deepEqual(new Set(expiredUploads.map((item) => item.storageKey)), new Set([staleUploadingKey, staleUploadedKey]), 'retention claims only unattached uploads older than 24 hours');
  assert.equal(expiredUploads.length, 2, 'overlapping retention workers cannot claim the same row while its lease is active');
  const staleStates = await inspectPool.query(
    'SELECT storage_key, status FROM lead_upload_drafts WHERE storage_key = ANY($1::text[]) ORDER BY storage_key',
    [[...expiredUploads.map((item) => item.storageKey), freshUploadingKey, directStorageKey]],
  );
  assert.equal(staleStates.rows.filter((row) => row.status === 'deleting').length, 2);
  assert.equal(staleStates.rows.find((row) => row.storage_key === freshUploadingKey)?.status, 'uploading');
  assert.equal(staleStates.rows.find((row) => row.storage_key === directStorageKey)?.status, 'attached', 'retention must never claim an attached photo');
  const oldClaim = expiredUploads.find((item) => item.storageKey === staleUploadedKey);
  assert.ok(oldClaim);
  await inspectPool.query('UPDATE lead_upload_drafts SET deletion_claimed_until = now() - interval \'1 second\' WHERE storage_key = $1', [staleUploadedKey]);
  const reclaimed = await claimExpiredLeadUploadDrafts(50);
  const newClaim = reclaimed.find((item) => item.storageKey === staleUploadedKey);
  assert.ok(newClaim && newClaim.claimId !== oldClaim.claimId, 'expired deletion ownership is replaced by a new claim ID');
  assert.equal(await completeLeadUploadDraftDeletion(staleUploadedKey, oldClaim.claimId), false, 'an expired worker cannot complete another worker\'s deletion');
  assert.equal((await inspectPool.query("SELECT count(*)::int AS count FROM audit_logs WHERE action = 'lead_upload_retention_deleted' AND changes->>'storageKeyHash' = $1", [createHash('sha256').update(staleUploadedKey).digest('hex')])).rows[0].count, 0,
    'a stale deletion claim cannot emit an audit event');
  assert.equal(await completeLeadUploadDraftDeletion(staleUploadedKey, newClaim.claimId), true);
  assert.equal(await completeLeadUploadDraftDeletion(staleUploadedKey, newClaim.claimId), false, 'deletion completion is idempotent');
  const staleDeletionAudit = await inspectPool.query("SELECT changes FROM audit_logs WHERE action = 'lead_upload_retention_deleted' AND changes->>'storageKeyHash' = $1", [createHash('sha256').update(staleUploadedKey).digest('hex')]);
  assert.equal(staleDeletionAudit.rows.length, 1, 'one successful retention deletion emits exactly one audit event');
  assert.equal(staleDeletionAudit.rows[0].changes.storageDriver, 'vercel_blob');
  assert.ok(!JSON.stringify(staleDeletionAudit.rows[0].changes).includes(staleUploadedKey), 'audit details never reveal the private Blob path');
  for (const item of expiredUploads.filter((candidate) => candidate.storageKey !== staleUploadedKey)) {
    assert.equal(await completeLeadUploadDraftDeletion(item.storageKey, item.claimId), true);
    await assert.rejects(reserveLeadUploadDraft(staleSubmissionId, item.storageKey), /už bola priradená|spracúva/,
      'a tombstoned storage path can never be reserved again');
  }
  await assert.rejects(reserveLeadUploadDraft(staleSubmissionId, staleUploadedKey), /už bola priradená|spracúva/,
    'a completed deletion tombstone prevents late token reuse');

  const legacySubmissionId = randomUUID();
  const legacyStorageKey = `lead-drafts/${legacySubmissionId}/${randomUUID()}.jpg`;
  assert.equal(await trackUnreservedLegacyLeadPhoto(legacySubmissionId, legacyStorageKey), true);
  assert.equal(await trackUnreservedLegacyLeadPhoto(legacySubmissionId, legacyStorageKey), false, 'legacy cleanup registration is idempotent');
  assert.equal(await trackUnreservedLegacyLeadPhoto(directSubmissionId, directStorageKey), false, 'an attached photo is never re-enqueued');
  await assert.rejects(trackUnreservedLegacyLeadPhoto(legacySubmissionId, `lead-drafts/${randomUUID()}/${randomUUID()}.jpg`), /Neplatná cesta/);
  const freshLegacyClaim = await claimExpiredLeadUploadDrafts(50);
  assert.ok(!freshLegacyClaim.some((item) => item.storageKey === legacyStorageKey), 'newly tracked legacy photo keeps its grace period');
  await inspectPool.query("UPDATE lead_upload_drafts SET updated_at = now() - interval '25 hours' WHERE storage_key = $1", [legacyStorageKey]);
  const expiredLegacyClaim = (await claimExpiredLeadUploadDrafts(50)).find((item) => item.storageKey === legacyStorageKey);
  assert.ok(expiredLegacyClaim, 'unattached legacy photo enters the protected retention queue');
  assert.equal(await completeLeadUploadDraftDeletion(legacyStorageKey, expiredLegacyClaim.claimId), true);
  assert.equal((await inspectPool.query('SELECT status FROM lead_upload_drafts WHERE storage_key = $1', [legacyStorageKey])).rows[0]?.status, 'deleted');
  await inspectPool.query("UPDATE lead_upload_drafts SET status = 'superseded', updated_at = now() - interval '25 hours' WHERE storage_key = $1", [directStorageKey]);
  assert.ok(!(await claimExpiredLeadUploadDrafts(50)).some((item) => item.storageKey === directStorageKey),
    'a legacy-style draft must never be deleted if the private object is referenced by an accepted lead');
  await inspectPool.query("UPDATE lead_upload_drafts SET status = 'attached', updated_at = now() WHERE storage_key = $1", [directStorageKey]);

  const inventoryNow = Date.now();
  const oldBlobDate = new Date(inventoryNow - 72 * 60 * 60 * 1000);
  const freshBlobDate = new Date(inventoryNow - 60 * 60 * 1000);
  const orphanAId = randomUUID();
  const orphanBId = randomUUID();
  const orphanA = `lead-drafts/${orphanAId}/${randomUUID()}.png`;
  const orphanB = `lead-drafts/${orphanBId}/${randomUUID()}.jpg`;
  const version7Id = '01234567-89ab-7cde-8abc-0123456789ab';
  const version8Id = '01234567-89ab-8cde-8abc-0123456789ac';
  const version7Orphan = `lead-drafts/${version7Id}/${randomUUID()}.png`;
  const version8Orphan = `lead-drafts/${version8Id}/${randomUUID()}.webp`;
  const version8Attached = `lead-drafts/${version8Id}/${randomUUID()}.jpg`;
  const nilPath = `lead-drafts/00000000-0000-0000-0000-000000000000/${randomUUID()}.png`;
  const maxPath = `lead-drafts/ffffffff-ffff-ffff-ffff-ffffffffffff/${randomUUID()}.png`;
  const freshOrphan = `lead-drafts/${randomUUID()}/${randomUUID()}.webp`;
  assert.equal(oldPrivateLeadPhoto({ pathname: orphanA, uploadedAt: oldBlobDate, etag: 'etag-a' }, inventoryNow)?.storageKey, orphanA);
  assert.equal(oldPrivateLeadPhoto({ pathname: version7Orphan, uploadedAt: oldBlobDate, etag: 'etag-v7' }, inventoryNow)?.storageKey, version7Orphan);
  assert.equal(oldPrivateLeadPhoto({ pathname: version8Orphan, uploadedAt: oldBlobDate, etag: 'etag-v8' }, inventoryNow)?.storageKey, version8Orphan);
  assert.equal(oldPrivateLeadPhoto({ pathname: nilPath, uploadedAt: oldBlobDate, etag: 'etag-nil' }, inventoryNow), null);
  assert.equal(oldPrivateLeadPhoto({ pathname: maxPath, uploadedAt: oldBlobDate, etag: 'etag-max' }, inventoryNow), null);
  await assert.rejects(trackUnreservedLegacyLeadPhoto('00000000-0000-0000-0000-000000000000', nilPath), /Neplatná cesta/);
  await assert.rejects(trackUnreservedLegacyLeadPhoto('ffffffff-ffff-ffff-ffff-ffffffffffff', maxPath), /Neplatná cesta/);
  await inspectPool.query(
    `INSERT INTO lead_files (id, lead_id, original_name, storage_driver, storage_key, mime_type, size_bytes)
     VALUES ($1,$2,'protected-v8.jpg','vercel_blob',$3,'image/jpeg',1024)`,
    [randomUUID(), directLead.lead.id, version8Attached],
  );
  assert.equal(oldPrivateLeadPhoto({ pathname: freshOrphan, uploadedAt: freshBlobDate, etag: 'etag-fresh' }, inventoryNow), null);
  assert.equal(oldPrivateLeadPhoto({ pathname: `lead-drafts/${randomUUID()}/../${randomUUID()}.png`, uploadedAt: oldBlobDate, etag: 'etag-unsafe' }, inventoryNow), null);
  assert.equal(oldPrivateLeadPhoto({ pathname: orphanB, uploadedAt: 'not-a-date', etag: 'etag-b' }, inventoryNow), null);
  assert.equal(oldPrivateLeadPhoto({ pathname: orphanB, uploadedAt: oldBlobDate, etag: '' }, inventoryNow), null);
  const previousBindingEnv = Object.fromEntries(['VERCEL', 'VERCEL_ENV', 'VERCEL_PROJECT_ID', 'BLOB_READ_WRITE_TOKEN', 'LEAD_BLOB_RETENTION_BINDING_SHA256']
    .map((key) => [key, process.env[key]]));
  try {
    process.env.VERCEL = '1';
    process.env.VERCEL_ENV = 'production';
    process.env.VERCEL_PROJECT_ID = 'prj_isolated_test';
    process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_isolated_test';
    process.env.LEAD_BLOB_RETENTION_BINDING_SHA256 = leadBlobRetentionBindingHash(process.env.VERCEL_PROJECT_ID, connectionString, process.env.BLOB_READ_WRITE_TOKEN);
    assert.equal(leadBlobRetentionBound(), true);
    process.env.VERCEL_ENV = 'preview';
    assert.equal(leadBlobRetentionBound(), false, 'preview may not clean the production store');
    process.env.VERCEL_ENV = 'production';
    process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_other_store';
    assert.equal(leadBlobRetentionBound(), false, 'a changed store token invalidates the DB/store binding');
  } finally {
    for (const [key, value] of Object.entries(previousBindingEnv)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
  const [firstInventoryClaim, competingInventoryClaim] = await Promise.all([claimLeadBlobReconciliation(), claimLeadBlobReconciliation()]);
  assert.equal(Number(Boolean(firstInventoryClaim)) + Number(Boolean(competingInventoryClaim)), 1, 'only one inventory worker can own the cursor');
  const heldInventoryClaim = firstInventoryClaim || competingInventoryClaim;
  assert.equal(await advanceLeadBlobReconciliation(randomUUID(), 'not-owned'), false);
  assert.equal(await releaseLeadBlobReconciliation(heldInventoryClaim.claimId), true);
  const listed = [];
  const inventoryResult = await reconcileLegacyLeadBlobs(async (options) => {
    assert.equal(options.prefix, 'lead-drafts/');
    assert.equal(options.limit, 100);
    listed.push(options.cursor || '');
    if (!options.cursor) return {
      blobs: [
        { pathname: orphanA, uploadedAt: oldBlobDate, etag: 'etag-a' },
        { pathname: version7Orphan, uploadedAt: oldBlobDate, etag: 'etag-v7' },
        { pathname: version8Orphan, uploadedAt: oldBlobDate, etag: 'etag-v8' },
        { pathname: version8Attached, uploadedAt: oldBlobDate, etag: 'etag-v8-attached' },
        { pathname: nilPath, uploadedAt: oldBlobDate, etag: 'etag-nil' },
        { pathname: maxPath, uploadedAt: oldBlobDate, etag: 'etag-max' },
        { pathname: directStorageKey, uploadedAt: oldBlobDate, etag: 'etag-attached' },
        { pathname: freshOrphan, uploadedAt: freshBlobDate, etag: 'etag-fresh' },
        { pathname: `lead-drafts/${randomUUID()}/unsafe.txt`, uploadedAt: oldBlobDate, etag: 'etag-unsafe' },
      ], hasMore: true, cursor: 'page-2',
    };
    assert.equal(options.cursor, 'page-2');
    return { blobs: [{ pathname: orphanB, uploadedAt: oldBlobDate, etag: 'etag-b' }], hasMore: false };
  }, inventoryNow);
  assert.deepEqual(listed, ['', 'page-2']);
  assert.deepEqual(inventoryResult, { busy: false, pages: 2, checked: 10, staged: 4, complete: true });
  const inventoriedDrafts = await inspectPool.query(
    'SELECT storage_key, status, lead_id FROM lead_upload_drafts WHERE storage_key = ANY($1::text[])',
    [[orphanA, orphanB, version7Orphan, version8Orphan, version8Attached, nilPath, maxPath, directStorageKey, freshOrphan]],
  );
  assert.equal(inventoriedDrafts.rows.find((row) => row.storage_key === orphanA)?.status, 'superseded');
  assert.equal(inventoriedDrafts.rows.find((row) => row.storage_key === orphanB)?.status, 'superseded');
  assert.equal(inventoriedDrafts.rows.find((row) => row.storage_key === version7Orphan)?.status, 'superseded');
  assert.equal(inventoriedDrafts.rows.find((row) => row.storage_key === version8Orphan)?.status, 'superseded');
  assert.equal(inventoriedDrafts.rows.find((row) => row.storage_key === version8Attached), undefined, 'an attached version-8 photo must not enter the orphan queue');
  assert.equal(inventoriedDrafts.rows.find((row) => row.storage_key === nilPath), undefined);
  assert.equal(inventoriedDrafts.rows.find((row) => row.storage_key === maxPath), undefined);
  assert.equal(inventoriedDrafts.rows.find((row) => row.storage_key === directStorageKey)?.status, 'attached');
  assert.equal(inventoriedDrafts.rows.find((row) => row.storage_key === freshOrphan), undefined);
  const queueOwnedId = randomUUID();
  const queueOwnedKey = `lead-drafts/${queueOwnedId}/${randomUUID()}.png`;
  assert.equal(await trackUnreservedLegacyLeadPhoto(queueOwnedId, queueOwnedKey, 'etag-queue-owned'), true);
  await inspectPool.query(
    `INSERT INTO lead_file_deletion_jobs (id, lead_id, file_id, storage_driver, storage_key, status)
     VALUES ($1,$2,$3,'vercel_blob',$4,'pending')`,
    [randomUUID(), randomUUID(), randomUUID(), queueOwnedKey],
  );
  await inspectPool.query("UPDATE lead_upload_drafts SET updated_at = now() - interval '25 hours' WHERE storage_key = $1", [queueOwnedKey]);
  assert.ok(!(await claimExpiredLeadUploadDrafts(50)).some((row) => row.storageKey === queueOwnedKey), 'the lead-file deletion queue remains sole owner of its object');
  await inspectPool.query('DELETE FROM lead_file_deletion_jobs WHERE storage_key = $1', [queueOwnedKey]);
  await inspectPool.query('UPDATE lead_upload_drafts SET updated_at = now() WHERE storage_key = $1', [queueOwnedKey]);
  assert.ok(!(await claimExpiredLeadUploadDrafts(50)).some((row) => [orphanA, orphanB, version7Orphan, version8Orphan, version8Attached].includes(row.storageKey)), 'inventory never triggers immediate deletion');
  await inspectPool.query("UPDATE lead_upload_drafts SET updated_at = now() - interval '25 hours' WHERE storage_key = ANY($1::text[])", [[version7Orphan, version8Orphan]]);
  const versionedExpired = await claimExpiredLeadUploadDrafts(50);
  assert.ok(versionedExpired.some((row) => row.storageKey === version7Orphan));
  assert.ok(versionedExpired.some((row) => row.storageKey === version8Orphan));
  assert.ok(!versionedExpired.some((row) => row.storageKey === version8Attached), 'an attached version-8 photo remains protected even after orphan grace period');
  for (const row of versionedExpired.filter((item) => [version7Orphan, version8Orphan].includes(item.storageKey))) {
    assert.equal(await completeLeadUploadDraftDeletion(row.storageKey, row.claimId), true);
  }
  const scanState = await inspectPool.query('SELECT cursor, claim_id FROM lead_blob_reconciliation_state WHERE id = 1');
  assert.deepEqual(scanState.rows[0], { cursor: '', claim_id: null });
  const cursorFailure = async (options) => {
    if (!options.cursor) return { blobs: [], hasMore: true, cursor: 'stale-provider-cursor' };
    throw new Error('simulated invalid provider cursor');
  };
  await assert.rejects(reconcileLegacyLeadBlobs(cursorFailure, inventoryNow), /simulated invalid provider cursor/);
  assert.deepEqual((await inspectPool.query('SELECT cursor, claim_id, list_failures FROM lead_blob_reconciliation_state WHERE id = 1')).rows[0],
    { cursor: 'stale-provider-cursor', claim_id: null, list_failures: 1 }, 'one transient listing error retains pagination progress');
  await assert.rejects(reconcileLegacyLeadBlobs(cursorFailure, inventoryNow), /simulated invalid provider cursor/);
  await assert.rejects(reconcileLegacyLeadBlobs(cursorFailure, inventoryNow), /simulated invalid provider cursor/);
  assert.deepEqual((await inspectPool.query('SELECT cursor, claim_id, list_failures FROM lead_blob_reconciliation_state WHERE id = 1')).rows[0],
    { cursor: '', claim_id: null, list_failures: 0 }, 'repeated invalid cursor eventually restarts without a held lease');

  const deletedPredecessorSubmissionId = randomUUID();
  const deletedPredecessorKey = `lead-drafts/${deletedPredecessorSubmissionId}/${randomUUID()}.jpg`;
  await reserveLeadUploadDraft(deletedPredecessorSubmissionId, deletedPredecessorKey);
  await markLeadUploadDraftUploaded(deletedPredecessorSubmissionId, deletedPredecessorKey);
  await inspectPool.query('UPDATE lead_upload_drafts SET updated_at = now() - interval \'25 hours\' WHERE storage_key = $1', [deletedPredecessorKey]);
  const deletedPredecessorClaim = (await claimExpiredLeadUploadDrafts(50)).find((item) => item.storageKey === deletedPredecessorKey);
  assert.ok(deletedPredecessorClaim, 'stará príloha musí prejsť retenčným claimom');
  assert.equal(await completeLeadUploadDraftDeletion(deletedPredecessorKey, deletedPredecessorClaim.claimId), true);
  const replacementAfterDeletionKey = `lead-drafts/${deletedPredecessorSubmissionId}/${randomUUID()}.jpg`;
  await reserveLeadUploadDraft(deletedPredecessorSubmissionId, replacementAfterDeletionKey, deletedPredecessorKey);
  const deletedPredecessorStates = await inspectPool.query(
    'SELECT storage_key, status FROM lead_upload_drafts WHERE storage_key = ANY($1::text[]) ORDER BY storage_key',
    [[deletedPredecessorKey, replacementAfterDeletionKey]],
  );
  assert.equal(deletedPredecessorStates.rows.find((row) => row.storage_key === deletedPredecessorKey)?.status, 'deleted', 'tombstoned predecessor stays deleted');
  assert.equal(deletedPredecessorStates.rows.find((row) => row.storage_key === replacementAfterDeletionKey)?.status, 'uploading', 'a fresh pathname can replace a deleted predecessor');

  const retrySubmissionId = randomUUID();
  const abandonedUploadKey = `lead-drafts/${retrySubmissionId}/${randomUUID()}.jpg`;
  const retryUploadKey = `lead-drafts/${retrySubmissionId}/${randomUUID()}.jpg`;
  await reserveLeadUploadDraft(retrySubmissionId, abandonedUploadKey);
  await reserveLeadUploadDraft(retrySubmissionId, retryUploadKey, abandonedUploadKey);
  const retryStates = await inspectPool.query(
    'SELECT storage_key, status FROM lead_upload_drafts WHERE storage_key = ANY($1::text[]) ORDER BY storage_key',
    [[abandonedUploadKey, retryUploadKey]],
  );
  assert.equal(retryStates.rows.find((row) => row.storage_key === abandonedUploadKey)?.status, 'superseded');
  assert.equal(retryStates.rows.find((row) => row.storage_key === retryUploadKey)?.status, 'uploading');
  const multipartSubmissionId = randomUUID();
  const multipartFingerprints = Array.from({ length: 10 }, (_, index) => `private-hmac-${index}`);
  for (const fingerprint of multipartFingerprints) {
    const key = `lead-drafts/${multipartSubmissionId}/${randomUUID()}.jpg`;
    await reserveLeadUploadDraft(multipartSubmissionId, key, undefined, 'vercel_blob', fingerprint);
    await markLeadUploadDraftUploaded(multipartSubmissionId, key);
  }
  for (const fingerprint of multipartFingerprints) {
    const key = `lead-drafts/${multipartSubmissionId}/${randomUUID()}.jpg`;
    await reserveLeadUploadDraft(multipartSubmissionId, key, undefined, 'vercel_blob', fingerprint);
  }
  const activeMultipartRetries = await inspectPool.query(
    `SELECT COUNT(*)::int AS count FROM lead_upload_drafts
     WHERE submission_id = $1 AND status IN ('uploading', 'uploaded')`,
    [multipartSubmissionId],
  );
  assert.equal(activeMultipartRetries.rows[0].count, 10, 'reuploading the same ten multipart images supersedes only their previous reservations');
  const interruptedSubmissionId = randomUUID();
  for (let index = 0; index < 9; index++) {
    await reserveLeadUploadDraft(interruptedSubmissionId, `lead-drafts/${interruptedSubmissionId}/${randomUUID()}.jpg`, undefined, 'vercel_blob', `other-photo-${index}`);
  }
  const firstReservedPath = `lead-drafts/${interruptedSubmissionId}/${randomUUID()}.jpg`;
  const tokenFailedBeforeReservationPath = `lead-drafts/${interruptedSubmissionId}/${randomUUID()}.jpg`;
  const finalRetryPath = `lead-drafts/${interruptedSubmissionId}/${randomUUID()}.jpg`;
  const interruptedPhotoFingerprint = 'a'.repeat(64);
  await reserveLeadUploadDraft(interruptedSubmissionId, firstReservedPath, undefined, 'vercel_blob', interruptedPhotoFingerprint);
  // No DB call for tokenFailedBeforeReservationPath: the second token request failed before reservation.
  await reserveLeadUploadDraft(interruptedSubmissionId, finalRetryPath, tokenFailedBeforeReservationPath, 'vercel_blob', interruptedPhotoFingerprint);
  const interruptedStates = await inspectPool.query(
    `SELECT storage_key, status FROM lead_upload_drafts WHERE submission_id = $1`, [interruptedSubmissionId],
  );
  assert.equal(interruptedStates.rows.find((row) => row.storage_key === firstReservedPath)?.status, 'superseded');
  assert.equal(interruptedStates.rows.find((row) => row.storage_key === finalRetryPath)?.status, 'uploading');
  assert.equal(interruptedStates.rows.filter((row) => ['uploading', 'uploaded'].includes(row.status)).length, 10,
    'a pre-reservation token failure must not strand an older photo at the ten-file limit');
  const legacyInterruptedId = randomUUID();
  for (let index = 0; index < 9; index++) {
    await reserveLeadUploadDraft(legacyInterruptedId, `lead-drafts/${legacyInterruptedId}/${randomUUID()}.jpg`);
  }
  const legacyFirstPath = `lead-drafts/${legacyInterruptedId}/${randomUUID()}.jpg`;
  const legacyTokenFailedPath = `lead-drafts/${legacyInterruptedId}/${randomUUID()}.jpg`;
  const legacyFinalPath = `lead-drafts/${legacyInterruptedId}/${randomUUID()}.jpg`;
  await reserveLeadUploadDraft(legacyInterruptedId, legacyFirstPath); // older backend stored no fingerprint
  await reserveLeadUploadDraft(legacyInterruptedId, legacyFinalPath, [legacyFirstPath, legacyTokenFailedPath], 'vercel_blob', 'b'.repeat(64));
  const legacyInterruptedStates = await inspectPool.query(
    'SELECT storage_key, status FROM lead_upload_drafts WHERE submission_id = $1', [legacyInterruptedId],
  );
  assert.equal(legacyInterruptedStates.rows.find((row) => row.storage_key === legacyFirstPath)?.status, 'superseded');
  assert.equal(legacyInterruptedStates.rows.find((row) => row.storage_key === legacyFinalPath)?.status, 'uploading');
  assert.equal(legacyInterruptedStates.rows.filter((row) => ['uploading', 'uploaded'].includes(row.status)).length, 10,
    'new client replaces a legacy reservation even when an intermediate token had no row');
  const unrelatedId = randomUUID();
  const unrelatedPath = `lead-drafts/${unrelatedId}/${randomUUID()}.jpg`;
  await reserveLeadUploadDraft(unrelatedId, unrelatedPath);
  await assert.rejects(reserveLeadUploadDraft(legacyInterruptedId, `lead-drafts/${legacyInterruptedId}/${randomUUID()}.jpg`, [unrelatedPath]), /Predchádzajúci pokus/);
  assert.equal((await inspectPool.query('SELECT status FROM lead_upload_drafts WHERE storage_key = $1', [unrelatedPath])).rows[0].status, 'uploading',
    'a forged predecessor must not affect another submission');
  const duplicatePhotoSubmissionId = randomUUID();
  const duplicatePhotoKeys = [
    `lead-drafts/${duplicatePhotoSubmissionId}/${randomUUID()}.jpg`,
    `lead-drafts/${duplicatePhotoSubmissionId}/${randomUUID()}.jpg`,
  ];
  const sameBytesAtDifferentPositions = 'same-content-hmac-with-position-salt';
  await reserveLeadUploadDraft(duplicatePhotoSubmissionId, duplicatePhotoKeys[0], undefined, 'vercel_blob', `${sameBytesAtDifferentPositions}:0`);
  await markLeadUploadDraftUploaded(duplicatePhotoSubmissionId, duplicatePhotoKeys[0]);
  await reserveLeadUploadDraft(duplicatePhotoSubmissionId, duplicatePhotoKeys[1], undefined, 'vercel_blob', `${sameBytesAtDifferentPositions}:1`);
  await markLeadUploadDraftUploaded(duplicatePhotoSubmissionId, duplicatePhotoKeys[1]);
  const duplicatePhotoRetryKey = `lead-drafts/${duplicatePhotoSubmissionId}/${randomUUID()}.jpg`;
  await reserveLeadUploadDraft(duplicatePhotoSubmissionId, duplicatePhotoRetryKey, undefined, 'vercel_blob', `${sameBytesAtDifferentPositions}:0`);
  const duplicatePhotoStates = await inspectPool.query(
    'SELECT storage_key, status FROM lead_upload_drafts WHERE submission_id = $1 ORDER BY storage_key',
    [duplicatePhotoSubmissionId],
  );
  assert.equal(duplicatePhotoStates.rows.filter((row) => ['uploading', 'uploaded'].includes(row.status)).length, 2,
    'identical file bytes at different multipart positions remain separate while retry replaces only the matching position');
  assert.equal(duplicatePhotoStates.rows.find((row) => row.storage_key === duplicatePhotoKeys[0])?.status, 'superseded');
  assert.equal(duplicatePhotoStates.rows.find((row) => row.storage_key === duplicatePhotoKeys[1])?.status, 'uploaded');
  assert.equal(duplicatePhotoStates.rows.find((row) => row.storage_key === duplicatePhotoRetryKey)?.status, 'uploading');
  const firstAttemptMissingSubmissionId = randomUUID();
  const missingPreviousPath = `lead-drafts/${firstAttemptMissingSubmissionId}/${randomUUID()}.jpg`;
  const validRetryPath = `lead-drafts/${firstAttemptMissingSubmissionId}/${randomUUID()}.jpg`;
  await reserveLeadUploadDraft(firstAttemptMissingSubmissionId, validRetryPath, missingPreviousPath);

  const rateLimitKey = `integration:${randomUUID()}`;
  assert.equal(trustedRateLimitClientIp(new Headers({ 'x-vercel-forwarded-for': '203.0.113.17, 192.0.2.5' })), '203.0.113.17');
  const priorNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    assert.throws(() => trustedRateLimitClientIp(new Headers({ 'x-forwarded-for': '198.51.100.10' })), /trusted Vercel client IP/,
      'produkčný endpoint nesmie prijať klientsky ovládateľnú generickú forwarding hlavičku');
  } finally {
    process.env.NODE_ENV = priorNodeEnv;
  }
  const rateLimitWindow = new Date(Math.floor(Date.now() / (10 * 60_000)) * (10 * 60_000));
  const concurrentRateLimitResults = await Promise.all(
    Array.from({ length: 3 }, () => consumeApiRateLimit(rateLimitKey, rateLimitWindow, 2)),
  );
  assert.equal(concurrentRateLimitResults.filter((limited) => !limited).length, 2, 'spoločný DB limit musí prepustiť iba prvé dve súbežné požiadavky');
  assert.equal(concurrentRateLimitResults.filter(Boolean).length, 1);
  assert.equal(await consumeApiRateLimit(rateLimitKey, rateLimitWindow, 2), true, 'limit musí zostať spoločný po skončení súbežných požiadaviek');
  const tenUploadRateLimitKey = `ten-photos:${randomUUID()}`;
  const tenUploadRateLimitResults = await Promise.all(
    Array.from({ length: 10 }, () => consumeApiRateLimit(tenUploadRateLimitKey, rateLimitWindow, 40)),
  );
  assert.deepEqual(tenUploadRateLimitResults, Array(10).fill(false),
    'desať súbežných tokenov nesmie spustiť ochranu nastavenú na štyridsať pokusov');
  const tenUploadBucket = await inspectPool.query(
    'SELECT hit_count FROM api_rate_limit_buckets WHERE bucket_key = $1 AND window_started_at = $2',
    [tenUploadRateLimitKey, rateLimitWindow],
  );
  assert.equal(Number(tenUploadBucket.rows[0]?.hit_count), 10);
  const expiredRateLimitKey = `expired:${randomUUID()}`;
  await inspectPool.query(
    'INSERT INTO api_rate_limit_buckets (bucket_key, window_started_at, hit_count) VALUES ($1, $2, 1)',
    [expiredRateLimitKey, new Date(Date.now() - 60 * 60_000)],
  );
  assert.equal(await purgeExpiredApiRateLimitBuckets(), 1, 'plánovaná údržba musí odstrániť vypršaný limitový záznam');
  const expiredRateLimitRows = await inspectPool.query('SELECT count(*)::int AS count FROM api_rate_limit_buckets WHERE bucket_key = $1', [expiredRateLimitKey]);
  assert.equal(expiredRateLimitRows.rows[0].count, 0);
  assert.equal(await consumeApiRateLimit(rateLimitKey, new Date(rateLimitWindow.getTime() + 10 * 60_000), 3), false, 'nové časové okno musí obnoviť limit');

  process.env.AUTH_SECRET = 'pglite-rate-limit-test-secret';
  const limitedAdminEmail = `admin-${randomUUID()}@example.invalid`;
  const accountAttempts = [];
  for (let index = 0; index < 7; index += 1) {
    accountAttempts.push(await consumeSharedRateLimit('admin-two-factor-account', limitedAdminEmail, 5, 10 * 60_000));
  }
  assert.equal(accountAttempts.filter((limited) => !limited).length, 5, 'spoločný limit 2FA musí prepustiť iba päť súbežných pokusov');
  assert.equal(accountAttempts.filter(Boolean).length, 2);
  const expectedAccountBucket = createRateLimitBucketKey('admin-two-factor-account', limitedAdminEmail, process.env.AUTH_SECRET);
  const accountBucketRows = await inspectPool.query('SELECT bucket_key FROM api_rate_limit_buckets WHERE bucket_key = $1', [expectedAccountBucket]);
  assert.equal(accountBucketRows.rows.length, 1);
  assert.match(accountBucketRows.rows[0].bucket_key, /^[a-f0-9]{64}$/);
  assert.ok(!accountBucketRows.rows[0].bucket_key.includes(limitedAdminEmail), 'DB limiter nesmie ukladať email účtu v čitateľnej forme');

  const analyticsIp = '203.0.113.88';
  const analyticsAttempts = [];
  const originalDateNow = Date.now;
  const analyticsWindowTime = Math.floor(Date.now() / 60_000) * 60_000 + 1_000;
  try {
    Date.now = () => analyticsWindowTime;
    for (let index = 0; index < 81; index += 1) {
      analyticsAttempts.push(await consumeSharedRateLimit('analytics-event-address', analyticsIp, 80, 60_000));
    }
  } finally {
    Date.now = originalDateNow;
  }
  assert.equal(analyticsAttempts.slice(0, 80).every((limited) => limited === false), true);
  assert.equal(analyticsAttempts[80], true, '81. analytická udalosť v spoločnom okne musí byť obmedzená');
  const analyticsBucketKey = createRateLimitBucketKey('analytics-event-address', analyticsIp, process.env.AUTH_SECRET);
  const analyticsBucketRows = await inspectPool.query(
    'SELECT hit_count FROM api_rate_limit_buckets WHERE bucket_key = $1',
    [analyticsBucketKey],
  );
  assert.equal(Number(analyticsBucketRows.rows[0]?.hit_count), 81);

  const inviteId = randomUUID();
  await inspectPool.query(
    `INSERT INTO photo_upload_invites (id, token_hash, created_by, worker_label, expires_at)
     VALUES ($1, $2, 'integration-test', 'Testovacia partia', now() + interval '10 days')`,
    [inviteId, randomUUID().replaceAll('-', '').padEnd(64, 'a').slice(0, 64)],
  );
  const completedPhotoJobId = randomUUID();
  await inspectPool.query(
    `INSERT INTO business_jobs (id, demolition_date, customer_name, district, status)
     VALUES ($1, DATE '2026-09-01', 'SÚKROMNÝ TEST ZÁKAZNÍK', 'Poprad', 'DOKONCENA')`,
    [completedPhotoJobId],
  );
  const privateInviteCodeHash = createHash('sha256').update(randomUUID()).digest('hex');
  const assignedPhotoInvite = await createPhotoUploadInvite(privateInviteCodeHash, 'integration-test', new Date(Date.now() + 7 * 86400000), 'Testovacia partia', completedPhotoJobId);
  assert.equal(assignedPhotoInvite.businessJob, undefined, 'vytvorenie jednorazového kódu nesmie vrátiť nepotrebné údaje zákazky');
  const inviteFromSession = await consumePhotoUploadInviteByHash(privateInviteCodeHash);
  assert.deepEqual(inviteFromSession.businessJob, { id: completedPhotoJobId, demolitionDate: '2026-09-01', district: 'Poprad', status: 'DOKONCENA' }, 'pracovnícka relácia má niesť iba bezpečný identifikátor, dátum, okres a stav dokončenej zákazky');
  const activeAssignedInvite = await getActivePhotoUploadInvite(inviteFromSession.id);
  assert.deepEqual(activeAssignedInvite.businessJob, inviteFromSession.businessJob);
  const deferredPhotoId = randomUUID();
  await inspectPool.query(
    `INSERT INTO realization_media_intake (id, invite_id, storage_key, original_name, mime_type, size_bytes, content_hash, sanitized_at, uploaded_at, status)
     VALUES ($1, $2, $3, 'odlozena-lokalita.jpg', 'image/jpeg', 12, $4, now(), now(), 'pending_review')`,
    [deferredPhotoId, inviteFromSession.id, `photo-intake/${deferredPhotoId}.jpg`, 'a'.repeat(64)],
  );
  const emptyDeferredMetadata = await updatePhotoIntakeMetadata({
    id: deferredPhotoId, locality: '', categories: [], updatedBy: 'integration-test', expectedMetadataVersion: 1, inviteId: inviteFromSession.id,
  });
  assert.equal(emptyDeferredMetadata.locality, '', 'worker may submit a private photo while locality is unknown');
  assert.deepEqual(emptyDeferredMetadata.categories, [], 'worker may submit a private photo before assigning a category');
  assert.equal(await reviewPhotoIntakeRecord({ id: deferredPhotoId, approve: true, reviewedBy: 'integration-test', expectedMetadataVersion: emptyDeferredMetadata.metadataVersion }), null,
    'database review function must reject approval without locality and category');
  const partialDeferredMetadata = await updatePhotoIntakeMetadata({
    id: deferredPhotoId, locality: 'Poprad', categories: [], updatedBy: 'integration-test', expectedMetadataVersion: emptyDeferredMetadata.metadataVersion, inviteId: inviteFromSession.id,
  });
  assert.equal(partialDeferredMetadata.locality, 'Poprad');
  assert.deepEqual(partialDeferredMetadata.categories, [], 'partial metadata may be saved while a worker is still checking the photo');
  const invalidApprovedLocalityPhotoId = randomUUID();
  await inspectPool.query(
    `INSERT INTO realization_media_intake (id, invite_id, storage_key, original_name, mime_type, size_bytes, content_hash, locality, categories, sanitized_at, uploaded_at, status)
     VALUES ($1, $2, $3, 'adresa-test.jpg', 'image/jpeg', 12, $4, 'Školská 12, Poprad', '["family_house"]'::jsonb, now(), now(), 'pending_review')`,
    [invalidApprovedLocalityPhotoId, inviteFromSession.id, `photo-intake/${invalidApprovedLocalityPhotoId}.jpg`, 'b'.repeat(64)],
  );
  assert.equal(await reviewPhotoIntakeRecord({ id: invalidApprovedLocalityPhotoId, approve: true, reviewedBy: 'integration-test', expectedMetadataVersion: 1 }), null,
    'approval SQL must reject an address even if one is inserted outside the user-facing form');
  const whitespaceLocalityPhotoId = randomUUID();
  await inspectPool.query(
    `INSERT INTO realization_media_intake (id, invite_id, storage_key, original_name, mime_type, size_bytes, content_hash, locality, categories, sanitized_at, uploaded_at, status)
     VALUES ($1, $2, $3, 'whitespace-lokalita.jpg', 'image/jpeg', 12, $4, E'\\t\\n', '["family_house"]'::jsonb, now(), now(), 'pending_review')`,
    [whitespaceLocalityPhotoId, inviteFromSession.id, `photo-intake/${whitespaceLocalityPhotoId}.jpg`, 'c'.repeat(64)],
  );
  assert.equal(await reviewPhotoIntakeRecord({ id: whitespaceLocalityPhotoId, approve: true, reviewedBy: 'integration-test', expectedMetadataVersion: 1 }), null,
    'approval SQL must reject tab/newline-only locality, not just trim plain spaces');
  const completedDeferredMetadata = await updatePhotoIntakeMetadata({
    id: deferredPhotoId, locality: 'Poprad', categories: ['family_house'], updatedBy: 'integration-test', expectedMetadataVersion: partialDeferredMetadata.metadataVersion, inviteId: inviteFromSession.id,
  });
  const internallyApproved = await reviewPhotoIntakeRecord({ id: deferredPhotoId, approve: true, reviewedBy: 'integration-test', expectedMetadataVersion: completedDeferredMetadata.metadataVersion });
  assert.equal(internallyApproved.status, 'approved_private');
  assert.equal(await updatePhotoIntakeMetadata({
    id: deferredPhotoId, locality: '', categories: [], updatedBy: 'integration-test', expectedMetadataVersion: internallyApproved.metadataVersion,
  }), null, 'internally approved photos must not have required metadata blanked');
  const photoJobOptions = await listPhotoIntakeJobOptions();
  assert.ok(photoJobOptions.some((job) => job.id === completedPhotoJobId));
  assert.equal(Object.hasOwn(photoJobOptions[0], 'customer_name'), false, 'výber zákazky nesmie načítať osobné údaje zákazníka');
  const incompletePhotoJobId = randomUUID();
  await inspectPool.query(
    `INSERT INTO business_jobs (id, demolition_date, customer_name, district, status)
     VALUES ($1, DATE '2026-09-02', 'SÚKROMNÝ TEST', 'Poprad', 'V_REALIZACII')`,
    [incompletePhotoJobId],
  );
  const incompleteJobInviteError = await createPhotoUploadInvite(createHash('sha256').update(randomUUID()).digest('hex'), 'integration-test', new Date(Date.now() + 7 * 86400000), 'Testovacia partia', incompletePhotoJobId).then(() => null, (error) => error);
  assert.match(String(incompleteJobInviteError?.message ?? ''), /dokončenú zákazku/);
  const retentionMedia = [
    { status: 'pending_upload', ageDays: 2, field: 'created_at' },
    { status: 'pending_review', ageDays: 31, field: 'uploaded_at' },
    { status: 'approved_private', ageDays: 181, field: 'reviewed_at' },
    { status: 'rejected', ageDays: 8, field: 'reviewed_at' },
    { status: 'pending_review', ageDays: 1, field: 'uploaded_at' },
    { status: 'approved_private', ageDays: 181, field: 'reviewed_at' },
  ];
  const retentionIds = [];
  for (const [index, item] of retentionMedia.entries()) {
    const mediaId = randomUUID();
    retentionIds.push(mediaId);
    await inspectPool.query(
      `INSERT INTO realization_media_intake (id, invite_id, storage_key, original_name, status, size_bytes, sanitized_at)
       VALUES ($1, $2, $3, 'retention-test.jpg', $4, 12, CASE WHEN $4 = 'approved_private' THEN now() END)`,
      [mediaId, inviteId, `photo-intake/${mediaId}.jpg`, item.status],
    );
    await inspectPool.query(
      `UPDATE realization_media_intake SET ${item.field} = now() - ($1::int * interval '1 day') WHERE id = $2`,
      [item.ageDays, mediaId],
    );
  }
  const retainedCasePhotoId = retentionIds[5];
  const retentionCaseDraft = await saveRealizationCaseDraft({
    title: 'Retenčný test konceptu', locality: 'Poprad', localityPrecision: 'district', objectType: 'Rodinný dom',
    materialType: 'Eternit', workDescription: '', resultDescription: '', updatedBy: 'integration-test',
  });
  await setRealizationCaseDraftMedia({ draftId: retentionCaseDraft.id, mediaId: retainedCasePhotoId, attach: true, updatedBy: 'integration-test' });
  const duePhotoDeletions = await claimDuePhotoIntakeDeletions(10);
  assert.equal(duePhotoDeletions.length, 4, 'retencia musí nájsť staré uploady, čakajúce, interné a zamietnuté fotky, nie čerstvú kontrolu');
  assert.ok(duePhotoDeletions.every((item) => item.storageDriver === 'vercel_blob' && item.storageKey.startsWith('photo-intake/')));
  const failedDeleteId = duePhotoDeletions[0].id;
  await markPhotoIntakeDeletionFailed(failedDeleteId);
  const failedDeleteState = await inspectPool.query('SELECT status, deletion_attempts, deletion_error FROM realization_media_intake WHERE id = $1', [failedDeleteId]);
  assert.equal(failedDeleteState.rows[0].status, 'deletion_pending');
  assert.equal(failedDeleteState.rows[0].deletion_attempts, 1);
  assert.ok(failedDeleteState.rows[0].deletion_error);
  for (const item of duePhotoDeletions.filter((candidate) => candidate.id !== failedDeleteId)) {
    assert.equal(await completePhotoIntakeDeletion(item.id), true, 'DB záznam sa smie odstrániť až po potvrdenom odstránení Blob objektu');
  }
  await inspectPool.query("UPDATE realization_media_intake SET deletion_attempted_at = now() - interval '2 days' WHERE id = $1", [failedDeleteId]);
  const retriedDeletion = await claimDuePhotoIntakeDeletions(10);
  assert.equal(retriedDeletion.length, 1, 'zlyhané mazanie sa musí po retry odstupe znovu zaradiť');
  assert.equal(retriedDeletion[0].id, failedDeleteId);
  assert.equal(await completePhotoIntakeDeletion(failedDeleteId), true);
  const deletedAudit = await inspectPool.query("SELECT count(*)::int AS count FROM audit_logs WHERE entity_id = $1 AND action = 'photo_intake_retention_deleted'", [failedDeleteId]);
  assert.equal(deletedAudit.rows[0].count, 1, 'úspešné zmazanie musí zanechať auditnú udalosť bez uloženia obsahu fotografie');
  const retainedFreshPhoto = await inspectPool.query('SELECT status FROM realization_media_intake WHERE id = $1', [retentionIds[4]]);
  assert.equal(retainedFreshPhoto.rows[0].status, 'pending_review');
  const retainedCasePhoto = await inspectPool.query('SELECT status FROM realization_media_intake WHERE id = $1', [retainedCasePhotoId]);
  assert.equal(retainedCasePhoto.rows[0].status, 'approved_private', 'retencia musí ponechať súkromnú fotku pripojenú ku konceptu realizácie');
  await setRealizationCaseDraftMedia({ draftId: retentionCaseDraft.id, mediaId: retainedCasePhotoId, attach: false, updatedBy: 'integration-test' });
  const detachedCasePhotoDeletion = await claimDuePhotoIntakeDeletions(10);
  assert.ok(detachedCasePhotoDeletion.some((item) => item.id === retainedCasePhotoId), 'po odpojení expirovanej fotky sa má obnoviť bežná retencia');

  const fullRetentionDraft = await saveRealizationCaseDraft({
    title: 'Plná chránená retenčná dávka', locality: 'Poprad', localityPrecision: 'district', objectType: 'Rodinný dom',
    materialType: 'Eternit', workDescription: '', resultDescription: '', updatedBy: 'integration-test',
  });
  for (let index = 0; index < 10; index += 1) {
    const protectedPhotoId = randomUUID();
    await inspectPool.query(
      `INSERT INTO realization_media_intake (id, invite_id, storage_key, original_name, status, size_bytes, reviewed_at, sanitized_at)
       VALUES ($1, $2, $3, 'full-batch-protected.jpg', 'approved_private', 12, now() - interval '190 days', now())`,
      [protectedPhotoId, inviteId, `photo-intake/${protectedPhotoId}.jpg`],
    );
    await setRealizationCaseDraftMedia({ draftId: fullRetentionDraft.id, mediaId: protectedPhotoId, attach: true, updatedBy: 'integration-test' });
  }
  const freeBatchPhotoId = randomUUID();
  await inspectPool.query(
    `INSERT INTO realization_media_intake (id, invite_id, storage_key, original_name, status, size_bytes, reviewed_at, sanitized_at)
     VALUES ($1, $2, $3, 'free-after-protected-batch.jpg', 'approved_private', 12, now() - interval '189 days', now())`,
    [freeBatchPhotoId, inviteId, `photo-intake/${freeBatchPhotoId}.jpg`],
  );
  const deletionAfterProtectedBatch = await claimDuePhotoIntakeDeletions(10);
  assert.ok(deletionAfterProtectedBatch.some((item) => item.id === freeBatchPhotoId),
    'pripojené expirované fotky nesmú zaplniť dávku a blokovať nasledujúce odstrániteľné fotky');
  assert.equal(await completePhotoIntakeDeletion(freeBatchPhotoId), true);

  const tokenMediaId = randomUUID();
  await inspectPool.query(
    `INSERT INTO realization_media_intake (id, invite_id, storage_key, original_name, status, size_bytes, created_at)
     VALUES ($1, $2, $3, 'token-race-test.jpg', 'pending_upload', 0, now() - interval '2 days')`,
    [tokenMediaId, inviteId, `photo-intake/${tokenMediaId}.jpg`],
  );
  assert.equal(await markPhotoIntakeUploadTokenIssued(tokenMediaId, inviteId, `photo-intake/${tokenMediaId}.jpg`), true);
  assert.equal((await claimDuePhotoIntakeDeletions(10)).some((item) => item.id === tokenMediaId), false,
    'čerstvo vydaný klientsky token musí chrániť rozbehnutý upload pred retenciou');
  await inspectPool.query(
    "UPDATE realization_media_intake SET upload_token_issued_at = now() - interval '2 days' WHERE id = $1",
    [tokenMediaId],
  );
  const expiredTokenDeletion = await claimDuePhotoIntakeDeletions(10);
  assert.ok(expiredTokenDeletion.some((item) => item.id === tokenMediaId), 'starý nedokončený upload sa po uplynutí tokenu musí dať zmazať');
  assert.equal(await markPhotoIntakeUploadTokenIssued(tokenMediaId, inviteId, `photo-intake/${tokenMediaId}.jpg`), false,
    'token sa nesmie vydať po tom, čo retencia uzamkla záznam na zmazanie');

  const confirmationRaceId = randomUUID();
  const confirmationRaceKey = `photo-intake/${confirmationRaceId}.jpg`;
  await inspectPool.query(
    `INSERT INTO realization_media_intake (id, invite_id, storage_key, original_name, status, size_bytes, created_at, upload_token_issued_at)
     VALUES ($1, $2, $3, 'confirm-retention-race.jpg', 'pending_upload', 12, now() - interval '2 days', now() - interval '2 days')`,
    [confirmationRaceId, inviteId, confirmationRaceKey],
  );
  const confirmationAttempt = await reservePhotoIntakeSanitizationAttempt(confirmationRaceId, inviteId);
  assert.ok(confirmationAttempt, 'potvrdenie musí zapísať trvalý pokus pred Blob operáciou');
  assert.ok(!(await claimDuePhotoIntakeDeletions(10)).some((item) => item.id === confirmationRaceId),
    'retencia musí chrániť zdrojový Blob, kým nie je attempt key vyčistený alebo potvrdený');
  const confirmationInFlight = await completePhotoIntakeRecord({
    id: confirmationRaceId, inviteId, storageKey: confirmationAttempt.sourceStorageKey,
    targetStorageKey: confirmationAttempt.targetStorageKey, sanitizationAttemptId: confirmationAttempt.id,
    mimeType: 'image/jpeg', sizeBytes: 12, contentHash: 'd'.repeat(64), locality: 'Poprad', categories: ['family_house'], expectedMetadataVersion: 1,
  });
  assert.equal(confirmationInFlight?.status, 'pending_review');
  assert.equal(confirmationInFlight?.storageKey, confirmationAttempt.targetStorageKey, 'DB ukáže na jedinečný očistený objekt až po jeho potvrdení');
  await inspectPool.query("UPDATE photo_intake_sanitization_attempts SET created_at = now() - interval '2 days' WHERE id = $1", [confirmationAttempt.id]);
  const committedSourceCleanup = await claimPhotoIntakeSanitizationCleanups(10);
  assert.deepEqual(committedSourceCleanup.filter((item) => item.id === confirmationAttempt.id).map((item) => item.storageKey), [confirmationRaceKey],
    'po potvrdení sa odstráni starý originál, nie očistený objekt používaný DB');
  assert.equal(await completePhotoIntakeSanitizationCleanup(confirmationAttempt.id), true);
  assert.ok(!(await claimDuePhotoIntakeDeletions(10)).some((item) => item.id === confirmationRaceId),
    'po úspešnom potvrdení sa starý pending-upload Blob už nesmie zaradiť do retencie');

  const abandonedAttemptMediaId = randomUUID();
  const abandonedAttemptSource = `photo-intake/${abandonedAttemptMediaId}.jpg`;
  await inspectPool.query(
    `INSERT INTO realization_media_intake (id, invite_id, storage_key, original_name, status, size_bytes, created_at, upload_token_issued_at)
     VALUES ($1, $2, $3, 'abandoned-sanitization.jpg', 'pending_upload', 12, now() - interval '2 days', now() - interval '2 days')`,
    [abandonedAttemptMediaId, inviteId, abandonedAttemptSource],
  );
  const abandonedAttempt = await reservePhotoIntakeSanitizationAttempt(abandonedAttemptMediaId, inviteId);
  assert.ok(abandonedAttempt);
  await abandonPhotoIntakeSanitizationAttempt(abandonedAttempt.id);
  await inspectPool.query("UPDATE photo_intake_sanitization_attempts SET created_at = now() - interval '10 minutes' WHERE id = $1", [abandonedAttempt.id]);
  const abandonedCleanup = await claimPhotoIntakeSanitizationCleanups(50);
  assert.ok(abandonedCleanup.some((item) => item.id === abandonedAttempt.id && item.storageKey === abandonedAttempt.targetStorageKey),
    'opustený unique objekt sa bezpečne odstráni bez zmazania zdrojovej fotografie');
  assert.equal(await completePhotoIntakeSanitizationCleanup(abandonedAttempt.id), true);
  const dueAfterAttemptCleanup = await claimDuePhotoIntakeDeletions(10);
  assert.ok(dueAfterAttemptCleanup.some((item) => item.id === abandonedAttemptMediaId && item.storageKey === abandonedAttemptSource),
    'pôvodný upload sa uvoľní do retencie až po potvrdenom vyčistení pomocného objektu');
  assert.equal(await completePhotoIntakeDeletion(abandonedAttemptMediaId), true);

  const failedFinalizeMediaId = randomUUID();
  const failedFinalizeSource = `photo-intake/${failedFinalizeMediaId}.jpg`;
  const simulatedPrivateBlobs = new Set([failedFinalizeSource]);
  await inspectPool.query(
    `INSERT INTO realization_media_intake (id, invite_id, storage_key, original_name, status, size_bytes, created_at, upload_token_issued_at)
     VALUES ($1, $2, $3, 'failed-finalize.jpg', 'pending_upload', 12, now() - interval '2 days', now() - interval '2 days')`,
    [failedFinalizeMediaId, inviteId, failedFinalizeSource],
  );
  const failedFinalizeAttempt = await reservePhotoIntakeSanitizationAttempt(failedFinalizeMediaId, inviteId);
  assert.ok(failedFinalizeAttempt);
  simulatedPrivateBlobs.add(failedFinalizeAttempt.targetStorageKey); // private Blob PUT succeeds
  const failedFinalize = await completePhotoIntakeRecord({
    id: failedFinalizeMediaId, inviteId, storageKey: failedFinalizeAttempt.sourceStorageKey,
    targetStorageKey: failedFinalizeAttempt.targetStorageKey, sanitizationAttemptId: failedFinalizeAttempt.id,
    mimeType: 'image/jpeg', sizeBytes: 12, contentHash: 'e'.repeat(64), locality: 'Poprad', categories: ['family_house'], expectedMetadataVersion: 99,
  });
  assert.equal(failedFinalize, null, 'zlyhaná DB finalizácia nesmie zmeniť aktívny storage key');
  await abandonPhotoIntakeSanitizationAttempt(failedFinalizeAttempt.id);
  await inspectPool.query("UPDATE photo_intake_sanitization_attempts SET created_at = now() - interval '10 minutes' WHERE id = $1", [failedFinalizeAttempt.id]);
  assert.equal((await inspectPool.query('SELECT storage_key FROM realization_media_intake WHERE id = $1', [failedFinalizeMediaId])).rows[0].storage_key, failedFinalizeSource,
    'pri zlyhaní finalizácie musí DB naďalej odkazovať na pôvodný súbor');
  assert.ok(simulatedPrivateBlobs.has(failedFinalizeSource), 'pôvodný súbor musí zostať zachovaný');
  const failedFinalizeCleanup = await claimPhotoIntakeSanitizationCleanups(50);
  assert.ok(failedFinalizeCleanup.some((item) => item.id === failedFinalizeAttempt.id && item.storageKey === failedFinalizeAttempt.targetStorageKey),
    'nedokončený cieľ po úspešnom PUT sa musí zaradiť na čistenie');
  simulatedPrivateBlobs.delete(failedFinalizeAttempt.targetStorageKey);
  assert.equal(await completePhotoIntakeSanitizationCleanup(failedFinalizeAttempt.id), true);
  assert.ok(simulatedPrivateBlobs.has(failedFinalizeSource), 'cleanup nesmie zmazať pôvodnú fotografiu');
  assert.ok(!simulatedPrivateBlobs.has(failedFinalizeAttempt.targetStorageKey), 'cleanup odstráni iba nedokončený cieľ');
  await inspectPool.query('DELETE FROM realization_media_intake WHERE id = $1', [failedFinalizeMediaId]);

  const revokedInviteId = randomUUID();
  await inspectPool.query(
    `INSERT INTO photo_upload_invites (id, token_hash, created_by, worker_label, expires_at, revoked_at)
     VALUES ($1, $2, 'integration-test', 'Odvolaná partia', now() + interval '10 days', now())`,
    [revokedInviteId, randomUUID().replaceAll('-', '').padEnd(64, 'b').slice(0, 64)],
  );
  const revokedMediaId = randomUUID();
  await inspectPool.query(
    `INSERT INTO realization_media_intake (id, invite_id, storage_key, original_name, status, size_bytes)
     VALUES ($1, $2, $3, 'revoked-photo.jpg', 'pending_upload', 0)`,
    [revokedMediaId, revokedInviteId, `crew-intake/${revokedInviteId}/${revokedMediaId}.jpg`],
  );
  const safelyClaimedRevoked = await listRevokedPendingPhotoRecords(revokedInviteId);
  assert.equal(safelyClaimedRevoked.length, 1, 'iba expirovaný upload bez čerstvého klientského tokenu sa smie atomicky prevziať na zmazanie');
  assert.equal(safelyClaimedRevoked[0].id, revokedMediaId);
  assert.equal((await inspectPool.query('SELECT status FROM realization_media_intake WHERE id = $1', [revokedMediaId])).rows[0].status, 'deletion_pending');
  assert.equal(await completePhotoIntakeForTest({
    id: revokedMediaId, inviteId: revokedInviteId, storageKey: safelyClaimedRevoked[0].storageKey,
    mimeType: 'image/jpeg', sizeBytes: 1200, contentHash: 'a'.repeat(64), locality: 'Poprad', categories: ['family_house'], expectedMetadataVersion: 1,
  }), null, 'potvrdenie uploadu nesmie vyhrať po atomickom nároku na zmazanie');
  assert.equal(await completePhotoIntakeDeletion(revokedMediaId), true, 'po potvrdenom odstránení objektu sa zmaže aj databázový záznam');

  const recentTokenMediaId = randomUUID();
  await inspectPool.query(
    `INSERT INTO realization_media_intake (id, invite_id, storage_key, original_name, status, size_bytes, upload_token_issued_at)
     VALUES ($1, $2, $3, 'recent-token-photo.jpg', 'pending_upload', 0, now())`,
    [recentTokenMediaId, revokedInviteId, `crew-intake/${revokedInviteId}/${recentTokenMediaId}.jpg`],
  );
  assert.deepEqual(await listRevokedPendingPhotoRecords(revokedInviteId), [], 'čerstvý upload token musí chrániť aj pri odvolaní pozvánky');
  assert.equal((await inspectPool.query('SELECT status FROM realization_media_intake WHERE id = $1', [recentTokenMediaId])).rows[0].status, 'pending_upload');
  assert.equal(await completePhotoIntakeForTest({
    id: recentTokenMediaId, inviteId: revokedInviteId, storageKey: `crew-intake/${revokedInviteId}/${recentTokenMediaId}.jpg`,
    mimeType: 'image/jpeg', sizeBytes: 1200, contentHash: 'c'.repeat(64), locality: 'Poprad', categories: ['family_house'], expectedMetadataVersion: 1,
  }), null, 'zrušená pozvánka sa musí znovu overiť v rovnakej transakcii ako potvrdenie fotografie');
  assert.equal((await inspectPool.query('SELECT status FROM realization_media_intake WHERE id = $1', [recentTokenMediaId])).rows[0].status, 'pending_upload');

  const photoPage = await listPhotoIntakeRecords({ page: 1, pageSize: 2 });
  assert.equal(photoPage.records.length, 2);
  assert.ok(photoPage.total >= photoPage.records.length);
  assert.equal(photoPage.totalPages, Math.max(1, Math.ceil(photoPage.total / 2)));

  const approvedCasePhotoId = randomUUID();
  await inspectPool.query(
    `INSERT INTO realization_media_intake (id, invite_id, storage_key, original_name, status, size_bytes, locality, categories, reviewed_at, reviewed_by, created_at, uploaded_at, sanitized_at)
     VALUES ($1, $2, $3, 'case-approved-photo.jpg', 'approved_private', 1200, 'Poprad', '["family_house"]'::jsonb, now(), 'integration-test', now() - interval '2 days', now() - interval '1 day', now())`,
    [approvedCasePhotoId, inviteId, `photo-intake/${approvedCasePhotoId}.jpg`],
  );
  for (let index = 0; index < 101; index += 1) {
    const newerApprovedId = randomUUID();
    await inspectPool.query(
      `INSERT INTO realization_media_intake (id, invite_id, storage_key, original_name, status, size_bytes, reviewed_at, reviewed_by, sanitized_at)
       VALUES ($1, $2, $3, 'newer-approved-photo.jpg', 'approved_private', 1200, now(), 'integration-test', now())`,
      [newerApprovedId, inviteId, `photo-intake/${newerApprovedId}.jpg`],
    );
  }
  const firstHundredApproved = await listPhotoIntakeRecords({ approvedOnly: true, page: 1, pageSize: 100 });
  assert.equal(firstHundredApproved.records.some((photo) => photo.id === approvedCasePhotoId), false,
    'testovacia pripojená fotka je staršia než prvých 100 dostupných fotografií');
  const caseDraft = await saveRealizationCaseDraft({
    title: 'Izolovaný koncept testovacieho prípadu', locality: 'Poprad', localityPrecision: 'municipality',
    objectType: 'Rodinný dom', materialType: 'Vlnitý eternit', workDescription: 'Overený opis práce.',
    resultDescription: 'Overený výsledok.', areaEstimate: 100, workPeriod: '2025', updatedBy: 'integration-test',
  });
  await setRealizationCaseDraftMedia({ draftId: caseDraft.id, mediaId: approvedCasePhotoId, attach: true, updatedBy: 'integration-test' });
  const draftWithPhoto = (await listRealizationCaseDrafts()).find((draft) => draft.id === caseDraft.id);
  assert.equal(draftWithPhoto?.media.length, 1, 'koncept smie naviazať interne schválenú fotku aj mimo prvej strany dostupných fotografií');
  assert.equal(draftWithPhoto?.media[0].id, approvedCasePhotoId);
  assert.equal(draftWithPhoto?.media[0].phase, 'during', 'staré a novo pripojené fotografie musia dostať bezpečný predvolený stav počas práce');
  await updateRealizationCaseDraftMediaMetadata({
    draftId: caseDraft.id, mediaId: approvedCasePhotoId, phase: 'before', publicCaption: 'Stav pred demontážou', sortOrder: 2, updatedBy: 'integration-test',
  });
  const photoWithMetadata = (await listRealizationCaseDrafts()).find((draft) => draft.id === caseDraft.id)?.media[0];
  assert.deepEqual({ phase: photoWithMetadata?.phase, publicCaption: photoWithMetadata?.publicCaption, sortOrder: photoWithMetadata?.sortOrder },
    { phase: 'before', publicCaption: 'Stav pred demontážou', sortOrder: 2 });
  const attachedPhotoCreatedAt = await inspectPool.query('SELECT created_at FROM realization_media_intake WHERE id=$1', [approvedCasePhotoId]);
  assert.equal(draftWithPhoto?.media[0].createdAt, new Date(attachedPhotoCreatedAt.rows[0].created_at).toISOString(), 'koncept musí správcovi ukázať skutočný dátum prijatia fotky pre kontrolu dlhodobého uchovávania');
  const attachedPhotoUploadedAt = await inspectPool.query('SELECT uploaded_at FROM realization_media_intake WHERE id=$1', [approvedCasePhotoId]);
  assert.equal(draftWithPhoto?.media[0].uploadedAt, new Date(attachedPhotoUploadedAt.rows[0].uploaded_at).toISOString(), 'čas nahratia sa musí odlišovať od skoršie vytvorenej rezervácie');
  assert.equal((await inspectPool.query('SELECT lifecycle FROM realization_case_drafts WHERE id=$1', [caseDraft.id])).rows[0].lifecycle, 'draft');
  const draftAudit = await inspectPool.query("SELECT action FROM audit_logs WHERE entity_type='realization_case_draft' AND entity_id=$1", [caseDraft.id]);
  assert.equal(draftAudit.rows[0]?.action, 'case_draft_created');
  const caseDraftUpdated = await saveRealizationCaseDraft({
    id: caseDraft.id, title: 'Upravený súkromný koncept', locality: 'Poprad', localityPrecision: 'district',
    objectType: 'Rodinný dom', materialType: 'Eternit', workDescription: 'Upravené.', resultDescription: '',
    updatedBy: 'integration-test',
  });
  assert.equal(caseDraftUpdated.title, 'Upravený súkromný koncept');
  assert.equal(caseDraftUpdated.media.length, 1, 'uloženie textu nesmie potichu odpojiť existujúcu fotografiu');
  assert.equal((await inspectPool.query('SELECT status FROM realization_media_intake WHERE id=$1', [approvedCasePhotoId])).rows[0].status, 'approved_private');
  const rejectedPhotoId = randomUUID();
  await inspectPool.query(
    `INSERT INTO realization_media_intake (id, invite_id, storage_key, original_name, status, size_bytes)
     VALUES ($1, $2, $3, 'case-rejected-photo.jpg', 'rejected', 1200)`,
    [rejectedPhotoId, inviteId, `photo-intake/${rejectedPhotoId}.jpg`],
  );
  const unapprovedPhotoError = await setRealizationCaseDraftMedia({ draftId: caseDraft.id, mediaId: rejectedPhotoId, attach: true, updatedBy: 'integration-test' }).then(() => null, (error) => error);
  assert.match(String(unapprovedPhotoError?.message ?? ''), /iba po internom schválení/);
  assert.equal((await inspectPool.query('SELECT title FROM realization_case_drafts WHERE id=$1', [caseDraft.id])).rows[0].title, 'Upravený súkromný koncept', 'neplatná fotka musí zrušiť celú zmenu konceptu');
  assert.equal(Number((await inspectPool.query('SELECT COUNT(*)::int AS count FROM realization_case_draft_media WHERE draft_id=$1 AND media_id=$2', [caseDraft.id, rejectedPhotoId])).rows[0].count), 0,
    'odmietnuté pripojenie nesmie vytvoriť väzbu');
  assert.equal(Number((await inspectPool.query("SELECT COUNT(*)::int AS count FROM audit_logs WHERE entity_type='realization_case_draft' AND entity_id=$1 AND action='case_draft_photo_attached'", [caseDraft.id])).rows[0].count), 1,
    'zlyhané pripojenie nesmie vytvoriť auditný záznam');
  await setRealizationCaseDraftMedia({ draftId: caseDraft.id, mediaId: approvedCasePhotoId, attach: false, updatedBy: 'integration-test' });
  assert.equal((await listRealizationCaseDrafts()).find((draft) => draft.id === caseDraft.id)?.media.length, 0, 'fotku možno odpojiť explicitnou samostatnou akciou');
  assert.ok((await listRealizationCaseDrafts()).some((draft) => draft.id === caseDraft.id));
  await setRealizationCaseDraftMedia({ draftId: caseDraft.id, mediaId: approvedCasePhotoId, attach: true, updatedBy: 'integration-test' });
  assert.equal(await withdrawApprovedPhotoIntakeRecord({ id: approvedCasePhotoId, withdrawnBy: 'integration-test', expectedMetadataVersion: 1 }), true,
    'správca môže interne schválenú fotografiu vyradiť aj po pripojení k súkromnému konceptu');
  assert.equal((await inspectPool.query('SELECT status, deletion_reason FROM realization_media_intake WHERE id=$1', [approvedCasePhotoId])).rows[0].status, 'deletion_pending');
  assert.equal((await listRealizationCaseDrafts()).find((draft) => draft.id === caseDraft.id)?.media.length, 0,
    'vyradená fotografia sa okamžite prestane zobrazovať v konceptoch');
  assert.equal(await setRealizationCaseDraftMedia({ draftId: caseDraft.id, mediaId: approvedCasePhotoId, attach: true, updatedBy: 'integration-test' }).then(() => true, () => false), false,
    'vyradenú fotografiu nemožno znovu pripojiť');
  const withdrawnDeletion = await claimDuePhotoIntakeDeletions(10);
  assert.ok(withdrawnDeletion.some((item) => item.id === approvedCasePhotoId && item.reason === 'admin_withdrawal'),
    'explicitne vyradená fotografia vstúpi do retenčného mazania aj keď mala väzbu na draft');
  assert.equal(await completePhotoIntakeDeletion(approvedCasePhotoId), true);
  assert.equal(Number((await inspectPool.query('SELECT COUNT(*)::int AS count FROM realization_case_draft_media WHERE media_id=$1', [approvedCasePhotoId])).rows[0].count), 0,
    'potvrdené zmazanie bezpečne odstráni aj súkromnú väzbu na koncept');
  assert.equal(Number((await inspectPool.query("SELECT COUNT(*)::int AS count FROM audit_logs WHERE entity_id=$1 AND action='photo_intake_withdrawal_requested'", [approvedCasePhotoId])).rows[0].count), 1);

  const jobBoundPhotoId = randomUUID();
  await inspectPool.query(
    `INSERT INTO realization_media_intake (id, invite_id, storage_key, original_name, status, size_bytes, locality, categories, reviewed_at, reviewed_by, sanitized_at)
     VALUES ($1, $2, $3, 'job-bound-photo.jpg', 'approved_private', 1200, 'Poprad', '["family_house"]'::jsonb, now(), 'integration-test', now())`,
    [jobBoundPhotoId, assignedPhotoInvite.id, `photo-intake/${jobBoundPhotoId}.jpg`],
  );
  const jobBoundDraft = await saveRealizationCaseDraft({
    businessJobId: completedPhotoJobId, title: 'Koncept viazaný na CRM zákazku', locality: 'Poprad', localityPrecision: 'district',
    objectType: 'Rodinný dom', materialType: 'Eternit', workDescription: '', resultDescription: '', updatedBy: 'integration-test',
  });
  assert.deepEqual(jobBoundDraft.businessJob, { id: completedPhotoJobId, demolitionDate: '2026-09-01', district: 'Poprad', exactLocation: '' });
  await inspectPool.query("UPDATE business_jobs SET status='V_REALIZACII' WHERE id=$1", [completedPhotoJobId]);
  const editedBoundDraft = await saveRealizationCaseDraft({
    id: jobBoundDraft.id, businessJobId: completedPhotoJobId, title: 'Upravený koncept s historickou väzbou', locality: 'Poprad', localityPrecision: 'district',
    objectType: 'Rodinný dom', materialType: 'Eternit', workDescription: 'Potvrdená úprava.', resultDescription: '', updatedBy: 'integration-test',
  });
  assert.equal(editedBoundDraft.businessJobId, completedPhotoJobId, 'úprava konceptu musí zachovať zákazku, ktorá už nie je v zozname dokončených zákaziek');
  await setRealizationCaseDraftMedia({ draftId: jobBoundDraft.id, mediaId: jobBoundPhotoId, attach: true, updatedBy: 'integration-test' });
  const listedJobBoundDraft = (await listRealizationCaseDrafts()).find((draft) => draft.id === jobBoundDraft.id);
  assert.equal(listedJobBoundDraft?.media[0]?.id, jobBoundPhotoId);
  const assignedCasePhotos = await listPhotoIntakeRecords({ businessJobId: completedPhotoJobId, approvedOnly: true, page: 1, pageSize: 100 });
  assert.equal(assignedCasePhotos.records.find((photo) => photo.id === jobBoundPhotoId)?.businessJobId, completedPhotoJobId);
  assert.equal(assignedCasePhotos.records.some((photo) => photo.id === approvedCasePhotoId), false, 'SQL stránkovanie nesmie vracať fotky inej zákazky');
  const otherCompletedJobId = randomUUID();
  await inspectPool.query(
    `INSERT INTO business_jobs (id, demolition_date, customer_name, district, status)
     VALUES ($1, DATE '2026-09-03', 'INÝ SÚKROMNÝ TEST', 'Kežmarok', 'DOKONCENA')`,
    [otherCompletedJobId],
  );
  const otherPhotoInviteHash = createHash('sha256').update(randomUUID()).digest('hex');
  const otherPhotoInvite = await createPhotoUploadInvite(otherPhotoInviteHash, 'integration-test', new Date(Date.now() + 7 * 86400000), 'Druhá testovacia partia', otherCompletedJobId);
  const otherJobPhotoId = randomUUID();
  await inspectPool.query(
    `INSERT INTO realization_media_intake (id, invite_id, storage_key, original_name, status, size_bytes, mime_type, locality, categories, reviewed_at, reviewed_by, sanitized_at)
     VALUES ($1, $2, $3, 'other-job-approved-photo.jpg', 'approved_private', 1200, 'image/jpeg', 'Kežmarok', '["family_house"]'::jsonb, now(), 'integration-test', now())`,
    [otherJobPhotoId, otherPhotoInvite.id, `photo-intake/${otherJobPhotoId}.jpg`],
  );
  await inspectPool.query('UPDATE realization_media_intake SET storage_key=$2 WHERE id=$1',
    [otherJobPhotoId, `photo-intake/sanitized/${otherJobPhotoId}/${randomUUID()}.jpg`]);
  const autoDraftJobId = randomUUID();
  await inspectPool.query(
    `INSERT INTO business_jobs (id, demolition_date, customer_name, district, status)
     VALUES ($1, DATE '2026-09-04', 'AUTOMATION TEST CUSTOMER', 'Poprad', 'DOKONCENA')`,
    [autoDraftJobId],
  );
  const autoDraftInviteHash = createHash('sha256').update(randomUUID()).digest('hex');
  const autoDraftInvite = await createPhotoUploadInvite(autoDraftInviteHash, 'integration-test', new Date(Date.now() + 7 * 86400000), 'Test automatického konceptu', autoDraftJobId);
  const autoDraftPhotoId = randomUUID();
  await inspectPool.query(
    `INSERT INTO realization_media_intake (id, invite_id, storage_key, original_name, status, size_bytes, mime_type, locality, categories, reviewed_at, reviewed_by, sanitized_at)
     VALUES ($1,$2,$3,'auto-draft-approved.jpg','approved_private',1200,'image/jpeg','Poprad','["family_house","garage"]'::jsonb,now(),'integration-test',now())`,
    [autoDraftPhotoId, autoDraftInvite.id, `photo-intake/sanitized/${autoDraftPhotoId}/${randomUUID()}.jpg`],
  );
  const [autoDraftFirst, autoDraftRetry] = await Promise.all([
    createCaseDraftFromApprovedPhoto({ mediaId: autoDraftPhotoId, updatedBy: 'integration-test' }),
    createCaseDraftFromApprovedPhoto({ mediaId: autoDraftPhotoId, updatedBy: 'integration-test' }),
  ]);
  assert.equal(autoDraftFirst.draftId, autoDraftRetry.draftId, 'súbežné opakovanie tej istej akcie nesmie vytvoriť viac konceptov');
  assert.equal([autoDraftFirst, autoDraftRetry].filter((result) => result.created).length, 1);
  assert.equal([autoDraftFirst, autoDraftRetry].filter((result) => result.attached).length, 1);
  const autoDraft = (await listRealizationCaseDrafts()).find((draft) => draft.id === autoDraftFirst.draftId);
  assert.equal(autoDraft?.lifecycle, 'draft', 'automatizácia smie pripraviť iba súkromný koncept');
  assert.equal(autoDraft?.businessJobId, autoDraftJobId);
  assert.equal(autoDraft?.locality, 'Poprad');
  assert.equal(autoDraft?.localityPrecision, 'none', 'automatizácia nesmie domýšľať presnosť lokality');
  assert.equal(autoDraft?.objectType, 'Rodinný dom, Garáž');
  assert.equal(autoDraft?.materialType, '', 'automatizácia nesmie odhadovať materiál len z kategórie fotky');
  assert.equal(autoDraft?.workDescription, '', 'automatizácia nesmie vytvárať nedoložený opis práce');
  assert.deepEqual(autoDraft?.media.map((photo) => photo.id), [autoDraftPhotoId]);
  assert.equal(Number((await inspectPool.query("SELECT COUNT(*)::int AS count FROM audit_logs WHERE entity_id=$1 AND action='case_draft_created_from_photo'", [autoDraftFirst.draftId])).rows[0].count), 1);
  const initialPhotoDraftAudit = await inspectPool.query(
    "SELECT changes::text AS changes_text FROM audit_logs WHERE entity_id=$1 AND action='case_draft_created_from_photo'",
    [autoDraftFirst.draftId],
  );
  assert.deepEqual(JSON.parse(initialPhotoDraftAudit.rows[0].changes_text), {
    mediaId: autoDraftPhotoId, businessJobId: autoDraftJobId,
    localityPrefilled: true, objectTypePrefilled: true, lifecycle: 'draft',
  }, 'audit prvého konceptu musí zaznamenať obe predvyplnené hodnoty');
  assert.equal((await listPublishedRealizationCases()).some((item) => item.id === autoDraftFirst.draftId), false, 'automaticky vytvorený koncept nesmie byť verejný');
  await saveRealizationCaseDraft({
    id: autoDraftFirst.draftId, title: autoDraft?.title ?? '', locality: 'Poprad', localityPrecision: 'none',
    objectType: '', materialType: '', workDescription: '', resultDescription: '', workPeriod: '', updatedBy: 'integration-test',
  });
  const metadataOnlyRetry = await createCaseDraftFromApprovedPhoto({ mediaId: autoDraftPhotoId, updatedBy: 'integration-test' });
  assert.equal(metadataOnlyRetry.attached, false, 'opakovanie nesmie predstierať nové pripojenie už pripojenej fotografie');
  assert.equal(metadataOnlyRetry.localityPrefilled, false);
  assert.equal(metadataOnlyRetry.objectTypePrefilled, true);
  const caseMetadataAudit = await inspectPool.query(
    "SELECT changes::text AS changes_text FROM audit_logs WHERE entity_id=$1 AND action='case_draft_metadata_prefilled_from_photo' ORDER BY created_at DESC LIMIT 1",
    [autoDraftFirst.draftId],
  );
  assert.deepEqual(JSON.parse(caseMetadataAudit.rows[0].changes_text), {
    mediaId: autoDraftPhotoId, businessJobId: autoDraftJobId,
    localityPrefilled: false, objectTypePrefilled: true, lifecycle: 'draft',
  }, 'audit má uviesť presne ktoré prázdne pole doplnil');
  const autoDraftSecondPhotoId = randomUUID();
  await inspectPool.query(
    `INSERT INTO realization_media_intake (id, invite_id, storage_key, original_name, status, size_bytes, mime_type, locality, categories, reviewed_at, reviewed_by, sanitized_at)
     VALUES ($1,$2,$3,'auto-draft-second-approved.jpg','approved_private',1200,'image/jpeg','Poprad','["family_house"]'::jsonb,now(),'integration-test',now())`,
    [autoDraftSecondPhotoId, autoDraftInvite.id, `photo-intake/sanitized/${autoDraftSecondPhotoId}/${randomUUID()}.jpg`],
  );
  const secondPhotoAttach = await Promise.all([
    createCaseDraftFromApprovedPhoto({ mediaId: autoDraftSecondPhotoId, updatedBy: 'integration-test' }),
    setRealizationCaseDraftMedia({ draftId: autoDraftFirst.draftId, mediaId: autoDraftSecondPhotoId, attach: true, updatedBy: 'integration-test' }),
  ]);
  assert.ok(secondPhotoAttach[0].lifecycle === 'draft');
  assert.equal(secondPhotoAttach[0].draftId, autoDraftFirst.draftId, 'ďalšia fotografia tej istej zákazky sa pridá do rovnakého konceptu');
  assert.deepEqual(new Set((await listRealizationCaseDrafts()).find((draft) => draft.id === autoDraftFirst.draftId)?.media.map((photo) => photo.id)), new Set([autoDraftPhotoId, autoDraftSecondPhotoId]));
  const duplicateManualDraftError = await saveRealizationCaseDraft({
    businessJobId: autoDraftJobId, title: 'Druhý koncept nesmie vzniknúť', locality: 'Poprad', localityPrecision: 'none',
    objectType: '', materialType: '', workDescription: '', resultDescription: '', workPeriod: '', updatedBy: 'integration-test',
  }).then(() => null, (error) => error);
  assert.match(String(duplicateManualDraftError?.message ?? ''), /už má rozpracovaný alebo zverejnený prípad/);
  assert.equal((await listRealizationCaseDrafts()).filter((draft) => draft.businessJobId === autoDraftJobId).length, 1,
    'ručné a automatické vytváranie musia rešpektovať jeden koncept na dokončenú zákazku');
  const publishableCase = await saveRealizationCaseDraft({
    businessJobId: otherCompletedJobId, title: 'Bezpečne pripravená strecha', locality: '', localityPrecision: 'none',
    objectType: 'Rodinný dom', materialType: 'Vlnitý eternit', workDescription: 'Kontrolovaná demontáž a balenie.',
    resultDescription: 'Odpad bol odovzdaný na určené zneškodnenie.', workPeriod: '2026', updatedBy: 'integration-test',
  });
  await setRealizationCaseDraftMedia({ draftId: publishableCase.id, mediaId: otherJobPhotoId, attach: true, updatedBy: 'integration-test' });
  await updateRealizationCaseDraftMediaMetadata({
    draftId: publishableCase.id, mediaId: otherJobPhotoId, phase: 'after', publicCaption: 'Strecha po bezpečnej demontáži', sortOrder: 1, updatedBy: 'integration-test',
  });
  assert.deepEqual(await listPublishedRealizationCases(), [], 'súkromné koncepty nikdy nesmú vstúpiť do verejného zoznamu');
  assert.equal(await getPublishedRealizationCasePhoto(otherJobPhotoId), null, 'schválená súkromná fotografia nie je verejne čitateľná pred publikovaním prípadu');
  const publicationConstraints = await inspectPool.query(
    "SELECT conname FROM pg_constraint WHERE conrelid='realization_case_drafts'::regclass AND conname IN ('realization_case_drafts_publication_approval_check', 'realization_case_drafts_published_at_check')",
  );
  assert.deepEqual(new Set(publicationConstraints.rows.map((row) => row.conname)), new Set([
    'realization_case_drafts_publication_approval_check', 'realization_case_drafts_published_at_check',
  ]), 'databáza musí mať nezávislé obmedzenia proti neúplnému alebo obídenému zverejneniu');
  await transitionRealizationCaseDraft({ draftId: publishableCase.id, nextLifecycle: 'reviewed', updatedBy: 'integration-test' });
  const missingProofError = await transitionRealizationCaseDraft({
    draftId: publishableCase.id, nextLifecycle: 'approved', updatedBy: 'integration-test', publicationEvidence: 'CRM záznam',
  }).then(() => null, (error) => error);
  assert.match(String(missingProofError?.message ?? ''), /vyžaduje potvrdenie práv/);
  assert.equal((await inspectPool.query('SELECT lifecycle FROM realization_case_drafts WHERE id=$1', [publishableCase.id])).rows[0].lifecycle, 'reviewed',
    'neúplné schválenie nesmie zmeniť stav ani uložiť súhlas');
  await transitionRealizationCaseDraft({
    draftId: publishableCase.id, nextLifecycle: 'approved', updatedBy: 'integration-test', publicationEvidence: 'CRM súhlas 2026-09-03',
    rightsConfirmed: true, locationConfirmed: true, contentConfirmed: true,
  });
  assert.equal((await inspectPool.query('SELECT lifecycle FROM realization_case_drafts WHERE id=$1', [publishableCase.id])).rows[0].lifecycle, 'approved');
  assert.deepEqual(await listPublishedRealizationCases(), [], 'schválenie ešte samo osebe obsah nezverejňuje');
  assert.equal(await getPublishedRealizationCasePhoto(otherJobPhotoId), null, 'schválenie samo osebe fotografiu nesprístupní');
  await transitionRealizationCaseDraft({ draftId: publishableCase.id, nextLifecycle: 'draft', updatedBy: 'integration-test' });
  const resetApproval = await inspectPool.query(
    'SELECT lifecycle, publication_evidence, publication_rights_confirmed, publication_location_confirmed, publication_content_confirmed, publication_approved_at FROM realization_case_drafts WHERE id=$1',
    [publishableCase.id],
  );
  assert.deepEqual(resetApproval.rows[0], {
    lifecycle: 'draft', publication_evidence: '', publication_rights_confirmed: false,
    publication_location_confirmed: false, publication_content_confirmed: false, publication_approved_at: null,
  }, 'návrat schváleného prípadu do úpravy musí zrušiť staré publikačné schválenie');
  await saveRealizationCaseDraft({
    id: publishableCase.id, title: 'Bezpečne pripravená strecha – upravené', locality: '', localityPrecision: 'none',
    objectType: 'Rodinný dom', materialType: 'Vlnitý eternit', workDescription: 'Kontrolovaná demontáž a balenie.',
    resultDescription: 'Odpad bol odovzdaný na určené zneškodnenie.', workPeriod: '2026', updatedBy: 'integration-test',
  });
  await transitionRealizationCaseDraft({ draftId: publishableCase.id, nextLifecycle: 'reviewed', updatedBy: 'integration-test' });
  const oldApprovalCannotPublish = await transitionRealizationCaseDraft({ draftId: publishableCase.id, nextLifecycle: 'published', updatedBy: 'integration-test' }).then(() => null, (error) => error);
  assert.match(String(oldApprovalCannotPublish?.message ?? ''), /Zverejniť možno iba úplne schválený prípad/);
  await transitionRealizationCaseDraft({
    draftId: publishableCase.id, nextLifecycle: 'approved', updatedBy: 'integration-test', publicationEvidence: 'CRM súhlas po úprave',
    rightsConfirmed: true, locationConfirmed: true, contentConfirmed: true,
  });
  await transitionRealizationCaseDraft({ draftId: publishableCase.id, nextLifecycle: 'published', updatedBy: 'integration-test' });
  const secondPublishedJobId = randomUUID();
  await inspectPool.query(
    `INSERT INTO business_jobs (id, demolition_date, customer_name, district, status)
     VALUES ($1, DATE '2026-09-05', 'PAGINATION TEST CUSTOMER', 'Poprad', 'DOKONCENA')`,
    [secondPublishedJobId],
  );
  const secondInvite = await createPhotoUploadInvite(createHash('sha256').update(randomUUID()).digest('hex'),
    'integration-test', new Date(Date.now() + 7 * 86400000), 'Druhá publikovaná testovacia realizácia', secondPublishedJobId);
  const secondPublishedPhotoId = randomUUID();
  await inspectPool.query(
    `INSERT INTO realization_media_intake (id, invite_id, storage_key, original_name, status, size_bytes, mime_type, locality, categories, reviewed_at, reviewed_by, sanitized_at)
     VALUES ($1,$2,$3,'second-published-case.jpg','approved_private',1200,'image/jpeg','Poprad','["family_house"]'::jsonb,now(),'integration-test',now())`,
    [secondPublishedPhotoId, secondInvite.id, `photo-intake/sanitized/${secondPublishedPhotoId}/${randomUUID()}.jpg`],
  );
  const secondPublishedCase = await saveRealizationCaseDraft({
    businessJobId: secondPublishedJobId, title: 'Druhá stránkovaná realizácia', locality: '', localityPrecision: 'none',
    objectType: 'Rodinný dom', materialType: 'Vlnitý eternit', workDescription: 'Bezpečná demontáž a balenie.',
    resultDescription: 'Pracovisko pripravené na ďalší postup.', workPeriod: '2026', updatedBy: 'integration-test',
  });
  await setRealizationCaseDraftMedia({ draftId: secondPublishedCase.id, mediaId: secondPublishedPhotoId, attach: true, updatedBy: 'integration-test' });
  await transitionRealizationCaseDraft({ draftId: secondPublishedCase.id, nextLifecycle: 'reviewed', updatedBy: 'integration-test' });
  await transitionRealizationCaseDraft({
    draftId: secondPublishedCase.id, nextLifecycle: 'approved', updatedBy: 'integration-test', publicationEvidence: 'Izolovaný pagination test',
    rightsConfirmed: true, locationConfirmed: true, contentConfirmed: true,
  });
  await transitionRealizationCaseDraft({ draftId: secondPublishedCase.id, nextLifecycle: 'published', updatedBy: 'integration-test' });
  await inspectPool.query(
    'UPDATE realization_case_drafts SET published_at=(SELECT published_at - interval \'1 minute\' FROM realization_case_drafts WHERE id=$1) WHERE id=$2',
    [publishableCase.id, secondPublishedCase.id],
  );
  const publicCases = await listPublishedRealizationCases();
  assert.equal(await countPublishedRealizationCases(), publicCases.length, 'počet stránkovania sa musí zhodovať s verejným allow-listom');
  assert.equal(publicCases.length, 2);
  assert.deepEqual(await listPublishedRealizationCases(1, 0), publicCases.slice(0, 1), 'prvá stránka používa zoradené verejné prípady');
  assert.deepEqual(await listPublishedRealizationCases(1, 1), publicCases.slice(1, 2), 'ďalšia stránka sprístupní starší publikovaný prípad');
  assert.deepEqual(await listPublishedRealizationCases(1, 2), [], 'offset mimo poslednej stránky nevracia súkromné alebo náhodné záznamy');
  await transitionRealizationCaseDraft({ draftId: secondPublishedCase.id, nextLifecycle: 'withdrawn', updatedBy: 'integration-test' });
  assert.equal(publicCases[0].locality, '', 'prípad bez zverejniteľnej lokality môže byť bezpečne publikovaný bez mapového bodu');
  assert.equal(publicCases[0].localityPrecision, 'none');
  assert.equal(publicCases[0].id, publishableCase.id);
  assert.equal(publicCases[0].locality, '');
  assert.deepEqual(publicCases[0].photoIds, [otherJobPhotoId]);
  assert.deepEqual(publicCases[0].photos, [{ id: otherJobPhotoId, phase: 'after', publicCaption: 'Strecha po bezpečnej demontáži', sortOrder: 1 }]);
  assert.equal('businessJobId' in publicCases[0], false, 'verejný DTO nesmie obsahovať internú väzbu na CRM');
  assert.equal('publicationEvidence' in publicCases[0], false, 'verejný DTO nesmie odhaliť interné dôkazy súhlasu');
  const publishedPhoto = await getPublishedRealizationCasePhoto(otherJobPhotoId);
  assert.match(publishedPhoto?.storageKey ?? '', new RegExp(`^photo-intake/sanitized/${otherJobPhotoId}/[0-9a-f-]+\\.jpg$`));
  assert.equal(await setBusinessJobTestData(otherCompletedJobId, true, 'integration-test', 'Testovacie CRM údaje'), true);
  assert.deepEqual(await listPublishedRealizationCases(), [], 'dodatočne označená testovacia zákazka nesmie zostať verejnou realizáciou');
  assert.equal(await getPublishedRealizationCasePhoto(otherJobPhotoId), null, 'fotografia testovacej zákazky musí byť okamžite neprístupná');
  assert.equal(await setBusinessJobTestData(otherCompletedJobId, false, 'integration-test', 'Testovacie CRM údaje'), true);
  assert.equal((await listPublishedRealizationCases())[0]?.id, publishableCase.id, 'oprava klasifikácie môže obnoviť schválený prípad');
  const caseLeadId = randomUUID();
  await inspectPool.query(
    `INSERT INTO leads (id, full_name, phone, email, city, object_type, material_type, area_estimate)
     VALUES ($1, 'CASE PRIVACY TEST', '0905000000', 'case-privacy@example.invalid', 'Poprad', 'Rodinný dom', 'Eternit', 100)`,
    [caseLeadId],
  );
  await inspectPool.query('UPDATE business_jobs SET lead_id=$1 WHERE id=$2', [caseLeadId, otherCompletedJobId]);
  assert.equal(await setLeadTestData(caseLeadId, true, 'integration-test', 'Testovacie CRM údaje'), true);
  assert.deepEqual(await listPublishedRealizationCases(), [], 'testovací zdrojový dopyt musí skryť aj inak obchodnú realizáciu');
  assert.equal(await getPublishedRealizationCasePhoto(otherJobPhotoId), null, 'fotografia pri testovacom zdrojovom dopyte musí byť neprístupná');
  assert.equal(await setLeadTestData(caseLeadId, false, 'integration-test', 'Testovacie CRM údaje'), true);
  assert.equal((await listPublishedRealizationCases())[0]?.id, publishableCase.id, 'opravený zdrojový dopyt môže obnoviť schválený prípad');
  assert.match((await getPublishedRealizationCasePhoto(otherJobPhotoId))?.storageKey ?? '', /^photo-intake\/sanitized\//);
  await inspectPool.query('UPDATE business_jobs SET lead_id=NULL WHERE id=$1', [otherCompletedJobId]);
  await inspectPool.query('DELETE FROM leads WHERE id=$1', [caseLeadId]);
  await transitionRealizationCaseDraft({ draftId: publishableCase.id, nextLifecycle: 'withdrawn', updatedBy: 'integration-test' });
  assert.deepEqual(await listPublishedRealizationCases(), [], 'stiahnutý prípad sa okamžite odstráni z verejného zoznamu');
  assert.equal(await getPublishedRealizationCasePhoto(otherJobPhotoId), null, 'stiahnutá fotografia sa okamžite prestane podávať');
  const lifecycleAudit = await inspectPool.query("SELECT action FROM audit_logs WHERE entity_type='realization_case_draft' AND entity_id=$1 ORDER BY created_at", [publishableCase.id]);
  assert.deepEqual(lifecycleAudit.rows.map((row) => row.action), [
    'case_draft_created', 'case_draft_photo_attached', 'case_draft_photo_metadata_updated', 'case_reviewed', 'case_approved', 'case_draft', 'case_draft_updated', 'case_reviewed', 'case_approved', 'case_published', 'case_withdrawn',
  ]);
  const crossJobAttachError = await setRealizationCaseDraftMedia({ draftId: jobBoundDraft.id, mediaId: otherJobPhotoId, attach: true, updatedBy: 'integration-test' }).then(() => null, (error) => error);
  assert.match(String(crossJobAttachError?.message ?? ''), /rovnakej CRM zákazky/);
  assert.equal(Number((await inspectPool.query('SELECT COUNT(*)::int AS count FROM realization_case_draft_media WHERE draft_id=$1 AND media_id=$2', [jobBoundDraft.id, otherJobPhotoId])).rows[0].count), 0,
    'fotografia z inej CRM zákazky sa nesmie pripojiť');
  assert.equal(Number((await inspectPool.query("SELECT COUNT(*)::int AS count FROM audit_logs WHERE entity_type='realization_case_draft' AND entity_id=$1 AND action='case_draft_photo_attached'", [jobBoundDraft.id])).rows[0].count), 1,
    'odmietnutá fotografia inej zákazky nesmie vytvoriť auditnú udalosť pripojenia');
  const reassignmentError = await saveRealizationCaseDraft({
    id: jobBoundDraft.id, businessJobId: otherCompletedJobId, title: 'Prehodená zákazka', locality: 'Poprad', localityPrecision: 'district',
    objectType: 'Rodinný dom', materialType: 'Eternit', workDescription: '', resultDescription: '', updatedBy: 'integration-test',
  }).then(() => null, (error) => error);
  assert.match(String(reassignmentError?.message ?? ''), /fotografie z inej CRM zákazky/);
  assert.equal((await inspectPool.query('SELECT business_job_id FROM realization_case_drafts WHERE id=$1', [jobBoundDraft.id])).rows[0].business_job_id, completedPhotoJobId,
    'zmena väzby na inú zákazku nesmie prehodiť existujúce fotografie');
  const filteredOtherJobPhotos = await listPhotoIntakeRecords({ businessJobId: completedPhotoJobId, approvedOnly: true, page: 1, pageSize: 100 });
  assert.equal(filteredOtherJobPhotos.records.some((photo) => photo.id === otherJobPhotoId), false, 'SQL výber príloh musí skryť aj schválené fotky cudzej zákazky');

  const concurrentMediaIds = [];
  for (let index = 0; index < 4; index += 1) {
    const mediaId = randomUUID();
    concurrentMediaIds.push(mediaId);
    await inspectPool.query(
      `INSERT INTO realization_media_intake (id, invite_id, storage_key, original_name, status, size_bytes, uploaded_at)
       VALUES ($1, $2, $3, 'parallel-retention-test.jpg', 'pending_review', 12, now() - interval '31 days')`,
      [mediaId, inviteId, `photo-intake/${mediaId}.jpg`],
    );
  }
  const concurrentClaims = await Promise.all([claimDuePhotoIntakeDeletions(2), claimDuePhotoIntakeDeletions(2)]);
  const claimedIds = concurrentClaims.flat().map((item) => item.id);
  assert.equal(new Set(claimedIds).size, claimedIds.length, 'súbežné cron behy nesmú naraz prevziať rovnaký Blob objekt');
  assert.deepEqual(new Set(claimedIds), new Set(concurrentMediaIds), 'dva súbežné cron behy majú bezpečne rozdeliť dávku');
  for (const mediaId of concurrentMediaIds) assert.equal(await completePhotoIntakeDeletion(mediaId), true);

  const editablePhotoId = randomUUID();
  await inspectPool.query(
    `INSERT INTO realization_media_intake (id, invite_id, storage_key, original_name, status, size_bytes, locality, categories, uploaded_at)
     VALUES ($1, $2, $3, 'editable-photo.jpg', 'pending_review', 1200, '', '[]'::jsonb, now())`,
    [editablePhotoId, inviteId, `photo-intake/${editablePhotoId}.jpg`],
  );
  const editedPhoto = await updatePhotoIntakeMetadata({ id: editablePhotoId, locality: 'Poprad', categories: ['family_house', 'interior'], updatedBy: 'photo-invite-test', expectedMetadataVersion: 1, inviteId });
  assert.equal(editedPhoto?.locality, 'Poprad');
  assert.deepEqual(editedPhoto?.categories, ['family_house', 'interior']);
  const metadataRevokedInviteId = randomUUID();
  await inspectPool.query(
    `INSERT INTO photo_upload_invites (id, token_hash, created_by, worker_label, expires_at, revoked_at)
     VALUES ($1, $2, 'integration-test', 'Odvolaná skúšobná pozvánka', now() + interval '1 day', now())`,
    [metadataRevokedInviteId, createHash('sha256').update(metadataRevokedInviteId).digest('hex')],
  );
  const revokedInvitePhotoId = randomUUID();
  await inspectPool.query(
    `INSERT INTO realization_media_intake (id, invite_id, storage_key, original_name, status, size_bytes, locality, categories, uploaded_at)
     VALUES ($1, $2, $3, 'revoked-invite-photo.jpg', 'pending_review', 1200, 'Poprad', '["family_house"]'::jsonb, now())`,
    [revokedInvitePhotoId, metadataRevokedInviteId, `photo-intake/${revokedInvitePhotoId}.jpg`],
  );
  assert.equal(await updatePhotoIntakeMetadata({
    id: revokedInvitePhotoId, locality: 'Kežmarok', categories: ['garage'], updatedBy: 'photo-invite-test', expectedMetadataVersion: 1, inviteId: metadataRevokedInviteId,
  }), null, 'odvolaná pozvánka nesmie uložiť úpravu fotky ani po obnovení starej relácie');
  assert.equal((await inspectPool.query('SELECT locality FROM realization_media_intake WHERE id=$1', [revokedInvitePhotoId])).rows[0]?.locality, 'Poprad');
  const metadataAudit = await inspectPool.query('SELECT action, changes::text FROM audit_logs WHERE entity_id = $1', [editablePhotoId]);
  assert.equal(metadataAudit.rows[0]?.action, 'photo_intake_metadata_updated');
  assert.equal(String(metadataAudit.rows[0]?.changes).includes('Poprad'), false, 'audit nesmie kopírovať voľný text lokality');
  const staleWorkerConfirmation = await completePhotoIntakeForTest({
    id: editablePhotoId, inviteId, storageKey: `photo-intake/${editablePhotoId}.jpg`, mimeType: 'image/jpeg', sizeBytes: 1200,
    contentHash: 'a'.repeat(64), locality: 'Poprad', categories: ['family_house'], expectedMetadataVersion: 1,
  });
  assert.equal(staleWorkerConfirmation, null, 'zastaralý formulár pracovníka nesmie prepísať novšiu opravu správcu');
  const preservedAdminMetadata = await inspectPool.query('SELECT locality, categories, metadata_version FROM realization_media_intake WHERE id = $1', [editablePhotoId]);
  assert.equal(preservedAdminMetadata.rows[0]?.locality, 'Poprad');
  assert.deepEqual(preservedAdminMetadata.rows[0]?.categories, ['family_house', 'interior']);
  assert.equal(Number(preservedAdminMetadata.rows[0]?.metadata_version), 2);
  assert.equal(await updatePhotoIntakeMetadata({ id: editablePhotoId, locality: 'Poprad', categories: ['family_house'], updatedBy: 'integration-test', expectedMetadataVersion: 1 }), null,
    'zastaraná administračná karta nesmie prepísať novšie údaje pracovníka');
  const sameWorkerConfirmation = await completePhotoIntakeForTest({
    id: editablePhotoId, inviteId, storageKey: `photo-intake/${editablePhotoId}.jpg`, mimeType: 'image/jpeg', sizeBytes: 1200,
    contentHash: 'a'.repeat(64), locality: 'Poprad', categories: ['family_house', 'interior'], expectedMetadataVersion: 2,
  });
  assert.equal(sameWorkerConfirmation?.locality, 'Poprad', 'opakovanie s rovnakými údajmi ostáva bezpečné a nemení opravu');
  assert.ok(sameWorkerConfirmation?.sanitizedAt, 'fotografia sa označí ako očistená iba po uložení jej finálneho obsahu do DB');
  assert.equal(sameWorkerConfirmation?.metadataVersion, 3);
  assert.equal(sameWorkerConfirmation?.contentHash, 'a'.repeat(64));
  const sameContentRetry = await completePhotoIntakeForTest({
    id: editablePhotoId, inviteId, storageKey: `photo-intake/${editablePhotoId}.jpg`, mimeType: 'image/jpeg', sizeBytes: 1200,
    contentHash: 'a'.repeat(64), locality: 'Poprad', categories: ['family_house', 'interior'], expectedMetadataVersion: 2,
  });
  assert.equal(sameContentRetry?.contentHash, 'a'.repeat(64), 'rovnaké potvrdenie obsahu je idempotentné');
  const changedContentRetry = await completePhotoIntakeForTest({
    id: editablePhotoId, inviteId, storageKey: `photo-intake/${editablePhotoId}.jpg`, mimeType: 'image/jpeg', sizeBytes: 1200,
    contentHash: 'b'.repeat(64), locality: 'Poprad', categories: ['family_house', 'interior'], expectedMetadataVersion: 2,
  });
  assert.equal(changedContentRetry, null, 'opakované potvrdenie nesmie potichu zameniť súbor pod rovnakým ID');
  const persistedContentHash = await inspectPool.query('SELECT content_hash FROM realization_media_intake WHERE id = $1', [editablePhotoId]);
  assert.equal(persistedContentHash.rows[0]?.content_hash, 'a'.repeat(64));
  assert.equal(await reviewPhotoIntakeRecord({ id: editablePhotoId, approve: true, reviewedBy: 'integration-test', expectedMetadataVersion: 2 }), null,
    'staré rozhodnutie správcu nesmie schváliť záznam s novšou verziou metadát');
  assert.equal((await inspectPool.query('SELECT status FROM realization_media_intake WHERE id = $1', [editablePhotoId])).rows[0].status, 'pending_review');
  assert.equal((await reviewPhotoIntakeRecord({ id: editablePhotoId, approve: true, reviewedBy: 'integration-test', expectedMetadataVersion: 3 }))?.status, 'approved_private',
    'aktuálnu verziu môže správca schváliť po jej opätovnej kontrole');
  const legacyUnsanitizedPhotoId = randomUUID();
  await inspectPool.query(
    `INSERT INTO realization_media_intake (id, invite_id, storage_key, original_name, status, size_bytes, locality, categories, uploaded_at)
     VALUES ($1, $2, $3, 'legacy-unverified.jpg', 'pending_review', 1200, 'Poprad', '["family_house"]'::jsonb, now())`,
    [legacyUnsanitizedPhotoId, inviteId, `photo-intake/${legacyUnsanitizedPhotoId}.jpg`],
  );
  assert.equal(await reviewPhotoIntakeRecord({ id: legacyUnsanitizedPhotoId, approve: true, reviewedBy: 'integration-test', expectedMetadataVersion: 1 }), null,
    'staršia fotografia bez trvalého dôkazu odstránenia EXIF sa nesmie schváliť');
  await inspectPool.query('INSERT INTO realization_case_draft_media (draft_id, media_id) VALUES ($1, $2)', [caseDraft.id, legacyUnsanitizedPhotoId]);
  const listedCaseWithLegacyPhoto = (await listRealizationCaseDrafts()).find((draft) => draft.id === caseDraft.id);
  assert.equal(listedCaseWithLegacyPhoto?.media.some((photo) => photo.id === legacyUnsanitizedPhotoId), false,
    'ani stará väzba konceptu nesmie zobraziť fotku bez dôkazu odstránenia EXIF');
  await inspectPool.query("UPDATE realization_media_intake SET status = 'deletion_pending' WHERE id = $1", [editablePhotoId]);
  assert.equal(await updatePhotoIntakeMetadata({ id: editablePhotoId, locality: 'Poprad', categories: ['family_house'], updatedBy: 'integration-test', expectedMetadataVersion: 3 }), null,
    'lokalitu a kategórie nemožno upravovať po začatí mazania');

  const failedAuditSubmissionId = randomUUID();
  await inspectPool.query(`ALTER TABLE audit_logs ADD CONSTRAINT integration_fail_testimonial_audit
    CHECK (action <> 'testimonial_created' OR entity_type <> 'testimonial')`);
  const failedAuditReviewInput = {
    submissionId: failedAuditSubmissionId,
    customerName: 'Test rollback referencie',
    text: 'Izolovaný rollback auditného zápisu, nikdy nezverejňovať.',
    rating: 5,
    status: 'draft',
    consentPublication: true,
    consentEvidence: publicConsentEvidence(testimonialContentHash('Test rollback referencie', 5, 'Izolovaný rollback auditného zápisu, nikdy nezverejňovať.')),
    consentCapturedAt: new Date().toISOString(),
    consentVersion: publicTestimonialConsentVersion,
    source: 'public',
  };
  await assert.rejects(createTestimonial(failedAuditReviewInput, 'integration-test'));
  assert.equal((await inspectPool.query('SELECT count(*)::int AS count FROM testimonials WHERE submission_id = $1', [failedAuditSubmissionId])).rows[0].count, 0,
    'zlyhaný audit musí vrátiť späť aj uloženie referencie');
  await inspectPool.query('ALTER TABLE audit_logs DROP CONSTRAINT integration_fail_testimonial_audit');
  const recoveredAuditReview = await createTestimonial(failedAuditReviewInput, 'integration-test');
  assert.equal((await inspectPool.query('SELECT count(*)::int AS count FROM audit_logs WHERE entity_id = $1 AND action = $2', [recoveredAuditReview.id, 'testimonial_created'])).rows[0].count, 1,
    'retry po rollbacku musí vytvoriť práve jeden auditný záznam');

  const review = await createTestimonial({
    submissionId: randomUUID(),
    customerName: 'Ján P.',
    text: 'Testovacia referencia v izolovanej databáze, nie je skutočná recenzia.',
    rating: 5,
    status: 'draft',
    consentPublication: true,
    consentEvidence: publicConsentEvidence(testimonialContentHash('Ján P.', 5, 'Testovacia referencia v izolovanej databáze, nie je skutočná recenzia.')),
    consentCapturedAt: new Date().toISOString(),
    consentVersion: publicTestimonialConsentVersion,
  }, 'integration-test');
  const repeatedReview = await createTestimonial({
    submissionId: review.submissionId,
    customerName: review.customerName,
    text: review.text,
    rating: review.rating,
    status: 'draft',
    consentPublication: true,
    consentEvidence: review.consentEvidence,
    consentCapturedAt: review.consentCapturedAt,
    consentVersion: review.consentVersion,
    source: review.source,
  }, 'integration-test');
  assert.equal(repeatedReview.id, review.id, 'opakovanie toho istého ID a obsahu vráti pôvodnú referenciu');
  assert.equal((await inspectPool.query('SELECT count(*)::int AS count FROM testimonials WHERE submission_id = $1', [review.submissionId])).rows[0].count, 1,
    'opakovanie nesmie vytvoriť duplicitný koncept');
  await assert.rejects(createTestimonial({
    submissionId: review.submissionId,
    customerName: review.customerName,
    text: `${review.text} upravené`,
    rating: review.rating,
    status: 'draft',
    consentPublication: true,
    consentEvidence: review.consentEvidence,
    consentCapturedAt: review.consentCapturedAt,
    consentVersion: review.consentVersion,
    source: review.source,
  }, 'integration-test'), /TESTIMONIAL_IDEMPOTENCY_CONFLICT/);
  assert.equal(await updateTestimonialStatus(review.id, 'approved', 'integration-test') !== null, true);
  assert.ok((await listApprovedTestimonials(50)).some((item) => item.id === review.id), 'schválená referencia s aktívnym doloženým súhlasom sa smie zobraziť');

  const adminConsentReview = await createTestimonial({
    customerName: 'Test admin dôkazu',
    text: 'Izolovaný testovací záznam admin dôkazu; nezverejňovať.',
    rating: 4,
    status: 'draft',
    consentPublication: true,
    consentEvidence: adminConsentEvidence(
      'Súhlasím so zverejnením presne uvedeného textu a mena zákazníka.',
      'e-mail',
      new Date().toISOString().slice(0, 10),
      testimonialContentHash('Test admin dôkazu', 4, 'Izolovaný testovací záznam admin dôkazu; nezverejňovať.'),
    ),
    consentCapturedAt: new Date().toISOString(),
    consentVersion: adminTestimonialConsentVersion,
  }, 'integration-test');
  assert.equal(await updateTestimonial(adminConsentReview.id, { ...adminConsentReview, status: 'approved' }, 'integration-test') !== null, true, 'adminom doložený zdroj a dátum majú umožniť schválenie aj cez úpravu referencie');
  assert.ok((await listApprovedTestimonials(50)).some((item) => item.id === adminConsentReview.id), 'SQL verejný výber musí prijať iba štruktúrovaný admin dôkaz so známou verziou');
  const adminHistory = await listTestimonialAdminHistory(adminConsentReview.id);
  assert.ok(adminHistory.some((entry) => entry.source === 'audit' && entry.event === 'testimonial_created'));
  assert.ok(adminHistory.some((entry) => entry.source === 'audit' && entry.event === 'testimonial_updated'));
  assert.ok(adminHistory.some((entry) => entry.source === 'consent' && entry.event === 'granted' && entry.snapshot?.text === adminConsentReview.text));
  assert.ok(adminHistory.some((entry) => entry.source === 'consent' && entry.event === 'superseded'));
  assert.equal((await getTestimonial(adminConsentReview.id))?.id, adminConsentReview.id, 'admin vie načítať referenciu aj mimo práve zobrazenej strany');
  const oneApprovedPage = await listTestimonialsPage({ page: 1, pageSize: 1, status: 'approved' });
  assert.equal(oneApprovedPage.records.length, 1);
  assert.ok(oneApprovedPage.records.every((item) => item.status === 'approved'));
  assert.ok(oneApprovedPage.total >= 2, 'SQL stránkovanie počíta všetky výsledky zvoleného stavu, nie iba prvú dávku');
  const storedAdminConsent = await inspectPool.query('SELECT consent_evidence FROM testimonials WHERE id = $1', [adminConsentReview.id]);
  assert.equal(storedAdminConsent.rows[0]?.consent_evidence, adminConsentReview.consentEvidence, 'presné zákaznícke znenie sa musí uložiť do súkromného poľa dôkazu bez zmeny');
  const adminConsentAudit = await inspectPool.query('SELECT changes::text FROM audit_logs WHERE entity_id = $1', [adminConsentReview.id]);
  assert.equal(adminConsentAudit.rows.some((row) => String(row.changes).includes('Súhlasím so zverejnením presne uvedeného textu')), false, 'presné znenie súhlasu sa nesmie kopírovať do auditného logu');

  const initialConsentHistory = await inspectPool.query(
    'SELECT event, consent_evidence, snapshot_customer_name, snapshot_rating, snapshot_text, public_content_hash FROM testimonial_consent_history WHERE testimonial_id = $1 ORDER BY history_sequence',
    [adminConsentReview.id],
  );
  assert.deepEqual(initialConsentHistory.rows.map((row) => row.event), ['superseded', 'granted']);
  assert.ok(initialConsentHistory.rows.every((row) => String(row.consent_evidence).includes('Súhlasím so zverejnením presne uvedeného textu')));
  assert.equal(initialConsentHistory.rows[1].snapshot_customer_name, adminConsentReview.customerName);
  assert.equal(initialConsentHistory.rows[1].snapshot_rating, adminConsentReview.rating);
  assert.equal(initialConsentHistory.rows[1].snapshot_text, adminConsentReview.text,
    'história uchová presný súkromný text, ku ktorému sa viaže súhlas');
  assert.ok(initialConsentHistory.rows.every((row) => /^[a-f0-9]{64}$/.test(String(row.public_content_hash))));

  const updatedConsentText = 'Zákazník ocenil zrozumiteľný postup a bezpečné odovzdanie odpadu.';
  const updatedConsentDate = new Date().toISOString().slice(0, 10);
  const updatedConsentEvidence = adminConsentEvidence(
    'Súhlasím s novým presným znením referencie.', 'e-mail', updatedConsentDate,
    testimonialContentHash(adminConsentReview.customerName, adminConsentReview.rating, updatedConsentText),
  );
  await inspectPool.query(`ALTER TABLE audit_logs ADD CONSTRAINT integration_fail_testimonial_update_audit
    CHECK (action <> 'testimonial_updated' OR entity_type <> 'testimonial') NOT VALID`);
  await assert.rejects(updateTestimonial(adminConsentReview.id, {
    ...adminConsentReview, status: 'draft', text: updatedConsentText,
    consentEvidence: updatedConsentEvidence, consentCapturedAt: new Date().toISOString(),
  }, 'integration-test'));
  await inspectPool.query('ALTER TABLE audit_logs DROP CONSTRAINT integration_fail_testimonial_update_audit');
  assert.equal((await inspectPool.query('SELECT text FROM testimonials WHERE id = $1', [adminConsentReview.id])).rows[0].text,
    adminConsentReview.text, 'failed audit must roll back edited public content');
  assert.equal((await inspectPool.query('SELECT count(*)::int AS count FROM testimonial_consent_history WHERE testimonial_id = $1', [adminConsentReview.id])).rows[0].count,
    2, 'failed audit must roll back consent-history writes too');

  assert.equal(await updateTestimonial(adminConsentReview.id, {
    ...adminConsentReview, status: 'draft', text: updatedConsentText,
    consentEvidence: updatedConsentEvidence, consentCapturedAt: new Date().toISOString(),
  }, 'integration-test') !== null, true);
  const changedConsentHistory = await inspectPool.query(
    'SELECT event, consent_evidence, snapshot_customer_name, snapshot_rating, snapshot_text, public_content_hash FROM testimonial_consent_history WHERE testimonial_id = $1 ORDER BY history_sequence',
    [adminConsentReview.id],
  );
  assert.deepEqual(changedConsentHistory.rows.map((row) => row.event), ['superseded', 'granted', 'superseded', 'granted']);
  assert.equal(changedConsentHistory.rows[2].consent_evidence, adminConsentReview.consentEvidence,
    'editing a reference must preserve the exact prior consent evidence');
  assert.equal(changedConsentHistory.rows[2].snapshot_text, adminConsentReview.text,
    'editing a reference must preserve the exact prior public text');
  assert.equal(changedConsentHistory.rows[3].consent_evidence, updatedConsentEvidence,
    'new consent evidence must be appended, not replace the historical version');
  assert.equal(changedConsentHistory.rows[3].snapshot_text, updatedConsentText);
  assert.equal(changedConsentHistory.rows[2].public_content_hash,
    testimonialContentHash(adminConsentReview.customerName, adminConsentReview.rating, adminConsentReview.text));
  assert.equal(changedConsentHistory.rows[3].public_content_hash,
    testimonialContentHash(adminConsentReview.customerName, adminConsentReview.rating, updatedConsentText));

  const manualWithoutWording = await createTestimonial({
    customerName: 'Test bez presného znenia',
    text: 'Izolovaný záznam bez presného znenia súhlasu; nezverejňovať.',
    rating: 5,
    status: 'draft',
    consentPublication: true,
    consentEvidence: 'Zdroj súhlasu: e-mail; dátum súhlasu: 2026-09-30.',
    consentCapturedAt: new Date().toISOString(),
    consentVersion: adminTestimonialConsentVersion,
  }, 'integration-test');
  await assert.rejects(
    updateTestimonialStatus(manualWithoutWording.id, 'approved', 'integration-test'),
    /TESTIMONIAL_PUBLICATION_CONSENT_REQUIRED/,
    'zdroj a dátum bez presného zákazníckeho znenia nesmú schváliť manuálnu referenciu',
  );
  const hiddenReview = await updateTestimonial(review.id, {
    ...review,
    status: 'hidden',
    consentPublication: false,
  }, 'integration-test');
  assert.ok(hiddenReview?.consentRevokedAt, 'odvolanie musí dostať časový záznam');
  assert.equal((await listApprovedTestimonials(50)).some((item) => item.id === review.id), false, 'odvolaná referencia sa okamžite vyradí z verejného výberu');
  await assert.rejects(
    updateTestimonialStatus(review.id, 'approved', 'integration-test'),
    /TESTIMONIAL_PUBLICATION_CONSENT_REQUIRED/,
    'priame schválenie nesmie obísť odvolaný súhlas',
  );

  const noVersionReview = await createTestimonial({
    customerName: 'Test bez verzie',
    text: 'Izolovaný testovací záznam bez verzie súhlasu; nezverejňovať.',
    rating: 5,
    status: 'draft',
    consentPublication: true,
    consentEvidence: publicTestimonialConsentWording,
    consentCapturedAt: new Date().toISOString(),
  }, 'integration-test');
  await assert.rejects(
    updateTestimonialStatus(noVersionReview.id, 'approved', 'integration-test'),
    /TESTIMONIAL_PUBLICATION_CONSENT_REQUIRED/,
    'schválenie bez consent_version musí byť odmietnuté',
  );

  const legacyReview = await createTestimonial({
    customerName: 'Starý záznam',
    text: 'Staršia referencia bez zdokladovaného súhlasu.',
    rating: 5,
    status: 'draft',
    consentPublication: false,
  }, 'integration-test');
  await inspectPool.query('UPDATE testimonials SET status = $1, consent_publication = true WHERE id = $2', ['approved', legacyReview.id]);
  assert.equal((await listApprovedTestimonials(50)).some((item) => item.id === legacyReview.id), false, 'legacy riadok bez dôkazu sa nesmie dostať do verejného výberu');

  const sqlRejectedReview = await createTestimonial({
    customerName: 'Test SQL verzie',
    text: 'Izolovaný SQL regresný test consent_version; nezverejňovať.',
    rating: 5,
    status: 'draft',
    consentPublication: true,
    consentEvidence: publicTestimonialConsentWording,
    consentCapturedAt: new Date().toISOString(),
    consentVersion: publicTestimonialConsentVersion,
  }, 'integration-test');
  await inspectPool.query(
    'UPDATE testimonials SET status = $1, consent_version = $2 WHERE id = $3',
    ['approved', '   ', sqlRejectedReview.id],
  );
  assert.equal((await listApprovedTestimonials(50)).some((item) => item.id === sqlRejectedReview.id), false, 'SQL verejný výber musí odmietnuť prázdnu consent_version aj pri schválenom riadku');

  const sqlManualWithoutWording = await createTestimonial({
    customerName: 'Test SQL bez presného znenia',
    text: 'Izolovaný SQL záznam bez presného znenia; nezverejňovať.',
    rating: 5,
    status: 'draft',
    consentPublication: true,
    consentEvidence: 'Mám doložený súhlas zákazníka.\nZdroj súhlasu: e-mail; dátum súhlasu: 2026-09-30.',
    consentCapturedAt: new Date().toISOString(),
    consentVersion: adminTestimonialConsentVersion,
  }, 'integration-test');
  await inspectPool.query('UPDATE testimonials SET status = $1 WHERE id = $2', ['approved', sqlManualWithoutWording.id]);
  assert.equal((await listApprovedTestimonials(50)).some((item) => item.id === sqlManualWithoutWording.id), false, 'SQL verejný výber musí zablokovať ručný záznam bez presného znenia aj pri schválenom stave');

  const careerSubmissionId = randomUUID();
  const careerInput = {
    submissionId: careerSubmissionId,
    fullName: 'Testovací uchádzač — nekontaktovať',
    phone: '+421900000002',
    email: 'career-test@example.invalid',
    city: 'Poprad',
    cooperationType: 'szco',
    workRegions: 'Prešovský kraj',
    hasTradeLicense: true,
    workAtHeights: true,
    hasAsbestosExperience: false,
    asbestosExperience: '',
    experience: 'Izolovaný test; žiadna reálna osoba.',
    note: '',
    privacyConsent: true,
    cvExpected: true,
  };
  const careerCreated = await createCareerApplication(careerInput);
  assert.equal(careerCreated.duplicate, false);
  const cvMetadata = {
    originalName: 'test-cv.pdf',
    storageDriver: 'vercel_blob',
    storageKey: `private/integration-test/${careerCreated.application.id}/cv.pdf`,
    mimeType: 'application/pdf',
    sizeBytes: 123,
    sha256: 'a'.repeat(64),
  };
  const attachedCareer = await attachCareerApplicationCv(careerCreated.application.id, cvMetadata);
  assert.equal(attachedCareer?.cv?.sha256, cvMetadata.sha256);
  const attemptedReplacement = await attachCareerApplicationCv(careerCreated.application.id, {
    ...cvMetadata,
    originalName: 'replacement.pdf',
    storageKey: `private/integration-test/${careerCreated.application.id}/replacement.pdf`,
    sha256: 'b'.repeat(64),
  });
  assert.equal(attemptedReplacement?.cv?.sha256, cvMetadata.sha256, 'opakovanie nesmie prepísať pôvodný životopis');
  assert.equal(attemptedReplacement?.cv?.storageKey, cvMetadata.storageKey);
  const careerDuplicate = await createCareerApplication({ ...careerInput, fullName: 'Zmenené testovacie meno' });
  assert.equal(careerDuplicate.duplicate, true, 'opakovanie submissionId musí vrátiť existujúcu žiadosť');
  assert.equal(careerDuplicate.application.id, careerCreated.application.id);
  assert.equal(careerDuplicate.application.fullName, careerInput.fullName, 'duplicitné ID nesmie prepísať uložené údaje');
  assert.deepEqual(
    (await listApplicationNotificationStatuses('career_application', [careerCreated.application.id])).map((item) => [item.recipient, item.status]),
    [['applicant', 'pending'], ['internal', 'pending']],
    'žiadosť a oba čakajúce stavy notifikácie musia vzniknúť spolu',
  );
  const abandonedCareerIds = [];
  const healthBeforeIncompleteCv = await getApplicationNotificationHealth();
  for (let index = 0; index < 52; index++) {
    const abandoned = await createCareerApplication({
      ...careerInput, submissionId: randomUUID(), email: `career-abandoned-${index}@example.invalid`,
    });
    abandonedCareerIds.push(abandoned.application.id);
  }
  await inspectPool.query(
    `UPDATE application_notification_outbox SET updated_at=now() - interval '1 day'
     WHERE entity_type='career_application' AND entity_id=ANY($1::uuid[])`, [abandonedCareerIds],
  );
  const dueCareer = await listDueApplicationNotifications(50);
  assert.equal((await getApplicationNotificationHealth()).pending, healthBeforeIncompleteCv.pending,
    'applications waiting for CV must not appear as a retry backlog in worker health');
  assert.ok(dueCareer.some((item) => item.entityId === careerCreated.application.id),
    '52 abandoned CV applications must not starve a completed application outside the 50-row recovery window');
  assert.equal(dueCareer.some((item) => abandonedCareerIds.includes(item.entityId)), false,
    'incomplete CV applications must not enter the notification recovery queue');
  const careerCounts = await countCareerApplications();
  assert.equal(careerCounts.incompleteCv, abandonedCareerIds.length, 'global count includes incomplete CVs outside the first page');
  const adminCareerFirstPage = await listCareerApplications(1, 50);
  const adminCareerSecondPage = await listCareerApplications(2, 50);
  assert.equal(adminCareerFirstPage.length, 50);
  assert.deepEqual(
    [...adminCareerFirstPage, ...adminCareerSecondPage].filter((item) => abandonedCareerIds.includes(item.id)).map((item) => item.id).sort(),
    [...abandonedCareerIds].sort(),
    'all 52 accepted applications waiting for CV remain visible across admin pages',
  );
  assert.equal(await claimCareerNotificationBatch(abandonedCareerIds[0]), false,
    'an application still waiting for its expected CV cannot reserve either email notification');
  const incompleteDriver = await createCareerApplication({
    ...careerInput, submissionId: randomUUID(), email: 'career-invalid-driver@example.invalid',
  });
  await inspectPool.query(
    "UPDATE career_applications SET cv_storage_key=$1, cv_storage_driver='' WHERE id=$2",
    [`private/integration-test/${incompleteDriver.application.id}/unusable.pdf`, incompleteDriver.application.id],
  );
  assert.equal((await countCareerApplications()).incompleteCv, abandonedCareerIds.length + 1,
    'a key without a recognized storage driver is still an incomplete CV');
  assert.equal((await listCareerApplications(1, 50))[0]?.id, incompleteDriver.application.id,
    'the incomplete storage record must appear in the prioritized admin queue');
  assert.equal((await listDueApplicationNotifications(50)).some((item) => item.entityId === incompleteDriver.application.id), false,
    'an incomplete storage record must not enter the notification recovery queue');
  assert.equal((await getApplicationNotificationHealth()).pending, healthBeforeIncompleteCv.pending,
    'career notification health must use the same valid-CV eligibility as recovery');
  assert.equal(await claimCareerNotificationBatch(incompleteDriver.application.id), false,
    'a key without a recognized storage driver cannot reserve the paired emails');

  const careerClaims = await Promise.all([
    claimCareerNotificationBatch(careerCreated.application.id),
    claimCareerNotificationBatch(careerCreated.application.id),
  ]);
  assert.equal(careerClaims.filter(Boolean).length, 1, 'súbežné cron behy nesmú naraz odosielať tú istú kariérnu dávku');
  const careerClaimToken = careerClaims.find(Boolean);
  assert.ok(careerClaimToken);
  assert.equal(await recordApplicationNotificationResult('career_application', careerCreated.application.id, 'applicant', careerClaimToken, {
    status: 'sent', messageId: 'test-career-message-id',
  }), true);
  assert.equal(await recordApplicationNotificationResult('career_application', careerCreated.application.id, 'internal', careerClaimToken, {
    status: 'unknown', reason: 'Izolovaný test neodosiela e-mail.',
  }), true);
  const careerFinalStatuses = await listApplicationNotificationStatuses('career_application', [careerCreated.application.id]);
  assert.deepEqual(careerFinalStatuses.map((item) => [item.recipient, item.status]), [['applicant', 'sent'], ['internal', 'unknown']]);
  assert.equal(await claimCareerNotificationBatch(careerCreated.application.id), false,
    'neznámy/čiastočne potvrdený relay výsledok sa nesmie bezpečne zopakovať ako celá dvojica');
  const careerResolution = await resolveUnknownApplicationNotification({
    entityType: 'career_application', entityId: careerCreated.application.id, recipient: 'internal',
    resolution: 'delivered', evidence: 'inbox_message_found', actorEmail: 'qa-admin@example.invalid',
  });
  assert.equal(careerResolution, true, 'unknown sa smie uzavrieť iba jedným auditovaným výsledkom');
  assert.equal(await resolveUnknownApplicationNotification({
    entityType: 'career_application', entityId: careerCreated.application.id, recipient: 'internal',
    resolution: 'not_delivered', evidence: 'provider_rejected', actorEmail: 'qa-admin@example.invalid',
  }), false, 'už vyriešený stav sa nesmie prepísať');
  const careerResolvedStatuses = await listApplicationNotificationStatuses('career_application', [careerCreated.application.id]);
  assert.deepEqual(careerResolvedStatuses.map((item) => [item.recipient, item.status]), [['applicant', 'sent'], ['internal', 'confirmed_delivered']]);
  const careerResolutionAudit = await inspectPool.query(
    `SELECT action, actor_email, changes FROM audit_logs WHERE entity_type='career_application' AND entity_id=$1 AND action='application_notification_delivery_confirmed'`,
    [careerCreated.application.id],
  );
  assert.equal(careerResolutionAudit.rowCount, 1);
  assert.equal(careerResolutionAudit.rows[0].actor_email, 'qa-admin@example.invalid');
  assert.equal(careerResolutionAudit.rows[0].changes.evidence, 'inbox_message_found');
  assert.equal(await prepareConfirmedApplicationNotificationRetry({
    entityType: 'career_application', entityId: careerCreated.application.id, recipient: 'applicant', actorEmail: 'qa-admin@example.invalid',
  }), false, 'kariérny relay nesmie zopakovať pár, keď jeden príjemca už má potvrdené doručenie');

  const careerPair = await createCareerApplication({
    ...careerInput,
    cvExpected: false,
    submissionId: randomUUID(),
    fullName: 'Test kariérneho páru — nekontaktovať',
    email: 'career-pair-test@example.invalid',
  });
  const careerPairToken = await claimCareerNotificationBatch(careerPair.application.id);
  assert.ok(careerPairToken);
  await assert.rejects(recordCareerNotificationBatchResult(careerPair.application.id, careerPairToken, {
    applicant: { status: 'sent', messageId: 'test-would-have-been-sent' },
    internal: { status: 'invalid-state' },
  }), 'invalid second result must roll back the first result in the same transaction');
  assert.deepEqual(
    (await listApplicationNotificationStatuses('career_application', [careerPair.application.id])).map((item) => [item.recipient, item.status]),
    [['applicant', 'sending'], ['internal', 'sending']],
    'failed second write must not strand a mixed career pair',
  );
  assert.equal(await recordCareerNotificationBatchResult(careerPair.application.id, careerPairToken, {
    applicant: { status: 'unknown', reason: 'Izolovaný test simuloval nejednoznačný výsledok.' },
    internal: { status: 'unknown', reason: 'Izolovaný test simuloval nejednoznačný výsledok.' },
  }), true);
  for (const recipient of ['applicant', 'internal']) {
    assert.equal(await resolveUnknownApplicationNotification({
      entityType: 'career_application', entityId: careerPair.application.id, recipient, resolution: 'not_delivered',
      evidence: 'provider_rejected', actorEmail: 'qa-admin@example.invalid',
    }), true);
  }
  assert.equal(await prepareConfirmedApplicationNotificationRetry({
    entityType: 'career_application', entityId: careerPair.application.id, recipient: 'applicant', actorEmail: 'qa-admin@example.invalid',
  }), true, 'kariérny relay môže zaradiť dvojicu iba po potvrdení nedoručenia obom adresátom');
  assert.deepEqual(
    (await listApplicationNotificationStatuses('career_application', [careerPair.application.id])).map((item) => [item.recipient, item.status]),
    [['applicant', 'pending'], ['internal', 'pending']],
  );
  const careerPairRetryToken = await claimCareerNotificationBatch(careerPair.application.id);
  assert.ok(careerPairRetryToken);
  assert.equal(await recordCareerNotificationBatchResult(careerPair.application.id, careerPairRetryToken, {
    applicant: { status: 'sent', messageId: 'test-retry-applicant' },
    internal: { status: 'sent', messageId: 'test-retry-internal' },
  }), true);

  const rooferSubmissionId = randomUUID();
  const rooferCreated = await createRooferRegistration({
    submissionId: rooferSubmissionId,
    businessType: 'szco',
    companyName: 'Testovací partner — nekontaktovať',
    companyId: '',
    contactPerson: 'Izolovaný automatický test',
    phone: '+421900000003',
    email: 'roofer-test@example.invalid',
    website: '',
    serviceRegions: ['Prešovský'],
    specializations: ['strechy'],
    otherSpecialization: '',
    canBuildRoofTruss: 'by_scope',
    acceptCustomerReferrals: false,
    consentPublicProfile: false,
    privacyConsent: true,
    note: 'Izolovaný test; nekontaktovať.',
  });
  const rooferRetryLookup = await getRooferRegistrationBySubmissionId(rooferSubmissionId);
  assert.equal(rooferRetryLookup?.id, rooferCreated.registration.id, 'rovnaké ID registrácie musí byť dohľadateľné pred limitovaním opakovania');
  const rooferDefinitiveFailure = await createRooferRegistration({
    ...rooferCreated.registration, submissionId: randomUUID(), email: 'roofer-definitive-failure@example.invalid',
  });
  const definitiveToken = await claimApplicationNotification('roofer_registration', rooferDefinitiveFailure.registration.id, 'applicant');
  assert.ok(definitiveToken);
  assert.equal(await recordApplicationNotificationResult('roofer_registration', rooferDefinitiveFailure.registration.id, 'applicant', definitiveToken, {
    status: 'failed', retryable: false, reason: 'SMTP 550: adresát definitívne odmietnutý v izolovanom teste.',
  }), true);
  assert.equal(await resolveUnknownApplicationNotification({
    entityType: 'roofer_registration', entityId: rooferDefinitiveFailure.registration.id, recipient: 'applicant',
    resolution: 'delivered', evidence: 'Testovací SMTP 550 neznamená doručenie adresátovi.', actorEmail: 'qa-admin@example.invalid',
  }), false, 'definitívne odmietnuté SMTP nemožno označiť ako doručené');
  assert.equal(await resolveUnknownApplicationNotification({
    entityType: 'roofer_registration', entityId: rooferDefinitiveFailure.registration.id, recipient: 'applicant',
    resolution: 'not_delivered', evidence: 'provider_rejected', actorEmail: 'qa-admin@example.invalid',
  }), true, 'definitívne odmietnutý email možno po doloženej kontrole pripraviť na manuálny retry');
  assert.equal(await prepareConfirmedApplicationNotificationRetry({
    entityType: 'roofer_registration', entityId: rooferDefinitiveFailure.registration.id,
    recipient: 'applicant', actorEmail: 'qa-admin@example.invalid',
  }), true);
  const rooferToken = await claimApplicationNotification('roofer_registration', rooferCreated.registration.id, 'applicant');
  assert.ok(rooferToken);
  assert.equal(await recordApplicationNotificationResult('roofer_registration', rooferCreated.registration.id, 'applicant', rooferToken, {
    status: 'unknown', reason: 'Izolovaný test neodosiela e-mail.',
  }), true);
  const [rooferResolved, concurrentResolution] = await Promise.all([
    resolveUnknownApplicationNotification({
      entityType: 'roofer_registration', entityId: rooferCreated.registration.id, recipient: 'applicant',
      resolution: 'not_delivered', evidence: 'provider_rejected', actorEmail: 'qa-admin@example.invalid',
    }),
    resolveUnknownApplicationNotification({
      entityType: 'roofer_registration', entityId: rooferCreated.registration.id, recipient: 'applicant',
      resolution: 'not_delivered', evidence: 'provider_rejected', actorEmail: 'qa-admin@example.invalid',
    }),
  ]);
  assert.equal([rooferResolved, concurrentResolution].filter(Boolean).length, 1, 'súbežné riešenia unknown musia byť atómové');
  assert.equal(await claimApplicationNotification('roofer_registration', rooferCreated.registration.id, 'applicant'), false,
    'potvrdené nedoručenie sa nesmie opakovať automaticky bez výslovnej admin akcie');
  assert.equal(await prepareConfirmedApplicationNotificationRetry({
    entityType: 'roofer_registration', entityId: rooferCreated.registration.id, recipient: 'applicant', actorEmail: 'qa-admin@example.invalid',
  }), true, 'výslovný admin retry smie zaradiť len potvrdené nedoručenie');
  assert.equal(await prepareConfirmedApplicationNotificationRetry({
    entityType: 'roofer_registration', entityId: rooferCreated.registration.id, recipient: 'applicant', actorEmail: 'qa-admin@example.invalid',
  }), false, 'rovnaký potvrdený výsledok nemožno zaradiť dvakrát');
  const rooferStatuses = await listApplicationNotificationStatuses('roofer_registration', [rooferCreated.registration.id]);
  assert.equal(rooferStatuses[0].status, 'pending', 'admin retry musí vytvoriť iba jeden čakajúci odosielací pokus');
  assert.equal(rooferStatuses[1].status, 'pending');

  const staleToken = await claimApplicationNotification('roofer_registration', rooferCreated.registration.id, 'internal');
  assert.ok(staleToken);
  await inspectPool.query(
    `UPDATE application_notification_outbox SET claimed_at = now() - interval '11 minutes'
     WHERE entity_type='roofer_registration' AND entity_id=$1 AND recipient_role='internal'`,
    [rooferCreated.registration.id],
  );
  assert.equal(await markStaleApplicationNotificationClaimsUnknown(), 1, 'zaseknutý SMTP pokus sa musí preklopiť na unknown');
  assert.equal(await claimApplicationNotification('roofer_registration', rooferCreated.registration.id, 'internal'), false,
    'stale unknown claim sa nesmie automaticky znovu odoslať');
}

async function runRealizationAtomicityChecks() {
  const unpublishedWithoutEvidence = await createRealization({
    title: 'Test publikovania bez oprávnenia', location: '', materialType: '', description: 'Test', imageUrls: [],
    status: 'published', createdBy: 'integration-test',
  }).then(() => null, (error) => error);
  assert.match(String(unpublishedWithoutEvidence?.message ?? ''), /potvrdenie práv/);
  const published = await createRealization({
    title: 'Test publikovanej realizácie',
    location: 'Interná lokalita, nesmie sa zobraziť',
    materialType: 'Eternit',
    description: 'Izolovaný integračný test.',
    imageUrls: ['/assets/azbest/webp/azbest-087.webp'],
    status: 'published',
    createdBy: 'integration-test',
    publicationEvidence: 'integration-test-source-001',
    publicationRightsConfirmed: true,
    publicationLocationConfirmed: true,
  });
  assert.equal(published.publicationEvidence, 'integration-test-source-001');
  assert.equal(published.publicationApprovedBy, 'integration-test');
  assert.ok(published.publicationApprovedAt);
  const persistedApproval = await inspectPool.query('SELECT publication_evidence, publication_approved_by, publication_approved_at FROM realizations WHERE id=$1', [published.id]);
  assert.equal(persistedApproval.rows[0]?.publication_evidence, 'integration-test-source-001');
  assert.equal(persistedApproval.rows[0]?.publication_approved_by, 'integration-test');
  assert.ok(persistedApproval.rows[0]?.publication_approved_at);
  const draft = await createRealization({
    title: 'Test konceptu realizácie',
    location: '',
    materialType: 'Eternit',
    description: 'Izolovaný integračný test.',
    imageUrls: [],
    status: 'draft',
    createdBy: 'integration-test',
  });
  const publishWithoutEvidence = await updateRealizationStatus(draft.id, 'published', 'integration-test').then(() => null, (error) => error);
  assert.match(String(publishWithoutEvidence?.message ?? ''), /potvrdenie práv/);
  assert.equal((await inspectPool.query('SELECT status FROM realizations WHERE id = $1', [draft.id])).rows[0]?.status, 'draft');

  const publicRows = await listPublishedRealizations(24);
  assert.ok(publicRows.some((row) => row.id === published.id), 'verejný výber musí obsahovať published záznam');
  assert.ok(!publicRows.some((row) => row.id === draft.id), 'verejný výber nesmie obsahovať draft záznam');
  const publicPublished = publicRows.find((row) => row.id === published.id);
  assert.equal('publicationEvidence' in publicPublished, false, 'verejný výber nesmie obsahovať internú referenciu dôkazu');
  assert.equal('publicationApprovedBy' in publicPublished, false, 'verejný výber nesmie obsahovať identitu schvaľovateľa');

  await inspectPool.query(`
    CREATE FUNCTION reject_realization_audit() RETURNS trigger AS $$
    BEGIN
      IF NEW.entity_type = 'realization' AND NEW.action IN ('realization_created', 'realization_status_changed') THEN
        RAISE EXCEPTION 'intentional realization audit failure';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    CREATE TRIGGER reject_realization_audit_trigger
      BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_realization_audit();
  `);

  const statusMutationError = await updateRealizationStatus(draft.id, 'hidden', 'integration-test').then(() => null, (error) => error);
  assert.match(String(statusMutationError?.message ?? ''), /intentional realization audit failure/, 'zmena stavu musí zlyhať na pripravenom audit triggeri');
  const afterFailedStatus = await inspectPool.query('SELECT status FROM realizations WHERE id=$1', [draft.id]);
  assert.equal(afterFailedStatus.rows[0]?.status, 'draft', 'stav musí ostať nezmenený pri zlyhaní auditu');

  const createMutationError = await createRealization({
      title: 'Test rollback vytvorenia',
      location: '',
      materialType: 'Eternit',
      description: 'Izolovaný integračný test.',
      imageUrls: [],
      status: 'published',
      createdBy: 'integration-test',
      publicationEvidence: 'integration-test-source-rollback',
      publicationRightsConfirmed: true,
      publicationLocationConfirmed: true,
    }).then(() => null, (error) => error);
  assert.match(String(createMutationError?.message ?? ''), /intentional realization audit failure/, 'vytvorenie musí zlyhať na pripravenom audit triggeri');
  const afterFailedCreate = await inspectPool.query("SELECT COUNT(*)::int AS count FROM realizations WHERE title='Test rollback vytvorenia'");
  assert.equal(afterFailedCreate.rows[0]?.count, 0, 'realizácia bez auditu nesmie ostať v databáze');
}

let exitCode = 0;
let checksPassed = false;
const cleanupErrors = [];
try {
  await startIsolatedDatabase();
  await runIntegrationChecks();
  await runRealizationAtomicityChecks();
  checksPassed = true;
} catch (error) {
  exitCode = 1;
  console.error(error);
} finally {
  try {
    await inspectPool?.end();
  } catch (error) {
    cleanupErrors.push(error);
  }
}

// The application DB module owns a process-wide Pool without a public disposer.
// This isolated test runs in its own Node test worker; process exit disposes
// that pool, the loopback listener, and the in-memory PGlite database together.
if (cleanupErrors.length) {
  console.error(new AggregateError(cleanupErrors, 'Integration test cleanup/runtime failed.'));
  exitCode = 1;
}
if (checksPassed && exitCode === 0) {
  console.log(`PASS: ${usingRealPostgres ? 'izolovaný PostgreSQL' : 'PGlite'} SQL test — dopyt, idempotencia/rollback, súbežný limit, token-vs-retencia, paralelné retenčné a notifikačné claimy, súkromné koncepty prípadov a interne schválené fotky, kariéra/strechári outbox a referencie so súhlasom/revokáciou. Bez skutočného Blob uploadu/mazania a emailu.`);
}
process.exit(exitCode);
