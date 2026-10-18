import { NextResponse } from 'next/server';
import { addAuditLog, claimLeadEmailOutbox, getLeadEmailOutboxHealth, listDueFollowups, listLeadEmailOutbox, listPendingLeadEmailDeliveries, listPlannerActions, markLeadFollowupNotificationSent, markPlannerNotificationSent, markStaleLeadEmailClaimsUnknown, purgeExpiredApiRateLimitBuckets, recordLeadEmailRecipientResult, recoverAcceptedLeadAnalytics } from '@/src/server/db';
import { leadDeliveryMode } from '@/src/server/astana-local-relay';
import { evaluateDailyNotificationsHealth } from '@/src/server/cron-delivery-health';
import { hasLeadEmailTransportConfiguration, hasUsableLeadSmtpConfiguration, sendLeadEmailToRecipient, sendLeadEmails, sendPlannerNotificationEmail } from '@/src/server/mail';
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

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char] || char);
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
  const safeCustomerPhone = action.customerPhone ? `· ${escapeHtml(action.customerPhone)}` : '';
  return `
    <div style="font-family:Arial,sans-serif;background:#F8F7F4;padding:24px;">
      <div style="max-width:620px;margin:0 auto;background:white;border:1px solid #E8E6DF;border-radius:10px;overflow:hidden;">
        <div style="background:#1E1E2E;color:white;padding:18px 22px;font-size:18px;font-weight:700;">${escapeHtml(title)}</div>
        <div style="padding:22px;color:#1E293B;font-size:14px;line-height:1.7;">
          <p><strong>Dátum:</strong> ${escapeHtml(action.date)} · ${escapeHtml(action.timeFrom)} – ${escapeHtml(action.timeTo)}</p>
          <p><strong>Typ:</strong> ${escapeHtml(typeLabel(action.type))}</p>
          <p><strong>Adresa:</strong> ${escapeHtml(action.address)}</p>
          <p><strong>Tím:</strong> ${escapeHtml(action.workers || '—')}</p>
          <p><strong>Zákazník:</strong> ${escapeHtml(action.customerName || '—')} ${safeCustomerPhone}</p>
          <p><strong>Poznámka:</strong> ${escapeHtml(action.note || '—')}</p>
          <p style="margin-top:16px;padding:12px 14px;background:#F8FAFC;border-left:4px solid #6B2D5E;">${escapeHtml(weather)}</p>
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
          <p>Dobrý deň${action.customerName ? `, ${escapeHtml(action.customerName)}` : ''},</p>
          <p>pripomíname termín demontáže/realizácie naplánovaný na <strong>${escapeHtml(action.date)}</strong> v čase <strong>${escapeHtml(action.timeFrom)} – ${escapeHtml(action.timeTo)}</strong>.</p>
          <p><strong>Adresa:</strong> ${escapeHtml(action.address)}</p>
          <p>Prosíme, pripravte prístup k streche/objektu a zabezpečte voľný priestor pre pracovníkov ASTANA.</p>
          <p style="margin-top:18px;padding:14px;background:#F8FAFC;border-radius:8px;">V prípade otázok volajte <strong>0905 217 946</strong>.</p>
        </div>
      </div>
    </div>`;
}

async function processPendingLeadEmailDelivery(
  pendingDelivery: Awaited<ReturnType<typeof listPendingLeadEmailDeliveries>>[number],
  mode: ReturnType<typeof leadDeliveryMode>,
) {
  let result: { sent: boolean; customerSent: boolean; adminSent: boolean; reason?: string } = { sent: false, customerSent: false, adminSent: false };
  const roles = pendingDelivery.pendingRoles;
  if ((mode === 'local_relay' || mode === 'smtp_then_local_relay') && roles.length === 2) {
    result = await sendLeadEmails(pendingDelivery.lead, pendingDelivery.fileCount, pendingDelivery.businessJobId, {
      claim: (role) => claimLeadEmailOutbox(pendingDelivery.lead.id, role),
      record: async (role, delivery, token) => {
        const saved = await recordLeadEmailRecipientResult(pendingDelivery.lead.id, role, delivery, token);
        if (!saved) throw new Error('Výsledok odoslania už nepatrí aktívnemu pokusu.');
      },
    }, pendingDelivery.files);
  } else if (mode !== 'local_relay') {
    for (const role of roles) {
      const token = await claimLeadEmailOutbox(pendingDelivery.lead.id, role);
      if (!token) continue;
      let delivery;
      try {
        delivery = await sendLeadEmailToRecipient(pendingDelivery.lead, role, pendingDelivery.fileCount, pendingDelivery.businessJobId, pendingDelivery.files);
      } catch (error) {
        delivery = { status: 'unknown' as const, reason: error instanceof Error ? error.message : 'Výsledok odoslania sa nepodarilo potvrdiť.' };
      }
      const saved = await recordLeadEmailRecipientResult(pendingDelivery.lead.id, role, delivery, token);
      if (!saved) throw new Error('Výsledok odoslania už nepatrí aktívnemu pokusu.');
      result = {
        sent: result.sent || delivery.status === 'sent',
        customerSent: result.customerSent || (role === 'customer' && delivery.status === 'sent'),
        adminSent: result.adminSent || (role === 'internal' && delivery.status === 'sent'),
        reason: [result.reason, delivery.reason].filter(Boolean).join(' | '),
      };
    }
  } else {
    result.reason = 'Relay nevie bezpečne zopakovať iba jedného adresáta; skontrolujte stav pred opakovaním.';
  }
  const deliveryStatuses = await listLeadEmailOutbox(pendingDelivery.lead.id);
  result.customerSent = deliveryStatuses.some((item) => item.recipientRole === 'customer' && item.status === 'sent');
  result.adminSent = deliveryStatuses.some((item) => item.recipientRole === 'internal' && item.status === 'sent');
  result.sent = result.customerSent && result.adminSent;
  await addAuditLog('lead', pendingDelivery.lead.id, result.sent ? 'lead_email_sent' : 'lead_email_error', 'cron', result);
  return result;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!secret || token !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let analyticsRecovery = { recovered: 0, remaining: false, failed: false, unrecoverable: 0 };
  try {
    const result = await recoverAcceptedLeadAnalytics();
    analyticsRecovery = result;
  } catch (error) {
    console.error('Accepted lead analytics recovery failed; lead delivery continues.', error);
    analyticsRecovery.failed = true;
  }

  let rateLimitBucketsPurged = 0;
  let rateLimitCleanupFailed = false;
  try {
    rateLimitBucketsPurged = await purgeExpiredApiRateLimitBuckets();
  } catch (error) {
    console.error('Expired upload-token rate limit cleanup failed.', error);
    rateLimitCleanupFailed = true;
  }

  await markStaleLeadEmailClaimsUnknown();
  const mode = leadDeliveryMode();
  const transportConfigured = hasLeadEmailTransportConfiguration(mode);
  const pairsOnly = mode === 'local_relay' || (mode === 'smtp_then_local_relay' && !hasUsableLeadSmtpConfiguration());
  const pendingDeliveries = transportConfigured ? await listPendingLeadEmailDeliveries(25, pairsOnly) : [];
  let leadEmailSent = false;
  let leadEmailFailed = false;
  for (const pendingDelivery of pendingDeliveries.slice(0, 5)) {
    try {
      const result = await processPendingLeadEmailDelivery(pendingDelivery, mode);
      leadEmailSent = leadEmailSent || result.sent;
      leadEmailFailed = leadEmailFailed || !result.sent;
    } catch (error) {
      console.error('Lead outbox recovery failed for a pending email.', error);
      leadEmailFailed = true;
    }
  }

  const tomorrow = addDays(1);
  const twoDays = addDays(2);
  const actions = await listPlannerActions({ from: tomorrow, to: twoDays });
  let sent = 0;
  let failed = 0;

  for (const action of actions) {
    const weather = await weatherText(action);
    if (action.date === twoDays && action.notify2Days && !action.notify2DaysSent) {
      const delivery = await sendPlannerNotificationEmail({
        to: adminEmail(),
        subject: `📅 O 2 dni — ${typeLabel(action.type)} ${action.address}`,
        text: [`O 2 dni: ${typeLabel(action.type)}`, `${action.date} ${action.timeFrom}-${action.timeTo}`, action.address, `Tím: ${action.workers || '—'}`, weather].join('\n'),
        html: adminHtml(action, `📅 O 2 dni — ${typeLabel(action.type)}`, weather),
      });
      if (delivery.sent) {
        await markPlannerNotificationSent(action.id, 'notify2DaysSent');
        sent += 1;
      } else failed += 1;
    }
    if (action.date === tomorrow && action.notify1Day && !action.notify1DaySent) {
      const delivery = await sendPlannerNotificationEmail({
        to: adminEmail(),
        subject: `🔔 ZAJTRA — ${action.address} o ${action.timeFrom}`,
        text: [`Zajtra: ${typeLabel(action.type)}`, `${action.date} ${action.timeFrom}-${action.timeTo}`, action.address, `Nezabudnite zavolať zákazníkovi: ${action.customerName || '—'} ${action.customerPhone || ''}`, `Tím: ${action.workers || '—'}`, weather].join('\n'),
        html: adminHtml(action, `🔔 Zajtra — ${action.address}`, weather),
      });
      if (delivery.sent) {
        await markPlannerNotificationSent(action.id, 'notify1DaySent');
        sent += 1;
      } else failed += 1;
    }
    if (action.date === twoDays && action.notifyCustomer && !action.notifyCustomerSent && action.customerEmail) {
      const delivery = await sendPlannerNotificationEmail({
        to: action.customerEmail,
        subject: `ASTANA — pripomienka termínu demontáže ${action.date}`,
        text: [`Dobrý deň,`, `pripomíname termín ${action.date} ${action.timeFrom}-${action.timeTo}.`, `Adresa: ${action.address}`, 'Prosíme, pripravte prístup a voľný priestor.', 'Kontakt: 0905 217 946'].join('\n'),
        html: customerHtml(action),
      });
      if (delivery.sent) {
        await markPlannerNotificationSent(action.id, 'notifyCustomerSent');
        sent += 1;
      } else failed += 1;
    }
  }

  const followups = await listDueFollowups(new Date().toISOString().slice(0, 10));
  for (const lead of followups) {
    const adminUrl = `${process.env.ADMIN_BASE_URL || new URL(request.url).origin}/admin/dopyty/${lead.id}`;
    const phoneHref = String(lead.phone || '').replace(/[^\d+]/g, '');
    const delivery = await sendPlannerNotificationEmail({
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
              <p><strong>Meno:</strong> ${escapeHtml(lead.fullName)}</p>
              <p><strong>Telefón:</strong> <a href="tel:${escapeHtml(phoneHref)}" style="color:#E8541A;font-weight:700;">${escapeHtml(lead.phone)}</a></p>
              <p><strong>Lokalita:</strong> ${escapeHtml(lead.city)}</p>
              <p><strong>Dôvod:</strong> ${escapeHtml(lead.followupNote || 'follow-up')}</p>
              <p><a href="${escapeHtml(adminUrl)}" style="display:inline-block;background:#E8541A;color:white;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700;">Otvoriť dopyt</a></p>
            </div>
          </div>
        </div>`,
    });
    if (delivery.sent) {
      await markLeadFollowupNotificationSent(lead.id);
      sent += 1;
    } else failed += 1;
  }

  const emailOutbox = await getLeadEmailOutboxHealth();
  leadEmailFailed = leadEmailFailed || ((!transportConfigured || pairsOnly) && emailOutbox.pending > 0);
  const health = evaluateDailyNotificationsHealth({
    notificationFailures: failed,
    leadEmailFailed,
    rateLimitCleanupFailed,
    analyticsFailed: analyticsRecovery.failed,
    analyticsRemaining: analyticsRecovery.remaining,
    analyticsUnrecoverable: analyticsRecovery.unrecoverable,
    emailOutbox,
  });
  return NextResponse.json({
    ok: health.ok,
    checked: actions.length,
    sent,
    failed,
    leadEmailSent,
    leadEmailFailed,
    rateLimitBucketsPurged,
    rateLimitCleanupFailed,
    analyticsRecovery,
    emailOutbox,
  }, { status: health.status });
}
