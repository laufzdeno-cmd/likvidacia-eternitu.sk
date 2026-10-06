import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import metricsModule from '../src/server/analytics-metrics.ts';

const { getMeasuredSessionSets, dateInBratislava, bratislavaMidnightUtc, getAnalyticsPeriod, getSessionEntryEvents, getSessionEntryDevice, getSequentialMeasuredFunnel, summarizeCrmCohort, limitAnalyticsEventRows } = metricsModule;

function event(eventType, sessionId, createdAt = '2026-10-01T10:00:00.000Z', path = '/') {
  return { id: `${eventType}-${sessionId}-${Math.random()}`, eventType, sessionId, createdAt, path };
}

test('measured funnel counts unique sessions with a page view and excludes server-only submissions', () => {
  const events = [
    event('page_view', 'visit-a'),
    event('page_view', 'visit-a', '2026-10-01T10:01:00.000Z', '/cena/'),
    event('quote_section_view', 'visit-a'),
    event('quote_section_view', 'visit-a'),
    event('form_start', 'visit-a'),
    event('form_start', 'visit-a'),
    event('form_submit_success', 'visit-a'),
    event('form_submit_success', 'server-only'),
    event('form_start', 'server-only'),
  ];
  const result = getMeasuredSessionSets(events);
  assert.equal(result.visitSessions.size, 1);
  assert.equal(result.quoteViewSessions.size, 1);
  assert.equal(result.formStartSessions.size, 1);
  assert.equal(result.leadSessions.size, 1);
  assert.equal(result.leadSessions.has('server-only'), false);
});

test('sequential funnel intersects each stage so it cannot report over 100 percent', () => {
  const events = [
    event('page_view', 'a'), event('page_view', 'b'), event('page_view', 'c'),
    event('quote_section_view', 'a'), event('form_start', 'a'), event('form_start', 'b'),
    event('form_submit_success', 'b'),
  ];
  const funnel = getSequentialMeasuredFunnel(getMeasuredSessionSets(events));
  assert.equal(funnel.quoteViews.size, 1);
  assert.equal(funnel.formStarts.size, 1);
  assert.equal(funnel.leads.size, 0);
  assert.ok(funnel.formStarts.size <= funnel.quoteViews.size);
  assert.ok(funnel.leads.size <= funnel.formStarts.size);
});

test('CRM cohort excludes archived and explicitly marked test leads, and counts quote stages by lead', () => {
  const since = Date.parse('2026-10-01T00:00:00.000Z');
  const leads = Array.from({ length: 350 }, (_, index) => ({
    id: `lead-${index}`,
    createdAt: new Date(since + 1000).toISOString(),
    deletedAt: undefined,
  }));
  leads.push({ id: 'deleted', createdAt: new Date(since + 1000).toISOString(), deletedAt: '2026-10-01T10:00:00Z' });
  leads.push({ id: 'old', createdAt: new Date(since - 1000).toISOString(), deletedAt: undefined });
  leads.push({ id: 'test', createdAt: new Date(since + 1000).toISOString(), deletedAt: undefined, isTestData: true });
  const quotes = [
    { leadId: 'lead-0', status: 'sent' },
    { leadId: 'lead-0', status: 'accepted' },
    { leadId: 'lead-1', status: 'draft' },
    { leadId: 'lead-2', status: 'cancelled' },
    { leadId: 'deleted', status: 'accepted' },
    { leadId: 'old', status: 'accepted' },
    { leadId: 'test', status: 'accepted' },
  ];
  assert.deepEqual(summarizeCrmCohort(leads, quotes, since), {
    leads: 350,
    quotes: 2,
    acceptedQuotes: 1,
    quotedLeads: 1,
    acceptedLeads: 1,
  });
});

test('daily analytics dates use Bratislava local calendar across UTC midnight and DST', () => {
  assert.equal(dateInBratislava('2026-09-30T22:30:00.000Z'), '2026-10-01');
  assert.equal(dateInBratislava('2026-10-25T00:30:00.000Z'), '2026-10-25');
  assert.equal(bratislavaMidnightUtc({ year: 2026, month: 10, day: 1 }).toISOString(), '2026-09-30T22:00:00.000Z');
  assert.equal(bratislavaMidnightUtc({ year: 2026, month: 10, day: 26 }).toISOString(), '2026-10-25T23:00:00.000Z');
  const beforeDstChange = getAnalyticsPeriod(7, new Date('2026-10-01T08:00:00.000Z'));
  assert.deepEqual(beforeDstChange.dates, ['2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01']);
  const afterDstChange = getAnalyticsPeriod(7, new Date('2026-10-26T22:30:00.000Z'));
  assert.equal(afterDstChange.dates.length, 7);
  assert.equal(new Set(afterDstChange.dates).size, 7);
  assert.equal(afterDstChange.since, '2026-10-19T22:00:00.000Z');
});

test('event exports can classify a submitted form by the measured session entry, not missing submit UTMs', async () => {
  const events = [
    { ...event('page_view', 'visit-c', '2026-10-01T09:00:00.000Z', '/'), utmSource: 'google', utmCampaign: 'strecha-poprad', device: 'mobile' },
    { ...event('page_view', 'visit-c', '2026-10-01T09:02:00.000Z', '/cena/'), device: 'desktop' },
    { ...event('form_submit_success', 'visit-c', '2026-10-01T09:05:00.000Z', '/'), device: 'desktop' },
  ];
  const entries = getSessionEntryEvents(events);
  const entry = entries.get('visit-c');
  assert.equal(entry.utmSource, 'google');
  assert.equal(entry.utmCampaign, 'strecha-poprad');
  assert.equal(entry.device, 'mobile');
  const reportDevices = new Map();
  for (const item of events) {
    const device = getSessionEntryDevice(item, entries);
    const row = reportDevices.get(device) ?? { sessions: new Set(), pageViews: 0, leads: new Set() };
    if (item.eventType === 'page_view') { row.sessions.add(item.sessionId); row.pageViews += 1; }
    if (item.eventType === 'form_submit_success') row.leads.add(item.sessionId);
    reportDevices.set(device, row);
  }
  assert.deepEqual({ sessions: reportDevices.get('mobile').sessions.size, pageViews: reportDevices.get('mobile').pageViews, leads: reportDevices.get('mobile').leads.size }, { sessions: 1, pageViews: 2, leads: 1 });
  assert.equal(reportDevices.has('desktop'), false);
  const [db, route] = await Promise.all([
    readFile(new URL('../src/server/db.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/admin/(protected)/analytics/export/route.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(db, /getSessionEntryDevice\(event, sessionEntry\)/);
  assert.match(route, /getSessionEntryDevice\(event, sessionEntry\)/);
});

test('event look-ahead marks capped analytics reports incomplete without dropping the warning', () => {
  const atLimit = limitAnalyticsEventRows(Array.from({ length: 20_000 }, (_, index) => index));
  assert.equal(atLimit.rows.length, 20_000);
  assert.deepEqual(atLimit.coverage, { limit: 20_000, returned: 20_000, truncated: false });
  const overLimit = limitAnalyticsEventRows(Array.from({ length: 20_001 }, (_, index) => index));
  assert.equal(overLimit.rows.length, 20_000);
  assert.deepEqual(overLimit.coverage, { limit: 20_000, returned: 20_000, truncated: true });
});

test('database-backed event query uses a look-ahead row and CRM counts are cohort-scoped', async () => {
  const db = await readFile(new URL('../src/server/db.ts', import.meta.url), 'utf8');
  assert.match(db, /ANALYTICS_EVENTS_LIMIT \+ 1/);
  assert.match(db, /limitAnalyticsEventRows\(rows\)/);
  assert.match(db, /WHERE l\.deleted_at IS NULL AND l\.is_test_data = false AND l\.created_at >= \$1/);
  assert.match(db, /COUNT\(DISTINCT l\.id\) FILTER \(WHERE q\.status IN \('sent', 'accepted', 'rejected', 'expired'\)\)/);
  assert.doesNotMatch(db, /getAnalyticsReport\(days\)[\s\S]{0,350}listLeadSummaries\(\)/);
});
