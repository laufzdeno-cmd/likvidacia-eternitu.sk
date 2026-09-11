import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/src/server/auth';
import { addAuditLog, analyticsEventDimensions, filterAnalyticsEvents, listAnalyticsEvents } from '@/src/server/db';
import { csvCell } from '@/src/server/csv';
import type { AnalyticsAttributionMode, AnalyticsEvent, AnalyticsReportFilters } from '@/src/server/types';

export const runtime = 'nodejs';

function cleanDays(value: string | null) {
  const days = Number(value || 30);
  return [7, 30, 90, 365].includes(days) ? days : 30;
}

function eventDate(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const actorEmail = await requireSuperAdmin();
  const days = cleanDays(request.nextUrl.searchParams.get('dni'));
  const attribution = request.nextUrl.searchParams.get('atribucia') === 'first' ? 'first' : 'last';
  const filters: AnalyticsReportFilters = {
    source: request.nextUrl.searchParams.get('zdroj') || undefined,
    campaign: request.nextUrl.searchParams.get('kampan') || undefined,
    device: ['desktop', 'tablet', 'mobile'].includes(request.nextUrl.searchParams.get('zariadenie') || '')
      ? (request.nextUrl.searchParams.get('zariadenie') as 'desktop' | 'tablet' | 'mobile')
      : undefined,
    attribution: attribution as AnalyticsAttributionMode,
  };
  const events = filterAnalyticsEvents(await listAnalyticsEvents(days), filters);
  const rows = new Map<
    string,
    {
      date: string;
      sessions: Set<string>;
      source: string;
      campaign: string;
      device: string;
      ctaClicks: number;
      submittedForms: number;
    }
  >();

  for (const event of events) {
    const date = eventDate(event.createdAt);
    const { source, campaign, device } = analyticsEventDimensions(event, attribution);
    const key = `${date}|${source}|${campaign}|${device}`;
    const row = rows.get(key) ?? { date, sessions: new Set<string>(), source, campaign, device, ctaClicks: 0, submittedForms: 0 };
    if (event.sessionId) row.sessions.add(event.sessionId);
    if (event.eventType === 'cta_click') row.ctaClicks += 1;
    if (event.eventType === 'form_submit_success') row.submittedForms += 1;
    rows.set(key, row);
  }

  const header = ['dátum', 'návštevy', 'zdroj', 'kampaň', 'zariadenie', 'atribúcia', 'CTA kliky', 'formuláre odoslané'];
  const lines = [
    header.join(';'),
    ...[...rows.values()]
      .sort((a, b) => b.date.localeCompare(a.date) || a.source.localeCompare(b.source) || a.device.localeCompare(b.device))
      .map((row) =>
        [row.date, row.sessions.size, row.source, row.campaign, row.device, attribution === 'first' ? 'prvý kontakt' : 'posledný kontakt', row.ctaClicks, row.submittedForms]
          .map(csvCell)
          .join(';'),
      ),
  ];

  await addAuditLog('system', 'analytics', 'analytics_exported', actorEmail.email, { days, filters });

  return new NextResponse(`\uFEFF${lines.join('\n')}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="astana-analytics-${days}dni.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
