import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, rmdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('local JSON store excludes only classified test leads and linked business records from dashboard', async () => {
  const scratch = await mkdtemp(path.join(tmpdir(), 'astana-dashboard-test-classification-'));
  const fixturePath = path.join(scratch, 'local-db.json');
  const normalLeadId = randomUUID();
  const testLeadId = randomUUID();
  const archivedTestLeadId = randomUUID();
  const normalJobId = randomUUID();
  const testJobId = randomUUID();
  const standaloneTestJobId = randomUUID();
  const eventAt = '2026-10-01T20:30:00.000Z';
  const now = '2026-10-01T08:00:00.000Z';
  const lead = (id, email) => ({
    id, createdAt: now, updatedAt: now, status: 'novy', fullName: 'Synthetic QA', phone: '+421900000000', email,
    city: 'Poprad', district: 'Poprad', objectType: 'Rodinný dom', materialType: 'Eternit', areaEstimate: 50,
    gdpr: true, source: 'test', internalNote: '', rawData: {},
  });
  const job = (id, leadId) => ({
    id, leadId, createdAt: now, updatedAt: now, demolitionDate: '2026-10-01', customerName: 'Synthetic QA',
    customerPhone: '', customerEmail: '', location: 'Poprad', district: 'Poprad', materialType: 'Eternit',
    objectType: 'Rodinný dom', term: '', leadSource: 'test', preferredContact: '', m2: 50, pricePerM2: 1,
    totalPrice: 100, paymentType: 'FAKTURA', workType: 'DEMONTAZ_A_ODVOZ', wasteKg: 0, landfill: 'INA',
    status: 'DOKONCENA', note: '', workers: [], costs: { total: 10, landfillCost: 0 }, rewardsTotal: 0,
  });
  await writeFile(fixturePath, JSON.stringify({
    leads: [
      lead(normalLeadId, 'normal@example.invalid'),
      lead(testLeadId, 'test@example.invalid'),
      { ...lead(archivedTestLeadId, 'archived-test@example.invalid'), isTestData: true, deletedAt: now },
    ],
    businessJobs: [job(normalJobId, normalLeadId), job(testJobId, testLeadId), job(standaloneTestJobId, undefined)],
    priceOffers: [
      { id: randomUUID(), number: 'LOCAL-NORMAL', jobId: normalJobId, createdAt: '2026-09-30T22:30:00.000Z', sentAt: eventAt, acceptedAt: eventAt },
      { id: randomUUID(), number: 'LOCAL-TEST', jobId: testJobId, createdAt: eventAt, sentAt: eventAt, acceptedAt: eventAt },
      { id: randomUUID(), number: 'LOCAL-JOB-TEST', jobId: standaloneTestJobId, createdAt: eventAt, sentAt: eventAt, acceptedAt: eventAt },
      { id: randomUUID(), number: 'LOCAL-DIRECT-LEAD', sourceInquiry: `dopyt:${testLeadId}`, createdAt: eventAt, sentAt: eventAt, acceptedAt: eventAt },
    ], auditLogs: [],
  }), 'utf8');
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = '';
  process.env.ASTANA_LOCAL_DB_PATH = fixturePath;
  try {
    const { archiveLead, deleteBusinessJob, destroyArchivedLead, destroyBusinessJob, getBusinessJobWithActivity, getLeadDashboardMetrics, getLeadQueueCounts, getPriceOfferEventMetrics, getPriceOfferStatusSummary, isLeadTestData, listBusinessJobDashboardRows, listBusinessJobs, listLeadSummaryPage, listPriceOffers, saveBusinessJob, savePriceOffer, setBusinessJobTestData, setLeadTestData } = await import('../src/server/db.ts');
    assert.equal((await getLeadDashboardMetrics('2026-10-01', '2026-10-01', '2026-10-01')).receivedInPeriod, 2);
    assert.deepEqual(await getPriceOfferEventMetrics('2026-10-01', '2026-10-01'), { created: 4, sent: 4, accepted: 4 });
    assert.equal((await getPriceOfferStatusSummary('2026-10')).created, 4, 'mesačný súhrn používa bratislavský deň aj pri UTC prechode mesiaca');
    assert.ok((await listPriceOffers({ month: '2026-10' })).some((offer) => offer.number === 'LOCAL-NORMAL'), 'októbrový zoznam obsahuje rovnakú ponuku na hranici mesiaca');
    assert.equal((await listLeadSummaryPage({ excludeTestData: true })).total, 2, 'legacy records begin unclassified unless explicitly changed');
    assert.equal(await isLeadTestData(archivedTestLeadId), true, 'detail zákazky zachová označenie aj pri archivovanom testovacom dopyte');
    assert.equal(await setLeadTestData(archivedTestLeadId, false, 'superadmin@example.invalid', 'Testovacie CRM údaje'), true, 'archivované staré dáta možno opraviť');
    assert.equal(await setLeadTestData(archivedTestLeadId, true, 'superadmin@example.invalid', 'Testovacie CRM údaje'), true);
    assert.equal(await setLeadTestData(testLeadId, true, 'superadmin@example.invalid', 'Lokálny test formulára'), true);
    assert.equal(await isLeadTestData(testLeadId), true);
    assert.equal((await getLeadDashboardMetrics('2026-10-01', '2026-10-01', '2026-10-01')).receivedInPeriod, 1);
    assert.deepEqual(await getPriceOfferEventMetrics('2026-10-01', '2026-10-01'), { created: 2, sent: 2, accepted: 2 }, 'testovací dopyt vylúči aj ponuku bez zákazky');
    assert.equal(await setBusinessJobTestData(standaloneTestJobId, true, 'superadmin@example.invalid', 'Testovacie CRM údaje'), true);
    assert.deepEqual(await getPriceOfferEventMetrics('2026-10-01', '2026-10-01'), { created: 1, sent: 1, accepted: 1 });
    const editInput = {
      demolitionDate: '2026-10-01', customerName: 'Synthetic QA edited', location: 'Poprad', m2: 50, pricePerM2: 1,
      paymentType: 'FAKTURA', workType: 'DEMONTAZ_A_ODVOZ', landfill: 'INA', status: 'DOKONCENA', workers: [],
      costs: { fuel: 0, suits: 0, gloves: 0, penetrant: 0, landfillCost: 0, otherName: '', otherAmount: 0 },
    };
    const editedStandaloneJob = await saveBusinessJob(editInput, 'superadmin@example.invalid', standaloneTestJobId);
    assert.equal(editedStandaloneJob.isTestData, true, 'bežná lokálna úprava zachová klasifikáciu testovacej zákazky');
    assert.equal((await listBusinessJobs({ excludeTestData: true, limit: null })).some((item) => item.id === standaloneTestJobId), false);
    const editedLinkedJob = await saveBusinessJob(editInput, 'superadmin@example.invalid', testJobId);
    assert.equal(editedLinkedJob.leadId, testLeadId, 'bežná lokálna úprava zachová väzbu na testovací dopyt');
    assert.equal((await listBusinessJobs({ excludeTestData: true, limit: null })).some((item) => item.id === testJobId), false, 'naviazaná zákazka ostane mimo reportov aj po úprave');
    assert.equal((await getPriceOfferEventMetrics('2026-10-01', '2026-10-01')).created, 1, 'ponuka naviazanej zákazky ostane mimo reportov po úprave');
    await deleteBusinessJob(standaloneTestJobId, 'superadmin@example.invalid');
    assert.ok((await getBusinessJobWithActivity(standaloneTestJobId))?.deletedAt, 'archivovaný detail ostáva dostupný na spätne označenie');
    await assert.rejects(saveBusinessJob(editInput, 'superadmin@example.invalid', standaloneTestJobId), /Archivovanú zákazku/);
    assert.equal(await setBusinessJobTestData(standaloneTestJobId, false, 'superadmin@example.invalid', 'Testovacie CRM údaje'), true, 'archivovaná zákazka sa dá spätne opraviť');
    assert.equal(await setBusinessJobTestData(standaloneTestJobId, true, 'superadmin@example.invalid', 'Testovacie CRM údaje'), true);
    assert.equal((await getLeadQueueCounts('2026-10-01', true)).total, 1);
    assert.equal((await listLeadSummaryPage({ excludeTestData: true })).total, 1);
    assert.equal((await listLeadSummaryPage()).total, 2, 'the operational CRM still shows the test lead');
    assert.deepEqual((await listBusinessJobs({ excludeTestData: true, limit: null })).map((item) => item.id), [normalJobId]);
    assert.deepEqual((await listBusinessJobDashboardRows('2026-10-01', '2026-10-01')).map((item) => item.id), [normalJobId]);
    const saved = JSON.parse(await readFile(fixturePath, 'utf8'));
    assert.equal(saved.leads.find((item) => item.id === testLeadId).isTestData, true);
    const leadAudit = saved.auditLogs.find((item) => item.action === 'lead_test_classification_changed');
    assert.equal(leadAudit?.changes.reason, 'Lokálny test formulára');
    assert.equal(saved.businessJobs.find((item) => item.id === standaloneTestJobId).isTestData, true);
    assert.equal(saved.businessJobs.find((item) => item.id === testJobId).leadId, testLeadId, 'uložená naviazaná zákazka si zachová väzbu na testovací dopyt');
    assert.ok(saved.auditLogs.some((item) => item.action === 'business_job_test_classification_changed'));
    assert.equal(await setBusinessJobTestData(testJobId, true, 'superadmin@example.invalid', 'Testovacie CRM údaje'), true);
    assert.equal(await setBusinessJobTestData(testJobId, false, 'superadmin@example.invalid', 'Testovacie CRM údaje'), true, 'stará záporná klasifikácia musí byť prebitá zdedeným testom');
    assert.ok(await archiveLead(testLeadId, 'superadmin@example.invalid', 'Lokálny test'));
    assert.ok(await destroyArchivedLead(testLeadId, 'superadmin@example.invalid', 'Vymazanie lokálneho testu'));
    let afterDelete = JSON.parse(await readFile(fixturePath, 'utf8'));
    assert.equal(afterDelete.businessJobs.find((item) => item.id === testJobId).isTestData, true, 'pred odstránením testovacieho dopytu sa označenie prenesie na zákazku');
    assert.equal(afterDelete.priceOffers.find((item) => item.number === 'LOCAL-DIRECT-LEAD').isTestData, true, 'priama ponuka zostane mimo reportu aj bez zdrojového dopytu');
    assert.equal((await getPriceOfferEventMetrics('2026-10-01', '2026-10-01')).created, 1);
    const offerInput = {
      objectType: 'Rodinný dom', objectAddress: 'Testovacia lokalita', municipality: 'Poprad', district: 'Poprad',
      contactPerson: 'Synthetic QA', phone: '+421900000000', email: 'test@example.invalid', realizationTerm: 'test',
      materialType: 'VLNITY_ETERNIT', areaM2: 50, pricePerM2WithoutVat: 1, documentationFeeWithoutVat: 0,
      includeDocumentation: false, validUntil: '2026-12-31', sourceInquiry: 'test',
    };
    const oldJobOfferId = afterDelete.priceOffers.find((item) => item.number === 'LOCAL-TEST').id;
    await savePriceOffer(offerInput, 'superadmin@example.invalid', oldJobOfferId);
    assert.equal((await getPriceOfferEventMetrics('2026-10-01', '2026-10-01')).created, 1, 'starú lokálnu ponuku nemožno odpojiť z testu bez zachovania klasifikácie');
    await assert.rejects(savePriceOffer({ ...offerInput, sourceInquiry: `dopyt:${testLeadId}` }, 'superadmin@example.invalid'), /Zdrojový dopyt už neexistuje/);
    await destroyBusinessJob(testJobId, 'superadmin@example.invalid');
    await destroyBusinessJob(standaloneTestJobId, 'superadmin@example.invalid');
    afterDelete = JSON.parse(await readFile(fixturePath, 'utf8'));
    assert.equal(afterDelete.priceOffers.find((item) => item.number === 'LOCAL-TEST').isTestData, true, 'ponuka zostane označená po vymazaní zákazky');
    assert.equal(afterDelete.priceOffers.find((item) => item.number === 'LOCAL-JOB-TEST').isTestData, true, 'ručný test zákazky sa prenesie na ponuku');
    assert.equal((await getPriceOfferEventMetrics('2026-10-01', '2026-10-01')).created, 1, 'trvalé zmazanie nesmie znovu započítať QA ponuky');
    const normalOfferId = afterDelete.priceOffers.find((item) => item.number === 'LOCAL-NORMAL').id;
    const detachedNormalOffer = await savePriceOffer(offerInput, 'superadmin@example.invalid', normalOfferId);
    assert.ok(detachedNormalOffer.sourceJobIds.includes(normalJobId), 'odpojená ponuka si pamätá pôvodnú zákazku');
    assert.equal(await setBusinessJobTestData(normalJobId, true, 'superadmin@example.invalid', 'Testovacie CRM údaje'), true);
    assert.equal((await getPriceOfferEventMetrics('2026-10-01', '2026-10-01')).created, 0, 'neskoršie označenie pôvodnej zákazky vylúči už odpojenú ponuku');
    assert.equal((await getPriceOfferStatusSummary('2026-10')).created, 0, 'mesačné karty musia mať rovnaký testovací filter');
    assert.equal(await setBusinessJobTestData(normalJobId, false, 'superadmin@example.invalid', 'Testovacie CRM údaje'), true);
    assert.equal((await getPriceOfferStatusSummary('2026-10')).created, 1);
    const concurrentResults = await Promise.allSettled([
      saveBusinessJob(editInput, 'superadmin@example.invalid', normalJobId),
      deleteBusinessJob(normalJobId, 'superadmin@example.invalid'),
    ]);
    assert.equal(concurrentResults[1].status, 'fulfilled', 'archivácia musí uspieť aj pri súbežnej úprave');
    assert.ok((await getBusinessJobWithActivity(normalJobId))?.deletedAt, 'súbežná úprava nesmie znovu aktivovať archivovanú zákazku');
    await destroyBusinessJob(normalJobId, 'superadmin@example.invalid');
    await assert.rejects(saveBusinessJob(editInput, 'superadmin@example.invalid', normalJobId), /Zákazka už neexistuje/, 'otvorená úprava nesmie vytvoriť vymazanú zákazku');
    assert.equal(await setLeadTestData(normalLeadId, true, 'superadmin@example.invalid', 'Testovacie CRM údaje'), true);
    assert.equal((await getPriceOfferEventMetrics('2026-10-01', '2026-10-01')).created, 0, 'odpojená ponuka stále reaguje na neskoršiu klasifikáciu zdrojového dopytu');
    afterDelete = JSON.parse(await readFile(fixturePath, 'utf8'));
    assert.equal(afterDelete.priceOffers.find((item) => item.number === 'LOCAL-NORMAL').leadId, normalLeadId);
    assert.equal(await setLeadTestData(normalLeadId, false, 'superadmin@example.invalid', 'Testovacie CRM údaje'), true);
    assert.equal((await getPriceOfferEventMetrics('2026-10-01', '2026-10-01')).created, 1);
  } finally {
    await rm(fixturePath, { force: true });
    await rmdir(scratch);
  }
});
