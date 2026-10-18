import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('review requests require an authenticated explicit approval and role-bound bulk limits', async () => {
  const [actions, workspace] = await Promise.all([
    read('../app/admin/(protected)/referencie/request-actions.ts'),
    read('../app/admin/(protected)/referencie/review-workspace.tsx'),
  ]);
  assert.match(actions, /await verifyCsrf\(formData\)/);
  assert.match(actions, /await requireAdminUser\(\)/);
  assert.match(actions, /formData\.get\('confirmSend'\) !== 'on'/);
  assert.match(actions, /canProcessReviewRequestSelection\(admin\.role/);
  assert.match(actions, /claimReviewRequestForDelivery/);
  assert.ok(actions.indexOf('claimReviewRequestForDelivery') < actions.indexOf('sendReviewRequestEmail'));
  assert.match(actions, /formData\.get\('reminderAllowed'\) === 'on'/);
  assert.match(actions, /claimReviewRequestForDelivery\(id, existing\.revision, admin\.email, reminderAllowed\)/);
  assert.match(workspace, /Schvaľujem reálne odoslanie e-mailov/);
  assert.match(workspace, /Výslovne povoľujem pre vybrané žiadosti najviac jednu automatickú pripomienku/);
  assert.match(workspace, /Nič sa teraz neodošle/);
  assert.match(workspace, /Presná správa pred odoslaním/);
});

test('operator is limited to one recipient while superadmin respects the configured batch cap', async () => {
  const policyModule = await import('../src/server/review-request-policy.ts');
  const policy = policyModule.default ?? policyModule;
  assert.equal(policy.canProcessReviewRequestSelection('OPERATOR', 1, 20), true);
  assert.equal(policy.canProcessReviewRequestSelection('OPERATOR', 2, 20), false);
  assert.equal(policy.canProcessReviewRequestSelection('SUPER_ADMIN', 20, 20), true);
  assert.equal(policy.canProcessReviewRequestSelection('SUPER_ADMIN', 21, 20), false);
  assert.equal(policy.canPublishRequestedTestimonial('OPERATOR'), false);
  assert.equal(policy.canPublishRequestedTestimonial('SUPER_ADMIN'), true);
});

test('review tokens, lifecycle and publication remain private and fail closed', async () => {
  const [database, api, interactionApi, publicPage, form, mail, workspace, actions, legacyPage, auditPage] = await Promise.all([
    read('../src/server/db.ts'),
    read('../app/api/testimonial/route.ts'),
    read('../app/api/testimonial/interaction/route.ts'),
    read('../app/recenzie/[token]/page.tsx'),
    read('../app/recenzie/testimonial-form.tsx'),
    read('../src/server/review-request-mail.ts'),
    read('../app/admin/(protected)/referencie/review-workspace.tsx'),
    read('../app/admin/(protected)/referencie/request-actions.ts'),
    read('../app/admin/(protected)/reviews/request/page.tsx'),
    read('../app/admin/(protected)/audit/page.tsx'),
  ]);
  assert.match(database, /randomBytes\(32\)\.toString\('base64url'\)/);
  assert.match(database, /createHash\('sha256'\)\.update\(token\)\.digest\('hex'\)/);
  assert.match(database, /30 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(database, /staleReviewSendingMs = 15 \* 60 \* 1000/);
  assert.match(database, /status='delivery_unknown'.*interrupted_after_claim/s);
  assert.match(database, /resolveUnknownReviewRequestDelivery/);
  assert.match(database, /review_requests_token_hash_unique_idx/);
  assert.match(database, /review_requests_reminder_token_hash_unique_idx/);
  assert.match(database, /reminder_token_hash/);
  assert.match(database, /review_request_content_changed_reapproval_required/);
  const publicLookup = database.slice(database.indexOf('export async function openPublicReviewRequest'), database.indexOf('export type RequestedTestimonialSubmission'));
  const getOnlyLookup = publicLookup.slice(0, publicLookup.indexOf('export async function recordPublicReviewInteraction'));
  assert.doesNotMatch(getOnlyLookup, /review_request_form_interaction_recorded|status='opened'|status = 'opened'/, 'GET token lookup must remain read-only');
  assert.match(publicLookup, /export async function recordPublicReviewInteraction/);
  assert.match(publicLookup, /review_request_form_interaction_recorded/);
  assert.match(database, /review_requests_job_unique_idx/);
  assert.match(database, /status = 'submitted'|status: 'submitted'|status='submitted'/);
  assert.match(database, /status = 'approved'|status: 'approved'|status='approved'/);
  assert.match(database, /status = 'published'|status: 'published'|status='published'/);
  assert.match(api, /submitRequestedTestimonial/);
  assert.match(publicPage, /index: false/);
  assert.match(publicPage, /referrer: 'no-referrer'/);
  assert.match(form, /requestToken\s*\?\s*<p/);
  assert.match(form, /:\s*<label>E-mail/);
  assert.match(form, /onPointerDownCapture=\{recordInteraction\}/);
  assert.match(form, /onKeyDownCapture=\{recordInteraction\}/);
  assert.match(form, /onFocusCapture=\{recordInteraction\}/);
  assert.match(form, /onInputCapture=\{recordInteraction\}/);
  assert.match(form, /fetch\('\/api\/testimonial\/interaction\/'/);
  assert.match(interactionApi, /export async function POST/);
  assert.match(interactionApi, /fetchSite && fetchSite !== 'same-origin'/);
  assert.match(interactionApi, /consumeSharedRateLimit/);
  assert.match(interactionApi, /recordPublicReviewInteraction/);
  assert.match(interactionApi, /trustedRateLimitClientIp/);
  assert.doesNotMatch(interactionApi, /console\.(?:log|error|warn)/);
  assert.doesNotMatch(mail, /customerEmail.*link/);
  assert.match(mail, /resolveOutboundEmailRecipient/);
  assert.match(mail, /status: 'smtp_accepted'/);
  assert.doesNotMatch(mail, /status: 'delivered'/);
  assert.ok(mail.indexOf('try {') < mail.indexOf('const transport = configuredTransport()'));
  assert.match(actions, /finish\(approved \? 'approved' : 'approval_stale'\)/);
  assert.match(actions, /finish\(published \? 'published' : 'publication_stale'\)/);
  assert.match(actions, /if \(!completed\) \{\s*unknown \+= 1;/);
  assert.match(actions, /finish\(cancelled \? 'cancelled' : 'cancellation_stale'\)/);
  assert.match(workspace, /Schváliť obsah/);
  assert.match(workspace, /Zverejniť na webe/);
  assert.match(workspace, /Interakcia s formulárom zaznamenaná/);
  assert.doesNotMatch(workspace, /Odkaz otvorený/);
  assert.match(auditPage, /Zaznamenaná interakcia s formulárom referencie/);
  assert.match(legacyPage, /redirect\(/);
});

test('Google review is offered to every requested-review submitter only after form submission', async () => {
  const [api, form, publicPage] = await Promise.all([
    read('../app/api/testimonial/route.ts'),
    read('../app/recenzie/testimonial-form.tsx'),
    read('../app/recenzie/[token]/page.tsx'),
  ]);
  assert.ok(api.indexOf('await submitRequestedTestimonial') < api.indexOf('googleReviewLink: publicRequest?.googleReviewLink'));
  assert.match(form, /submittedGoogleLink && !error/);
  assert.match(form, /všetkým zákazníkom bez ohľadu na hodnotenie/);
  assert.doesNotMatch(form, /rating\s*[><=!]=?\s*[45]/);
  assert.match(publicPage, /request\.alreadySubmitted/);
  assert.match(publicPage, /request\.googleReviewLink/);
});

test('review SMTP setup failures are truthful and never escape before a send attempt', async () => {
  const previous = {
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    FROM_EMAIL: process.env.FROM_EMAIL,
    MAIL_FROM: process.env.MAIL_FROM,
  };
  const restore = (key, value) => value === undefined ? delete process.env[key] : process.env[key] = value;
  const request = {
    id: '00000000-0000-4000-8000-000000000001', jobId: '00000000-0000-4000-8000-000000000002',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), revision: 1,
    status: 'sending', customerName: 'Test', customerEmail: 'test@example.invalid', subject: 'Test',
    message: 'Test {{odkaz}}', createdBy: 'test@example.invalid', reminderAllowed: false,
  };
  try {
    const module = await import(`../src/server/review-request-mail.ts?smtp-test=${Date.now()}`);
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    process.env.FROM_EMAIL = 'astana@astana.sk';
    assert.deepEqual(await module.sendReviewRequestEmail(request, 'a'.repeat(43), request.message), {
      status: 'delivery_failed', reasonCode: 'smtp_unconfigured',
    });

    process.env.SMTP_HOST = '127.0.0.1';
    process.env.FROM_EMAIL = 'wrong@example.invalid';
    assert.deepEqual(await module.sendReviewRequestEmail(request, 'b'.repeat(43), request.message), {
      status: 'delivery_failed', reasonCode: 'smtp_invalid_sender',
    });
  } finally {
    for (const [key, value] of Object.entries(previous)) restore(key, value);
  }
});

test('one reminder, fail-closed cron and superadmin settings are enforced', async () => {
  const [database, actions, policy, cron, vercel, packageJson] = await Promise.all([
    read('../src/server/db.ts'),
    read('../app/admin/(protected)/referencie/request-actions.ts'),
    read('../src/server/review-request-policy.ts'),
    read('../app/api/cron/review-reminders/route.ts'),
    read('../vercel.json'),
    read('../package.json'),
  ]);
  assert.match(database, /reminder_allowed=true AND reminder_attempted_at IS NULL AND reminder_status IS NULL/);
  assert.match(database, /LOWER\(BTRIM\(j\.customer_email\)\)=LOWER\(BTRIM\(review_requests\.customer_email\)\)/);
  assert.match(database, /reminderNumber: 1/);
  assert.match(database, /reminder_status='delivery_unknown'.*interrupted_after_claim/s);
  assert.match(actions, /await requireSuperAdmin\(\)/);
  assert.match(actions, /settings\.reminderEnabled/);
  assert.match(actions, /claimReviewReminder/);
  assert.match(policy, /minReviewReminderDays = 5/);
  assert.match(policy, /maxReviewReminderDays = 7/);
  assert.match(cron, /CRON_SECRET/);
  assert.match(cron, /settings\.reminderEnabled/);
  assert.match(cron, /claimReviewReminder/);
  assert.match(cron, /recoverStaleReviewRequestDeliveries\('cron:review-reminders'\)/);
  assert.match(cron, /cron:review-reminders/);
  assert.match(cron, /timingSafeEqual/);
  assert.match(vercel, /\/api\/cron\/review-reminders\//);
  assert.match(vercel, /"schedule": "0 8 \* \* \*"/);
  assert.match(packageJson, /review-request-workflow\.local\.integration\.mjs/);
  assert.match(packageJson, /review-request-workflow\.postgres\.integration\.mjs/);
});
