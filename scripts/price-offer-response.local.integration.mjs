import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('..', import.meta.url));

test('customer offer response is hash-only, one-time and requires explicit admin application', () => {
  const tmpRoot = join(root, 'tmp');
  mkdirSync(tmpRoot, { recursive: true });
  const directory = mkdtempSync(join(tmpRoot, '.offer-response-'));
  const localDbPath = join(directory, 'local-db.json');
  const moduleUrl = new URL('../src/server/db.ts', import.meta.url).href;
  const code = `
    const fs = await import('node:fs');
    const imported = await import(${JSON.stringify(moduleUrl)});
    const db = imported.default ?? imported;
    const input = (suffix) => ({ objectType:'Rodinný dom', objectAddress:'Testovacia 1', municipality:'Poprad', district:'Poprad',
      contactPerson:'Test ' + suffix, phone:'0900000000', email:'test-' + suffix + '@example.invalid', realizationTerm:'Dohodou',
      materialType:'VLNITY_ETERNIT', areaM2:120, pricePerM2WithoutVat:10, documentationFeeWithoutVat:0,
      includeDocumentation:false, documentationPromotion:false, includeTransport:false, transportFrom:'', transportTo:'',
      transportRoundTripKm:0, transportPricePerKm:0.7, validUntil:'2027-12-31', sourceInquiry:'integration:' + crypto.randomUUID() });

    const failedOffer = await db.savePriceOffer(input('failed'),'operator@example.invalid');
    const failedClaim = await db.claimPriceOfferForSending(failedOffer.id,'operator@example.invalid');
    await db.finishPriceOfferSending(failedOffer.id,failedClaim.sendAttemptId,'not_sent','operator@example.invalid');
    const failedOpen = await db.openPublicPriceOfferResponse(failedClaim.customerResponseToken);

    const offer = await db.savePriceOffer(input('accepted'),'operator@example.invalid');
    const claim = await db.claimPriceOfferForSending(offer.id,'operator@example.invalid');
    await db.finishPriceOfferSending(offer.id,claim.sendAttemptId,'sent','operator@example.invalid');
    const opened = await db.openPublicPriceOfferResponse(claim.customerResponseToken);
    const submissions = await Promise.all(Array.from({length:12},()=>db.submitPublicPriceOfferResponse({
      token:claim.customerResponseToken,response:'ACCEPTED',confirmedReview:true,
    })));
    const beforeApply = await db.getPriceOffer(offer.id);
    const conflict = await db.submitPublicPriceOfferResponse({
      token:claim.customerResponseToken,response:'DECLINED',reasonCode:'price',confirmedReview:true,
    });
    const staleApply = await db.resolvePriceOfferCustomerResponse({ id:offer.id,expectedRevision:99,resolution:'apply',actorEmail:'jarka@example.invalid' });
    const applied = await db.resolvePriceOfferCustomerResponse({
      id:offer.id,expectedRevision:beforeApply.customerResponseRevision,resolution:'apply',actorEmail:'jarka@example.invalid',
    });

    const deferredOffer = await db.savePriceOffer(input('deferred'),'operator@example.invalid');
    const deferredClaim = await db.claimPriceOfferForSending(deferredOffer.id,'operator@example.invalid');
    await db.finishPriceOfferSending(deferredOffer.id,deferredClaim.sendAttemptId,'sent','operator@example.invalid');
    await db.submitPublicPriceOfferResponse({ token:deferredClaim.customerResponseToken,response:'DEFERRED',
      requestedFollowUpAt:'2027-01-20',confirmedReview:true });
    const deferredPending = await db.getPriceOffer(deferredOffer.id);
    const deferredApplied = await db.resolvePriceOfferCustomerResponse({ id:deferredOffer.id,
      expectedRevision:deferredPending.customerResponseRevision,resolution:'apply',actorEmail:'slavka@example.invalid',
      requestedFollowUpAt:'2027-01-22' });

    const cancelledJob = await db.saveBusinessJob({ demolitionDate:'2026-10-01', customerName:'Anna Testovacia', customerPhone:'0900000000',
      customerEmail:'anna@example.invalid', location:'Poprad', district:'Poprad', materialType:'Vlnitý eternit', objectType:'Rodinný dom', term:'',
      leadSource:'test-harness', preferredContact:'email', m2:100, pricePerM2:10, paymentType:'FAKTURA', workType:'DEMONTAZ_A_ODVOZ',
      wasteKg:1000, landfill:'INA', status:'DOKONCENA', note:'', workers:[], costs:{ fuel:0,suits:0,gloves:0,penetrant:0,landfillCost:0,otherName:'',otherAmount:0 } },'admin@example.invalid',undefined,{ legacyCompletedImportReason:'TEST_FIXTURE' });
    const review = await db.createReviewRequest({ jobId:cancelledJob.id, customerName:cancelledJob.customerName,
      customerEmail:cancelledJob.customerEmail, phone:cancelledJob.customerPhone, location:cancelledJob.location,
      objectType:cancelledJob.objectType, realizationDate:cancelledJob.demolitionDate, googleReviewLink:'', subject:'Spätná väzba',
      message:'Dobrý deň {{meno}} {{odkaz}}', status:'pending_approval', reminderAllowed:false, createdBy:'operator@example.invalid' });
    const cancelled = await db.cancelReviewRequest(review.id,'operator@example.invalid');
    const reopened = await db.reopenCancelledReviewRequest({ id:review.id,expectedRevision:cancelled.revision,
      subject:'Aktuálna spätná väzba',message:'Dobrý deň {{meno}}, prosíme o hodnotenie {{odkaz}}',googleReviewLink:'',
      reminderAllowed:false,actorEmail:'operator@example.invalid' });

    const storedText = fs.readFileSync(process.env.ASTANA_LOCAL_DB_PATH,'utf8');
    const stored = JSON.parse(storedText);
    const responseAudits = stored.auditLogs.filter((entry)=>entry.action.startsWith('price_offer_customer_response_'));
    process.stdout.write(JSON.stringify({ failedOpen:Boolean(failedOpen), rawFailedToken:failedClaim.customerResponseToken,
      rawToken:claim.customerResponseToken, opened, submissions:submissions.map((item)=>item.status),
      beforeApplyStatus:beforeApply.status,beforeApplyResponse:beforeApply.customerResponse, conflict:conflict.status,
      staleApply:Boolean(staleApply),appliedStatus:applied.status,deferredStatus:deferredApplied.status,
      deferredDate:deferredApplied.nextFollowUpAt,reopenedStatus:reopened.status,reopenedRevision:reopened.revision,
      cancelledRevision:cancelled.revision,storedText,responseAudits }));
  `;
  try {
    const output = execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', code], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: '', ASTANA_LOCAL_DB_PATH: localDbPath },
      timeout: 30_000,
    });
    const result = JSON.parse(output);
    assert.equal(result.failedOpen, false, 'confirmed no-send revokes the response link');
    assert.equal(result.opened.alreadyResponded, false);
    assert.equal(result.submissions.filter((status) => status === 'created').length, 1);
    assert.equal(result.submissions.filter((status) => status === 'idempotent').length, 11);
    assert.equal(result.beforeApplyStatus, 'ODOSLANA', 'public response does not change the offer state');
    assert.equal(result.beforeApplyResponse, 'ACCEPTED');
    assert.equal(result.conflict, 'conflict', 'a different second answer cannot replace the first');
    assert.equal(result.staleApply, false);
    assert.equal(result.appliedStatus, 'PRIJATA');
    assert.equal(result.deferredStatus, 'ODLOZENA');
    assert.equal(result.deferredDate, '2027-01-22', 'admin may confirm a reviewed follow-up date');
    assert.equal(result.reopenedStatus, 'pending_approval');
    assert.equal(result.reopenedRevision, result.cancelledRevision + 1);
    assert.equal(result.storedText.includes(result.rawToken), false, 'raw response token is never persisted');
    assert.equal(result.storedText.includes(result.rawFailedToken), false, 'failed-send token is never persisted');
    const auditJson = JSON.stringify(result.responseAudits.map((entry) => entry.changes));
    assert.equal(auditJson.includes('test-accepted@example.invalid'), false);
    assert.equal(auditJson.includes(result.rawToken), false);
  } finally {
    if (resolve(directory, '..') !== resolve(tmpRoot) || !directory.split(/[\\/]/).at(-1)?.startsWith('.offer-response-')) {
      throw new Error('Refusing to remove an unexpected test directory.');
    }
    rmSync(directory, { recursive: true, force: true });
  }
});
