import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { trustedRateLimitClientIp } from '../src/server/shared-rate-limit.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const rooferPage = read('../app/strechari/page.tsx');
const publicClient = read('../app/landing-client.tsx');
const rooferRoute = read('../app/api/roofer-registration/route.ts');
const loginRoute = read('../app/admin/login/submit/route.ts');
const twoFactorActions = read('../app/admin/2fa/actions.ts');
const sharedRateLimit = read('../src/server/shared-rate-limit.ts');
const database = read('../src/server/db.ts');
const databaseConfig = read('../src/server/database-config.ts');
const homepageClient = read('../app/homepage-critical-client.tsx');
const homepage = read('../app/page.tsx');
const leadRoute = read('../app/api/lead/route.ts');
const leadReceiptRoute = read('../app/api/lead/receipt/route.ts');
const noJsConfirmation = read('../app/dopyt-prijaty/route.ts');
const leadReceipt = read('../src/server/lead-receipt.ts');
const leadUploadRoute = read('../app/api/lead-upload/route.ts');
const leadValidation = read('../src/server/validation.ts');
const emailCron = read('../app/api/cron/notifications/route.ts');
const leadEmailDeliveryCron = read('../app/api/cron/lead-email-delivery/route.ts');
const leadFileDeletionCron = read('../app/api/cron/lead-file-deletions/route.ts');
const vercelConfig = JSON.parse(read('../vercel.json'));
const leadDetail = read('../app/admin/(protected)/dopyty/[id]/page.tsx');
const leadAdminActions = read('../app/admin/(protected)/dopyty/[id]/actions.ts');
const mailer = read('../src/server/mail.ts');
const relay = read('../src/server/astana-local-relay.ts');
const envExample = read('../.env.example');
const privacyPage = read('../app/ochrana-osobnych-udajov/page.tsx');
const browserHarness = read('../scripts/lead-private-blob-browser.integration.mjs');
const adminVisualHarness = read('../scripts/admin-visual.browser.integration.mjs');

test('customer confirmation email clearly identifies ASTANA, s.r.o.', () => {
  assert.match(mailer, /customerLeadEmailSubject = '✅ ASTANA, s\.r\.o\. prijala váš dopyt \| likvidacia-eternitu\.sk'/);
  assert.match(mailer, /customerLeadLogoUrl = 'https:\/\/likvidacia-eternitu\.sk\/assets\/astana-logo-dark\.png'/);
  assert.equal(existsSync(new URL('../public/assets/astana-logo-dark.png', import.meta.url)), true);
  assert.match(mailer, /<img src="\$\{customerLeadLogoUrl\}" width="190" alt="ASTANA, s\.r\.o\."/);
  assert.match(mailer, />ASTANA, s\.r\.o\.<\/div>/);
  assert.match(mailer, /ASTANA, s\.r\.o\. – odborná likvidácia azbestu a eternitu/);
});

test('sample environment makes the active lead email transport explicit', () => {
  assert.match(envExample, /^LEAD_EMAIL_DELIVERY_MODE=smtp$/m);
  assert.match(envExample, /^ASTANA_RELAY_URL=$/m);
  assert.match(envExample, /^ASTANA_RELAY_SECRET=$/m);
  assert.match(envExample, /smtp, local_relay alebo smtp_then_local_relay/);
});

test('homepage rejects unsupported photo metadata before upload and offers only decodable image types', () => {
  assert.match(homepageClient, /if \(!leadPhotoContentType\(file\.name, file\.type\)\) \{[\s\S]{0,180}rejected\.push/);
  assert.match(homepageClient, /const contentType = leadPhotoContentType\(file\.name, file\.type\)/);
  assert.match(homepage, /accept="[^"]*\.webp,image\/jpeg,image\/png,image\/webp"/);
  assert.doesNotMatch(homepage, /HEIC a HEIF tiež prijímame/);
});

test('strechársky honeypot is disabled and excluded from FormData', () => {
  assert.match(rooferPage, /name="companyWebsite"[^>]*autoComplete="new-password"[^>]*data-submit-disabled="true"[^>]*disabled/);
});

test('roofer registration has a 30-second abort and no automatic native retry', () => {
  assert.match(publicClient, /const timeoutId = window\.setTimeout\(\(\) => controller\.abort\(\), 30_000\)/);
  assert.match(publicClient, /signal: controller\.signal/);
  assert.match(publicClient, /if \(rooferRegistrationSubmitting\) return/);
  assert.match(publicClient, /Bez úprav môžete skúsiť odoslanie znova bez založenia duplicitnej registrácie/);
  assert.match(publicClient, /ak údaje zmeníte, pôjde o novú registráciu/);
  assert.match(publicClient, /const payload = new FormData\(rooferRegistrationForm\);[\s\S]{0,700}fields\.forEach\(\(field\) => \{ field\.disabled = true; \}\)/);
  assert.match(publicClient, /if \(!rooferRegistrationMayHaveSaved \|\| rooferRegistrationSubmitting\) return;[\s\S]{0,120}setRooferRegistrationId\(\)/);
  assert.doesNotMatch(publicClient, /HTMLFormElement\.prototype\.submit\.call\(rooferRegistrationForm\)/);
});

test('shared quote handler sends once, keeps an idempotent retry key and never falls back to a native POST', () => {
  const submitter = publicClient.slice(publicClient.indexOf('const submitLeadForm'), publicClient.indexOf('const onRooferContactClick'));
  assert.match(submitter, /window\.setTimeout\(\(\) => controller\.abort\(\), 30_000\)/);
  assert.match(submitter, /fetch\('\/api\/dopyt\/'/);
  assert.match(submitter, /form\.classList\.contains\('is-submitting'\)/);
  assert.match(submitter, /ensureLeadSubmissionId/);
  assert.match(submitter, /lastLeadSnapshot && snapshot !== lastLeadSnapshot/);
  assert.match(submitter, /lastLeadSubmissionId = submissionId/);
  assert.match(submitter, /Údaje zostali vo formulári[\s\S]*rovnaké ID dopytu/);
  assert.doesNotMatch(submitter, /OPR\\\/|HTMLFormElement\.prototype\.submit|nativeSubmit|4000\)/);
  assert.equal((submitter.match(/fetch\('\/api\/dopyt\/'/g) || []).length, 1);
});

test('the active homepage form fingerprints actual photo bytes before reusing a retry ID', () => {
  assert.match(homepageClient, /createLeadFormSnapshot\(payload, selectedFiles\)/);
  assert.match(homepageClient, /if \(form\.classList\.contains\('is-submitting'\) \|\| leadSnapshotInProgress\)/);
  assert.match(homepageClient, /leadSnapshotInProgress = true;[\s\S]*await createLeadFormSnapshot\(payload, selectedFiles\)/);
  assert.ok(homepageClient.indexOf('await createLeadFormSnapshot(payload, selectedFiles)') < homepageClient.indexOf('await uploadLeadPhotos()'));
  assert.match(homepageClient, /const fileFingerprint = await fingerprintLeadPhoto\(file\)/);
  const photoUploader = homepageClient.slice(homepageClient.indexOf('const uploadLeadPhotos'), homepageClient.indexOf('const onSubmit'));
  assert.match(photoUploader, /state\.promise = undefined/);
  assert.match(photoUploader, /uploadedFilesByFingerprint\.set\(fileFingerprint, state\)/);
  assert.match(photoUploader, /uploadLeadPhoto\(state\.pathname, file/);
  assert.match(photoUploader, /leadPhotoUploadErrorMessage\(error, file\.name, controller\.signal\.aborted\)/);
  assert.match(publicClient, /createLeadFormSnapshot\(payload, selectedFiles\)/);
});

test('roofer submissions are idempotent by submission ID in storage', () => {
  assert.match(rooferRoute, /createRooferRegistration\(registration\)/);
  assert.match(database, /ON CONFLICT \(submission_id\) DO NOTHING[\s\S]{0,350}RETURNING \*/);
});

test('roofer registration notifications are bounded by shared address and recipient quotas', () => {
  assert.match(rooferRoute, /consumeSharedRateLimit\('roofer-registration-address', trustedRateLimitClientIp\(request\.headers\), 10, registrationRateWindowMs\)/);
  assert.match(rooferRoute, /consumeSharedRateLimit\('roofer-registration-email', email\.trim\(\)\.toLowerCase\(\), 3, registrationRateWindowMs\)/);
  assert.match(rooferRoute, /Roofer registration rate limit unavailable[\s\S]{0,180}503/);
  assert.match(rooferRoute, /getRooferRegistrationBySubmissionId\(registration\.submissionId\)[\s\S]{0,260}knownDuplicate = true/);
  assert.match(rooferRoute, /if \(!knownDuplicate\) \{[\s\S]{0,180}registrationIsRateLimited/);
  assert.ok(rooferRoute.indexOf('await registrationIsRateLimited(request, registration.email)') < rooferRoute.indexOf('await createRooferRegistration(registration)'));
  assert.match(sharedRateLimit, /createHmac\('sha256', secret\)/);
  assert.match(sharedRateLimit, /consumeApiRateLimit\(key, windowStartedAt, maxHits\)/);
});

test('roofer registration rejects a missing Origin header in production', () => {
  assert.match(rooferRoute, /if \(!origin\) return process\.env\.NODE_ENV !== 'production';/);
});

test('admin login uses trusted shared address limits while 2FA uses an account limit', () => {
  assert.match(loginRoute, /consumeSharedRateLimit\('admin-login-address', trustedRateLimitClientIp\(request\.headers\), maxLoginAttempts, loginWindowMs\)/);
  assert.match(loginRoute, /Admin login rate limit unavailable[\s\S]{0,180}503/);
  assert.doesNotMatch(loginRoute, /x-forwarded-for|loginAttempts/);
  assert.equal((twoFactorActions.match(/twoFactorLimitState\(user\.email\)/g) || []).length, 2);
  assert.match(twoFactorActions, /consumeSharedRateLimit\([\s\S]{0,120}'admin-two-factor-account'[\s\S]{0,100}maxTwoFactorAttempts/);
  assert.match(twoFactorActions, /twoFactorLimitState\(user\.email\)[\s\S]{0,180}limited[\s\S]{0,100}unavailable/);
  assert.match(twoFactorActions, /'admin-two-factor-account',\s*email\.trim\(\)\.toLowerCase\(\)/);
});

test('shared rate-limit identities are HMACed, namespaced and use fixed windows', () => {
  assert.match(sharedRateLimit, /createHmac\('sha256', secret\)\.update\(`\$\{namespace\}:v1:\$\{identity\}`\)\.digest\('hex'\)/);
  assert.match(sharedRateLimit, /Math\.floor\(now \/ windowMs\) \* windowMs/);
  assert.match(sharedRateLimit, /localBucketLimit = 5_000/);
  assert.match(sharedRateLimit, /return process\.env\.NODE_ENV === 'production' \|\| Boolean\(process\.env\.DATABASE_URL\)/);
  assert.match(sharedRateLimit, /x-vercel-forwarded-for/);
  assert.match(sharedRateLimit, /A trusted Vercel client IP header is required/);
});

test('public quote limits trust only the Vercel-controlled client address in production', () => {
  for (const route of [leadRoute, leadUploadRoute]) {
    assert.match(route, /trustedRateLimitClientIp\(request\.headers\)/);
    assert.doesNotMatch(route, /function clientIp|x-real-ip|x-forwarded-for/);
  }

  const originalNodeEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    assert.equal(
      trustedRateLimitClientIp(new Headers({ 'x-vercel-forwarded-for': '203.0.113.17, 192.0.2.5' })),
      '203.0.113.17',
    );
    assert.throws(
      () => trustedRateLimitClientIp(new Headers({ 'x-real-ip': '198.51.100.9' })),
      /trusted Vercel client IP/,
    );
    assert.throws(
      () => trustedRateLimitClientIp(new Headers({ 'x-forwarded-for': '198.51.100.10' })),
      /trusted Vercel client IP/,
    );
    assert.throws(
      () => trustedRateLimitClientIp(new Headers({
        'x-vercel-forwarded-for': 'not-an-ip',
        'x-forwarded-for': '198.51.100.10',
      })),
      /trusted Vercel client IP/,
    );
    assert.throws(
      () => trustedRateLimitClientIp(new Headers()),
      /trusted Vercel client IP/,
    );

    process.env.NODE_ENV = 'test';
    assert.equal(
      trustedRateLimitClientIp(new Headers({ 'x-forwarded-for': '198.51.100.10' })),
      '198.51.100.10',
    );
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  }
});

test('a successful roofer registration rotates the ID before the next form submission', () => {
  const submitHandler = publicClient.slice(
    publicClient.indexOf('const onRooferRegistrationSubmit'),
    publicClient.indexOf('const refreshGalleryActiveItems'),
  );
  const catchIndex = submitHandler.indexOf('} catch (error) {');
  const finallyIndex = submitHandler.indexOf('} finally {', catchIndex);
  const successPath = submitHandler.slice(0, catchIndex);
  const catchPath = submitHandler.slice(catchIndex, finallyIndex);
  const finallyPath = submitHandler.slice(finallyIndex);

  assert.match(successPath, /rooferRegistrationForm\.reset\(\);\s*setRooferRegistrationId\(\);/);
  assert.doesNotMatch(catchPath, /setRooferRegistrationId\(\)/);
  assert.doesNotMatch(finallyPath, /setRooferRegistrationId\(\)/);
});

test('quote submissions bind the form ID to the uploaded private photos', () => {
  assert.match(leadValidation, /submissionId:\s*z\.union\(\[z\.string\(\)\.uuid\(\)\.refine\(isValidLeadSubmissionId,/);
  assert.match(leadRoute, /submissionId: z\.string\(\)\.uuid\(\)\.refine\(isValidLeadSubmissionId\)/);
  assert.match(leadUploadRoute, /submissionId: z\.string\(\)\.uuid\(\)\.refine\(isValidLeadSubmissionId\)/);
  assert.match(leadRoute, /submissionId:\s*formData\.get\('submissionId'\)/);
  assert.match(leadRoute, /directPhotos\.some\(\(photo\) => photo\.submissionId !== submissionId\)/);
  assert.match(leadRoute, /createLeadSubmissionFingerprint\(input,\s*\{\s*uploadedStorageIds:/);
  assert.match(leadRoute, /\.\.\.directPhotos\.map\(\(photo\) => photo\.pathname\)/);
  assert.match(leadRoute, /existingFingerprintMismatch[\s\S]*getLeadSubmissionForRetry\(submissionId\)/,
    'a changed upload path may use only the dedicated existing-submission verification path');
  assert.match(leadRoute, /async function existingAttachmentFingerprints\(files: LeadFile\[\]\) \{[\s\S]*?await readStoredLeadFile\(file\)[\s\S]*?createHash\('sha256'\)\.update\(bytes\)\.digest\('hex'\)/,
    'legacy retries compare stored attachment bytes rather than trusting a changed Blob pathname');
  assert.match(leadRoute, /sameCustomer[\s\S]*sameAttachments/,
    'legacy retries require both matching customer fields and exact attachment content');
  assert.ok(leadRoute.indexOf('getExistingLeadSubmission(submissionId, fingerprint.hash)') < leadRoute.indexOf('await verifyDirectLeadPhotos(directPhotos)'), 'idempotent retry must be decided before a remote Blob read');
  const idempotentLookup = leadRoute.indexOf('getExistingLeadSubmission(submissionId, fingerprint.hash)');
  const privateBlobVerification = leadRoute.indexOf('await verifyDirectLeadPhotos(directPhotos)');
  const multipartStorage = leadRoute.indexOf('await storeLeadFile(submissionId, file, retryPosition)');
  assert.ok(idempotentLookup >= 0 && idempotentLookup < privateBlobVerification && privateBlobVerification < multipartStorage,
    'known retries must return before remote Blob verification or multipart storage');
  assert.match(database, /export async function getExistingLeadSubmission\([\s\S]{0,650}throw new LeadSubmissionConflictError\(\)/);
});

test('quote retry reuses unchanged uploaded blobs and rotates the ID when customer data changes', () => {
  assert.match(homepageClient, /uploadedFilesByFingerprint\.get\(fileFingerprint\)/);
  assert.match(homepageClient, /fingerprintLeadPhoto\(file\)/);
  assert.match(homepageClient, /cached\?\.submissionId === submissionId && cached\.promise\) return cached\.promise/);
  assert.match(homepageClient, /cached\?\.submissionId === submissionId\s*\?\s*cached\s*:/);
  assert.match(homepageClient, /abortSignal: controller\.signal/);
  assert.match(homepageClient, /withLeadPhotoUploadDeadline\(upload, \(\) => controller\.abort\(\), 120_000\)/);
  assert.match(homepageClient, /replacesPathname: state\.replacedPathname/);
  assert.match(homepageClient, /replacesPathnames: state\.previousPathnames/);
  assert.match(homepageClient, /fileFingerprint: uploadGroup/);
  assert.match(homepageClient, /settleLeadPhotoUploadBatch\(uploads/);
  assert.match(leadUploadRoute, /fileFingerprint: z\.string\(\)\.regex\(\/\^\[0-9a-f\]\{64\}\$\/\)\.optional\(\)/);
  assert.match(leadUploadRoute, /contentType: z\.string\(\)\.refine\([\s\S]*?\)\.optional\(\)/,
    'older open tabs may omit pre-upload metadata while the Blob callback still verifies it');
  assert.match(leadUploadRoute, /sizeBytes: z\.number\(\)\.int\(\)\.min\(1\)\.max\(maxLeadFileSize\)\.optional\(\)/);
  assert.match(leadUploadRoute, /\(payload\.contentType === undefined\) !== \(payload\.sizeBytes === undefined\)/,
    'new clients must provide content type and size together');
  assert.match(leadUploadRoute, /reserveLeadUploadDraft\([\s\S]*?payload\.submissionId,[\s\S]*?pathname,[\s\S]*?predecessors,[\s\S]*?'vercel_blob',[\s\S]*?payload\.fileFingerprint,[\s\S]*?payload\.contentType,[\s\S]*?payload\.sizeBytes/);
  assert.match(leadUploadRoute, /if \(!isExpectedPath\(predecessor, payload\.submissionId\)\)/);
  assert.match(leadUploadRoute, /allowOverwrite: false/);
  assert.doesNotMatch(leadUploadRoute, /allowOverwrite: true/);
  assert.match(database, /A missing key may be a token request that failed before reservation/);
  assert.match(homepageClient, /leadSnapshot !== lastLeadSnapshot/);
  assert.match(homepageClient, /submissionId = window\.crypto\?\.randomUUID\?\./);
});

test('old-form photo recovery keeps fields and retries with fresh upload reservations', () => {
  assert.match(leadRoute, /new MissingLeadPhotoError\(photo\.pathname, 'Fotky boli nahrané pred obnovením ich bezpečnej rezervácie/);
  assert.match(leadRoute, /function missingLeadPhoto\(pathname: string\)/);
  assert.match(leadRoute, /new MissingLeadPhotoError\(pathname, 'Fotky v úložisku sa nenašli/);
  assert.match(leadRoute, /retryPhotoPathname: error\.pathname/);
  assert.match(homepageClient, /resetMissingLeadPhotoUpload\(uploadedFilesByFingerprint, error\.retryPhotoPathname\)/);
  assert.match(homepageClient, /cached\.promise\) return cached\.promise/);
  assert.match(homepageClient, /Chvíľu počkajte, nahrávame údaje/);
});

test('native form success is shown only after checking a short-lived signed server receipt', () => {
  assert.match(leadRoute, /dopyt_receipt=\$\{encodeURIComponent\(token\)\}/);
  assert.match(leadRoute, /new URL\(`\/dopyt-prijaty\/\?dopyt_receipt=/);
  assert.match(leadReceiptRoute, /verifyLeadReceiptToken\(token, leadReceiptSecret\(\)\)/);
  assert.match(noJsConfirmation, /verifyLeadReceiptToken\(token, leadReceiptSecret\(\)\)/);
  assert.match(noJsConfirmation, /'X-Robots-Tag': 'noindex, nofollow, noarchive'/);
  assert.match(leadReceipt, /createHmac\('sha256'/);
  assert.match(leadReceipt, /timingSafeEqual/);
  assert.match(leadReceipt, /receiptTtlMs = 10 \* 60_000/);
  assert.match(homepageClient, /fetch\(`\/api\/lead\/receipt\/\?token=/);
  assert.match(homepageClient, /verifiedReceipt\?\.accepted === true/);
  assert.doesNotMatch(homepageClient, /url\.searchParams\.get\('potvrdenie'\)/);
});

test('native form failures do not redirect into a query-string error or false-success state', () => {
  const failure = leadRoute.slice(leadRoute.indexOf('function failure'), leadRoute.indexOf('function success'));
  assert.match(failure, /new NextResponse\(`<!doctype html>/);
  assert.match(failure, /Content-Security-Policy/);
  assert.match(failure, /Vráťte sa v prehliadači o krok späť/);
  assert.doesNotMatch(failure, /NextResponse\.redirect/);
  assert.doesNotMatch(homepageClient, /url\.searchParams\.get\('odoslane'\)[\s\S]{0,250}setStatus\([^;]*success/);
  assert.match(leadRoute, /createNativeLeadSubmissionId\(fingerprint\.hash, secret, now\)/);
  assert.ok(leadRoute.indexOf('createNativeLeadSubmissionId(fingerprint.hash, secret, now)') < leadRoute.indexOf('getExistingLeadSubmission(submissionId, fingerprint.hash)'));
  assert.match(leadRoute, /createNativeLeadSubmissionId\(fingerprint\.hash, secret, now - nativeLeadRetryWindowMs\)/);
  assert.match(leadRoute, /previousCreatedAt = previous \? Date\.parse\(previous\.lead\.createdAt\)/);
  assert.match(leadRoute, /now - previousCreatedAt <= nativeLeadRetryWindowMs/);
  assert.match(leadRoute, /input\.submissionId = submissionId/);
  assert.match(homepageClient, /setFormSubmitting\(true, button\);\s*setStatus\('Overujeme výsledok odoslania/);
  assert.match(homepageClient, /const receiptCheckId = \+\+nativeReceiptCheckId/);
  assert.match(homepageClient, /if \(receiptCheckId !== nativeReceiptCheckId\) return/);
  assert.match(homepageClient, /receiptTimeoutId = window\.setTimeout\(\(\) => receiptController\.abort\(\), 10_000\)/);
  assert.match(homepageClient, /signal: receiptController\.signal/);
  assert.match(homepageClient, /window\.clearTimeout\(receiptTimeoutId\)/);
});

test('photo remove controls stay locked while asynchronous fingerprinting uses a snapshot', () => {
  assert.match(homepageClient, /remove\.disabled = fileSelectionInProgress \|\| Boolean\(form\?\.classList\.contains\('is-submitting'\)\)/);
  assert.match(homepageClient, /if \(fileSelectionInProgress \|\| form\?\.classList\.contains\('is-submitting'\)\) return;\s*selectedFiles\.splice/);
  assert.match(homepageClient, /fileSelectionInProgress = true;\s*renderFiles\(\)/);
  assert.match(homepageClient, /fileSelectionInProgress = false;[\s\S]{0,220}renderFiles\(\)/);
});

test('signed Blob completion callbacks do not consume client-token rate limits', () => {
  const signatureRead = leadUploadRoute.indexOf("request.headers.get('x-vercel-signature')");
  const rateCheck = leadUploadRoute.indexOf('if (await rateLimited(request))');
  const bodyParse = leadUploadRoute.indexOf('body = await request.json()');
  assert.ok(signatureRead >= 0 && signatureRead < rateCheck && rateCheck < bodyParse);
  assert.match(leadUploadRoute, /if \(!callbackSignature\) \{[\s\S]{0,700}if \(await rateLimited\(request\)\)/);
  assert.match(leadUploadRoute, /if \(uploadType === 'blob\.generate-client-token'\) \{[\s\S]{0,180}if \(callbackSignature\) return NextResponse\.json/);
  assert.match(leadUploadRoute, /createHmac\('sha256', secret\)\.update\(`lead-upload:\$\{trustedRateLimitClientIp\(request\.headers\)\}`\)/);
  assert.match(leadUploadRoute, /return consumeApiRateLimit\(key, windowStartedAt, maxTokensPerWindow\)/);
  assert.doesNotMatch(leadUploadRoute, /new Map\(/);
  assert.match(database, /export async function consumeApiRateLimit\([\s\S]{0,400}ON CONFLICT \(bucket_key, window_started_at\) DO UPDATE[\s\S]{0,140}hit_count = api_rate_limit_buckets\.hit_count \+ 1/);
  assert.match(database, /export async function purgeExpiredApiRateLimitBuckets\(/);
  assert.match(emailCron, /purgeExpiredApiRateLimitBuckets\(\)/);
  assert.match(privacyPage, /HMAC odtlačok IP/);
  assert.match(privacyPage, /plánovanej dennej údržbe/);
  assert.match(leadUploadRoute, /onUploadCompleted: async \(\{ blob, tokenPayload \}\)/);
});

test('lead rate limiting uses a shared hashed database bucket in production', () => {
  assert.match(leadRoute, /consumeApiRateLimit\(key, windowStartedAt, maxSubmissionsPerWindow\)/);
  assert.match(leadRoute, /createHmac\('sha256', secret\)\.update\(`lead-submit:\$\{ip\}`\)\.digest\('hex'\)/);
  assert.match(leadRoute, /await rateLimited\(request\)/);
  assert.match(leadRoute, /Lead rate limit unavailable[\s\S]{0,240}503/);
});

test('the PGlite browser harness serializes its pool without changing the production default', () => {
  assert.match(database, /process\.env\.DATABASE_POOL_MAX/);
  assert.match(databaseConfig, /parsedPoolMax >= 1 && parsedPoolMax <= 50/);
  assert.match(databaseConfig, /\.\.\.\(max \? \{ max \} : \{\}\)/);
  assert.match(browserHarness, /DATABASE_POOL_MAX:\s*isolatedPgUrl \? '' : '1'/);
  assert.match(adminVisualHarness, /DATABASE_POOL_MAX:\s*'1'/);
});

test('lead endpoint enforces its request limit before parsing multipart bodies', () => {
  const post = leadRoute.slice(leadRoute.indexOf('export async function POST(request: NextRequest)'));
  const originCheck = post.indexOf('if (!originAllowed(request))');
  const rateCheck = post.indexOf('await rateLimited(request)');
  const bodyParse = post.indexOf('request.formData()');
  assert.ok(originCheck >= 0 && originCheck < rateCheck, 'reject disallowed origins before consuming a limiter bucket');
  assert.ok(rateCheck >= 0 && rateCheck < bodyParse, 'limit repeated multipart requests before parsing their bodies');
  assert.match(post, /if \(isRateLimited\)\s*\{[\s\S]{0,220}429/);
  assert.match(post, /Lead rate limit unavailable[\s\S]{0,240}503/);
});

test('unattached lead-photo drafts have a protected daily retention worker', () => {
  const worker = read('../app/api/cron/lead-upload-retention/route.ts');
  const claim = database.slice(database.indexOf('export async function claimExpiredLeadUploadDrafts'), database.indexOf('export async function completeLeadUploadDraftDeletion'));
  assert.match(claim, /draft\.status IN \('uploading', 'uploaded', 'superseded'\) AND draft\.updated_at < now\(\) - interval '24 hours'/);
  assert.match(claim, /lead_files AS file/);
  assert.match(claim, /lead_file_deletion_jobs AS job/);
  assert.match(claim, /FOR UPDATE SKIP LOCKED/);
  assert.match(database, /deletion_claimed_until = now\(\) \+ interval '15 minutes'/);
  const completion = database.slice(database.indexOf('export async function completeLeadUploadDraftDeletion'), database.indexOf('export async function mayDeleteClaimedLeadUploadDraft'));
  assert.match(completion, /BEGIN/);
  assert.match(completion, /status = 'deleted'[\s\S]*deletion_claim_id = \$2/);
  assert.match(completion, /lead_files AS file/);
  assert.match(completion, /lead_file_deletion_jobs AS job/);
  assert.match(completion, /lead_upload_retention_deleted/);
  assert.match(completion, /storageKeyHash: createHash\('sha256'\)\.update\(storageKey\)/);
  assert.match(completion, /COMMIT/);
  assert.match(worker, /CRON_SECRET/);
  assert.match(worker, /mayDeleteClaimedLeadUploadDraft\(candidate\.storageKey, candidate\.claimId\)/);
  assert.match(worker, /await deleteStoredLeadFile\(\{ storageDriver: candidate\.storageDriver, storageKey: candidate\.storageKey, blobEtag: candidate\.blobEtag \}\)/);
  assert.match(worker, /await head\(candidate\.storageKey\)/);
  assert.match(worker, /headError instanceof BlobNotFoundError/);
  assert.match(worker, /leadBlobRetentionBound\(\)/);
  assert.match(worker, /const deletionEnabled = !process\.env\.BLOB_READ_WRITE_TOKEN \|\| process\.env\.LEAD_UPLOAD_RETENTION_DELETE_ENABLED === '1'/);
  assert.match(worker, /if \(deletionEnabled\) \{[\s\S]*?candidates = await claimExpiredLeadUploadDrafts\(50\)/);
  assert.match(worker, /claimExpiredLeadUploadDrafts\(50\)/);
  assert.match(read('../vercel.json'), /\/api\/cron\/lead-upload-retention/);
  assert.match(database, /status = 'attached'/);
  assert.match(database, /'superseded', 'deleting', 'deleted'/);
});

test('all server-side multipart attachments enter the private draft manifest before storage', () => {
  const storage = read('../src/server/storage.ts');
  assert.ok(storage.includes('const key = `lead-drafts/${leadId}/${randomUUID()}${safeExtension(originalName)}`'));
  assert.match(storage, /createHmac\('sha256', secret\)\.update\(`multipart:\$\{retryPosition\}:`\)\.update\(bytes\)\.digest\('hex'\)/);
  assert.match(storage, /await reserveLeadUploadDraft\([\s\S]*?leadId,[\s\S]*?key,[\s\S]*?undefined,[\s\S]*?storageDriver,[\s\S]*?fileFingerprint,[\s\S]*?file\.type \|\| 'application\/octet-stream',[\s\S]*?file\.size/);
  assert.match(database, /file_fingerprint = \$3[\s\S]{0,180}status IN \('uploading', 'uploaded'\)/);
  assert.match(storage, /await markLeadUploadDraftUploaded\(leadId, blob\.pathname, \{[\s\S]*?contentType: blob\.contentType,[\s\S]*?sizeBytes: file\.size,[\s\S]*?blobEtag: blob\.etag/);
  assert.match(leadRoute, /supersedeLeadUploadDraft\(submissionId, file\.storageKey\)/);
});

test('lead and upload token quotas use separate purpose-specific HMAC buckets', () => {
  assert.match(leadUploadRoute, /lead-upload:\$\{trustedRateLimitClientIp\(request\.headers\)\}/);
  assert.match(leadRoute, /lead-submit:\$\{ip\}/);
  assert.notEqual('lead-upload:ip-hash', 'lead-submit:ip-hash');
});

test('admin file delivery sniffs the image and never renders it inline', () => {
  const route = read('../app/admin/(protected)/files/[id]/route.ts');
  assert.match(route, /detectLeadFileContentType/);
  assert.match(route, /Content-Disposition': `attachment/);
  assert.match(route, /X-Content-Type-Options': 'nosniff'/);
  assert.doesNotMatch(route, /inline; filename/);
});

test('lead, linked job, files, audits, and email outbox are committed in one reserved DB transaction', () => {
  assert.match(database, /export async function createLeadSubmission\(/);
  assert.match(database, /ALTER TABLE lead_upload_drafts ALTER COLUMN client_file_id DROP NOT NULL;/);
  assert.match(database, /ALTER TABLE lead_upload_drafts ALTER COLUMN content_type SET DEFAULT '';/);
  assert.match(database, /ALTER TABLE lead_upload_drafts ALTER COLUMN size_bytes SET DEFAULT 0;/);
  assert.match(database, /ADD CONSTRAINT lead_upload_drafts_size_bytes_check[\s\S]*?size_bytes >= 0 AND size_bytes <= 10485760/);
  assert.match(leadUploadRoute, /payload\.contentType,[\s\S]*?payload\.sizeBytes/);
  assert.match(leadUploadRoute, /callbackUrl: immutableDeploymentCallbackUrl\(\)/);
  assert.match(leadUploadRoute, /const metadata = await head\(blob\.pathname\)/);
  assert.match(leadUploadRoute, /allowedFileTypes\.has\(metadata\.contentType\)[\s\S]*?metadata\.size >= 1[\s\S]*?metadata\.size <= maxLeadFileSize/,
    'legacy callbacks must validate the actual stored type and size');
  assert.match(leadUploadRoute, /payload\.contentType === undefined \|\| metadata\.contentType === payload\.contentType/);
  assert.match(leadUploadRoute, /payload\.sizeBytes === undefined \|\| metadata\.size === payload\.sizeBytes/);
  assert.match(database, /const client = await db\.connect\(\);[\s\S]{0,180}await client\.query\('BEGIN'\)/);
  assert.match(database, /ON CONFLICT \(submission_id\) DO NOTHING RETURNING \*/);
  assert.match(database, /CREATE UNIQUE INDEX IF NOT EXISTS leads_submission_id_uq/);
  assert.match(database, /CREATE UNIQUE INDEX IF NOT EXISTS business_jobs_lead_id_uq/);
  assert.match(database, /INSERT INTO lead_email_outbox/);
  assert.match(database, /await client\.query\('COMMIT'\);[\s\S]{0,130}return \{ lead, businessJobId: jobId, files, duplicate: false \}/);
});

test('same ID with changed normalized payload returns a conflict instead of replacing the lead', () => {
  assert.match(database, /class LeadSubmissionConflictError/);
  assert.match(database, /submission_hash[\s\S]{0,260}throw new LeadSubmissionConflictError\(\)/);
  assert.match(leadRoute, /if \(error instanceof LeadSubmissionConflictError\) \{[\s\S]{0,420}return failure\(request, error\.message, 409\);/);
  assert.match(leadRoute, /A failed response after COMMIT may be ambiguous/);
  assert.match(leadRoute, /Lead was accepted, but email processing needs recovery/);
  assert.match(leadRoute, /Neobnovujte stránku ani nevytvárajte nový dopyt/);
  assert.match(homepageClient, /Neobnovujte stránku; zachovajte vyplnený formulár/);
  assert.match(leadRoute, /idempotent retry\./);
  assert.match(leadRoute, /mailResult = await recordLeadAuditNonFatal\(/);
});

test('pending lead emails have a protected worker and interrupted sends become visible unknown states', () => {
  assert.match(emailCron, /token !== secret/);
  assert.match(emailCron, /markStaleLeadEmailClaimsUnknown\(\)/);
  assert.match(emailCron, /transportConfigured \? await listPendingLeadEmailDeliveries\(25, pairsOnly\) : \[\]/);
  assert.match(emailCron, /mode === 'local_relay' \|\| \(mode === 'smtp_then_local_relay' && !hasUsableLeadSmtpConfiguration\(\)\)/);
  assert.match(emailCron, /pendingDeliveries\.slice\(0, 5\)/);
  assert.match(emailCron, /pendingDelivery\.pendingRoles/);
  assert.match(emailCron, /claimLeadEmailOutbox\(pendingDelivery\.lead\.id, role\)/);
  assert.match(emailCron, /sendLeadEmailToRecipient\(pendingDelivery\.lead, role/);
  assert.match(emailCron, /mode === 'local_relay' \|\| mode === 'smtp_then_local_relay'\) && roles\.length === 2/);
  assert.match(emailCron, /claim: \(role\) => claimLeadEmailOutbox\(pendingDelivery\.lead\.id, role\)/);
  assert.match(emailCron, /listLeadEmailOutbox\(pendingDelivery\.lead\.id\)/);
  assert.match(emailCron, /getLeadEmailOutboxHealth\(\)/);
  assert.match(emailCron, /emailOutbox\.unknown === 0/);
  assert.match(database, /export async function claimLeadEmailOutbox\(leadId: string, recipientRole\?/);
  assert.match(database, /status = 'failed' AND retryable = true AND attempts < 3/);
  assert.match(database, /INTERVAL '15 minutes'/);
  assert.match(database, /ADD COLUMN IF NOT EXISTS retryable boolean/);
  assert.match(database, /CREATE INDEX IF NOT EXISTS lead_email_outbox_retryable_idx/);
  assert.match(database, /sort\(\(\[leadIdA\], \[leadIdB\]\) => \(nextDueByLead\.get\(leadIdA\)/);
  const auditLogWriter = database.slice(database.indexOf('export async function addAuditLog('), database.indexOf('export async function listAuditLogs('));
  assert.match(auditLogWriter, /withLocalLeadSubmissionLock\(async \(\) => \{[\s\S]*local\.auditLogs\.unshift/);
  assert.match(database, /pendingRoles/);
  assert.match(database, /requireBothRecipients = false/);
  assert.match(database, /HAVING NOT \$2::boolean OR COUNT\(\*\) = 2/);
  assert.doesNotMatch(database, /HAVING COUNT\(\*\) = 2/);
  assert.match(emailCron, /ok: failed === 0 && !leadEmailFailed/);
  assert.match(emailCron, /leadEmailFailed/);
  assert.equal(vercelConfig.crons.some((cron) => cron.path === '/api/cron/lead-emails'), false);
  assert.equal(vercelConfig.crons.some((cron) => cron.path === '/api/cron/notifications/' && cron.schedule === '0 7 * * *'), true);
  assert.equal(vercelConfig.crons.some((cron) => cron.path === '/api/cron/application-notifications/' && cron.schedule === '*/5 * * * *'), true);
  assert.match(database, /status = 'unknown', retryable = false,[\s\S]{0,220}WHERE status = 'sending' AND COALESCE\(locked_at, updated_at\) < \$3/);
  assert.match(database, /CREATE UNIQUE INDEX IF NOT EXISTS lead_email_outbox_lead_role_uq/);
  assert.match(leadDetail, /Doručenie treba overiť/);
  assert.match(leadDetail, /Pred opakovaným odoslaním skontrolujte doručenú poštu aj log poskytovateľa/);
  assert.match(leadDetail, /name="recipientRole" value=\{delivery\.recipientRole\}/);
  assert.match(leadDetail, /name="checkedDelivery" type="checkbox" value="yes" required/);
  assert.match(leadDetail, /delivery\.status === 'unknown' \? <option value="inbox_message_found"/);
  assert.match(leadAdminActions, /export async function resendLeadEmailRecipientAfterReview/);
  assert.match(leadAdminActions, /confirmation !== 'yes'/);
  assert.match(leadAdminActions, /prepareLeadEmailRecipientManualRetry\(id, recipientRole, actor, evidence\)/);
  assert.match(database, /export async function prepareLeadEmailRecipientManualRetry/);
  assert.match(database, /status = 'sending', attempts = attempts \+ 1, retryable = false, next_attempt_at = \$3, locked_at = \$3/);
  assert.match(database, /AS confirmed_non_delivery[\s\S]{0,120}FOR UPDATE OF o/);
  assert.match(database, /INSERT INTO audit_logs \(id, entity_type, entity_id, action, actor_email, changes, created_at\)[\s\S]{0,300}lead_email_manual_retry_started/);
  assert.match(database, /await client\.query\('COMMIT'\);[\s\S]{0,80}return updatedAt/);
  assert.match(database, /const \{ rowCount \} = await client\.query\(/);
  assert.match(database, /return \(rowCount \?\? 0\) > 0/);
  assert.match(database, /\$4::timestamptz ELSE NULL END/);
  assert.match(database, /\$7::timestamptz ELSE NULL END/);
  assert.match(database, /message_id text NOT NULL DEFAULT ''/);
  assert.match(leadAdminActions, /recordLeadEmailRecipientResult\(id, recipientRole, \{ \.\.\.result, retryable: false \}, attemptLockedAt, actor\)/);
  assert.match(mailer, /export async function sendLeadEmailToRecipient/);
  assert.match(leadRoute, /unlinkedMultipartFiles\.push\(storedFile\)/);
  assert.match(leadRoute, /cleanUnlinkedMultipartFiles\(submissionId, unlinkedMultipartFiles\)/);
  assert.match(database, /export async function recordLeadEmailRecipientResult/);
  assert.match(database, /WHERE lead_id = \$1 AND recipient_role = \$2 AND status = 'sending' AND locked_at = \$3/);
  assert.match(mailer, /messageId: info\.messageId/);
  assert.match(mailer, /classifySmtpAcceptance\(info\)/);
  assert.match(mailer, /recordRecipient \? await recordRecipient\.claim\('customer'\)/);
  assert.match(mailer, /recordRecipient \? await recordRecipient\.claim\('internal'\)/);
  assert.match(mailer, /recordRecipient\.record\('customer'/);
  assert.match(mailer, /recordRecipient \? await recordRecipient\.claim\(\)/);
  assert.match(leadAdminActions, /getBusinessJobIdByLeadId\(id\)/);
  assert.match(leadAdminActions, /canManuallyRetryLeadEmail\(\)/);
  assert.match(mailer, /export function canManuallyRetryLeadEmail\(\)\s*\{\s*if \(!process\.env\.SMTP_HOST\?\.trim\(\)/);
  assert.match(database, /export async function getBusinessJobIdByLeadId/);
  assert.match(relay, /customerSent,\s*adminSent,/);
  assert.match(relay, /Relay potvrdil iba časť emailov/);
  assert.match(mailer, /LEAD_TO_EMAIL musí obsahovať iba jednu internú adresu/);
  assert.match(mailer, /customerSent: relayResult\.customerSent,[\s\S]{0,120}adminSent: relayResult\.adminSent/);
});

test('local permanent lead deletion rechecks archival inside the shared lock', () => {
  const implementation = database.slice(database.indexOf('export async function destroyArchivedLead('), database.indexOf('type RooferRegistrationCreateResult'));
  assert.match(implementation, /const removed = await withLocalLeadSubmissionLock\(async \(\) => \{/);
  assert.match(implementation, /const currentLead = local\.leads\.find\(\(item\) => item\.id === id && item\.deletedAt\)/);
  assert.match(implementation, /if \(!currentLead\) return false/);
  assert.match(implementation, /if \(!removed\) return null/);
});

test('dedicated lead-email cron is authenticated, bounded, outbox-only, and respects existing retry claims', () => {
  assert.match(leadEmailDeliveryCron, /authorization === `Bearer \$\{secret\}`/);
  assert.match(leadEmailDeliveryCron, /if \(!isAuthorized\(request\)\)[\s\S]{0,140}status: 401/);
  assert.match(leadEmailDeliveryCron, /listPendingLeadEmailDeliveries\(LOOKAHEAD_LIMIT, pairsOnly\)/);
  assert.match(leadEmailDeliveryCron, /mode === 'local_relay' \|\| \(mode === 'smtp_then_local_relay' && !hasUsableLeadSmtpConfiguration\(\)\)/);
  assert.match(leadEmailDeliveryCron, /if \(!hasLeadEmailTransportConfiguration\(mode\)\)/);
  assert.match(leadEmailDeliveryCron, /pendingRoles\.length === 1 && \(mode === 'local_relay' \|\| !hasUsableLeadSmtpConfiguration\(\)\)/);
  assert.match(leadEmailDeliveryCron, /const workerHealth = evaluateLeadEmailWorkerHealth\(\{/);
  assert.match(leadEmailDeliveryCron, /const MAX_DELIVERIES_PER_RUN = 5/);
  assert.match(leadEmailDeliveryCron, /pendingDeliveries\.slice\(0, MAX_DELIVERIES_PER_RUN\)/);
  assert.match(leadEmailDeliveryCron, /claimLeadEmailOutbox\(lead\.id, role\)/);
  assert.match(leadEmailDeliveryCron, /recordLeadEmailRecipientResult\(lead\.id, role, delivery, attemptToken\)/);
  assert.match(leadEmailDeliveryCron, /\(\['customer', 'internal'\] as const\)\.every\(\(role\) =>/);
  assert.match(leadEmailDeliveryCron, /status: 'unknown'[\s\S]{0,120}Výsledok odoslania sa nepodarilo potvrdiť/);
  assert.match(leadEmailDeliveryCron, /mode === 'local_relay' \|\| mode === 'smtp_then_local_relay'\) && pendingRoles\.length === 2/);
  assert.match(leadEmailDeliveryCron, /sendLeadEmailToRecipient\(lead, role/);
  assert.match(leadEmailDeliveryCron, /getLeadEmailOutboxHealth\(\)/);
  assert.match(leadEmailDeliveryCron, /getLeadEmailOutboxAttention\(\)/);
  assert.match(leadEmailDeliveryCron, /evaluateLeadEmailWorkerHealth\(\{/);
  assert.match(leadEmailDeliveryCron, /attention: workerHealth\.attention/);
  assert.match(leadEmailDeliveryCron, /status: workerHealth\.status/);
  assert.match(leadEmailDeliveryCron, /dispatchOpsAlert\(\{[\s\S]{0,180}worker: 'lead_email_delivery'/);
  assert.match(leadEmailDeliveryCron, /reasonCodes: \['worker_exception'\]/);
  assert.doesNotMatch(leadEmailDeliveryCron, /oldestAttentionLeadId/);
  assert.match(leadEmailDeliveryCron, /await markStaleLeadEmailClaimsUnknown\(\)/);
  assert.ok(leadEmailDeliveryCron.indexOf('await markStaleLeadEmailClaimsUnknown()') < leadEmailDeliveryCron.indexOf('await listPendingLeadEmailDeliveries('));
  assert.match(leadEmailDeliveryCron, /LEAD_EMAIL_WORKER_FAILED/);
  assert.doesNotMatch(leadEmailDeliveryCron, /listPlannerActions|listDueFollowups|weatherText|recoverAcceptedLeadAnalytics|runApplicationNotificationRecovery/);

  const scheduledWorker = vercelConfig.crons.filter((cron) => cron.path === '/api/cron/lead-email-delivery/');
  assert.deepEqual(scheduledWorker, [{ path: '/api/cron/lead-email-delivery/', schedule: '*/5 * * * *' }]);
  assert.equal(vercelConfig.crons.some((cron) => cron.path === '/api/cron/notifications/' && cron.schedule === '0 7 * * *'), true);
  assert.equal(vercelConfig.crons.some((cron) => cron.path === '/api/cron/application-notifications/' && cron.schedule === '*/5 * * * *'), true);
  assert.equal(vercelConfig.crons.length <= 100, true);
  assert.match(database, /next_attempt_at <= now\(\)/);
  assert.match(database, /INTERVAL '15 minutes'/);
  assert.match(database, /INTERVAL '60 minutes'/);
  assert.match(database, /AND next_attempt_at <= \$3/);
});

test('private lead-file deletion uses a durable authenticated worker and bounded retries', () => {
  assert.match(leadFileDeletionCron, /headers\.get\('authorization'\) === `Bearer \$\{secret\}`/);
  assert.match(leadFileDeletionCron, /claimLeadFileDeletionJobs\(MAX_DELETIONS_PER_RUN\)/);
  assert.match(leadFileDeletionCron, /deleteStoredLeadFile\(job\)/);
  assert.match(leadFileDeletionCron, /completeLeadFileDeletionJob\(job\.id, job\.claimId\)/);
  assert.match(leadFileDeletionCron, /failLeadFileDeletionJob\(job\.id, job\.claimId/);
  assert.doesNotMatch(leadFileDeletionCron, /console\.(log|error).*job|storageKey/);
  assert.match(database, /CREATE TABLE IF NOT EXISTS lead_file_deletion_jobs/);
  assert.match(database, /ON CONFLICT \(storage_driver, storage_key\) DO NOTHING/);
  assert.match(database, /export async function claimLeadFileDeletionJobs/);
  assert.match(database, /FOR UPDATE SKIP LOCKED/);
  assert.match(database, /export async function completeLeadFileDeletionJob/);
  assert.match(database, /export async function failLeadFileDeletionJob/);
  assert.deepEqual(vercelConfig.crons.filter((cron) => cron.path === '/api/cron/lead-file-deletions/'), [
    { path: '/api/cron/lead-file-deletions/', schedule: '*/5 * * * *' },
  ]);
  assert.match(leadAdminActions, /isLeadEmailEvidenceValid\(outcome, evidence\)/);
  assert.match(leadAdminActions, /isLeadEmailEvidenceValid\('failed', evidence\)/);
  assert.doesNotMatch(leadDetail, /value="provider_accepted"|value="inbox_no_message"/);
  assert.match(database, /manuallyConfirmedLeadEmailNonDelivery\(item, local\.auditLogs\)/);
  assert.match(database, /status = 'failed' AND retryable = false AND last_error = \$4 RETURNING id/);
  assert.match(leadDetail, /delivery\.manualRetryReady && canManuallyRetryLeadEmail\(\)/);
  assert.match(mailer, /export function canManuallyRetryLeadEmail\(\)\s*\{\s*if \(!process\.env\.SMTP_HOST\?\.trim\(\)/);
  assert.match(leadDetail, /delivery\.status === 'failed' && !delivery\.retryable && !delivery\.manualRetryReady/);
});

test('SMTP uncertainty is not automatically retried over the local relay', () => {
  assert.match(mailer, /canSafelyFallbackToLocalRelay\(mode, smtpResult\)/);
  assert.match(mailer, /if \(!canSafelyFallbackToLocalRelay\(mode, smtpResult\)\) return smtpResult/);
});

test('admin gives a safe CRM fallback for unresolved mail regardless of SMTP configuration', () => {
  assert.match(leadDetail, /!lead\.deletedAt && emailOutbox\.some\(\(delivery\) => delivery\.status === 'unknown' \|\| delivery\.status === 'failed'\)/);
  assert.doesNotMatch(leadDetail, /!lead\.deletedAt && !canManuallyRetryLeadEmail\(\) && emailOutbox\.some/);
  assert.match(leadDetail, /Dopyt je uložený v CRM/);
  assert.match(leadDetail, /Spracujte ho priamo tu, nečakajte na interné upozornenie/);
  assert.match(leadDetail, /Odoslanie neopakujte naslepo/);
});

test('cron marks planner and follow-up notices sent only after confirmed delivery', () => {
  assert.match(emailCron, /if \(delivery\.sent\) \{\s*await markPlannerNotificationSent\(action\.id, 'notify2DaysSent'\)/);
  assert.match(emailCron, /if \(delivery\.sent\) \{\s*await markPlannerNotificationSent\(action\.id, 'notify1DaySent'\)/);
  assert.match(emailCron, /if \(delivery\.sent\) \{\s*await markPlannerNotificationSent\(action\.id, 'notifyCustomerSent'\)/);
  assert.match(emailCron, /if \(delivery\.sent\) \{\s*await markLeadFollowupNotificationSent\(lead\.id\)/);
  assert.match(emailCron, /ok: failed === 0 && !leadEmailFailed && !rateLimitCleanupFailed && !analyticsRecovery\.failed && !analyticsRecovery\.remaining && analyticsRecovery\.unrecoverable === 0 && emailOutbox\.pending === 0/);
  assert.match(emailCron, /emailOutbox,/);
});
