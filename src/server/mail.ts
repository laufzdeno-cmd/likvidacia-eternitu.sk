import nodemailer from 'nodemailer';
import type { BusinessJob, Lead, PriceOffer, PriceOfferSettings } from './types';

const siteUrl = () => process.env.ADMIN_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://likvidacia-eternitu.sk';
const leadRecipient = () => process.env.LEAD_TO_EMAIL || 'astana@astana.sk';
const fromEmail = () => process.env.FROM_EMAIL || process.env.MAIL_FROM || 'astana@astana.sk';

function namedFromHeader(name: string) {
  const from = fromEmail();
  const address = from.match(/<([^>]+)>/)?.[1] || from;
  return `${name} <${address}>`;
}

function mailConfigured() {
  return Boolean(process.env.SMTP_HOST && fromEmail() && process.env.LEAD_TO_EMAIL);
}

function assertAstanaSender() {
  const from = fromEmail();
  const match = from.match(/<([^>]+)>/)?.[1] || from;
  const domain = match.split('@')[1]?.toLowerCase();
  if (domain && domain !== 'astana.sk') {
    throw new Error('MAIL_FROM musí používať doménu astana.sk kvôli SPF/DMARC.');
  }
}

function transporter() {
  if (!mailConfigured()) return null;
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
  });
}

function euro(value: number) {
  return new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR' }).format(value || 0);
}

function dateSk(value: string) {
  return new Intl.DateTimeFormat('sk-SK', { dateStyle: 'medium' }).format(new Date(value));
}

function escapeHtml(value: string | number | undefined) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function mailErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Email sa nepodarilo odoslat.';
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
  return new Intl.DateTimeFormat('sk-SK', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(lead.createdAt));
}

function customerLeadEmailHtml(lead: Lead) {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0;padding:0;background:#F8F7F4;font-family:Arial,sans-serif;">
    <tr><td style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" align="center" style="width:100%;max-width:600px;margin:0 auto;border-collapse:collapse;background:#ffffff;">
        <tr>
          <td style="background:#0F1F3D;padding:28px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              <tr>
                <td style="vertical-align:middle;">
                  <div style="color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;line-height:1;">ASTANA</div>
                  <div style="margin-top:6px;color:rgba(255,255,255,0.55);font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">likvidácia azbestu a eternitu</div>
                </td>
                <td align="right" style="vertical-align:middle;">
                  <span style="display:inline-block;background:#2D7A3A;color:#ffffff;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:600;">✓ Dopyt prijatý</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr><td style="background:#E8541A;padding:20px 32px;color:#ffffff;">
          <div style="font-size:22px;font-weight:700;line-height:1.25;">Cenovú ponuku dostanete</div>
          <div style="margin-top:5px;color:rgba(255,255,255,0.85);font-size:15px;">do 24 hodín na tento email</div>
        </td></tr>
        <tr><td style="background:#ffffff;padding:32px;">
          <p style="margin:0 0 12px;font-size:17px;font-weight:600;color:#0F1F3D;">Dobrý deň ${escapeHtml(lead.fullName)},</p>
          <p style="margin:0 0 24px;font-size:15px;color:#4A4845;line-height:1.7;">váš dopyt z likvidacia-eternitu.sk sme prijali. Pripravíme vám cenovú ponuku a pošleme ju na tento email do 24 hodín.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border-left:4px solid #E8541A;border-radius:0 8px 8px 0;background:#F8F7F4;">
            <tr><td style="padding:16px 20px;">
              <div style="margin-bottom:12px;font-size:11px;font-weight:700;color:#8A8880;text-transform:uppercase;letter-spacing:0.08em;">Súhrn vášho dopytu</div>
              <div style="font-size:14px;color:#1C1B19;line-height:1.8;">
                📍 <strong>Lokalita:</strong> ${escapeHtml(lead.city)}<br />
                📐 <strong>Výmera:</strong> ${escapeHtml(lead.areaEstimate)} m²<br />
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
                  <div style="display:inline-block;width:32px;height:32px;border-radius:50%;background:#E8541A;color:#ffffff;font-size:15px;font-weight:700;line-height:32px;text-align:center;">${index + 1}</div>
                  <div style="margin-top:8px;font-size:12px;color:#4A4845;line-height:1.4;">${step}</div>
                </td>`).join('')}
            </tr>
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border-radius:10px;background:#0F1F3D;text-align:center;">
            <tr><td style="padding:20px 24px;">
              <div style="color:rgba(255,255,255,0.6);font-size:13px;">Máte otázky?</div>
              <a href="tel:+421905217946" style="display:block;margin:8px 0;color:#ffffff;font-size:24px;font-weight:700;text-decoration:none;">0905 217 946</a>
              <div style="color:rgba(255,255,255,0.5);font-size:12px;">Po–Pia 7:00–18:00</div>
            </td></tr>
          </table>
          <div style="margin-top:20px;text-align:center;">
            <div style="font-size:13px;color:#8A8880;">Viac informácií na</div>
            <a href="https://likvidacia-eternitu.sk" style="display:block;margin-top:4px;color:#E8541A;font-size:14px;font-weight:600;text-decoration:none;">likvidacia-eternitu.sk</a>
          </div>
        </td></tr>
        <tr><td style="background:#F8F7F4;border-top:2px solid #E8541A;padding:20px 32px;text-align:center;">
          <div style="font-size:11px;color:#8A8880;line-height:1.6;">ASTANA, s.r.o. · Scherffelova 1364/28, Poprad 058 01 · IČO: 46 157 701</div>
          <div style="margin-top:4px;font-size:11px;color:#C0B8B0;">© 2026 ASTANA, s.r.o.</div>
          <div style="font-size:11px;color:#C0B8B0;">Email odoslaný z likvidacia-eternitu.sk</div>
        </td></tr>
      </table>
    </td></tr>
  </table>`;
}

function customerLeadEmailText(lead: Lead) {
  return [
    `Dobrý deň ${lead.fullName},`,
    '',
    'váš dopyt z likvidacia-eternitu.sk sme prijali.',
    'Cenovú ponuku vám pošleme do 24 hodín na tento email.',
    '',
    'Súhrn vášho dopytu:',
    `Lokalita: ${lead.city}`,
    `Výmera: ${lead.areaEstimate} m²`,
    `Materiál: ${lead.materialType}`,
    `Typ objektu: ${lead.objectType}`,
    `Kontakt: ${lead.preferredContact || 'Zavolajte mi'}`,
    '',
    'Máte otázky? Zavolajte 0905 217 946 (Po-Pia 7:00-18:00).',
    'likvidacia-eternitu.sk',
  ].join('\n');
}

function adminLeadEmailHtml(lead: Lead, businessJobId?: string) {
  const adminUrl = `${siteUrl()}/admin/zakazky/${businessJobId || lead.id}/`;
  const contact = contactMeta(lead.preferredContact);
  const phoneHref = normalizePhoneHref(lead.phone);
  const rows: Array<[string, string]> = [
    ['Meno', escapeHtml(lead.fullName)],
    ['Telefón', `<a href="tel:${escapeHtml(phoneHref)}" style="color:#E8541A;font-weight:700;text-decoration:none;font-size:16px;">${escapeHtml(lead.phone)}</a>`],
    ['Email', `<a href="mailto:${escapeHtml(lead.email)}" style="color:#185FA5;text-decoration:none;">${escapeHtml(lead.email)}</a>`],
    ['Lokalita', escapeHtml(lead.city)],
    ['Okres', escapeHtml(lead.district || '—')],
    ['Výmera', `${escapeHtml(lead.areaEstimate)} m²`],
    ['Materiál', escapeHtml(lead.materialType)],
    ['Objekt', escapeHtml(lead.objectType)],
    ['Kontakt', `<span style="display:inline-block;background:${contact.bg};color:${contact.color};border:1px solid ${contact.border};border-radius:999px;padding:4px 10px;font-size:12px;font-weight:700;">${contact.label}</span>`],
    ['Termín', escapeHtml(lead.term || '—')],
    ['Poznámka', escapeHtml(lead.note || '—')],
  ];
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0;padding:0;background:#F8F7F4;font-family:Arial,sans-serif;">
    <tr><td style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" align="center" style="width:100%;max-width:600px;margin:0 auto;border-collapse:collapse;background:#ffffff;">
        <tr><td style="background:#0F1F3D;padding:20px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <tr>
              <td style="color:#ffffff;font-size:20px;font-weight:700;">🔔 Nový dopyt</td>
              <td align="right" style="font-size:12px;color:rgba(255,255,255,0.5);line-height:1.5;">${escapeHtml(leadSubmittedAt(lead))}<br /><span style="color:#E8541A;font-size:11px;font-weight:600;">likvidacia-eternitu.sk</span></td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="background:${contact.bg};border-left:4px solid ${contact.border};padding:12px 20px;color:${contact.color};font-size:14px;font-weight:700;">${contact.banner}</td></tr>
        <tr><td style="background:#ffffff;padding:24px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            ${rows.map(([label, value]) => `
              <tr>
                <td style="padding:8px 14px 8px 0;width:120px;color:#8A8880;font-size:13px;vertical-align:top;">${escapeHtml(label)}:</td>
                <td style="padding:8px 0;color:#0F1F3D;font-size:14px;font-weight:600;vertical-align:top;">${value}</td>
              </tr>`).join('')}
          </table>
        </td></tr>
        <tr><td style="background:#F8F7F4;padding:20px 28px;text-align:center;">
          <a href="${adminUrl}" style="display:inline-block;background:#E8541A;color:#ffffff;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:700;text-decoration:none;">Otvoriť v admin →</a>
          <div style="margin-top:10px;font-size:11px;color:#8A8880;">alebo prejdi na: ${escapeHtml(siteUrl())}/admin/</div>
        </td></tr>
        <tr><td style="background:#0F1F3D;padding:16px 28px;text-align:center;color:rgba(255,255,255,0.4);font-size:11px;">ASTANA admin systém · likvidacia-eternitu.sk</td></tr>
      </table>
    </td></tr>
  </table>`;
}

function adminLeadEmailText(lead: Lead, businessJobId?: string, fileCount = 0) {
  return [
    'Nový dopyt z likvidacia-eternitu.sk',
    '',
    `Meno: ${lead.fullName}`,
    `Telefón: ${lead.phone}`,
    `Email: ${lead.email}`,
    `Lokalita: ${lead.city}`,
    `Okres: ${lead.district || '—'}`,
    `Výmera: ${lead.areaEstimate} m²`,
    `Materiál: ${lead.materialType}`,
    `Objekt: ${lead.objectType}`,
    `Kontakt: ${lead.preferredContact || 'Zavolajte mi'}`,
    `Termín: ${lead.term || '—'}`,
    `Poznámka: ${lead.note || '—'}`,
    `Fotky: ${fileCount}`,
    '',
    `Admin: ${siteUrl()}/admin/zakazky/${businessJobId || lead.id}/`,
  ].join('\n');
}

export async function sendLeadEmails(lead: Lead, fileCount: number, businessJobId?: string) {
  const client = transporter();
  if (!client) return { sent: false, reason: 'SMTP nie je nastavené.' };
  const adminHtml = adminLeadEmailHtml(lead, businessJobId);
  const customerHtml = customerLeadEmailHtml(lead);

  await client.sendMail({
    from: namedFromHeader('ASTANA systém'),
    to: leadRecipient(),
    replyTo: leadRecipient(),
    subject: `🔔 ${lead.city} | ${lead.areaEstimate}m² | ${lead.fullName} | likvidacia-eternitu.sk`,
    text: adminLeadEmailText(lead, businessJobId, fileCount),
    html: adminHtml,
  });

  await client.sendMail({
    from: namedFromHeader('ASTANA likvidácia azbestu'),
    to: lead.email,
    replyTo: leadRecipient(),
    subject: '✅ Prijali sme váš dopyt | likvidacia-eternitu.sk',
    text: customerLeadEmailText(lead),
    html: customerHtml,
  });

  return { sent: true };
}

export async function sendBusinessQuoteEmail(job: BusinessJob, input: { validUntil: string; pricePerM2: number; totalPrice: number; note?: string }) {
  const client = transporter();
  if (!client) return { sent: false, reason: 'SMTP nie je nastavené.' };
  if (!job.customerEmail) return { sent: false, reason: 'Zákazka nemá email zákazníka.' };

  await client.sendMail({
    from: namedFromHeader('ASTANA likvidácia azbestu'),
    to: job.customerEmail,
    replyTo: leadRecipient(),
    subject: `ASTANA — cenová ponuka pre ${job.location}`,
    text: [
      `Dobrý deň ${job.customerName},`,
      '',
      'na základe vášho dopytu sme pripravili cenovú ponuku:',
      '',
      `Lokalita: ${job.location}`,
      `Výmera: ${job.m2} m²`,
      `Cena za m²: ${euro(input.pricePerM2)}`,
      `Celková cena: ${euro(input.totalPrice)}`,
      `Platnosť ponuky do: ${dateSk(input.validUntil)}`,
      '',
      input.note ? input.note : '',
      input.note ? '' : '',
      'Pre potvrdenie zavolajte: 0905 217 946',
      'alebo odpovedzte na tento email.',
      '',
      'S pozdravom, tím ASTANA',
      'likvidacia-eternitu.sk',
    ].join('\n'),
  });

  return { sent: true };
}

function surname(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : name.trim();
}

export async function sendPriceOfferDocumentEmail(offer: PriceOffer, settings: PriceOfferSettings, pdf: Buffer) {
  const client = transporter();
  if (!client) return { sent: false, reason: 'SMTP nie je nastavené.' };
  if (!offer.email) return { sent: false, reason: 'Ponuka nemá email zákazníka.' };
  const c = settings.company;
  const body = [
    `Dobrý deň p./pani ${surname(offer.contactPerson)},`,
    '',
    'V prílohe Vám zasielame cenovú ponuku na likvidáciu „AZC" krytiny.',
    '',
    'Až by sa Vám naša cenová ponuka pozdávala, alebo by ste mali akékoľvek otázky, neváhajte nás prosím kontaktovať mailom, alebo na tel. čísle 0905 217 946.',
    '',
    'V prípade záujmu nám prosím potvrďte CP mailom vo forme záväznej objednávky v ktorej je potrebné uviesť číslo cenovej ponuky s ktorou súhlasíte a uviesť:',
    `1) adresu kde sa ${offer.objectType} nachádza (ulicu a číslo, prípadne aj parcelu)`,
    '2) uviesť kto je objednávateľ a adresu objednávateľa',
    `3) uviesť, kto je vlastníkom ${offer.objectType} + jeho adresu`,
    '4) po prípade nám zašlite foto situácie',
    '',
    'Po ukončení likvidácie, Vám zašleme všetky potrebné dokumenty, ktoré bude nutné predložiť pri prípadnej kontrole zo strany úradov (OÚ ŽP, a RUVZ):',
    '- kópiu rozhodnutia z Okresného úradu životného prostredia',
    '- kópiu rozhodnutia z Regionálneho úradu verejného zdravotníctva',
    '- originál Sprievodný list nebezpečných odpadov s potvrdením zo skládky nebezpečných odpadov',
    '- kópia vážny lístok',
    '- potvrdenie o tom, že azbest zlikvidovala firma ASTANA, s.r.o.',
    '',
    'S pozdravom a prianím pekného dňa',
    settings.preparedByName,
    `tel.: ${settings.preparedByPhone}`,
    '',
    '- - - - - - - - - - - - - - - - - - -',
    c.name,
    `${c.street} ${c.city} ${c.postalCode}`,
    'Tel.: +421 905 217 946',
    `E-mail: ${c.email}`,
    `Web: ${c.mainWeb}`,
    `IČO: ${c.ico}`,
    'DIČ: 202 325 3771',
    `IČ DPH: ${c.icDph}`,
  ].join('\n');

  try {
    await client.sendMail({
    from: namedFromHeader('ASTANA likvidácia azbestu'),
    to: offer.email,
    cc: c.email,
    replyTo: c.email,
    subject: `Cenová ponuka č. ${offer.number} — ASTANA likvidácia azbestu`,
    text: body,
    attachments: [{ filename: `ASTANA-CP-${offer.number}.pdf`, content: pdf, contentType: 'application/pdf' }],
    });
  } catch (error) {
    return { sent: false, reason: mailErrorMessage(error) };
  }

  return { sent: true };
}

export type RooferRegistrationEmail = {
  fullName: string;
  companyName?: string;
  phone: string;
  email: string;
  regions: string[];
  jobTypes: string[];
  message?: string;
};

export async function sendRooferRegistrationEmail(input: RooferRegistrationEmail) {
  const client = transporter();
  if (!client) return { sent: false, reason: 'SMTP nie je nastavené.' };

  const adminText = [
    'Prišla nová registrácia strechára z webu likvidacia-eternitu.sk.',
    '',
    `Meno: ${input.fullName}`,
    `Firma / živnosť: ${input.companyName || 'neuvedené'}`,
    `Telefón: ${input.phone}`,
    `Email: ${input.email}`,
    `Regióny: ${input.regions.join(', ')}`,
    `Typ zákaziek: ${input.jobTypes.length ? input.jobTypes.join(', ') : 'neuvedené'}`,
    '',
    `Poznámka: ${input.message || 'bez poznámky'}`,
  ].join('\n');

  await client.sendMail({
    from: namedFromHeader('ASTANA systém'),
    to: leadRecipient(),
    replyTo: input.email,
    subject: `[STRECHÁR] Nová registrácia — ${input.fullName}`,
    text: adminText,
  });

  await client.sendMail({
    from: namedFromHeader('ASTANA likvidácia azbestu'),
    to: input.email,
    replyTo: leadRecipient(),
    subject: 'Prijali sme vašu registráciu — ASTANA',
    text: [
      `Dobrý deň, ${input.fullName},`,
      '',
      'Ďakujeme za registráciu do siete ASTANA. Ozveme sa vám do 48 hodín na zadané telefónne číslo a prejdeme si možnosti spolupráce.',
      '',
      'ASTANA, s.r.o.',
      '0905 217 946',
      'astana@astana.sk',
    ].join('\n'),
  });

  return { sent: true };
}
