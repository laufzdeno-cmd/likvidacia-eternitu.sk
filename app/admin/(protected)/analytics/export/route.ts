import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/src/server/auth';
import { listAnalyticsEvents } from '@/src/server/db';
import type { AnalyticsEvent } from '@/src/server/types';

export const runtime = 'nodejs';

function cleanDays(value: string | null) {
  return Math.min(365, Math.max(7, Number(value || 30) || 30));
}

function eventDate(value: string) {
  return new Date(value).toISOString().slice(0, 10);
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

function csvCell(value: string | number) {
  const text = String(value);
  if (!/[",\n\r;]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  await requireSuperAdmin();
  const days = cleanDays(request.nextUrl.searchParams.get('dni'));
  const events = await listAnalyticsEvents(days);
  const rows = new Map<
    string,
    {
      date: string;
      sessions: Set<string>;
      source: string;
      device: string;
      ctaClicks: number;
      submittedForms: number;
    }
  >();

  for (const event of events) {
    const date = eventDate(event.createdAt);
    const source = sourceFromEvent(event);
    const device = event.device || 'unknown';
    const key = `${date}|${source}|${device}`;
    const row = rows.get(key) ?? { date, sessions: new Set<string>(), source, device, ctaClicks: 0, submittedForms: 0 };
    if (event.sessionId) row.sessions.add(event.sessionId);
    if (event.eventType === 'cta_click') row.ctaClicks += 1;
    if (event.eventType === 'form_submit_success') row.submittedForms += 1;
    rows.set(key, row);
  }

  const header = ['dátum', 'návštevy', 'zdroj', 'zariadenie', 'CTA kliky', 'formuláre odoslané'];
  const lines = [
    header.join(';'),
    ...[...rows.values()]
      .sort((a, b) => b.date.localeCompare(a.date) || a.source.localeCompare(b.source) || a.device.localeCompare(b.device))
      .map((row) =>
        [row.date, row.sessions.size, row.source, row.device, row.ctaClicks, row.submittedForms].map(csvCell).join(';'),
      ),
  ];

  return new NextResponse(`\uFEFF${lines.join('\n')}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="astana-analytics-${days}dni.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
