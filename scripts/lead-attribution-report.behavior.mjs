import assert from 'node:assert/strict';
import test from 'node:test';
import reportModule from '../src/server/lead-attribution-report.ts';

const { summarizeLeadAttribution } = reportModule;

test('CRM campaign cohort counts each lead once across legacy and job-linked offers', () => {
  const sinceMs = Date.now() - 24 * 60 * 60 * 1000;
  const lead = (id, status, rawData = {}, overrides = {}) => ({
    id, status, rawData, createdAt: new Date().toISOString(), ...overrides,
  });
  const leads = [
    lead('g-1', 'novy', { attribution: { utmSource: 'google', utmMedium: 'cpc', utmCampaign: 'strecha Poprad' } }),
    lead('g-2', 'v_realizacii', { attribution: { utmSource: 'google', utmMedium: 'cpc', utmCampaign: 'strecha Poprad' } }),
    lead('g-braid-1', 'novy', { attribution: { gbraid: 'google-braid-1' } }),
    lead('g-braid-2', 'novy', { attribution: { wbraid: 'google-braid-2' } }),
    lead('m-1', 'objednane', { attribution: { fbclid: 'hidden-click-id' } }),
    lead('direct', 'novy', {}, { note: 'TEST – NEKONTAKTOVAŤ, NEPOSIELAŤ PONUKU' }),
    lead('deleted', 'objednane', { attribution: { utmSource: 'google', utmCampaign: 'strecha Poprad' } }, { deletedAt: new Date().toISOString() }),
    lead('classified-test', 'objednane', { attribution: { utmSource: 'google', utmMedium: 'cpc', utmCampaign: 'strecha Poprad' } }, { isTestData: true }),
    lead('old', 'objednane', { attribution: { utmSource: 'google', utmCampaign: 'strecha Poprad' } }, { createdAt: new Date(sinceMs - 1000).toISOString() }),
  ];
  const quotes = [
    { leadId: 'g-1', status: 'sent' },
    { leadId: 'g-1', status: 'rejected' },
    { leadId: 'g-1', status: 'draft' },
    { leadId: 'g-2', status: 'accepted' },
    { leadId: 'missing', status: 'accepted' },
    { leadId: 'classified-test', status: 'accepted' },
  ];
  const jobs = [
    { id: 'j-g1', leadId: 'g-1', deletedAt: new Date().toISOString() },
    { id: 'j-direct', leadId: 'direct' },
    { id: 'j-deleted', leadId: 'deleted' },
    { id: 'j-late-test', isTestData: true },
  ];
  const priceOffers = [
    { jobId: 'j-g1', status: 'PRIJATA', deletedAt: new Date().toISOString() },
    { jobId: 'j-g1', status: 'ODOSLANA' },
    { jobId: 'j-direct', status: 'PRIPRAVENA' },
    { jobId: 'j-direct', status: 'ODOSLANA' },
    { jobId: 'j-deleted', status: 'PRIJATA' },
    { status: 'PRIJATA' },
    { leadId: 'g-braid-1', status: 'PRIJATA', isTestData: true },
    { leadId: 'm-1', sourceJobIds: ['j-late-test'], status: 'PRIJATA' },
    { leadId: 'classified-test', status: 'PRIJATA' },
  ];

  assert.deepEqual(summarizeLeadAttribution(leads, quotes, jobs, priceOffers, sinceMs), [
    { source: 'Google Ads', medium: 'Neuvedené', campaign: 'Bez označenia', leads: 2, leadsWithIssuedOffer: 0, leadsWithAcceptedOffer: 0, progressedLeads: 0 },
    { source: 'google', medium: 'cpc', campaign: 'strecha Poprad', leads: 2, leadsWithIssuedOffer: 2, leadsWithAcceptedOffer: 2, progressedLeads: 1 },
    { source: 'Meta', medium: 'Neuvedené', campaign: 'Bez označenia', leads: 1, leadsWithIssuedOffer: 0, leadsWithAcceptedOffer: 0, progressedLeads: 1 },
    { source: 'Nezachytený zdroj', medium: 'Neuvedené', campaign: 'Bez označenia', leads: 1, leadsWithIssuedOffer: 1, leadsWithAcceptedOffer: 0, progressedLeads: 0 },
  ]);
});

test('local report uses deterministic source, medium, and campaign tie-breakers before its 50-row limit', () => {
  const now = new Date().toISOString();
  const leads = Array.from({ length: 55 }, (_, index) => ({
    id: `lead-${index}`,
    status: 'novy',
    createdAt: now,
    rawData: { attribution: { utmSource: 'google', utmMedium: 'cpc', utmCampaign: `campaign-${String(index).padStart(2, '0')}` } },
  }));
  const rows = summarizeLeadAttribution(leads, [], [], [], Date.now() - 1000);
  assert.equal(rows.length, 50);
  assert.equal(rows[0].campaign, 'campaign-00');
  assert.equal(rows[49].campaign, 'campaign-49');
  assert.equal(summarizeLeadAttribution(leads, [], [], [], Date.now() - 1000, null).length, 55);
});

test('ambiguous legacy offer with two historical job leads is not assigned to either campaign', () => {
  const createdAt = new Date().toISOString();
  const leads = ['a', 'b'].map((id) => ({ id, status: 'novy', createdAt, rawData: { attribution: { utmSource: `qa-${id}` } } }));
  const jobs = [{ id: 'job-a', leadId: 'a' }, { id: 'job-b', leadId: 'b' }];
  const offers = [{ sourceJobIds: ['job-a', 'job-b'], status: 'PRIJATA' }];
  const rows = summarizeLeadAttribution(leads, [], jobs, offers, Date.now() - 1000, null);
  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => row.leadsWithIssuedOffer === 0 && row.leadsWithAcceptedOffer === 0));
  const currentRows = summarizeLeadAttribution(leads, [], jobs, [{ ...offers[0], jobId: 'job-b' }], Date.now() - 1000, null);
  assert.equal(currentRows.find((row) => row.source === 'qa-a').leadsWithAcceptedOffer, 0);
  assert.equal(currentRows.find((row) => row.source === 'qa-b').leadsWithAcceptedOffer, 1, 'aktuálna jednoznačná zákazka má prednosť pred starou väzbou');
  const currentWithoutLead = summarizeLeadAttribution(leads, [], [{ id: 'job-a', leadId: 'a' }, { id: 'job-b' }],
    [{ ...offers[0], jobId: 'job-b' }], Date.now() - 1000, null);
  assert.ok(currentWithoutLead.every((row) => row.leadsWithAcceptedOffer === 0), 'aktuálna zákazka bez dopytu nesmie siahnuť po starej väzbe');
});

test('legacy direct-source hint does not override the current linked job owner', () => {
  const createdAt = new Date().toISOString();
  const leadAId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const leadBId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const leads = [leadAId, leadBId].map((id, index) => ({
    id, status: 'novy', createdAt, rawData: { attribution: { utmSource: `qa-owner-${index}` } },
  }));
  const jobs = [{ id: 'job-a', leadId: leadAId }, { id: 'job-b', leadId: leadBId }];
  const offer = { jobId: 'job-b', sourceJobIds: ['job-a', 'job-b'], sourceInquiry: `dopyt:${leadAId}`, status: 'PRIJATA' };
  const rows = summarizeLeadAttribution(leads, [], jobs, [offer], Date.now() - 1000, null);
  assert.equal(rows.find((row) => row.source === 'qa-owner-0')?.leadsWithAcceptedOffer, 0);
  assert.equal(rows.find((row) => row.source === 'qa-owner-1')?.leadsWithAcceptedOffer, 1);
  const testSourceRows = summarizeLeadAttribution([{ ...leads[0], isTestData: true }, leads[1]], [], jobs, [offer], Date.now() - 1000, null);
  assert.equal(testSourceRows.find((row) => row.source === 'qa-owner-1')?.leadsWithAcceptedOffer, 0,
    'testovací priamy zdroj nesmie zvyšovať konverzie iného dopytu');
});
