import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('..', import.meta.url));

test('completion wizard is role-safe, revision-safe and prepares only an unsent review draft', () => {
  const tmpRoot = join(root, 'tmp');
  mkdirSync(tmpRoot, { recursive: true });
  const directory = mkdtempSync(join(tmpRoot, '.business-job-completion-'));
  const localDbPath = join(directory, 'local-db.json');
  const moduleUrl = new URL('../src/server/db.ts', import.meta.url).href;
  const code = `
    const fs = await import('node:fs');
    const imported = await import(${JSON.stringify(moduleUrl)});
    const db = imported.default ?? imported;
    const input = (name) => ({ demolitionDate:'2026-10-14', customerName:name, customerPhone:'0900000000',
      customerEmail:name.toLowerCase().replace(/[^a-z]/g,'')+'@example.invalid', location:'Poprad', district:'Poprad',
      materialType:'Vlnitý eternit', objectType:'Rodinný dom', term:'', preferredContact:'email', m2:100,
      pricePerM2:10, paymentType:'FAKTURA', workType:'DEMONTAZ_A_ODVOZ', wasteKg:1000, landfill:'INA',
      status:'DEMONT_DOKONCENA', note:'', workers:[], costs:{ fuel:0,suits:0,gloves:0,penetrant:0,landfillCost:0,otherName:'',otherAmount:0 } });
    const job = await db.saveBusinessJob(input('Anna Bezpecna'),'superadmin@example.invalid');
    let directCreateBlocked = false;
    try { await db.saveBusinessJob({ ...input('Priamo Dokoncena'), status:'DOKONCENA' },'superadmin@example.invalid'); }
    catch { directCreateBlocked = true; }
    let directCompletionBlocked = false;
    try { await db.saveBusinessJob({ ...input('Anna Bezpecna'), status:'DOKONCENA' },'superadmin@example.invalid',job.id); }
    catch { directCompletionBlocked = true; }
    const initial = await db.getBusinessJobCompletion(job.id);
    const operatorSaved = await db.saveBusinessJobCompletion({ jobId:job.id, expectedRevision:initial.revision,
      values:{ documentsDecision:'confirmed',documentsReason:'',costsDecision:'confirmed_zero',costsReason:'podvrhnute',
        photosDecision:'not_available',photosReason:'Zakaznik fotografie neposkytol',reviewDecision:'prepare',reviewBlockReason:'' },
      actorEmail:'operator@example.invalid',actorRole:'OPERATOR' });
    const operatorView = await db.getOperationalBusinessJobCompletion(job.id);
    let documentsReasonBlocked = false;
    try { await db.saveBusinessJobCompletion({ jobId:job.id,expectedRevision:operatorSaved.revision,
      values:{ documentsDecision:'not_applicable',documentsReason:'',costsDecision:'confirmed_recorded',costsReason:'',
        photosDecision:'not_available',photosReason:'Zakaznik fotografie neposkytol',reviewDecision:'prepare',reviewBlockReason:'' },
      actorEmail:'superadmin@example.invalid',actorRole:'SUPER_ADMIN' }); } catch { documentsReasonBlocked = true; }
    let operatorFinalizeBlocked = false;
    try { await db.finalizeBusinessJobCompletion({ jobId:job.id,expectedRevision:operatorSaved.revision,
      actorEmail:'operator@example.invalid',actorRole:'OPERATOR' }); } catch { operatorFinalizeBlocked = true; }
    let zeroReasonBlocked = false;
    try { await db.saveBusinessJobCompletion({ jobId:job.id,expectedRevision:operatorSaved.revision,
      values:{ documentsDecision:'confirmed',documentsReason:'',costsDecision:'confirmed_zero',costsReason:'',
        photosDecision:'not_available',photosReason:'Zakaznik fotografie neposkytol',reviewDecision:'prepare',reviewBlockReason:'' },
      actorEmail:'superadmin@example.invalid',actorRole:'SUPER_ADMIN' }); } catch { zeroReasonBlocked = true; }
    let photoReasonBlocked = false;
    try { await db.saveBusinessJobCompletion({ jobId:job.id,expectedRevision:operatorSaved.revision,
      values:{ documentsDecision:'confirmed',documentsReason:'',costsDecision:'confirmed_recorded',costsReason:'',
        photosDecision:'not_available',photosReason:'',reviewDecision:'prepare',reviewBlockReason:'' },
      actorEmail:'superadmin@example.invalid',actorRole:'SUPER_ADMIN' }); } catch { photoReasonBlocked = true; }
    const superSaved = await db.saveBusinessJobCompletion({ jobId:job.id,expectedRevision:operatorSaved.revision,
      values:{ documentsDecision:'confirmed',documentsReason:'',costsDecision:'confirmed_zero',costsReason:'Bez externych nakladov',
        photosDecision:'not_available',photosReason:'Zakaznik fotografie neposkytol',reviewDecision:'prepare',reviewBlockReason:'' },
      actorEmail:'superadmin@example.invalid',actorRole:'SUPER_ADMIN' });
    let staleBlocked = false;
    try { await db.saveBusinessJobCompletion({ jobId:job.id,expectedRevision:operatorSaved.revision,
      values:{ documentsDecision:'confirmed',documentsReason:'',costsDecision:'confirmed_recorded',costsReason:'',
        photosDecision:'not_available',photosReason:'Zakaznik fotografie neposkytol',reviewDecision:'prepare',reviewBlockReason:'' },
      actorEmail:'superadmin@example.invalid',actorRole:'SUPER_ADMIN' }); } catch { staleBlocked = true; }
    const finalized = await db.finalizeBusinessJobCompletion({ jobId:job.id,expectedRevision:superSaved.revision,
      actorEmail:'superadmin@example.invalid',actorRole:'SUPER_ADMIN',reviewRequestTemplate:{
        subject:'Ako ste boli spokojni?',message:'Dobry den {{meno}}, prosime o spatnu vazbu {{odkaz}}.',
        googleReviewLink:'https://example.invalid/review',reminderAllowed:false } });
    const repeated = await db.finalizeBusinessJobCompletion({ jobId:job.id,expectedRevision:superSaved.revision,
      actorEmail:'superadmin@example.invalid',actorRole:'SUPER_ADMIN',reviewRequestTemplate:{
        subject:'Ako ste boli spokojni?',message:'Dobry den {{meno}}, prosime o spatnu vazbu {{odkaz}}.',
        googleReviewLink:'https://example.invalid/review',reminderAllowed:false } });
    const after = await db.getBusinessJob(job.id);
    let reopenBlocked = false;
    try { await db.updateBusinessJobOperational(job.id,{ demolitionDate:after.demolitionDate,customerName:after.customerName,
      customerPhone:after.customerPhone,customerEmail:after.customerEmail,location:after.location,district:after.district,
      materialType:after.materialType,objectType:after.objectType,term:after.term,preferredContact:after.preferredContact,
      status:'VYUCTOVANIE',note:after.note },'operator@example.invalid'); } catch { reopenBlocked = true; }
    const requests = (await db.listReviewRequests()).filter((item)=>item.jobId===job.id);
    const raw = JSON.parse(fs.readFileSync(process.env.ASTANA_LOCAL_DB_PATH,'utf8'));
    const auditText = JSON.stringify(raw.auditLogs);
    process.stdout.write(JSON.stringify({ directCreateBlocked, directCompletionBlocked, initial, operatorSaved, operatorFinalizeBlocked,
      operatorView, documentsReasonBlocked, zeroReasonBlocked, photoReasonBlocked, superSaved, staleBlocked, finalized, repeated, after, requests,
      reopenBlocked, outboxCount:raw.leadEmailOutbox.length, auditContainsCustomerEmail:auditText.includes(after.customerEmail) }));
  `;
  try {
    const result = JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', code], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: '', ASTANA_LOCAL_DB_PATH: localDbPath },
      timeout: 30_000,
    }));
    assert.equal(result.directCreateBlocked, true);
    assert.equal(result.directCompletionBlocked, true);
    assert.equal(result.operatorSaved.costsDecision, 'pending');
    assert.equal(result.operatorSaved.costsReason, '');
    assert.equal(Object.hasOwn(result.operatorView, 'costsDecision'), false);
    assert.equal(Object.hasOwn(result.operatorView, 'costsReason'), false);
    assert.equal(result.documentsReasonBlocked, true);
    assert.equal(result.operatorFinalizeBlocked, true);
    assert.equal(result.zeroReasonBlocked, true);
    assert.equal(result.photoReasonBlocked, true);
    assert.equal(result.staleBlocked, true);
    assert.equal(result.after.status, 'DOKONCENA');
    assert.equal(result.reopenBlocked, true);
    assert.equal(result.finalized.completion.finalizedBy, 'superadmin@example.invalid');
    assert.equal(result.repeated.completion.revision, result.finalized.completion.revision);
    assert.equal(result.requests.length, 1);
    assert.equal(result.requests[0].status, 'pending_approval');
    assert.equal(result.requests[0].reminderAllowed, false);
    assert.equal(Boolean(result.requests[0].tokenHash), false);
    assert.equal(result.outboxCount, 0);
    assert.equal(result.auditContainsCustomerEmail, false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
