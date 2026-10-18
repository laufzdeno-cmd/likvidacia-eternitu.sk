import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('..', import.meta.url));

test('local review workflow is linked, idempotent, token-hashed and separately approved/published', () => {
  const tmpRoot = join(root, 'tmp');
  mkdirSync(tmpRoot, { recursive: true });
  const directory = mkdtempSync(join(tmpRoot, '.review-workflow-'));
  const localDbPath = join(directory, 'local-db.json');
  const moduleUrl = new URL('../src/server/db.ts', import.meta.url).href;
  const consentModuleUrl = new URL('../src/lib/testimonial-consent.ts', import.meta.url).href;
  const testimonialPolicyUrl = new URL('../src/server/testimonial-policy.ts', import.meta.url).href;
  const interactionRouteUrl = new URL('../app/api/testimonial/interaction/route.ts', import.meta.url).href;
  const code = `
    const fs = await import('node:fs');
    const dbModule = await import(${JSON.stringify(moduleUrl)});
    const db = dbModule.default ?? dbModule;
    const consentModule = await import(${JSON.stringify(consentModuleUrl)});
    const consent = consentModule.default ?? consentModule;
    const testimonialPolicyModule = await import(${JSON.stringify(testimonialPolicyUrl)});
    const testimonialPolicy = testimonialPolicyModule.default ?? testimonialPolicyModule;
    const { NextRequest } = await import('next/server');
    const interactionRoute = await import(${JSON.stringify(interactionRouteUrl)});
    process.env.AUTH_SECRET = 'local-review-interaction-test-secret';
    const jobInput = (name, email) => ({ demolitionDate:'2026-10-01', customerName:name, customerPhone:'0900000000', customerEmail:email,
      location:'Poprad', district:'Poprad', materialType:'Vlnitý eternit', objectType:'Rodinný dom', term:'', leadSource:'test-harness',
      preferredContact:'email', m2:100, pricePerM2:10, paymentType:'FAKTURA', workType:'DEMONTAZ_A_ODVOZ', wasteKg:1000,
      landfill:'INA', status:'DOKONCENA', note:'', workers:[], costs:{ fuel:0,suits:0,gloves:0,penetrant:0,landfillCost:0,otherName:'',otherAmount:0 } });
    const legacy = { legacyCompletedImportReason:'TEST_FIXTURE' };
    const job = await db.saveBusinessJob(jobInput('Anna Testovacia','anna@example.invalid'),'admin@example.invalid',undefined,legacy);
    const reminderJob = await db.saveBusinessJob(jobInput('Ján Testovací','jan@example.invalid'),'admin@example.invalid',undefined,legacy);
    const recoveryJob = await db.saveBusinessJob(jobInput('Mária Testovacia','maria@example.invalid'),'admin@example.invalid',undefined,legacy);
    const acceptedReminderJob = await db.saveBusinessJob(jobInput('Peter Testovací','peter@example.invalid'),'admin@example.invalid',undefined,legacy);
    const staleReminderJob = await db.saveBusinessJob(jobInput('Eva Testovacia','eva@example.invalid'),'admin@example.invalid',undefined,legacy);
    const recipientChangedJob = await db.saveBusinessJob(jobInput('Igor Testovací','igor@example.invalid'),'admin@example.invalid',undefined,legacy);
    const eligibleBefore = await db.listEligibleReviewJobs();
    const request = await db.createReviewRequest({ jobId:job.id, customerName:job.customerName, customerEmail:job.customerEmail,
      phone:job.customerPhone, location:job.location, objectType:job.objectType, realizationDate:job.demolitionDate,
      googleReviewLink:'https://example.com/google', subject:'Spätná väzba', message:'Dobrý deň {{meno}} {{odkaz}}',
      status:'pending_approval', reminderAllowed:true, createdBy:'operator@example.invalid' });
    const duplicate = await db.createReviewRequest({ ...request, createdBy:'operator@example.invalid' });
    const claim = await db.claimReviewRequestForDelivery(request.id, request.revision, 'operator@example.invalid', false);
    assert.equal(claim.request.reminderAllowed, false, 'schválenie prvej správy musí vedieť výslovne ponechať pripomienku vypnutú');
    const concurrentClaim = await db.claimReviewRequestForDelivery(request.id, request.revision, 'operator@example.invalid');
    const smtpAccepted = await db.completeReviewRequestDelivery(request.id, claim.request.revision,
      { status:'smtp_accepted', messageId:'smtp-sensitive-message-id' }, 'operator@example.invalid', 6);
    const tokenDays = (new Date(smtpAccepted.tokenExpiresAt).getTime() - new Date(claim.request.updatedAt).getTime()) / 86400000;
    const openedA = await db.openPublicReviewRequest(claim.token);
    const openedB = await db.openPublicReviewRequest(claim.token);
    const afterGet = (await db.listReviewRequests()).find((item)=>item.id===request.id);
    const interactionA = await db.recordPublicReviewInteraction(claim.token);
    const interactionB = await db.recordPublicReviewInteraction(claim.token);
    const afterInteraction = (await db.listReviewRequests()).find((item)=>item.id===request.id);
    const interactionRouteResponse = await interactionRoute.POST(new NextRequest(
      'https://likvidacia-eternitu.sk/api/testimonial/interaction/',
      { method:'POST', headers:{ Origin:'https://likvidacia-eternitu.sk', 'Sec-Fetch-Site':'same-origin',
        'Content-Type':'application/json', 'X-Forwarded-For':'192.0.2.81' }, body:JSON.stringify({ token:claim.token }) },
    ));
    const interactionRouteMissingOrigin = await interactionRoute.POST(new NextRequest(
      'https://likvidacia-eternitu.sk/api/testimonial/interaction/',
      { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ token:claim.token }) },
    ));
    const testimonial = await db.submitRequestedTestimonial({ token:claim.token, submissionId:crypto.randomUUID(),
      customerName:'Anna T.', rating:5, text:'S prácou tímu ASTANA sme boli veľmi spokojní.' });
    const submittedAgain = await db.submitRequestedTestimonial({ token:claim.token, submissionId:testimonial.submissionId,
      customerName:'Anna T.', rating:5, text:'S prácou tímu ASTANA sme boli veľmi spokojní.' });
    const approved = await db.approveRequestedTestimonial(testimonial.id,'operator@example.invalid');
    const notYetPublic = await db.listApprovedTestimonials(20);
    const published = await db.publishRequestedTestimonial(testimonial.id,'superadmin@example.invalid');
    const nowPublic = await db.listApprovedTestimonials(20);
    const revisedText = 'Upravená a zákazníkom znovu odsúhlasená skúsenosť so službou ASTANA.';
    const revisedEvidence = consent.formatAdminTestimonialConsentEvidence(
      'Súhlasím so zverejnením upravenej referencie v uvedenom znení.', 'e-mail', '2026-10-14',
      testimonialPolicy.testimonialPublicContentHash(testimonial.customerName, testimonial.rating, revisedText),
    );
    const edited = await db.updateTestimonial(testimonial.id, { ...testimonial, text:revisedText, status:'draft',
      consentPublication:true, consentEvidence:revisedEvidence, consentCapturedAt:new Date().toISOString(),
      consentVersion:consent.adminTestimonialConsentVersion }, 'operator@example.invalid');
    const requestAfterEdit = (await db.listReviewRequests()).find((item)=>item.id===request.id);
    const publicAfterEdit = await db.listApprovedTestimonials(20);
    const reapproved = await db.approveRequestedTestimonial(testimonial.id,'operator@example.invalid');
    const republished = await db.publishRequestedTestimonial(testimonial.id,'superadmin@example.invalid');
    const hidden = await db.updateTestimonialStatus(testimonial.id,'hidden','operator@example.invalid');
    const requestAfterHide = (await db.listReviewRequests()).find((item)=>item.id===request.id);
    const publicAfterHide = await db.listApprovedTestimonials(20);
    await db.updateTestimonialStatus(testimonial.id,'draft','operator@example.invalid');
    const reapprovedAfterHide = await db.approveRequestedTestimonial(testimonial.id,'operator@example.invalid');
    const republishedAfterHide = await db.publishRequestedTestimonial(testimonial.id,'superadmin@example.invalid');

    const reminderRequest = await db.createReviewRequest({ jobId:reminderJob.id, customerName:reminderJob.customerName,
      customerEmail:reminderJob.customerEmail, phone:reminderJob.customerPhone, location:reminderJob.location,
      objectType:reminderJob.objectType, realizationDate:reminderJob.demolitionDate, googleReviewLink:'',
      subject:'Spätná väzba', message:'Dobrý deň {{meno}} {{odkaz}}', status:'pending_approval', reminderAllowed:true,
      createdBy:'operator@example.invalid' });
    const reminderInitialClaim = await db.claimReviewRequestForDelivery(reminderRequest.id, reminderRequest.revision,'operator@example.invalid');
    const reminderAccepted = await db.completeReviewRequestDelivery(reminderRequest.id, reminderInitialClaim.request.revision,
      { status:'smtp_accepted', messageId:'another-private-id' },'operator@example.invalid',5);
    const raw = JSON.parse(fs.readFileSync(process.env.ASTANA_LOCAL_DB_PATH,'utf8'));
    const storedReminder = raw.reviewRequests.find((item)=>item.id===reminderRequest.id);
    storedReminder.reminderDueAt='2026-01-01T00:00:00.000Z'; storedReminder.updatedAt=new Date().toISOString(); storedReminder.revision+=1;
    fs.writeFileSync(process.env.ASTANA_LOCAL_DB_PATH,JSON.stringify(raw,null,2),'utf8');
    const dueReminderIds = (await db.listDueReviewReminders(20)).map((item)=>item.id);
    const reminderClaim = await db.claimReviewReminder(reminderRequest.id, storedReminder.revision,'operator@example.invalid');
    const secondReminderClaim = await db.claimReviewReminder(reminderRequest.id, reminderClaim.request.revision,'operator@example.invalid');
    const originalLinkDuringReminder = await db.openPublicReviewRequest(reminderInitialClaim.token);
    const failedReminder = await db.recordReviewReminderResult(reminderRequest.id, reminderClaim.request.revision,
      { status:'delivery_failed', reasonCode:'smtp_send_failed' }, 'operator@example.invalid');
    const originalLinkAfterFailure = await db.openPublicReviewRequest(reminderInitialClaim.token);
    const failedReminderLink = await db.openPublicReviewRequest(reminderClaim.token);
    const thirdReminderClaim = await db.claimReviewReminder(reminderRequest.id, failedReminder.revision,'operator@example.invalid');

    const acceptedReminderRequest = await db.createReviewRequest({ jobId:acceptedReminderJob.id, customerName:acceptedReminderJob.customerName,
      customerEmail:acceptedReminderJob.customerEmail, phone:acceptedReminderJob.customerPhone, location:acceptedReminderJob.location,
      objectType:acceptedReminderJob.objectType, realizationDate:acceptedReminderJob.demolitionDate, googleReviewLink:'',
      subject:'Spätná väzba', message:'Dobrý deň {{meno}} {{odkaz}}', status:'pending_approval', reminderAllowed:true,
      createdBy:'operator@example.invalid' });
    const acceptedInitialClaim = await db.claimReviewRequestForDelivery(acceptedReminderRequest.id, acceptedReminderRequest.revision,'operator@example.invalid');
    const acceptedInitial = await db.completeReviewRequestDelivery(acceptedReminderRequest.id, acceptedInitialClaim.request.revision,
      { status:'smtp_accepted', messageId:'accepted-initial-private-id' },'operator@example.invalid',5);
    const rawAccepted = JSON.parse(fs.readFileSync(process.env.ASTANA_LOCAL_DB_PATH,'utf8'));
    const storedAccepted = rawAccepted.reviewRequests.find((item)=>item.id===acceptedReminderRequest.id);
    storedAccepted.reminderDueAt='2026-01-01T00:00:00.000Z'; storedAccepted.revision+=1;
    fs.writeFileSync(process.env.ASTANA_LOCAL_DB_PATH,JSON.stringify(rawAccepted,null,2),'utf8');
    const acceptedReminderClaim = await db.claimReviewReminder(acceptedReminderRequest.id,storedAccepted.revision,'operator@example.invalid');
    const acceptedReminderResult = await db.recordReviewReminderResult(acceptedReminderRequest.id,acceptedReminderClaim.request.revision,
      { status:'smtp_accepted', messageId:'accepted-reminder-private-id' },'operator@example.invalid');
    const acceptedReminderLink = await db.openPublicReviewRequest(acceptedReminderClaim.token);
    const acceptedOriginalLink = await db.openPublicReviewRequest(acceptedInitialClaim.token);

    const staleReminderRequest = await db.createReviewRequest({ jobId:staleReminderJob.id, customerName:staleReminderJob.customerName,
      customerEmail:staleReminderJob.customerEmail, phone:staleReminderJob.customerPhone, location:staleReminderJob.location,
      objectType:staleReminderJob.objectType, realizationDate:staleReminderJob.demolitionDate, googleReviewLink:'',
      subject:'Spätná väzba', message:'Dobrý deň {{meno}} {{odkaz}}', status:'pending_approval', reminderAllowed:true,
      createdBy:'operator@example.invalid' });
    const staleInitialClaim = await db.claimReviewRequestForDelivery(staleReminderRequest.id,staleReminderRequest.revision,'operator@example.invalid');
    await db.completeReviewRequestDelivery(staleReminderRequest.id,staleInitialClaim.request.revision,
      { status:'smtp_accepted', messageId:'stale-initial-private-id' },'operator@example.invalid',5);
    const rawStale = JSON.parse(fs.readFileSync(process.env.ASTANA_LOCAL_DB_PATH,'utf8'));
    const storedStale = rawStale.reviewRequests.find((item)=>item.id===staleReminderRequest.id);
    storedStale.reminderDueAt='2026-01-01T00:00:00.000Z'; storedStale.revision+=1;
    fs.writeFileSync(process.env.ASTANA_LOCAL_DB_PATH,JSON.stringify(rawStale,null,2),'utf8');
    const staleReminderClaim = await db.claimReviewReminder(staleReminderRequest.id,storedStale.revision,'operator@example.invalid');
    const rawClaimedStale = JSON.parse(fs.readFileSync(process.env.ASTANA_LOCAL_DB_PATH,'utf8'));
    const claimedStale = rawClaimedStale.reviewRequests.find((item)=>item.id===staleReminderRequest.id);
    claimedStale.updatedAt='2026-01-01T00:00:00.000Z';
    fs.writeFileSync(process.env.ASTANA_LOCAL_DB_PATH,JSON.stringify(rawClaimedStale,null,2),'utf8');
    const recoveredStaleReminderCount = await db.recoverStaleReviewRequestDeliveries();
    const recoveredStaleReminder = (await db.listReviewRequests()).find((item)=>item.id===staleReminderRequest.id);
    const staleReminderLink = await db.openPublicReviewRequest(staleReminderClaim.token);
    const staleOriginalLink = await db.openPublicReviewRequest(staleInitialClaim.token);
    const staleRetryClaim = await db.claimReviewReminder(staleReminderRequest.id,recoveredStaleReminder.revision,'operator@example.invalid');

    const recipientRequest = await db.createReviewRequest({ jobId:recipientChangedJob.id, customerName:recipientChangedJob.customerName,
      customerEmail:recipientChangedJob.customerEmail, phone:recipientChangedJob.customerPhone, location:recipientChangedJob.location,
      objectType:recipientChangedJob.objectType, realizationDate:recipientChangedJob.demolitionDate, googleReviewLink:'',
      subject:'Spätná väzba', message:'Dobrý deň {{meno}} {{odkaz}}', status:'pending_approval', reminderAllowed:true,
      createdBy:'operator@example.invalid' });
    const recipientInitialClaim = await db.claimReviewRequestForDelivery(recipientRequest.id,recipientRequest.revision,'operator@example.invalid');
    await db.completeReviewRequestDelivery(recipientRequest.id,recipientInitialClaim.request.revision,
      { status:'smtp_accepted', messageId:'recipient-initial-private-id' },'operator@example.invalid',5);
    const rawRecipient = JSON.parse(fs.readFileSync(process.env.ASTANA_LOCAL_DB_PATH,'utf8'));
    const storedRecipientRequest = rawRecipient.reviewRequests.find((item)=>item.id===recipientRequest.id);
    storedRecipientRequest.reminderDueAt='2026-01-01T00:00:00.000Z'; storedRecipientRequest.revision+=1;
    rawRecipient.businessJobs.find((item)=>item.id===recipientChangedJob.id).customerEmail='changed@example.invalid';
    fs.writeFileSync(process.env.ASTANA_LOCAL_DB_PATH,JSON.stringify(rawRecipient,null,2),'utf8');
    const recipientDueIds = (await db.listDueReviewReminders(20)).map((item)=>item.id);
    const recipientClaim = await db.claimReviewReminder(recipientRequest.id,storedRecipientRequest.revision,'operator@example.invalid');

    const recoveryRequest = await db.createReviewRequest({ jobId:recoveryJob.id, customerName:recoveryJob.customerName,
      customerEmail:recoveryJob.customerEmail, phone:recoveryJob.customerPhone, location:recoveryJob.location,
      objectType:recoveryJob.objectType, realizationDate:recoveryJob.demolitionDate, googleReviewLink:'',
      subject:'Spätná väzba', message:'Dobrý deň {{meno}} {{odkaz}}', status:'pending_approval', reminderAllowed:false,
      createdBy:'operator@example.invalid' });
    const recoveryClaim = await db.claimReviewRequestForDelivery(recoveryRequest.id,recoveryRequest.revision,'operator@example.invalid');
    const beforeRecovery = JSON.parse(fs.readFileSync(process.env.ASTANA_LOCAL_DB_PATH,'utf8'));
    const orphaned = beforeRecovery.reviewRequests.find((item)=>item.id===recoveryRequest.id);
    orphaned.updatedAt='2026-01-01T00:00:00.000Z';
    fs.writeFileSync(process.env.ASTANA_LOCAL_DB_PATH,JSON.stringify(beforeRecovery,null,2),'utf8');
    const recoveredCount = await db.recoverStaleReviewRequestDeliveries();
    const recovered = (await db.listReviewRequests()).find((item)=>item.id===recoveryRequest.id);
    const manuallyResolved = await db.resolveUnknownReviewRequestDelivery(recoveryRequest.id,recovered.revision,'not_sent','operator@example.invalid');
    const retryClaim = await db.claimReviewRequestForDelivery(recoveryRequest.id,manuallyResolved.revision,'operator@example.invalid');

    const storedText = fs.readFileSync(process.env.ASTANA_LOCAL_DB_PATH,'utf8');
    const stored = JSON.parse(storedText);
    const requestAudits = stored.auditLogs.filter((entry)=>entry.entityType==='review_request');
    process.stdout.write(JSON.stringify({ jobId:job.id, eligibleBefore:eligibleBefore.map((item)=>item.id), duplicateId:duplicate.id,
      requestId:request.id, concurrentClaim:Boolean(concurrentClaim), rawToken:claim.token, storedText, tokenDays,
      openedA, openedB, testimonial, submittedAgainId:submittedAgain.id, approvedStatus:approved.status,
      notYetPublic:notYetPublic.map((item)=>item.id), publishedStatus:published.status, nowPublic:nowPublic.map((item)=>item.id),
      afterGetStatus:afterGet.status, afterGetRevision:afterGet.revision, smtpAcceptedRevision:smtpAccepted.revision,
      interactionAStatus:interactionA.status, interactionARevision:interactionA.revision,
      interactionBRevision:interactionB.revision, interactionAt:afterInteraction.openedAt,
      interactionRouteStatus:interactionRouteResponse.status, interactionRouteMissingOriginStatus:interactionRouteMissingOrigin.status,
      editedStatus:edited.status, requestAfterEditStatus:requestAfterEdit.status, publicAfterEdit:publicAfterEdit.map((item)=>item.id),
      reapprovedStatus:reapproved.status, republishedStatus:republished.status, hiddenStatus:hidden.status,
      requestAfterHideStatus:requestAfterHide.status, publicAfterHide:publicAfterHide.map((item)=>item.id),
      reapprovedAfterHideStatus:reapprovedAfterHide.status, republishedAfterHideStatus:republishedAfterHide.status,
      reminderAccepted, dueReminderIds, reminderClaim:Boolean(reminderClaim), secondReminderClaim:Boolean(secondReminderClaim),
      failedReminderStatus:failedReminder.reminderStatus, reminderRawToken:reminderClaim.token, originalLinkDuringReminder:Boolean(originalLinkDuringReminder),
      originalLinkAfterFailure:Boolean(originalLinkAfterFailure), failedReminderLink:Boolean(failedReminderLink), thirdReminderClaim:Boolean(thirdReminderClaim),
      acceptedReminderResultStatus:acceptedReminderResult.reminderStatus, acceptedReminderRawToken:acceptedReminderClaim.token,
      acceptedReminderLink:Boolean(acceptedReminderLink), acceptedOriginalLink:Boolean(acceptedOriginalLink),
      recoveredStaleReminderCount, recoveredStaleReminderStatus:recoveredStaleReminder.reminderStatus,
      staleReminderRawToken:staleReminderClaim.token, staleReminderLink:Boolean(staleReminderLink),
      staleOriginalLink:Boolean(staleOriginalLink), staleRetryClaim:Boolean(staleRetryClaim),
      recipientRequestId:recipientRequest.id, recipientDueIds, recipientClaim:Boolean(recipientClaim),
      recoveredCount, recoveredStatus:recovered.status, manuallyResolvedStatus:manuallyResolved.status,
      retryClaim:Boolean(retryClaim), recoveryRawToken:recoveryClaim.token, requestAudits }));
  `;
  try {
    const output = execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', code], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: '', ASTANA_LOCAL_DB_PATH: localDbPath },
      timeout: 30_000,
    });
    const result = JSON.parse(output);
    assert.ok(result.eligibleBefore.includes(result.jobId));
    assert.equal(result.duplicateId, result.requestId);
    assert.equal(result.concurrentClaim, false, 'concurrent approval cannot claim the same email twice');
    assert.ok(result.tokenDays >= 29.99 && result.tokenDays <= 30.01);
    assert.equal(result.storedText.includes(result.rawToken), false, 'raw token must never be persisted');
    assert.equal(result.openedA.id, result.openedB.id, 'opening is safely repeatable before submission');
    assert.equal(result.afterGetStatus, 'smtp_accepted', 'GET must not claim that a human opened the link');
    assert.equal(result.afterGetRevision, result.smtpAcceptedRevision, 'GET must not mutate the request revision');
    assert.equal(result.interactionAStatus, 'opened', 'a real form interaction records the compatibility status');
    assert.ok(result.interactionAt, 'a real form interaction records its timestamp');
    assert.equal(result.interactionARevision, result.smtpAcceptedRevision + 1);
    assert.equal(result.interactionBRevision, result.interactionARevision, 'interaction recording is idempotent');
    assert.equal(result.interactionRouteStatus, 200, 'same-origin local route accepts a valid token idempotently');
    assert.equal(result.interactionRouteMissingOriginStatus, 403, 'local route rejects requests without a same-origin signal');
    assert.equal(result.submittedAgainId, result.testimonial.id, 'submission retry is idempotent');
    assert.equal(result.approvedStatus, 'approved');
    assert.equal(result.notYetPublic.includes(result.testimonial.id), false, 'approval alone is not publication');
    assert.equal(result.publishedStatus, 'approved');
    assert.equal(result.nowPublic.includes(result.testimonial.id), true);
    assert.equal(result.editedStatus, 'draft');
    assert.equal(result.requestAfterEditStatus, 'submitted', 'editing published linked content requires a fresh approval');
    assert.equal(result.publicAfterEdit.includes(result.testimonial.id), false, 'edited content is removed from publication until reapproved');
    assert.equal(result.reapprovedStatus, 'approved');
    assert.equal(result.republishedStatus, 'approved');
    assert.equal(result.hiddenStatus, 'hidden');
    assert.equal(result.requestAfterHideStatus, 'submitted', 'hiding linked content resets its publish lifecycle');
    assert.equal(result.publicAfterHide.includes(result.testimonial.id), false);
    assert.equal(result.reapprovedAfterHideStatus, 'approved');
    assert.equal(result.republishedAfterHideStatus, 'approved');
    assert.equal(result.reminderClaim, true);
    assert.deepEqual(result.dueReminderIds, [result.reminderAccepted.id], 'only the pre-authorized due reminder enters the automatic queue');
    assert.equal(result.secondReminderClaim, false, 'only one reminder may be claimed');
    assert.equal(result.failedReminderStatus, 'delivery_failed');
    assert.equal(result.originalLinkDuringReminder, true, 'claiming a reminder must not replace the original token');
    assert.equal(result.originalLinkAfterFailure, true, 'failed reminder preserves the original link');
    assert.equal(result.failedReminderLink, false, 'failed reminder token is revoked');
    assert.equal(result.thirdReminderClaim, false, 'failed reminder is still a consumed one-time attempt');
    assert.equal(result.acceptedReminderResultStatus, 'smtp_accepted');
    assert.equal(result.acceptedReminderLink, true, 'accepted reminder keeps its new link usable');
    assert.equal(result.acceptedOriginalLink, true, 'accepted reminder also preserves the original link');
    assert.equal(result.recoveredStaleReminderCount, 1);
    assert.equal(result.recoveredStaleReminderStatus, 'delivery_unknown');
    assert.equal(result.staleReminderLink, true, 'unknown reminder keeps its potentially delivered link usable');
    assert.equal(result.staleOriginalLink, true);
    assert.equal(result.staleRetryClaim, false, 'stale recovery must not create an infinite retry loop');
    assert.equal(result.recipientDueIds.includes(result.recipientRequestId), false);
    assert.equal(result.recipientClaim, false, 'recipient changes fail closed at the claim boundary');
    assert.equal(result.recoveredCount, 1, 'an interrupted send is recovered instead of remaining stuck');
    assert.equal(result.recoveredStatus, 'delivery_unknown');
    assert.equal(result.manuallyResolvedStatus, 'delivery_failed');
    assert.equal(result.retryClaim, true, 'retry is possible only after explicit not-sent resolution');
    assert.equal(result.storedText.includes(result.recoveryRawToken), false, 'recovery token must also remain hash-only');
    assert.equal(result.storedText.includes(result.reminderRawToken), false, 'failed reminder token must never be persisted raw');
    assert.equal(result.storedText.includes(result.acceptedReminderRawToken), false, 'accepted reminder token must never be persisted raw');
    assert.equal(result.storedText.includes(result.staleReminderRawToken), false, 'unknown reminder token must never be persisted raw');
    const auditJson = JSON.stringify(result.requestAudits.map((entry) => entry.changes));
    assert.equal(result.requestAudits.filter((entry) => entry.action === 'review_request_form_interaction_recorded').length, 1,
      'repeated interaction signals create one audit event');
    assert.equal(auditJson.includes('anna@example.invalid'), false);
    assert.equal(auditJson.includes('Anna Testovacia'), false);
    assert.equal(auditJson.includes('smtp-sensitive-message-id'), false);
  } finally {
    if (resolve(directory, '..') !== resolve(tmpRoot) || !directory.split(/[\\/]/).at(-1)?.startsWith('.review-workflow-')) {
      throw new Error('Refusing to remove an unexpected test directory.');
    }
    rmSync(directory, { recursive: true, force: true });
  }
});
