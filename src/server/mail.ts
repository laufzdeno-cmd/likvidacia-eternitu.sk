import nodemailer from 'nodemailer';
import { canSafelyFallbackToLocalRelay, isAstanaLocalRelayConfigured, leadDeliveryMode, sendCareerApplicationThroughAstanaLocalRelay, sendLeadThroughAstanaLocalRelay, type LeadDeliveryMode, type LeadDeliveryResult, type LeadRecipientDeliveryRecorder } from './astana-local-relay';
import { cleanSlovakText } from './slovak-text';
import { classifyRequiredSmtpRecipient, classifySmtpAcceptance, classifySmtpError, isRetryableSmtpFailure } from './email-delivery-policy';
import type { ApplicationNotificationRecipient } from './types';
import type { CareerApplication, Lead, LeadFile, PriceOffer, PriceOfferSettings } from './types';
import { calculatePriceOfferPricing } from '../lib/price-offer-pricing';
import { resolvePriceOfferVatRate } from '../lib/price-offer-vat';
import { isCustomStagingTarget, stagingMailOverride } from './preview-safety';
import { formatLeadAreaCompact } from './lead-area';
import { readStoredLeadFile } from './storage';

const siteUrl = () => process.env.ADMIN_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://likvidacia-eternitu.sk';
const leadRecipient = () => process.env.LEAD_TO_EMAIL || 'astana@astana.sk';
const fromEmail = () => process.env.FROM_EMAIL || process.env.MAIL_FROM || 'astana@astana.sk';
const customerLeadEmailSubject = '✅ ASTANA, s.r.o. prijala váš dopyt | likvidacia-eternitu.sk';
const customerLeadLogoUrl = 'https://likvidacia-eternitu.sk/assets/astana-logo-dark.png';
const maxInternalLeadAttachmentBytes = 12 * 1024 * 1024;

type InternalLeadPhotoAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
};

type InternalLeadPhotoBundle = {
  attachments: InternalLeadPhotoAttachment[];
  attachedCount: number;
  skippedCount: number;
};

function namedFromHeader(name: string) {
  const from = fromEmail();
  const address = from.match(/<([^>]+)>/)?.[1] || from;
  return `${name} <${address}>`;
}

function mailConfigured() {
  return Boolean(process.env.SMTP_HOST && fromEmail() && process.env.LEAD_TO_EMAIL);
}

export function resolveOutboundEmailRecipient(recipient: string) {
  const override = stagingMailOverride();
  if (override) return override;
  if (isCustomStagingTarget()) {
    throw new Error('Staging email is blocked without a verified single-recipient override.');
  }
  return recipient;
}

function resolveOutboundEmailCc(recipient: string | undefined) {
  if (stagingMailOverride()) return undefined;
  if (isCustomStagingTarget()) {
    throw new Error('Staging email is blocked without a verified single-recipient override.');
  }
  return recipient;
}

export function isLeadSmtpConfigured() {
  return mailConfigured();
}

export function hasUsableLeadSmtpConfiguration() {
  if (!process.env.SMTP_HOST?.trim() || !process.env.LEAD_TO_EMAIL?.trim()) return false;
  if (/[;,]/.test(leadRecipient())) return false;
  if (process.env.SMTP_USER?.trim() && !process.env.SMTP_PASS?.trim()) return false;
  try {
    assertAstanaSender();
    return true;
  } catch {
    return false;
  }
}

export function hasLeadEmailTransportConfiguration(mode: LeadDeliveryMode = leadDeliveryMode()) {
  if (mode === 'local_relay') return isAstanaLocalRelayConfigured();
  if (hasUsableLeadSmtpConfiguration()) return true;
  return mode === 'smtp_then_local_relay' && !mailConfigured() && isAstanaLocalRelayConfigured();
}

function assertAstanaSender() {
  const from = fromEmail();
  const match = from.match(/<([^>]+)>/)?.[1] || from;
  const domain = match.split('@')[1]?.toLowerCase();
  if (domain && domain !== 'astana.sk') {
    throw new Error('MAIL_FROM musí používať doménu astana.sk kvôli SPF/DMARC.');
  }
}

function transporter(options: { applicationNotification?: boolean } = {}) {
  if (!mailConfigured()) return null;
  resolveOutboundEmailRecipient(leadRecipient());
  if (/[;,]/.test(leadRecipient())) {
    throw new Error('LEAD_TO_EMAIL musí obsahovať iba jednu internú adresu; viac adries vyžaduje samostatné sledovanie doručenia.');
  }
  assertAstanaSender();
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        }
      : undefined,
    ...(options.applicationNotification ? {
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    } : {}),
  });
}

function euro(value: number) {
  return new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR' }).format(value || 0);
}

function dateSk(value: string) {
  return new Intl.DateTimeFormat('sk-SK', { dateStyle: 'medium' }).format(new Date(value));
}

function escapeHtml(value: string | number | undefined) {
  return cleanSlovakText(String(value ?? ''))
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function plainText(value: string | number | undefined) {
  return cleanSlovakText(String(value ?? ''));
}

function mailErrorMessage(error: unknown) {
  return error instanceof Error ? cleanSlovakText(error.message) : 'Email sa nepodarilo odoslať.';
}

function normalizePhoneHref(phone: string) {
  const cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('0')) return `+421${cleaned.slice(1)}`;
  return cleaned || phone;
}

function contactMeta(contact?: string) {
  const value = contact || 'Zavolajte mi';
  if (value.toLowerCase().includes('email')) {
    return {
      label: '📧 Napíšte email',
      banner: '📧 ZÁKAZNÍK CHCE EMAIL',
      bg: '#EFF6FF',
      border: '#3B82F6',
      color: '#1E40AF',
    };
  }
  if (value.toLowerCase().includes('whatsapp') || value.toLowerCase().includes('sms')) {
    return {
      label: '💬 WhatsApp/SMS',
      banner: '💬 ZÁKAZNÍK CHCE WHATSAPP/SMS',
      bg: '#F0FDF4',
      border: '#22C55E',
      color: '#166534',
    };
  }
  return {
    label: '📞 Zavolajte mi',
    banner: '📞 ZÁKAZNÍK CHCE TELEFONÁT',
    bg: '#FEF3C7',
    border: '#F59E0B',
    color: '#92400E',
  };
}

function leadSubmittedAt(lead: Lead) {
  return new Intl.DateTimeFormat('sk-SK', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Bratislava',
  }).format(new Date(lead.createdAt));
}

function photoCountLabel(count: number) {
  if (count === 1) return '1 fotografia';
  if (count >= 2 && count <= 4) return `${count} fotografie`;
  return `${count} fotografií`;
}

function attachedPhotoCountLabel(count: number) {
  if (count === 1) return '1 priložená';
  if (count >= 2 && count <= 4) return `${count} priložené`;
  return `${count} priložených`;
}

function attachedPhotoAdjective(count: number) {
  if (count === 1) return 'priložená';
  if (count >= 2 && count <= 4) return 'priložené';
  return 'priložených';
}

function internalLeadPhotoSummary(fileCount: number, attachedCount: number) {
  const total = photoCountLabel(fileCount);
  if (fileCount === 0) return total;
  if (attachedCount === fileCount) return `${total} · ${attachedPhotoAdjective(fileCount)} k tomuto e-mailu`;
  if (attachedCount > 0) return `${total} · ${attachedPhotoCountLabel(attachedCount)} k e-mailu, všetky sú v chránenom admine`;
  return `${total} · uložené v chránenom admine`;
}

function safeLeadAttachmentName(file: LeadFile, index: number) {
  const cleaned = cleanSlovakText(file.originalName)
    .replace(/[\u0000-\u001F\u007F"\\/]+/g, '-')
    .trim()
    .slice(0, 120);
  return cleaned || `fotografia-${index + 1}`;
}

export async function prepareInternalLeadPhotoAttachments(
  files: LeadFile[],
  readFile: (file: LeadFile) => Promise<Buffer> = readStoredLeadFile,
): Promise<InternalLeadPhotoBundle> {
  const attachments: InternalLeadPhotoAttachment[] = [];
  let totalBytes = 0;
  let skippedCount = 0;

  for (const [index, file] of files.entries()) {
    const remainingBytes = maxInternalLeadAttachmentBytes - totalBytes;
    if (!file.mimeType.startsWith('image/') || file.sizeBytes <= 0 || file.sizeBytes > remainingBytes) {
      skippedCount += 1;
      continue;
    }

    try {
      const content = await readFile(file);
      if (content.length <= 0 || content.length > remainingBytes) {
        skippedCount += 1;
        continue;
      }
      attachments.push({
        filename: safeLeadAttachmentName(file, index),
        content,
        contentType: file.mimeType,
      });
      totalBytes += content.length;
    } catch {
      // The protected admin copy remains the source of truth if an email attachment cannot be prepared.
      skippedCount += 1;
    }
  }

  return { attachments, attachedCount: attachments.length, skippedCount };
}

function customerLeadEmailHtml(lead: Lead) {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0;padding:0;background:#F7F4EE;font-family:Arial,sans-serif;">
    <tr><td style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" align="center" style="width:100%;max-width:600px;margin:0 auto;border-collapse:collapse;background:#ffffff;">
        <tr>
          <td style="background-color:#263451;background-image:linear-gradient(135deg,#263451 0%,#18243B 100%);padding:24px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              <tr>
                <td style="vertical-align:middle;">
                  <img src="${customerLeadLogoUrl}" width="190" alt="ASTANA, s.r.o." style="display:block;width:190px;max-width:100%;height:auto;border:0;" />
                  <div style="margin-top:8px;color:#ffffff;font-size:14px;font-weight:700;line-height:1.2;">ASTANA, s.r.o.</div>
                  <div style="margin-top:4px;color:#D8E0ED;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">odborná likvidácia azbestu a eternitu</div>
                </td>
                <td align="right" style="vertical-align:middle;">
                  <span style="display:inline-block;background:#2D7A3A;color:#ffffff;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:600;">✓ Dopyt prijatý</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr><td style="background:linear-gradient(135deg,#314768 0%,#263451 100%);border-top:4px solid #C86432;padding:20px 32px;color:#ffffff;">
          <div style="font-size:22px;font-weight:700;line-height:1.25;">Cenovú ponuku dostanete</div>
          <div style="margin-top:5px;color:#C9D5E8;font-size:15px;">do 24 hodín na tento email</div>
        </td></tr>
        <tr><td style="background:#ffffff;padding:32px;">
          <p style="margin:0 0 12px;font-size:17px;font-weight:600;color:#263451;">Dobrý deň ${escapeHtml(lead.fullName)},</p>
          <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.7;">váš dopyt z likvidacia-eternitu.sk sme prijali. Pripravíme vám cenovú ponuku a pošleme ju na tento email do 24 hodín.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border-left:4px solid #C86432;border-radius:0 8px 8px 0;background:#F7F4EE;">
            <tr><td style="padding:16px 20px;">
              <div style="margin-bottom:12px;font-size:11px;font-weight:700;color:#687284;text-transform:uppercase;letter-spacing:0.08em;">Súhrn vášho dopytu</div>
              <div style="font-size:14px;color:#1C1B19;line-height:1.8;">
                📍 <strong>Lokalita:</strong> ${escapeHtml(lead.city)}<br />
                📐 <strong>Výmera:</strong> ${escapeHtml(formatLeadAreaCompact(lead))}<br />
                🏗 <strong>Materiál:</strong> ${escapeHtml(lead.materialType)}<br />
                🏠 <strong>Objekt:</strong> ${escapeHtml(lead.objectType)}<br />
                📞 <strong>Kontakt:</strong> ${escapeHtml(lead.preferredContact || 'Zavolajte mi')}
              </div>
            </td></tr>
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;text-align:center;">
            <tr>
              ${['Skontrolujeme dopyt', 'Pripravíme ponuku', 'Pošleme do 24h'].map((step, index) => `
                <td width="33.33%" style="padding:0 6px;vertical-align:top;">
                  <div style="display:inline-block;width:32px;height:32px;border-radius:50%;background:#263451;color:#ffffff;font-size:15px;font-weight:700;line-height:32px;text-align:center;">${index + 1}</div>
                  <div style="margin-top:8px;font-size:12px;color:#374151;line-height:1.4;">${step}</div>
                </td>`).join('')}
            </tr>
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border-radius:10px;background:#F4F7FB;border:2px solid #E8E6DF;border-top:3px solid #263451;text-align:center;">
            <tr><td style="padding:20px 24px;">
              <div style="color:#263451;font-size:13px;font-weight:600;">Máte otázky?</div>
              <a href="tel:+421905217946" style="display:block;margin:8px 0;color:#263451;font-size:22px;font-weight:700;text-decoration:none;">0905 217 946</a>
              <div style="color:#687284;font-size:12px;">Po–Pia 8:00–18:00</div>
              <a href="mailto:astana@astana.sk" style="display:block;margin-top:8px;color:#B95A32;font-size:13px;text-decoration:none;">✉ astana@astana.sk</a>
            </td></tr>
          </table>
          <div style="margin-top:20px;text-align:center;">
            <div style="font-size:13px;color:#687284;">Viac informácií na</div>
            <a href="https://likvidacia-eternitu.sk" style="display:block;margin-top:4px;color:#C86432;font-size:14px;font-weight:600;text-decoration:none;">likvidacia-eternitu.sk</a>
          </div>
        </td></tr>
        <tr><td style="background:#F8FAFC;border-top:1px solid #E2E8F0;padding:20px 32px;text-align:center;color:#334155;">
          <div style="font-size:11px;color:#334155;line-height:1.6;">ASTANA, s.r.o. · Scherffelova 1364/28, Poprad 058 01 · IČO: 46 157 701</div>
          <div style="margin-top:4px;font-size:11px;color:#64748B;">© 2026 ASTANA, s.r.o.</div>
          <div style="font-size:11px;color:#64748B;">Email odoslaný z likvidacia-eternitu.sk</div>
        </td></tr>
      </table>
    </td></tr>
  </table>`;
}

function customerLeadEmailText(lead: Lead) {
  return [
    'ASTANA, s.r.o. – odborná likvidácia azbestu a eternitu',
    '',
    `Dobrý deň ${plainText(lead.fullName)},`,
    '',
    'váš dopyt z likvidacia-eternitu.sk sme prijali.',
    'Cenovú ponuku vám pošleme do 24 hodín na tento email.',
    '',
    'Súhrn vášho dopytu:',
    `Lokalita: ${plainText(lead.city)}`,
    `Výmera: ${plainText(formatLeadAreaCompact(lead))}`,
    `Materiál: ${plainText(lead.materialType)}`,
    `Typ objektu: ${plainText(lead.objectType)}`,
    `Kontakt: ${plainText(lead.preferredContact || 'Zavolajte mi')}`,
    '',
    'Máte otázky? Zavolajte 0905 217 946 (Po-Pia 8:00-18:00).',
    'likvidacia-eternitu.sk',
  ].join('\n');
}

export function adminLeadEmailHtml(lead: Lead, businessJobId?: string, fileCount = 0, attachedCount = 0) {
  const leadUrl = `${siteUrl()}/admin/dopyty/${encodeURIComponent(lead.id)}/`;
  const businessJobUrl = businessJobId
    ? `${siteUrl()}/admin/zakazky/${encodeURIComponent(businessJobId)}/`
    : '';
  const contact = contactMeta(lead.preferredContact);
  const phoneHref = normalizePhoneHref(lead.phone);
  const rows: Array<[string, string]> = [
    ['Meno', escapeHtml(lead.fullName)],
    ['Telefón', `<a href="tel:${escapeHtml(phoneHref)}" style="color:#C86432;font-weight:700;text-decoration:none;font-size:16px;">${escapeHtml(lead.phone)}</a>`],
    ['Email', `<a href="mailto:${escapeHtml(lead.email)}" style="color:#185FA5;text-decoration:none;">${escapeHtml(lead.email)}</a>`],
    ['Lokalita', escapeHtml(lead.city)],
    ['Okres', escapeHtml(lead.district || '—')],
    ['Výmera', escapeHtml(formatLeadAreaCompact(lead))],
    ['Materiál', escapeHtml(lead.materialType)],
    ['Objekt', escapeHtml(lead.objectType)],
    ['Kontakt', `<span style="display:inline-block;background:${contact.bg};color:${contact.color};border:1px solid ${contact.border};border-radius:999px;padding:4px 10px;font-size:12px;font-weight:700;">${contact.label}</span>`],
    ['Fotky', escapeHtml(internalLeadPhotoSummary(fileCount, attachedCount))],
    ['Termín', escapeHtml(lead.term || '—')],
    ['Poznámka', escapeHtml(lead.note || '—')],
  ];
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0;padding:0;background:#F7F4EE;font-family:Arial,sans-serif;">
    <tr><td style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" align="center" style="width:100%;max-width:600px;margin:0 auto;border-collapse:collapse;background:#ffffff;">
        <tr><td bgcolor="#263451" style="background-color:#263451;background-image:linear-gradient(135deg,#263451 0%,#18243B 100%);padding:20px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <tr>
              <td style="vertical-align:middle;color:#ffffff!important;">
                <img src="${customerLeadLogoUrl}" width="150" alt="ASTANA, s.r.o." style="display:block;width:150px;max-width:100%;height:auto;border:0;" />
                <div style="margin-top:8px;color:#ffffff!important;font-size:18px;font-weight:700;">🔔 Nový dopyt</div>
              </td>
              <td align="right" style="vertical-align:middle;font-size:12px;color:#E2E8F0!important;line-height:1.5;">${escapeHtml(leadSubmittedAt(lead))}<br /><a href="${escapeHtml(siteUrl())}/" style="color:#F2B24A!important;text-decoration:none!important;font-size:11px;font-weight:700;"><span style="color:#F2B24A!important;">likvidacia-eternitu.sk</span></a></td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="background:${contact.bg};border-left:4px solid ${contact.border};padding:12px 20px;color:${contact.color};font-size:14px;font-weight:700;">${contact.banner}</td></tr>
        <tr><td style="background:#ffffff;padding:24px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            ${rows.map(([label, value]) => `
              <tr>
                <td style="padding:8px 14px 8px 0;width:120px;color:#687284;font-size:13px;vertical-align:top;">${escapeHtml(label)}:</td>
                <td style="padding:8px 0;color:#263451;font-size:14px;font-weight:600;vertical-align:top;">${value}</td>
              </tr>`).join('')}
          </table>
        </td></tr>
        <tr><td style="background:#F7F4EE;padding:20px 28px;text-align:center;">
          <a href="${leadUrl}" style="display:inline-block;background:#C86432;color:#ffffff;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:700;text-decoration:none;">Otvoriť dopyt a prílohy →</a>
          ${businessJobUrl ? `<div style="margin-top:10px;font-size:11px;color:#687284;">Súvisiaca zákazka: <a href="${businessJobUrl}" style="color:#185FA5;">otvoriť v admine</a></div>` : ''}
          <div style="margin-top:10px;font-size:11px;color:#687284;">alebo prejdi na: <a href="${escapeHtml(siteUrl())}/admin/" style="color:#185FA5!important;text-decoration:underline;">${escapeHtml(siteUrl())}/admin/</a></div>
        </td></tr>
        <tr><td style="background:#F8FAFC;border-top:1px solid #E2E8F0;padding:16px 28px;text-align:center;color:#475569;font-size:11px;">ASTANA admin systém · <a href="${escapeHtml(siteUrl())}/" style="color:#185FA5!important;text-decoration:none!important;">likvidacia-eternitu.sk</a></td></tr>
      </table>
    </td></tr>
  </table>`;
}

export function adminLeadEmailText(lead: Lead, businessJobId?: string, fileCount = 0, attachedCount = 0) {
  return [
    'Nový dopyt z likvidacia-eternitu.sk',
    '',
    `Meno: ${plainText(lead.fullName)}`,
    `Telefón: ${plainText(lead.phone)}`,
    `Email: ${plainText(lead.email)}`,
    `Lokalita: ${plainText(lead.city)}`,
    `Okres: ${plainText(lead.district || '—')}`,
    `Výmera: ${plainText(formatLeadAreaCompact(lead))}`,
    `Materiál: ${plainText(lead.materialType)}`,
    `Objekt: ${plainText(lead.objectType)}`,
    `Kontakt: ${plainText(lead.preferredContact || 'Zavolajte mi')}`,
    `Termín: ${plainText(lead.term || '—')}`,
    `Poznámka: ${plainText(lead.note || '—')}`,
    `Fotky: ${internalLeadPhotoSummary(fileCount, attachedCount)}`,
    '',
    `Dopyt a prílohy: ${siteUrl()}/admin/dopyty/${encodeURIComponent(lead.id)}/`,
    ...(businessJobId ? [`Súvisiaca zákazka: ${siteUrl()}/admin/zakazky/${encodeURIComponent(businessJobId)}/`] : []),
  ].join('\n');
}

async function sendLeadEmailsViaSmtp(
  lead: Lead,
  fileCount: number,
  businessJobId?: string,
  recordRecipient?: LeadRecipientDeliveryRecorder,
  files: LeadFile[] = [],
): Promise<LeadDeliveryResult> {
  const client = transporter();
  if (!client) {
    return {
      sent: false,
      customerSent: false,
      adminSent: false,
      customerStatus: 'failed',
      adminStatus: 'failed',
      reason: 'SMTP nie je nastavené.',
    };
  }
  const customerHtml = customerLeadEmailHtml(lead);

  const customerClaim = recordRecipient ? await recordRecipient.claim('customer') : undefined;
  const customerDelivery = customerClaim === false
    ? { sent: false as const, status: 'failed' as const, messageId: '', retryable: false, reason: 'Zákaznícky email už spracúva iný pokus.' }
    : await client
    .sendMail({
      from: namedFromHeader('ASTANA likvidácia azbestu'),
      to: resolveOutboundEmailRecipient(lead.email),
      replyTo: leadRecipient(),
      subject: customerLeadEmailSubject,
      text: customerLeadEmailText(lead),
      html: customerHtml,
    })
    .then((info) => {
      const status = classifySmtpAcceptance(info);
      return { sent: status === 'sent', status, messageId: info.messageId || '', retryable: status === 'failed' && isRetryableSmtpFailure(info), reason: status === 'sent' ? undefined : status === 'failed' ? 'SMTP odmietol zákazníckeho adresáta.' : 'SMTP prijal iba časť adresátov alebo nepotvrdil žiadneho.' };
    })
    .catch((error) => ({ sent: false as const, status: classifySmtpError(error), messageId: '', retryable: isRetryableSmtpFailure(error), reason: mailErrorMessage(error) }));

  if (recordRecipient && customerClaim) await recordRecipient.record('customer', {
    status: customerDelivery.status,
    messageId: customerDelivery.messageId,
    retryable: customerDelivery.retryable,
    reason: 'reason' in customerDelivery ? customerDelivery.reason : undefined,
  }, customerClaim);

  const adminClaim = recordRecipient ? await recordRecipient.claim('internal') : undefined;
  const photoBundle = adminClaim === false
    ? { attachments: [], attachedCount: 0, skippedCount: files.length }
    : await prepareInternalLeadPhotoAttachments(files);
  const adminHtml = adminLeadEmailHtml(lead, businessJobId, fileCount, photoBundle.attachedCount);
  const adminDelivery = adminClaim === false
    ? { sent: false as const, status: 'failed' as const, messageId: '', retryable: false, reason: 'Interný email už spracúva iný pokus.' }
    : await client
    .sendMail({
      from: namedFromHeader('ASTANA systém'),
      to: resolveOutboundEmailRecipient(leadRecipient()),
      replyTo: leadRecipient(),
      subject: `🔔 ${plainText(lead.city)} | ${plainText(formatLeadAreaCompact(lead))} | ${plainText(lead.fullName)} | likvidacia-eternitu.sk`,
      text: adminLeadEmailText(lead, businessJobId, fileCount, photoBundle.attachedCount),
      html: adminHtml,
      attachments: photoBundle.attachments,
    })
    .then((info) => {
      const status = classifySmtpAcceptance(info);
      return { sent: status === 'sent', status, messageId: info.messageId || '', retryable: status === 'failed' && isRetryableSmtpFailure(info), reason: status === 'sent' ? undefined : status === 'failed' ? 'SMTP odmietol interného adresáta.' : 'SMTP prijal iba časť adresátov alebo nepotvrdil žiadneho.' };
    })
    .catch((error) => ({ sent: false as const, status: classifySmtpError(error), messageId: '', retryable: isRetryableSmtpFailure(error), reason: mailErrorMessage(error) }));

  if (recordRecipient && adminClaim) await recordRecipient.record('internal', {
    status: adminDelivery.status,
    messageId: adminDelivery.messageId,
    retryable: adminDelivery.retryable,
    reason: 'reason' in adminDelivery ? adminDelivery.reason : undefined,
  }, adminClaim);

  const reasons = [
    customerDelivery.sent ? '' : `Potvrdenie zákazníkovi: ${customerDelivery.reason}`,
    adminDelivery.sent ? '' : `Interné upozornenie: ${adminDelivery.reason}`,
  ].filter(Boolean);

  return {
    sent: customerDelivery.sent && adminDelivery.sent,
    customerSent: customerDelivery.sent,
    adminSent: adminDelivery.sent,
    customerStatus: customerDelivery.status,
    adminStatus: adminDelivery.status,
    customerMessageId: customerDelivery.messageId,
    adminMessageId: adminDelivery.messageId,
    customerReason: 'reason' in customerDelivery ? customerDelivery.reason : '',
    adminReason: 'reason' in adminDelivery ? adminDelivery.reason : '',
    reason: reasons.join(' | ') || undefined,
  };
}

export async function sendCareerApplicationEmails(application: CareerApplication): Promise<LeadDeliveryResult> {
  return sendCareerApplicationThroughAstanaLocalRelay(application);
}

export function canManuallyRetryLeadEmail() {
  if (!process.env.SMTP_HOST?.trim() || !process.env.LEAD_TO_EMAIL?.trim()
    || !fromEmail().trim() || /[;,]/.test(leadRecipient())) return false;
  try {
    assertAstanaSender();
    return true;
  } catch {
    return false;
  }
}

export async function sendCareerApplicationNotificationBatch(application: CareerApplication) {
  const result = await sendCareerApplicationThroughAstanaLocalRelay(application);
  const toRecipient = (status: 'sent' | 'failed' | 'unknown' | undefined, messageId?: string, reason?: string) => ({
    status: status || 'unknown',
    retryable: status === 'failed',
    messageId,
    reason: reason || (status === 'sent' ? undefined : result.reason || 'Relay nepotvrdil výsledok; automatické opakovanie je vypnuté.'),
  } as const);
  return {
    applicant: toRecipient(result.customerStatus, result.customerMessageId, result.customerReason),
    internal: toRecipient(result.adminStatus, result.adminMessageId, result.adminReason),
  };
}

export async function sendLeadEmails(
  lead: Lead,
  fileCount: number,
  businessJobId?: string,
  recordRecipient?: LeadRecipientDeliveryRecorder,
  files: LeadFile[] = [],
): Promise<LeadDeliveryResult> {
  const mode = leadDeliveryMode();
  if (!hasLeadEmailTransportConfiguration(mode)) {
    return { sent: false, customerSent: false, adminSent: false, reason: 'Odosielanie dopytových e-mailov nie je nastavené.' };
  }
  if (mode === 'local_relay') {
    const relayClaim = recordRecipient ? await recordRecipient.claim() : undefined;
    if (recordRecipient && !relayClaim) {
      return { sent: false, customerSent: false, adminSent: false, reason: 'Obaja adresáti nemajú aktívne rezervované pokusy; relay sa preto nespustil.' };
    }
    const result = await sendLeadThroughAstanaLocalRelay(lead, fileCount, businessJobId);
    if (recordRecipient) {
      await recordRecipient.record('customer', { status: result.customerStatus || (result.customerSent ? 'sent' : 'unknown'), messageId: result.customerMessageId, reason: result.customerReason || result.reason }, relayClaim as string);
      await recordRecipient.record('internal', { status: result.adminStatus || (result.adminSent ? 'sent' : 'unknown'), messageId: result.adminMessageId, reason: result.adminReason || result.reason }, relayClaim as string);
    }
    return result;
  }

  const smtpResult = await sendLeadEmailsViaSmtp(lead, fileCount, businessJobId, recordRecipient, files);
  if (!canSafelyFallbackToLocalRelay(mode, smtpResult)) return smtpResult;

  const relayClaim = recordRecipient ? await recordRecipient.claim() : undefined;
  if (recordRecipient && !relayClaim) {
    return { sent: false, customerSent: false, adminSent: false, reason: 'Obaja adresáti nemajú aktívne rezervované pokusy; relay sa preto nespustil.' };
  }
  const relayResult = await sendLeadThroughAstanaLocalRelay(lead, fileCount, businessJobId);
  if (recordRecipient) {
    await recordRecipient.record('customer', { status: relayResult.customerStatus || (relayResult.customerSent ? 'sent' : 'unknown'), messageId: relayResult.customerMessageId, reason: relayResult.customerReason || relayResult.reason }, relayClaim as string);
    await recordRecipient.record('internal', { status: relayResult.adminStatus || (relayResult.adminSent ? 'sent' : 'unknown'), messageId: relayResult.adminMessageId, reason: relayResult.adminReason || relayResult.reason }, relayClaim as string);
  }
  if (relayResult.sent) return relayResult;

  return {
    sent: false,
    customerSent: relayResult.customerSent,
    adminSent: relayResult.adminSent,
    customerStatus: relayResult.customerStatus,
    adminStatus: relayResult.adminStatus,
    customerMessageId: relayResult.customerMessageId,
    adminMessageId: relayResult.adminMessageId,
    customerReason: relayResult.customerReason,
    adminReason: relayResult.adminReason,
    reason: `SMTP: ${smtpResult.reason || 'nepotvrdilo doručenie'} | Záložný relay: ${relayResult.reason || 'nepotvrdil doručenie'}`,
  };
}

export async function sendLeadEmailToRecipient(
  lead: Lead,
  recipientRole: 'customer' | 'internal',
  fileCount: number,
  businessJobId?: string,
  files: LeadFile[] = [],
): Promise<{ status: 'sent' | 'failed' | 'unknown'; messageId?: string; reason?: string; retryable?: boolean }> {
  let client: ReturnType<typeof transporter>;
  try {
    client = transporter();
  } catch (error) {
    return { status: 'failed', reason: mailErrorMessage(error) };
  }
  if (!client) return { status: 'failed', reason: 'SMTP nie je nastavené.' };

  const isCustomer = recipientRole === 'customer';
  try {
    const photoBundle = isCustomer
      ? { attachments: [], attachedCount: 0, skippedCount: 0 }
      : await prepareInternalLeadPhotoAttachments(files);
    const info = await client.sendMail(isCustomer
      ? {
          from: namedFromHeader('ASTANA likvidácia azbestu'),
          to: resolveOutboundEmailRecipient(lead.email),
          replyTo: leadRecipient(),
          subject: customerLeadEmailSubject,
          text: customerLeadEmailText(lead),
          html: customerLeadEmailHtml(lead),
        }
      : {
          from: namedFromHeader('ASTANA systém'),
          to: resolveOutboundEmailRecipient(leadRecipient()),
          replyTo: leadRecipient(),
          subject: `🔔 ${plainText(lead.city)} | ${plainText(formatLeadAreaCompact(lead))} | ${plainText(lead.fullName)} | likvidacia-eternitu.sk`,
          text: adminLeadEmailText(lead, businessJobId, fileCount, photoBundle.attachedCount),
          html: adminLeadEmailHtml(lead, businessJobId, fileCount, photoBundle.attachedCount),
          attachments: photoBundle.attachments,
        });
    const status = classifySmtpAcceptance(info);
    return {
      status,
      messageId: info.messageId || '',
      retryable: status === 'failed' && isRetryableSmtpFailure(info),
      reason: status === 'sent' ? undefined : status === 'failed' ? 'SMTP odmietol zvoleného adresáta.' : 'SMTP prijal iba časť adresátov alebo nepotvrdil žiadneho.',
    };
  } catch (error) {
    return {
      status: classifySmtpError(error),
      retryable: isRetryableSmtpFailure(error),
      reason: mailErrorMessage(error),
    };
  }
}

export async function sendPlannerNotificationEmail(input: { to: string; subject: string; html: string; text: string; replyTo?: string }) {
  let client: ReturnType<typeof transporter>;
  try {
    client = transporter();
  } catch (error) {
    const status = classifySmtpError(error);
    return { sent: false, status, messageId: '', reason: mailErrorMessage(error) };
  }
  if (!client) return { sent: false, status: 'failed' as const, messageId: '', reason: 'SMTP nie je nastavené.' };

  try {
    const requiredRecipient = resolveOutboundEmailRecipient(input.to);
    const info = await client.sendMail({
      from: namedFromHeader('ASTANA plánovač'),
      to: requiredRecipient,
      replyTo: input.replyTo || leadRecipient(),
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    const status = classifyRequiredSmtpRecipient(info, requiredRecipient);
    return {
      sent: status === 'sent',
      status,
      messageId: info.messageId || '',
      reason: status === 'sent'
        ? undefined
        : status === 'failed'
          ? 'SMTP odmietlo zvoleného adresáta.'
          : 'SMTP nepotvrdilo prijatie zvoleným adresátom.',
    };
  } catch (error) {
    const status = classifySmtpError(error);
    return { sent: false, status, messageId: '', reason: mailErrorMessage(error) };
  }
}

const priceOfferMaterialLabels: Record<string, string> = {
  VLNITY_ETERNIT: 'Vlnitý eternit (AZC)',
  HLADKY_ETERNIT: 'Hladký eternit',
  AZBESTOVE_RURY: 'Azbestové rúry',
  PODHLADOVE_DOSKY: 'Podhľadové dosky',
  BOLETICKY: 'Boletické panely',
  INE: 'Iné',
};

function priceOfferMaterialLabel(offer: PriceOffer) {
  return priceOfferMaterialLabels[offer.materialType] || 'Azbestový materiál';
}

function tableRow(label: string, value: string) {
  return `
    <tr>
      <td style="padding:6px 12px 6px 0;color:#94A3B8;font-size:13px;vertical-align:top;width:42%;">${label}</td>
      <td style="padding:6px 0;color:#1E293B;font-size:13px;font-weight:600;vertical-align:top;">${value}</td>
    </tr>`;
}

function calcRow(label: string, value: string, bold = false) {
  return `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #F1F5F9;color:#475569;font-size:13px;${bold ? 'font-weight:700;' : ''}">${label}</td>
      <td align="right" style="padding:8px 0;border-bottom:1px solid #F1F5F9;color:#1E293B;font-size:13px;font-weight:500;">${value}</td>
    </tr>`;
}

export function priceOfferEmailHtml(offer: PriceOffer, settings: PriceOfferSettings) {
  const material = priceOfferMaterialLabel(offer);
  const vatRate = resolvePriceOfferVatRate(offer, settings.vatRate);
  const pricing = calculatePriceOfferPricing(offer, vatRate);
  const location = [offer.municipality || offer.objectAddress, offer.district].filter(Boolean).join(', ');
  const validUntil = dateSk(offer.validUntil);
  const confirmSubject = encodeURIComponent(`Potvrdenie objednávky č. ${offer.number}`);
  const confirmBody = encodeURIComponent([
    `Dobrý deň, záväzne objednávam práce podľa cenovej ponuky č. ${offer.number}.`,
    '',
    `Presná adresa objektu typu ${offer.objectType} (ulica, číslo, prípadne parcela):`,
    'Objednávateľ a jeho úplná adresa:',
    `Vlastník objektu typu ${offer.objectType} a jeho úplná adresa:`,
    'Doplňujúce informácie alebo fotografie:',
  ].join('\n'));
  const included = [
    ...(offer.includeDocumentation ? ['Písomné oznámenie plánovaných prác príslušnému RÚVZ a súvisiace podklady', 'Prípadné správne poplatky podľa konkrétneho konania, ak vzniknú'] : []),
    'Vytvorenie ochranného pásma',
    'Stabilizácia materiálu penetračným postrekom',
    'Odborná demontáž vyškoleným personálom',
    'Balenie do PE vriec s označením ADR 9',
    'Dekontaminácia pracoviska',
    'Preprava na skládku nebezpečného odpadu',
    'Poplatok za skládkovanie',
    'Záverečná správa a doklady po likvidácii',
    'Potvrdenie o legálnom zneškodnení odpadu',
  ];

  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0;padding:0;background:#FAFAFA;font-family:Arial,sans-serif;">
    <tr><td style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" align="center" style="width:100%;max-width:600px;margin:0 auto;border-collapse:collapse;background:#ffffff;">
        <tr><td style="background:#FFFFFF;border-bottom:3px solid #263451;padding:24px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:middle;">
          <img src="https://likvidacia-eternitu.sk/assets/astana-logo-dark.png" width="160" alt="ASTANA, s.r.o." style="display:block;width:160px;max-width:100%;height:auto;border:0;" />
          <div style="margin-top:4px;color:#64748B;font-size:11px;font-weight:700;">ASTANA, s.r.o.</div>
              <div style="margin-top:6px;color:#94A3B8;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;">likvidácia azbestu a eternitu</div>
            </td>
            <td align="right" style="vertical-align:middle;">
              <div style="color:#94A3B8;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;">Cenová ponuka</div>
              <div style="margin-top:4px;color:#263451;font-size:18px;font-weight:700;">č. ${escapeHtml(offer.number)}</div>
            </td>
          </tr></table>
        </td></tr>
        <tr><td bgcolor="#A94722" style="background:#A94722;background-image:linear-gradient(135deg,#C86432 0%,#A94722 100%);padding:20px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:middle;">
              <div style="color:#ffffff;font-size:17px;font-weight:600;">Vaša cenová ponuka je pripravená</div>
              <div style="margin-top:4px;color:#FFF7E6;font-size:12px;">Platná do: ${escapeHtml(validUntil)}</div>
            </td>
            <td align="right" style="vertical-align:middle;">
              <div style="color:#FFF2C4;font-size:26px;font-weight:700;">${euro(offer.totalWithVat)}</div>
              <div style="color:#FFF7E6;font-size:11px;">vrátane DPH ${vatRate}%</div>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:16px 32px 0;background:#ffffff;">
          <div style="background:#FFFBEB;border:1px solid #FDE68A;border-left:3px solid #D4B56A;border-radius:6px;padding:12px 16px;color:#92400E;font-size:13px;line-height:1.6;">
            📎 Cenovú ponuku nájdete v prílohe tohto emailu ako súbor PDF. Vytlačte ju, podpíšte a pošlite nám späť — alebo nám jednoducho odpovedzte na tento email.
          </div>
        </td></tr>
        <tr><td style="background:#ffffff;padding:24px 32px;">
          <p style="margin:0 0 12px;font-size:16px;font-weight:600;color:#1E293B;">Dobrý deň,</p>
          <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.7;">Na základe Vašej požiadavky Vám posielame cenovú ponuku na materiál ${escapeHtml(material)} na objekte typu ${escapeHtml(offer.objectType)}.</p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;background:#FAFAFA;border:1px solid #D7DDEA;border-left:3px solid #263451;border-radius:6px;">
            <tr><td style="padding:16px 20px;">
              <div style="margin-bottom:12px;color:#94A3B8;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Súhrn vašej zákazky</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${tableRow('📍 Lokalita', escapeHtml(location))}
                ${tableRow('🏠 Typ objektu', escapeHtml(offer.objectType))}
                ${tableRow('📐 Výmera', `${escapeHtml(offer.areaM2)} m2`)}
                ${tableRow('🏗 Materiál', escapeHtml(material))}
                ${tableRow('📋 Dokumentácia', offer.includeDocumentation ? offer.documentationPromotion ? 'AKCIA — 0,00 €' : 'Oznámenie prác RÚVZ a súvisiace podklady' : 'Nezahrnutá')}
                ${offer.includeTransport ? tableRow('🚚 Doprava', `${escapeHtml(offer.transportFrom)} → ${escapeHtml(offer.transportTo)} · ${escapeHtml(offer.transportRoundTripKm)} km tam aj späť`) : ''}
                ${tableRow('📅 Termín', escapeHtml(offer.realizationTerm || 'dohodou'))}
              </table>
            </td></tr>
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;background:#ffffff;border:1px solid #E2E8F0;border-radius:8px;">
            <tr><td style="padding:16px 20px;">
              <div style="margin-bottom:12px;color:#94A3B8;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Cenová kalkulácia</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${calcRow(`Materiál (${offer.areaM2} m2 × ${euro(offer.pricePerM2WithoutVat)}/m2)`, `${euro(pricing.materialPriceWithoutVat)} bez DPH`)}
                ${offer.includeDocumentation ? calcRow(offer.documentationPromotion ? 'Dokumentácia — AKCIA' : 'Oznámenie prác RÚVZ a súvisiace podklady', `${euro(pricing.documentationWithoutVat)} bez DPH`) : ''}
                ${offer.includeTransport ? calcRow(`Doprava (${offer.transportRoundTripKm} km × ${euro(offer.transportPricePerKm)}/km)`, `${euro(pricing.transportWithoutVat)} bez DPH`) : ''}
                ${calcRow('Celkom bez DPH', euro(offer.totalWithoutVat), true)}
                ${calcRow(`DPH ${vatRate}%`, euro(Math.round((offer.totalWithVat - offer.totalWithoutVat) * 100) / 100))}
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;background:#263451;border-radius:6px;"><tr>
                <td style="padding:10px 16px;color:#ffffff;font-size:14px;font-weight:700;">CELKOM S DPH:</td>
                <td align="right" style="padding:10px 16px;color:#FFE08A;font-size:20px;font-weight:700;">${euro(offer.totalWithVat)}</td>
              </tr></table>
              <div style="margin-top:12px;color:#64748B;font-size:12px;line-height:1.5;">Presná cena bude upravená podľa skutočného množstva m2 azbestu na mieste.</div>
            </td></tr>
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:#FAFAFA;border-radius:8px;">
            <tr><td style="padding:16px 20px;">
              <div style="margin-bottom:12px;color:#94A3B8;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Čo je zahrnuté v cene</div>
              ${included.map((item) => `<div style="font-size:13px;color:#475569;line-height:1.8;"><span style="color:#263451;font-weight:700;">✓</span> ${escapeHtml(item)}</div>`).join('')}
            </td></tr>
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;text-align:center;"><tr>
            ${[
              ['1', 'Potvrďte záujem', 'Odpovedzte na tento email alebo zavolajte'],
              ['2', 'Dohodneme termín', 'Plánované práce vopred písomne oznámime príslušnému RÚVZ'],
              ['3', 'Realizujeme', 'Prídeme, demontujeme, odvezieme a odovzdáme doklady'],
            ].map(([num, title, text]) => `<td width="33.33%" style="padding:14px 10px;vertical-align:top;"><div style="display:inline-block;width:32px;height:32px;border-radius:50%;background:#263451;color:#ffffff;font-weight:700;line-height:32px;">${num}</div><div style="margin-top:10px;color:#1E293B;font-size:13px;font-weight:700;">${title}</div><div style="margin-top:5px;color:#64748B;font-size:12px;line-height:1.5;">${text}</div></td>`).join('')}
          </tr></table>

          <div style="margin:24px 0;text-align:center;">
            <a href="mailto:astana@astana.sk?subject=${confirmSubject}&amp;body=${confirmBody}" style="display:inline-block;background:#A94722;background-image:linear-gradient(135deg,#C86432 0%,#A94722 100%);color:#ffffff;padding:16px 36px;border-radius:8px;font-size:16px;font-weight:700;text-decoration:none;">Mám záujem — potvrdzujem objednávku</a>
            <div style="margin-top:10px;color:#687284;font-size:13px;">alebo zavolajte: 0905 217 946</div>
          </div>

          <div style="margin:0 0 20px;background:#F8FAFC;border:1px solid #D7DDEA;border-left:3px solid #263451;border-radius:6px;padding:16px 18px;color:#475569;font-size:13px;line-height:1.65;">
            <strong style="color:#263451;">Ak vám ponuka vyhovuje, pošlite nám záväznú objednávku odpoveďou na tento email.</strong>
            <div style="margin-top:8px;">V objednávke uveďte:</div>
            <ol style="margin:6px 0 0;padding-left:22px;">
              <li>číslo cenovej ponuky <strong>${escapeHtml(offer.number)}</strong>,</li>
              <li>presnú adresu objektu typu ${escapeHtml(offer.objectType)} — ulicu, číslo a prípadne parcelu,</li>
              <li>objednávateľa a jeho úplnú adresu,</li>
              <li>vlastníka objektu typu ${escapeHtml(offer.objectType)} a jeho úplnú adresu,</li>
              <li>prípadné doplňujúce fotografie situácie.</li>
            </ol>
          </div>

          <div style="margin-bottom:20px;background:#FFFBEB;border-left:3px solid #D4B56A;border-radius:6px;padding:14px 18px;color:#92400E;font-size:13px;line-height:1.6;">Plánované práce vopred písomne oznamujeme príslušnému RÚVZ; nejde o žiadosť o povolenie. Potvrdenie RÚVZ nie je záverečným dokladom. Potrebné doklady Vám odovzdáme po dokončení zákazky.</div>
          <div style="margin:0 0 20px;color:#475569;font-size:13px;line-height:1.65;">
            <strong style="color:#263451;">Po ukončení prác vám podľa rozsahu zákazky odovzdáme dostupné doklady preukazujúce riadne odovzdanie a zneškodnenie odpadu. Môže ísť najmä o:</strong>
            <ul style="margin:8px 0 0;padding-left:22px;">
              <li>kópiu príslušného rozhodnutia orgánu životného prostredia, ak bolo vydané,</li>
              <li>kópiu dokladu o preprave alebo prevzatí odpadu, ak bol vystavený,</li>
              <li>doklad o hmotnosti odpadu, ak bol vystavený,</li>
              <li>potvrdenie o zneškodnení azbestu firmou ASTANA, s.r.o.</li>
            </ul>
          </div>
        </td></tr>
        <tr><td style="border-top:1px solid #E2E8F0;padding:20px 32px;">
          <div style="font-size:14px;color:#374151;">S pozdravom a prianím pekného dňa</div>
          <div style="margin-top:8px;font-size:16px;font-weight:700;color:#1E293B;">${escapeHtml(settings.preparedByName)}</div>
          <div style="margin-top:4px;color:#263451;font-size:14px;">tel.: ${escapeHtml(settings.preparedByPhone)}</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;background:#FAFAFA;border:1px solid #D7DDEA;border-top:3px solid #263451;border-radius:8px;"><tr><td style="padding:16px 20px;">
            <div style="font-weight:600;color:#1E293B;font-size:13px;">${escapeHtml(settings.company.name)}</div>
            <div style="font-size:12px;color:#64748B;line-height:1.6;">${escapeHtml(settings.company.street)}, ${escapeHtml(settings.company.city)} ${escapeHtml(settings.company.postalCode)}<br>Tel.: <span style="color:#263451;font-size:20px;font-weight:700;">+421 905 217 946</span><br>E-mail: <span style="color:#B95A32;">${escapeHtml(settings.company.email)}</span><br>Web: ${escapeHtml(settings.company.mainWeb)} | likvidacia-eternitu.sk<br>IČO: ${escapeHtml(settings.company.ico)} | DIČ: ${escapeHtml(settings.company.dic)} | IČ DPH: ${escapeHtml(settings.company.icDph)}</div>
          </td></tr></table>
        </td></tr>
        <tr><td style="background:#EEF2F7;border-top:1px solid #D7DDEA;padding:16px 32px;text-align:center;">
          <div style="color:#475569;font-size:11px;">Táto cenová ponuka platí do ${escapeHtml(validUntil)}. · ${escapeHtml(settings.company.name)} · ${escapeHtml(settings.company.street)}, ${escapeHtml(settings.company.city)} ${escapeHtml(settings.company.postalCode)}</div>
          <div style="margin-top:4px;color:#475569;font-size:11px;">© 2026 ASTANA, s.r.o. · <span style="color:#263451;">likvidacia-eternitu.sk</span></div>
        </td></tr>
      </table>
    </td></tr>
  </table>`;
}

export function priceOfferEmailText(offer: PriceOffer, settings: PriceOfferSettings) {
  const material = priceOfferMaterialLabel(offer);
  const location = [offer.municipality || offer.objectAddress, offer.district].filter(Boolean).join(', ');
  return [
    'Dobrý deň,',
    '',
    `v prílohe posielame cenovú ponuku č. ${offer.number} na materiál ${material} na objekte typu ${offer.objectType}.`,
    '',
    `Lokalita: ${location}`,
    `Typ objektu: ${offer.objectType}`,
    `Výmera: ${offer.areaM2} m2`,
    `Materiál: ${material}`,
    `Celkom s DPH: ${euro(offer.totalWithVat)}`,
    `Platná do: ${dateSk(offer.validUntil)}`,
    '',
    ...(offer.includeTransport ? [`Doprava: ${offer.transportFrom} – ${offer.transportTo}; ${offer.transportRoundTripKm} km tam aj späť × ${euro(offer.transportPricePerKm)}/km.`] : []),
    ...(offer.includeDocumentation ? [offer.documentationPromotion ? 'Dokumentácia: akcia 0,00 €.' : `Dokumentácia a súvisiace podklady: ${euro(offer.documentationFeeWithoutVat)} bez DPH.`] : []),
    '',
    'Ak vám ponuka vyhovuje, pošlite nám záväznú objednávku odpoveďou na tento email. V objednávke uveďte:',
    `1. číslo cenovej ponuky ${offer.number},`,
    `2. presnú adresu objektu typu ${offer.objectType} — ulicu, číslo a prípadne parcelu,`,
    '3. objednávateľa a jeho úplnú adresu,',
    `4. vlastníka objektu typu ${offer.objectType} a jeho úplnú adresu,`,
    '5. prípadné doplňujúce fotografie situácie.',
    '',
    'Plánované práce vopred písomne oznamujeme príslušnému RÚVZ; nejde o žiadosť o povolenie. Potvrdenie RÚVZ nie je záverečným dokladom.',
    'Po ukončení prác vám podľa rozsahu zákazky odovzdáme dostupné doklady preukazujúce riadne odovzdanie a zneškodnenie odpadu. Môže ísť najmä o:',
    '- kópiu príslušného rozhodnutia orgánu životného prostredia, ak bolo vydané,',
    '- kópiu dokladu o preprave alebo prevzatí odpadu, ak bol vystavený,',
    '- doklad o hmotnosti odpadu, ak bol vystavený,',
    '- potvrdenie o zneškodnení azbestu firmou ASTANA, s.r.o.',
    '',
    `Pre potvrdenie odpovedzte na tento email alebo volajte 0905 217 946. Vyhotovil: ${settings.preparedByName}, tel.: ${settings.preparedByPhone}.`,
    '',
    'ASTANA, s.r.o.',
    'likvidacia-eternitu.sk',
  ].join('\n');
}

export async function sendPriceOfferDocumentEmail(offer: PriceOffer, settings: PriceOfferSettings, pdf: Buffer) {
  const client = transporter();
  if (!client) return { status: 'not_sent' as const, reason: 'SMTP nie je nastavené.' };
  if (!offer.email) return { status: 'not_sent' as const, reason: 'Ponuka nemá email zákazníka.' };
  const c = settings.company;
  const location = offer.municipality || offer.objectAddress || offer.district;

  try {
    const requiredRecipient = resolveOutboundEmailRecipient(offer.email);
    const info = await client.sendMail({
      from: namedFromHeader('ASTANA s.r.o. - likvidácia azbestu'),
      to: requiredRecipient,
      cc: resolveOutboundEmailCc(c.email),
      replyTo: c.email,
      subject: `Cenová ponuka č. ${offer.number} — ASTANA likvidácia azbestu | ${location}`,
      text: priceOfferEmailText(offer, settings),
      html: priceOfferEmailHtml(offer, settings),
      attachments: [{ filename: `ASTANA-CP-${offer.number}.pdf`, content: pdf, contentType: 'application/pdf' }],
    });
    const status = classifyRequiredSmtpRecipient(info, requiredRecipient);
    if (status !== 'sent') {
      return {
        status: status === 'failed' ? 'not_sent' as const : 'unknown' as const,
        reason: status === 'failed'
          ? 'SMTP odmietlo adresu zákazníka. Interná kópia nemení stav ponuky na odoslanú.'
          : 'SMTP nepotvrdilo prijatie adresou zákazníka. Pred opakovaním skontrolujte odoslanú poštu.',
      };
    }
  } catch (error) {
    const status = classifySmtpError(error);
    return {
      status: status === 'failed' ? 'not_sent' as const : 'unknown' as const,
      reason: mailErrorMessage(error),
    };
  }

  return { status: 'sent' as const };
}

export type RooferRegistrationEmail = {
  id?: string;
  submissionId: string;
  businessType: 'sro' | 'szco' | 'other';
  companyName: string;
  companyId?: string;
  contactPerson: string;
  phone: string;
  email: string;
  website?: string;
  serviceRegions: string[];
  specializations: string[];
  otherSpecialization?: string;
  canBuildRoofTruss: 'yes' | 'no' | 'by_scope';
  acceptCustomerReferrals: boolean;
  consentPublicProfile: boolean;
  privacyConsent: boolean;
  note?: string;
};

const rooferBusinessTypeLabels = {
  sro: 's.r.o.',
  szco: 'živnostník / SZČO',
  other: 'iné',
} as const;

const rooferTrussLabels = {
  yes: 'áno',
  no: 'nie',
  by_scope: 'podľa rozsahu zákazky',
} as const;

function rooferRegistrationRows(input: RooferRegistrationEmail) {
  return [
    ['Forma podnikania', rooferBusinessTypeLabels[input.businessType]],
    ['Firma / obchodné meno', input.companyName],
    ['IČO', input.companyId || 'neuvedené'],
    ['Kontaktná osoba', input.contactPerson],
    ['Telefón', input.phone],
    ['Email', input.email],
    ['Web', input.website || 'neuvedený'],
    ['Kraje pôsobenia', input.serviceRegions.join(', ')],
    ['Špecializácie', input.specializations.join(', ')],
    ['Iná špecializácia', input.otherSpecialization || 'neuvedená'],
    ['Nový krov', rooferTrussLabels[input.canBuildRoofTruss]],
    ['Posielať zákazníkov', input.acceptCustomerReferrals ? 'áno' : 'nie'],
    ['Verejný profil', input.consentPublicProfile ? 'áno' : 'nie'],
    ['Spracovanie údajov', input.privacyConsent ? 'áno' : 'nie'],
    ['Poznámka', input.note || 'bez poznámky'],
  ] as const;
}

function rooferRegistrationEmailHtml(input: RooferRegistrationEmail) {
  const rows = rooferRegistrationRows(input);
  const adminUrl = `${siteUrl()}/admin/strechari/`;
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0;padding:0;background:#f4f7f8;font-family:Arial,sans-serif;">
    <tr><td style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" align="center" style="width:100%;max-width:600px;margin:0 auto;border-collapse:collapse;background:#ffffff;border:1px solid #dce7ec;">
        <tr><td style="background:#0f1f3d;padding:24px 28px;color:#ffffff;">
          <div style="font-size:22px;font-weight:700;line-height:1.2;">Nová registrácia strechára</div>
          <div style="margin-top:6px;color:#c9d5e8;font-size:13px;line-height:1.5;">ASTANA partnerská sieť · ${escapeHtml(input.companyName)}</div>
        </td></tr>
        <tr><td style="background:#eaf7ed;border-left:5px solid #2d7a3a;padding:14px 20px;color:#175b2a;font-size:14px;font-weight:700;line-height:1.45;">Registrácia bola uložená a čaká na internú kontrolu.</td></tr>
        <tr><td style="padding:24px 28px;">
          <div style="margin-bottom:14px;color:#687284;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">Údaje registrácie</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            ${rows.map(([label, value]) => `
              <tr>
                <td style="padding:9px 14px 9px 0;width:36%;border-bottom:1px solid #edf1f3;color:#687284;font-size:13px;vertical-align:top;">${escapeHtml(label)}</td>
                <td style="padding:9px 0;border-bottom:1px solid #edf1f3;color:#1f2d3d;font-size:14px;font-weight:600;line-height:1.45;vertical-align:top;">${escapeHtml(value)}</td>
              </tr>`).join('')}
          </table>
        </td></tr>
        <tr><td style="background:#f7f4ee;padding:20px 28px;text-align:center;">
          <a href="${adminUrl}" style="display:inline-block;background:#d34a22;color:#ffffff;padding:13px 24px;border-radius:7px;font-size:15px;font-weight:700;text-decoration:none;">Otvoriť registrácie v admine</a>
          <div style="margin-top:10px;color:#687284;font-size:11px;line-height:1.5;">Registráciu nájdete v sekcii Strechári.</div>
        </td></tr>
        <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 28px;text-align:center;color:#64748b;font-size:11px;line-height:1.5;">ASTANA, s.r.o. · likvidacia-eternitu.sk</td></tr>
      </table>
    </td></tr>
  </table>`;
}

function rooferRegistrationConfirmationEmailHtml(input: RooferRegistrationEmail) {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0;padding:0;background:#f4f7f8;font-family:Arial,sans-serif;">
    <tr><td style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" align="center" style="width:100%;max-width:600px;margin:0 auto;border-collapse:collapse;background:#ffffff;border:1px solid #dce7ec;">
        <tr><td style="background:#0f1f3d;padding:26px 28px;color:#ffffff;">
          <div style="font-size:24px;font-weight:700;line-height:1.2;">ASTANA</div>
          <div style="margin-top:6px;color:#c9d5e8;font-size:12px;letter-spacing:.06em;text-transform:uppercase;">partnerská sieť strechárov</div>
        </td></tr>
        <tr><td style="padding:28px;">
          <div style="display:inline-block;background:#eaf7ed;color:#175b2a;padding:8px 12px;border-radius:6px;font-size:13px;font-weight:700;">✓ Registráciu sme prijali</div>
          <h1 style="margin:20px 0 12px;color:#0f1f3d;font-size:24px;line-height:1.25;">Ďakujeme, ${escapeHtml(input.contactPerson)}.</h1>
          <p style="margin:0;color:#374151;font-size:15px;line-height:1.65;">Vaše údaje sme prijali. Najprv ich interne skontrolujeme a potom sa vám ozveme ohľadom možností spolupráce.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border-collapse:collapse;background:#f7f4ee;border-left:4px solid #d34a22;">
            <tr><td style="padding:16px 18px;color:#263451;font-size:14px;line-height:1.7;">
              <strong>Čo bude nasledovať</strong><br />
              1. Skontrolujeme údaje o vašej firme a pôsobnosti.<br />
              2. Ozveme sa vám, ak bude spolupráca dávať zmysel pre obe strany.
            </td></tr>
          </table>
          <div style="margin-top:24px;color:#687284;font-size:12px;line-height:1.5;">Registrovaná firma</div>
          <div style="margin-top:4px;color:#0f1f3d;font-size:16px;font-weight:700;">${escapeHtml(input.companyName)}</div>
        </td></tr>
        <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 28px;text-align:center;color:#475569;font-size:12px;line-height:1.6;">
          <div style="font-weight:700;color:#263451;">Máte otázky?</div>
          <a href="tel:+421905217946" style="display:inline-block;margin-top:5px;color:#263451;font-size:18px;font-weight:700;text-decoration:none;">0905 217 946</a>
          <div style="margin-top:5px;">ASTANA, s.r.o. · likvidacia-eternitu.sk</div>
        </td></tr>
      </table>
    </td></tr>
  </table>`;
}

export async function sendRooferRegistrationNotification(
  input: RooferRegistrationEmail,
  recipientRole: ApplicationNotificationRecipient,
) {
  let client: ReturnType<typeof transporter>;
  try {
    client = transporter({ applicationNotification: true });
  } catch (error) {
    return { status: 'failed' as const, retryable: true, reason: mailErrorMessage(error) };
  }
  if (!client) return { status: 'failed' as const, retryable: true, reason: 'SMTP nie je nastavené.' };

  try {
    if (recipientRole === 'internal') {
  const adminText = [
    'Prišla nová registrácia strechára z webu likvidacia-eternitu.sk.',
    '',
    `Registrácia: ${input.id || 'bez ID'}`,
    `Submission ID: ${input.submissionId}`,
    `Forma podnikania: ${rooferBusinessTypeLabels[input.businessType]}`,
    `Firma / obchodné meno: ${input.companyName}`,
    `IČO: ${input.companyId || 'neuvedené'}`,
    `Konajúca osoba: ${input.contactPerson}`,
    `Telefón: ${input.phone}`,
    `Email: ${input.email}`,
    `Web: ${input.website || 'neuvedený'}`,
    `Kraje pôsobenia: ${input.serviceRegions.join(', ')}`,
    `Špecializácie: ${input.specializations.join(', ')}`,
    `Iná špecializácia: ${input.otherSpecialization || 'neuvedená'}`,
    `Nový krov: ${rooferTrussLabels[input.canBuildRoofTruss]}`,
    `Posielať zákazníkov: ${input.acceptCustomerReferrals ? 'áno' : 'nie'}`,
    `Súhlas s verejným profilom: ${input.consentPublicProfile ? 'áno' : 'nie'}`,
    `Súhlas so spracovaním údajov: ${input.privacyConsent ? 'áno' : 'nie'}`,
    '',
    `Poznámka: ${input.note || 'bez poznámky'}`,
  ].join('\n');

      const info = await client.sendMail({
    from: namedFromHeader('ASTANA systém'),
    to: resolveOutboundEmailRecipient(leadRecipient()),
    replyTo: input.email,
    subject: `[STRECHÁR] Nová registrácia — ${input.companyName}`,
    text: adminText,
    html: rooferRegistrationEmailHtml(input),
      });
      const status = classifySmtpAcceptance(info);
      return { status, retryable: status === 'failed' && isRetryableSmtpFailure(info), messageId: info.messageId || '', reason: status === 'failed' ? 'SMTP odmietol interného adresáta.' : status === 'unknown' ? 'SMTP nepotvrdilo prijatie interným adresátom.' : undefined };
    }

    const info = await client.sendMail({
    from: namedFromHeader('ASTANA likvidácia azbestu'),
    to: resolveOutboundEmailRecipient(input.email),
    replyTo: leadRecipient(),
    subject: 'Prijali sme vašu registráciu — ASTANA',
    text: [
      `Dobrý deň, ${input.contactPerson},`,
      '',
      'Ďakujeme za registráciu do partnerskej siete ASTANA. Údaje si najprv interne skontrolujeme a následne sa vám ozveme ohľadom možností spolupráce.',
      '',
      'ASTANA, s.r.o.',
      '0905 217 946',
      'astana@astana.sk',
    ].join('\n'),
    html: rooferRegistrationConfirmationEmailHtml(input),
    });
    const status = classifySmtpAcceptance(info);
    return { status, retryable: status === 'failed' && isRetryableSmtpFailure(info), messageId: info.messageId || '', reason: status === 'failed' ? 'SMTP odmietlo adresáta registrácie.' : status === 'unknown' ? 'SMTP nepotvrdilo prijatie adresátom registrácie.' : undefined };
  } catch (error) {
    const status = classifySmtpError(error);
    return { status, retryable: status === 'failed' && isRetryableSmtpFailure(error), reason: mailErrorMessage(error) };
  }
}
