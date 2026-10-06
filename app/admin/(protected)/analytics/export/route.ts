import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/src/server/auth';
import { dateInBratislava, getAnalyticsPeriod, getSessionEntryDevice, getSessionEntryEvents } from '@/src/server/analytics-metrics';
import { addAuditLog, getAnalyticsEventsWithCoverage, getLeadAttributionReport } from '@/src/server/db';
import { csvCell } from '@/src/server/csv';
import type { AnalyticsEvent } from '@/src/server/types';

export const runtime = 'nodejs';

function cleanDays(value: string | null) {
  return Math.min(365, Math.max(7, Number(value || 30) || 30));
}

function eventDate(value: string) {
  return dateInBratislava(value);
}

function sourceFromEvent(event: Pick<AnalyticsEvent, 'utmSource' | 'referrer'>) {
  if (event.utmSource) return event.utmSource;
  if (!event.referrer) return 'direct';
  try {
    const host = new URL(event.referrer).hostname.replace(/^www\./, '');
    if (host.includes('google.')) return 'google';
    if (host.includes('facebook.') || host.includes('instagram.')) return 'social';
    return host;
  } catch {
    return 'referrer';
  }
}

export async function GET(request: NextRequest) {
  const actorEmail = await requireSuperAdmin();
  const days = cleanDays(request.nextUrl.searchParams.get('dni'));
  if (request.nextUrl.searchParams.get('typ') === 'crm-attribution') {
    const period = getAnalyticsPeriod(days);
    const cohort = await getLeadAttributionReport(days, period.since, null);
    const header = ['zdroj', 'typ', 'kampaň', 'dopyty', 'dopyty s vydanou ponukou', 'dopyty s prijatou ponukou', 'objednané/realizované/ukončené'];
    const lines = [
      header.map(csvCell).join(';'),
      ...cohort.map((row) => [row.source, row.medium, row.campaign, row.leads, row.leadsWithIssuedOffer, row.leadsWithAcceptedOffer, row.progressedLeads].map(csvCell).join(';')),
    ];
    await addAuditLog('system', 'analytics', 'analytics_exported', actorEmail.email, { days, type: 'crm-attribution' });
    return new NextResponse(`\uFEFF${lines.join('\n')}`, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="astana-dopyty-podla-kampane-${days}dni.csv"`,
        'Cache-Control': 'private, no-store',
      },
    });
  }
  const { events, coverage } = await getAnalyticsEventsWithCoverage(days);
  if (coverage.truncated) {
    return NextResponse.json(
      { error: `Export obsahuje viac než ${coverage.limit} udalostí. Zvoľte kratšie obdobie, aby boli údaje úplné.` },
      { status: 409, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
  const sessionEntry = getSessionEntryEvents(events);
  const rows = new Map<
    string,
    {
      date: string;
      sessions: Set<string>;
      source: string;
      campaign: string;
      device: string;
      ctaClicks: number;
      submittedForms: Set<string>;
    }
  >();

  for (const event of events) {
    const date = eventDate(event.createdAt);
    const entry = sessionEntry.get(event.sessionId);
    if (!entry) continue;
    const source = sourceFromEvent(entry);
    const campaign = entry.utmCampaign?.trim() || 'Bez kampane';
    const device = getSessionEntryDevice(event, sessionEntry);
    const key = `${date}|${source}|${campaign}|${device}`;
    const row = rows.get(key) ?? { date, sessions: new Set<string>(), source, campaign, device, ctaClicks: 0, submittedForms: new Set<string>() };
    if (event.eventType === 'page_view' && event.sessionId) row.sessions.add(event.sessionId);
    if (event.eventType === 'cta_click') row.ctaClicks += 1;
    if (event.eventType === 'form_submit_success') row.submittedForms.add(event.sessionId);
    rows.set(key, row);
  }

  const header = ['dátum udalosti', 'merané relácie', 'zdroj vstupnej návštevy', 'kampaň vstupnej návštevy', 'zariadenie vstupnej návštevy', 'CTA kliky', 'relácie s odoslaným dopytom'];
  const lines = [
    header.join(';'),
    ...[...rows.values()]
      .sort((a, b) => b.date.localeCompare(a.date) || a.source.localeCompare(b.source) || a.device.localeCompare(b.device))
      .map((row) =>
        [row.date, row.sessions.size, row.source, row.campaign, row.device, row.ctaClicks, row.submittedForms.size].map(csvCell).join(';'),
      ),
  ];

  await addAuditLog('system', 'analytics', 'analytics_exported', actorEmail.email, { days });

  return new NextResponse(`\uFEFF${lines.join('\n')}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="astana-analytics-${days}dni.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
