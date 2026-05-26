import { NextResponse } from 'next/server';
import { listDueFollowups, listPlannerActions, markLeadFollowupNotificationSent, markPlannerNotificationSent } from '@/src/server/db';
import { sendPlannerNotificationEmail } from '@/src/server/mail';
import type { PlannerAction } from '@/src/server/types';

export const runtime = 'nodejs';

const adminEmail = () => process.env.LEAD_TO_EMAIL || process.env.FROM_EMAIL || 'astana@astana.sk';

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(days: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

function typeLabel(type: PlannerAction['type']) {
  return {
    DEMONTAZ: 'Demontáž',
    ODVOZ: 'Odvoz',
    DOKUMENTACIA: 'Dokumentácia',
    INE: 'Iné',
  }[type];
}

async function weatherText(action: PlannerAction) {
  try {
    const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(`${action.address}, Slovensko`)}`, {
      headers: { 'User-Agent': 'ASTANA admin planner' },
      cache: 'no-store',
    });
    const geo = (await geoRes.json()) as Array<{ lat: string; lon: string }>;
    if (!geo[0]) return 'Počasie: nepodarilo sa zistiť lokalitu.';
    const forecastRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${geo[0].lat}&longitude=${geo[0].lon}&daily=temperature_2m_max,precipitation_sum,wind_speed_10m_max&timezone=Europe%2FBratislava&start_date=${action.date}&end_date=${action.date}`,
      { cache: 'no-store' },
    );
    const data = await forecastRes.json() as { daily?: { temperature_2m_max?: number[]; precipitation_sum?: number[]; wind_speed_10m_max?: number[] } };
    const temp = data.daily?.temperature_2m_max?.[0];
    const rain = data.daily?.precipitation_sum?.[0] ?? 0;
    const wind = data.daily?.wind_speed_10m_max?.[0] ?? 0;
    const warning = rain > 2 || wind > 35 ? ' ⚠ Nevhodné počasie' : '';
    return `Počasie: ${temp ?? '—'} °C, dážď ${rain} mm, vietor ${wind} km/h.${warning}`;
  } catch {
    return 'Počasie: aktuálne sa nepodarilo načítať.';
  }
}

function adminHtml(action: PlannerAction, title: string, weather: string) {
  return `
    <div style="font-family:Arial,sans-serif;background:#F8F7F4;padding:24px;">
      <div style="max-width:620px;margin:0 auto;background:white;border:1px solid #E8E6DF;border-radius:10px;overflow:hidden;">
        <div style="background:#1E1E2E;color:white;padding:18px 22px;font-size:18px;font-weight:700;">${title}</div>
        <div style="padding:22px;color:#1E293B;font-size:14px;line-height:1.7;">
          <p><strong>Dátum:</strong> ${action.date} · ${action.timeFrom} – ${action.timeTo}</p>
          <p><strong>Typ:</strong> ${typeLabel(action.type)}</p>
          <p><strong>Adresa:</strong> ${action.address}</p>
          <p><strong>Tím:</strong> ${action.workers || '—'}</p>
          <p><strong>Zákazník:</strong> ${action.customerName || '—'} ${action.customerPhone ? `· ${action.customerPhone}` : ''}</p>
          <p><strong>Poznámka:</strong> ${action.note || '—'}</p>
          <p style="margin-top:16px;padding:12px 14px;background:#F8FAFC;border-left:4px solid #6B2D5E;">${weather}</p>
        </div>
      </div>
    </div>`;
}

function customerHtml(action: PlannerAction) {
  return `
    <div style="font-family:Arial,sans-serif;background:#F8F7F4;padding:24px;">
      <div style="max-width:600px;margin:0 auto;background:white;border:1px solid #E8E6DF;border-radius:10px;overflow:hidden;">
        <div style="background:#1E1E2E;color:white;padding:22px 28px;font-size:20px;font-weight:700;">ASTANA</div>
        <div style="padding:28px;color:#1E293B;font-size:15px;line-height:1.7;">
          <p>Dobrý deň${action.customerName ? `, ${action.customerName}` : ''},</p>
          <p>pripomíname termín demontáže/realizácie naplánovaný na <strong>${action.date}</strong> v čase <strong>${action.timeFrom} – ${action.timeTo}</strong>.</p>
          <p><strong>Adresa:</strong> ${action.address}</p>
          <p>Prosíme, pripravte prístup k streche/objektu a zabezpečte voľný priestor pre pracovníkov ASTANA.</p>
          <p style="margin-top:18px;padding:14px;background:#F8FAFC;border-radius:8px;">V prípade otázok volajte <strong>0905 217 946</strong>.</p>
        </div>
      </div>
    </div>`;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!secret || token !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tomorrow = addDays(1);
  const twoDays = addDays(2);
  const actions = await listPlannerActions({ from: tomorrow, to: twoDays });
  let sent = 0;

  for (const action of actions) {
    const weather = await weatherText(action);
    if (action.date === twoDays && action.notify2Days && !action.notify2DaysSent) {
      await sendPlannerNotificationEmail({
        to: adminEmail(),
        subject: `📅 O 2 dni — ${typeLabel(action.type)} ${action.address}`,
        text: [`O 2 dni: ${typeLabel(action.type)}`, `${action.date} ${action.timeFrom}-${action.timeTo}`, action.address, `Tím: ${action.workers || '—'}`, weather].join('\n'),
        html: adminHtml(action, `📅 O 2 dni — ${typeLabel(action.type)}`, weather),
      });
      await markPlannerNotificationSent(action.id, 'notify2DaysSent');
      sent += 1;
    }
    if (action.date === tomorrow && action.notify1Day && !action.notify1DaySent) {
      await sendPlannerNotificationEmail({
        to: adminEmail(),
        subject: `🔔 ZAJTRA — ${action.address} o ${action.timeFrom}`,
        text: [`Zajtra: ${typeLabel(action.type)}`, `${action.date} ${action.timeFrom}-${action.timeTo}`, action.address, `Nezabudnite zavolať zákazníkovi: ${action.customerName || '—'} ${action.customerPhone || ''}`, `Tím: ${action.workers || '—'}`, weather].join('\n'),
        html: adminHtml(action, `🔔 Zajtra — ${action.address}`, weather),
      });
      await markPlannerNotificationSent(action.id, 'notify1DaySent');
      sent += 1;
    }
    if (action.date === twoDays && action.notifyCustomer && !action.notifyCustomerSent && action.customerEmail) {
      await sendPlannerNotificationEmail({
        to: action.customerEmail,
        subject: `ASTANA — pripomienka termínu demontáže ${action.date}`,
        text: [`Dobrý deň,`, `pripomíname termín ${action.date} ${action.timeFrom}-${action.timeTo}.`, `Adresa: ${action.address}`, 'Prosíme, pripravte prístup a voľný priestor.', 'Kontakt: 0905 217 946'].join('\n'),
        html: customerHtml(action),
      });
      await markPlannerNotificationSent(action.id, 'notifyCustomerSent');
      sent += 1;
    }
  }

  const followups = await listDueFollowups(new Date().toISOString().slice(0, 10));
  for (const lead of followups) {
    const adminUrl = `${process.env.ADMIN_BASE_URL || new URL(request.url).origin}/admin/dopyty/${lead.id}`;
    await sendPlannerNotificationEmail({
      to: adminEmail(),
      subject: `📞 Dnes zavolať — ${lead.fullName} ${lead.city}`,
      text: [
        `Meno: ${lead.fullName}`,
        `Telefón: ${lead.phone}`,
        `Lokalita: ${lead.city}`,
        `Dôvod: ${lead.followupNote || 'follow-up'}`,
        `Admin: ${adminUrl}`,
      ].join('\n'),
      html: `
        <div style="font-family:Arial,sans-serif;background:#F8F7F4;padding:24px;">
          <div style="max-width:620px;margin:0 auto;background:white;border:1px solid #E8E6DF;border-radius:10px;overflow:hidden;">
            <div style="background:#6B2D5E;color:white;padding:18px 22px;font-size:18px;font-weight:700;">📞 Dnes zavolať</div>
            <div style="padding:22px;color:#1E293B;font-size:14px;line-height:1.7;">
              <p><strong>Meno:</strong> ${lead.fullName}</p>
              <p><strong>Telefón:</strong> <a href="tel:${lead.phone}" style="color:#E8541A;font-weight:700;">${lead.phone}</a></p>
              <p><strong>Lokalita:</strong> ${lead.city}</p>
              <p><strong>Dôvod:</strong> ${lead.followupNote || 'follow-up'}</p>
              <p><a href="${adminUrl}" style="display:inline-block;background:#E8541A;color:white;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700;">Otvoriť dopyt</a></p>
            </div>
          </div>
        </div>`,
    });
    await markLeadFollowupNotificationSent(lead.id);
    sent += 1;
  }

  return NextResponse.json({ ok: true, checked: actions.length, sent });
}
