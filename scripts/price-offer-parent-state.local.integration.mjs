import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'astana-price-offer-parents-local-'));
const databasePath = path.join(temporaryDirectory, 'local-db.json');
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = '';
process.env.ASTANA_LOCAL_DB_PATH = databasePath;
process.env.ADMIN_EMAIL = '';

const {
  claimPriceOfferForSending,
  confirmPreparedPriceOffersSentExternally,
  confirmUncertainPriceOfferSent,
  createLeadSubmission,
  finishPriceOfferSending,
  getBusinessJob,
  getLeadWithFiles,
  getPriceOffer,
  savePriceOffer,
  setLeadTestData,
  submitPublicPriceOfferResponse,
  resolvePriceOfferCustomerResponse,
  updatePriceOfferStatus,
} = await import(`../src/server/db.ts?price-offer-parent-local=${randomUUID()}`);

async function createParents(label) {
  const submissionId = randomUUID();
  const result = await createLeadSubmission({
    submissionId,
    submissionHash: 'a'.repeat(64),
    fullName: `QA ${label}`,
    phone: '0900000000',
    email: `${label.toLowerCase()}@example.invalid`,
    city: 'Poprad',
    district: 'Poprad',
    objectType: 'Rodinný dom',
    materialType: 'Vlnitý eternit',
    areaEstimate: 10,
    preferredContact: 'Email',
    gdpr: true,
    source: 'local-parent-integration',
  }, []);
  return { leadId: result.lead.id, jobId: result.businessJobId, label };
}

function offerInput(parents, explicitJob = true) {
  return {
    jobId: explicitJob ? parents.jobId : '',
    objectType: 'Rodinný dom', objectAddress: 'Testovacia 1', municipality: 'Poprad', district: 'Poprad',
    contactPerson: `QA ${parents.label}`, phone: '0900000000', email: `${parents.label.toLowerCase()}@example.invalid`,
    realizationTerm: 'Dohodou', materialType: 'VLNITY_ETERNIT', areaM2: 10, pricePerM2WithoutVat: 10,
    documentationFeeWithoutVat: 0, includeDocumentation: false, documentationPromotion: false,
    includeTransport: false, transportFrom: '', transportTo: '', transportRoundTripKm: 0, transportPricePerKm: 0.7,
    validUntil: '2027-12-31', sourceInquiry: `dopyt:${parents.leadId}`,
  };
}

async function statuses(parents) {
  return {
    lead: (await getLeadWithFiles(parents.leadId, true))?.status,
    job: (await getBusinessJob(parents.jobId, true))?.status,
  };
}

async function forceParentStatuses(parents, leadStatus, jobStatus) {
  const local = JSON.parse(await readFile(databasePath, 'utf8'));
  local.leads.find((lead) => lead.id === parents.leadId).status = leadStatus;
  local.businessJobs.find((job) => job.id === parents.jobId).status = jobStatus;
  await writeFile(databasePath, JSON.stringify(local, null, 2), 'utf8');
}

try {
  const testSource = await createParents('TestSource');
  await setLeadTestData(testSource.leadId, true, 'qa-operator@example.invalid', 'Testovacie CRM údaje');
  const testJobOffer = await savePriceOffer(offerInput(testSource), 'qa-operator@example.invalid');
  const testDirectOffer = await savePriceOffer(offerInput(testSource, false), 'qa-operator@example.invalid');
  assert.equal(testJobOffer.isTestData, false, 'klasifikácia zdroja zostáva opraviteľná');
  assert.equal(testDirectOffer.isTestData, false, 'klasifikácia zdroja zostáva opraviteľná');
  assert.equal(await claimPriceOfferForSending(testJobOffer.id, 'qa-operator@example.invalid'), null);
  assert.equal(await claimPriceOfferForSending(testDirectOffer.id, 'qa-operator@example.invalid'), null);

  const lateTestSource = await createParents('LateTestSource');
  const lateJobOffer = await savePriceOffer(offerInput(lateTestSource), 'qa-operator@example.invalid');
  const lateDirectOffer = await savePriceOffer(offerInput(lateTestSource, false), 'qa-operator@example.invalid');
  assert.equal(lateJobOffer.isTestData, false);
  assert.equal(lateDirectOffer.isTestData, false);
  await setLeadTestData(lateTestSource.leadId, true, 'qa-operator@example.invalid', 'Testovacie CRM údaje');
  for (const offer of [lateJobOffer, lateDirectOffer]) {
    assert.equal((await getPriceOffer(offer.id))?.isTestData, false, 'neskoršie označenie dopytu nemení opraviteľnú klasifikáciu ponuky');
    assert.equal(await claimPriceOfferForSending(offer.id, 'qa-operator@example.invalid'), null,
      'ponuka vytvorená pred označením dopytu za test sa nesmie odoslať');
  }
  await setLeadTestData(lateTestSource.leadId, false, 'qa-operator@example.invalid', 'Testovacie CRM údaje');
  const correctedClaim = await claimPriceOfferForSending(lateDirectOffer.id, 'qa-operator@example.invalid');
  assert.ok(correctedClaim?.sendAttemptId, 'oprava klasifikácie dopytu vráti pripravenú ponuku do odosielateľného stavu');
  await finishPriceOfferSending(lateDirectOffer.id, correctedClaim.sendAttemptId, 'not_sent', 'qa-operator@example.invalid');

  const competing = await createParents('Competing');
  const competingFirst = await savePriceOffer(offerInput(competing), 'qa-operator@example.invalid');
  const competingSecond = await savePriceOffer(offerInput(competing), 'qa-operator@example.invalid');
  for (const offer of [competingFirst, competingSecond]) {
    const claim = await claimPriceOfferForSending(offer.id, 'qa-operator@example.invalid');
    await finishPriceOfferSending(offer.id, claim.sendAttemptId, 'sent', 'qa-operator@example.invalid');
  }
  await updatePriceOfferStatus(competingFirst.id, 'NEUSPESNA', 'qa-operator@example.invalid', { reason: 'Zákazník uprednostnil druhú ponuku.' });
  assert.deepEqual(await statuses(competing), { lead: 'cenova_ponuka_odoslana', job: 'PONUKA_ODOSLANA' },
    'neúspech jednej ponuky nesmie uzavrieť rodičov s ďalšou aktívnou ponukou');
  await updatePriceOfferStatus(competingSecond.id, 'NEUSPESNA', 'qa-operator@example.invalid', { reason: 'Zákazník odmietol aj druhú ponuku.' });
  assert.deepEqual(await statuses(competing), { lead: 'nevyslo', job: 'ZRUSENA' },
    'posledná neúspešná ponuka môže uzavrieť rodičov');
  await assert.rejects(savePriceOffer(offerInput(competing), 'qa-operator@example.invalid'),
    /Dopyt alebo zákazka už boli uzavreté/,
    'novú ponuku nemožno pripojiť k dopytu uzavretému po zlyhaní poslednej ponuky');

  const editSource = await createParents('LocalEditSource');
  const editTarget = await createParents('LocalEditTarget');
  const editable = await savePriceOffer(offerInput(editSource), 'qa-operator@example.invalid');
  const edited = await savePriceOffer({ ...offerInput(editSource), contactPerson: 'QA opravený kontakt' },
    'qa-operator@example.invalid', editable.id);
  assert.equal(edited.contactPerson, 'QA opravený kontakt');
  await assert.rejects(savePriceOffer(offerInput(editTarget), 'qa-operator@example.invalid', editable.id),
    /Pripravenú ponuku nemožno presunúť/,
    'úprava pripravenej ponuky nesmie nenápadne zmeniť rodičovský dopyt');

  const directAlternative = await createParents('DirectAlternative');
  const directFirst = await savePriceOffer(offerInput(directAlternative), 'qa-operator@example.invalid');
  const directSecond = await savePriceOffer(offerInput(directAlternative, false), 'qa-operator@example.invalid');
  let directFirstToken = '';
  for (const offer of [directFirst, directSecond]) {
    const claim = await claimPriceOfferForSending(offer.id, 'qa-operator@example.invalid');
    if (offer.id === directFirst.id) directFirstToken = claim.customerResponseToken;
    await finishPriceOfferSending(offer.id, claim.sendAttemptId, 'sent', 'qa-operator@example.invalid');
  }
  const directReply = await submitPublicPriceOfferResponse({ token: directFirstToken,
    response: 'DECLINED', reasonCode: 'price', confirmedReview: true });
  assert.equal(directReply.status, 'created');
  const directFirstPending = await getPriceOffer(directFirst.id);
  const directResolved = await resolvePriceOfferCustomerResponse({ id: directFirst.id, expectedRevision: directFirstPending.customerResponseRevision,
    resolution: 'apply', actorEmail: 'qa-operator@example.invalid' });
  assert.equal(directResolved?.status, 'NEUSPESNA');
  assert.deepEqual(await statuses(directAlternative), { lead: 'cenova_ponuka_odoslana', job: 'PONUKA_ODOSLANA' },
    'schválené odmietnutie zákazníka nesmie uzavrieť rodičov pri ďalšej relevantnej ponuke');

  const normal = await createParents('Normal');
  const normalOffer = await savePriceOffer(offerInput(normal), 'qa-operator@example.invalid');
  assert.deepEqual(await statuses(normal), { lead: 'naceneny', job: 'DOPYT' }, 'PRIPRAVENA posunie iba dopyt na naceneny');

  const noSendClaim = await claimPriceOfferForSending(normalOffer.id, 'qa-operator@example.invalid');
  assert.ok(noSendClaim?.sendAttemptId);
  await finishPriceOfferSending(normalOffer.id, noSendClaim.sendAttemptId, 'not_sent', 'qa-operator@example.invalid');
  assert.deepEqual(await statuses(normal), { lead: 'naceneny', job: 'DOPYT' }, 'not_sent nesmie meniť rodičov');

  const sentClaim = await claimPriceOfferForSending(normalOffer.id, 'qa-operator@example.invalid');
  assert.ok(sentClaim?.sendAttemptId);
  await finishPriceOfferSending(normalOffer.id, sentClaim.sendAttemptId, 'sent', 'qa-operator@example.invalid');
  assert.deepEqual(await statuses(normal), { lead: 'cenova_ponuka_odoslana', job: 'PONUKA_ODOSLANA' });
  await updatePriceOfferStatus(normalOffer.id, 'PRIJATA', 'qa-operator@example.invalid');
  assert.deepEqual(await statuses(normal), { lead: 'objednane', job: 'PONUKA_POTVRDENA' });

  const advanced = await createParents('Advanced');
  await forceParentStatuses(advanced, 'v_realizacii', 'V_REALIZACII');
  const advancedOffer = await savePriceOffer(offerInput(advanced), 'qa-operator@example.invalid');
  const advancedClaim = await claimPriceOfferForSending(advancedOffer.id, 'qa-operator@example.invalid');
  await finishPriceOfferSending(advancedOffer.id, advancedClaim.sendAttemptId, 'sent', 'qa-operator@example.invalid');
  await updatePriceOfferStatus(advancedOffer.id, 'PRIJATA', 'qa-operator@example.invalid');
  assert.deepEqual(await statuses(advanced), { lead: 'v_realizacii', job: 'V_REALIZACII' }, 'pokročilé stavy sa nesmú vrátiť späť');

  const uncertain = await createParents('Uncertain');
  const uncertainOffer = await savePriceOffer(offerInput(uncertain), 'qa-operator@example.invalid');
  const uncertainClaim = await claimPriceOfferForSending(uncertainOffer.id, 'qa-operator@example.invalid');
  await finishPriceOfferSending(uncertainOffer.id, uncertainClaim.sendAttemptId, 'unknown', 'qa-operator@example.invalid');
  assert.deepEqual(await statuses(uncertain), { lead: 'naceneny', job: 'DOPYT' }, 'unknown nesmie meniť rodičov');
  await assert.rejects(confirmUncertainPriceOfferSent(uncertainOffer.id, 'qa-operator@example.invalid', 'vlastný text'), /platný interný dôkaz/);
  assert.equal((await getPriceOffer(uncertainOffer.id))?.status, 'NEISTY_STAV');
  const confirmed = await confirmUncertainPriceOfferSent(uncertainOffer.id, 'qa-operator@example.invalid', 'sent_folder_verified');
  assert.equal(confirmed?.status, 'ODOSLANA');
  assert.equal(confirmed?.sendAttemptId, undefined);
  assert.deepEqual(await statuses(uncertain), { lead: 'cenova_ponuka_odoslana', job: 'PONUKA_ODOSLANA' });

  const direct = await createParents('Direct');
  const directOffer = await savePriceOffer(offerInput(direct, false), 'qa-operator@example.invalid');
  assert.equal(directOffer.jobId, '');
  assert.equal(directOffer.leadId, direct.leadId);
  const directClaim = await claimPriceOfferForSending(directOffer.id, 'qa-operator@example.invalid');
  await finishPriceOfferSending(directOffer.id, directClaim.sendAttemptId, 'sent', 'qa-operator@example.invalid');
  assert.deepEqual(await statuses(direct), { lead: 'cenova_ponuka_odoslana', job: 'PONUKA_ODOSLANA' }, 'ponuka iba s leadId nájde jednu aktívnu zákazku');

  const ambiguous = await createParents('Ambiguous');
  const ambiguousDb = JSON.parse(await readFile(databasePath, 'utf8'));
  const originalAmbiguousJob = ambiguousDb.businessJobs.find((job) => job.id === ambiguous.jobId);
  const secondAmbiguousJob = { ...originalAmbiguousJob, id: randomUUID(), createdAt: new Date().toISOString() };
  ambiguousDb.businessJobs.push(secondAmbiguousJob);
  await writeFile(databasePath, JSON.stringify(ambiguousDb, null, 2), 'utf8');
  const ambiguousOffer = await savePriceOffer(offerInput(ambiguous, false), 'qa-operator@example.invalid');
  const ambiguousClaim = await claimPriceOfferForSending(ambiguousOffer.id, 'qa-operator@example.invalid');
  await finishPriceOfferSending(ambiguousOffer.id, ambiguousClaim.sendAttemptId, 'sent', 'qa-operator@example.invalid');
  const afterAmbiguous = JSON.parse(await readFile(databasePath, 'utf8'));
  assert.equal(afterAmbiguous.leads.find((lead) => lead.id === ambiguous.leadId).status, 'cenova_ponuka_odoslana');
  assert.deepEqual(
    afterAmbiguous.businessJobs.filter((job) => job.leadId === ambiguous.leadId).map((job) => job.status),
    ['DOPYT', 'DOPYT'],
    'bez explicitného jobId sa pri viacerých kandidátoch nesmie posunúť žiadna zákazka',
  );

  const terminal = await createParents('Terminal');
  await forceParentStatuses(terminal, 'zrusena', 'ZRUSENA');
  await assert.rejects(savePriceOffer(offerInput(terminal), 'qa-operator@example.invalid'),
    /Dopyt alebo zákazka už boli uzavreté/,
    'zrušenému dopytu sa nesmie vytvoriť nová ponuka');
  assert.deepEqual(await statuses(terminal), { lead: 'zrusena', job: 'ZRUSENA' }, 'terminálne stavy sú chránené');

  const cancelledAfterPreparation = await createParents('CancelledAfterPreparation');
  const cancelledDraft = await savePriceOffer(offerInput(cancelledAfterPreparation), 'qa-operator@example.invalid');
  await forceParentStatuses(cancelledAfterPreparation, 'zrusena', 'ZRUSENA');
  assert.equal(await claimPriceOfferForSending(cancelledDraft.id, 'qa-operator@example.invalid'), null,
    'už pripravenú ponuku nemožno rezervovať na odoslanie po zrušení dopytu');

  const external = await createParents('External');
  const externalOffer = await savePriceOffer(offerInput(external), 'qa-operator@example.invalid');
  const externalSentAt = '2026-10-01T10:00:00.000Z';
  const externalHash = 'b'.repeat(64);
  const reconciled = await confirmPreparedPriceOffersSentExternally([{
    id: externalOffer.id,
    sentAt: externalSentAt,
    evidenceCode: 'gmail_readonly_match',
    externalMessageIdHash: externalHash,
  }], 'qa-superadmin@example.invalid');
  assert.equal(reconciled.updated.length, 1);
  assert.equal(reconciled.skipped.length, 0);
  assert.equal((await getPriceOffer(externalOffer.id))?.sentAt, externalSentAt);
  assert.deepEqual(await statuses(external), { lead: 'cenova_ponuka_odoslana', job: 'PONUKA_ODOSLANA' });
  const repeated = await confirmPreparedPriceOffersSentExternally([{
    id: externalOffer.id,
    sentAt: externalSentAt,
    evidenceCode: 'gmail_readonly_match',
    externalMessageIdHash: externalHash,
  }], 'qa-superadmin@example.invalid');
  assert.deepEqual({ updated: repeated.updated.length, skipped: repeated.skipped.length }, { updated: 0, skipped: 1 });
  const duplicateExternal = await createParents('ExternalDuplicate');
  const duplicateExternalOffer = await savePriceOffer(offerInput(duplicateExternal), 'qa-operator@example.invalid');
  const duplicateEvidence = await confirmPreparedPriceOffersSentExternally([{
    id: duplicateExternalOffer.id,
    sentAt: externalSentAt,
    evidenceCode: 'gmail_readonly_match',
    externalMessageIdHash: externalHash,
  }], 'qa-superadmin@example.invalid');
  assert.deepEqual({ updated: duplicateEvidence.updated.length, skipped: duplicateEvidence.skipped.length }, { updated: 0, skipped: 1 },
    'jedna Gmail správa nesmie potvrdiť dve ponuky');
  assert.equal((await getPriceOffer(duplicateExternalOffer.id))?.status, 'PRIPRAVENA');

  const stale = await createParents('Stale');
  const staleOffer = await savePriceOffer(offerInput(stale), 'qa-operator@example.invalid');
  await claimPriceOfferForSending(staleOffer.id, 'qa-operator@example.invalid');
  const staleDb = JSON.parse(await readFile(databasePath, 'utf8'));
  const staleRecord = staleDb.priceOffers.find((offer) => offer.id === staleOffer.id);
  staleRecord.sendStartedAt = new Date(Date.now() - 16 * 60_000).toISOString();
  await writeFile(databasePath, JSON.stringify(staleDb, null, 2), 'utf8');
  assert.equal(
    (await confirmUncertainPriceOfferSent(staleOffer.id, 'qa-operator@example.invalid', 'provider_confirmed'))?.status,
    'ODOSLANA',
    'zaseknuté odosielanie možno uzavrieť iba manuálnym potvrdením s dôkazom',
  );

  const persisted = JSON.parse(await readFile(databasePath, 'utf8'));
  const lifecycleAudits = persisted.auditLogs.filter((entry) => entry.action.startsWith('price_offer_') || entry.changes?.reasonCode);
  const serializedAuditChanges = JSON.stringify(lifecycleAudits.map((entry) => entry.changes));
  for (const pii of ['0900000000', '@example.invalid', 'QA Normal', 'QA Advanced', 'QA Uncertain']) {
    assert.doesNotMatch(serializedAuditChanges, new RegExp(pii.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), `audit nesmie obsahovať PII: ${pii}`);
  }
  assert.ok(lifecycleAudits.some((entry) => entry.changes?.reasonCode === 'sent_folder_verified'));
  assert.ok(lifecycleAudits.some((entry) => entry.action === 'price_offer_external_send_confirmed'
    && entry.changes?.externalMessageIdHash === externalHash));
  console.log('PASS: lokálna price-offer synchronizácia rodičov je monotónna, atómová a bez PII v audite.');
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
