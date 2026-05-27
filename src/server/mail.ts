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
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0;padding:0;background:#F7F4EE;font-family:Arial,sans-serif;">
    <tr><td style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" align="center" style="width:100%;max-width:600px;margin:0 auto;border-collapse:collapse;background:#ffffff;">
        <tr>
          <td style="background:linear-gradient(135deg,#263451 0%,#18243B 100%);padding:28px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              <tr>
                <td style="vertical-align:middle;">
                  <div style="color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;line-height:1;">ASTANA</div>
                  <div style="margin-top:6px;color:rgba(255,255,255,0.75);font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">likvidácia azbestu a eternitu</div>
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
                📐 <strong>Výmera:</strong> ${escapeHtml(lead.areaEstimate)} m2<br />
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
              <div style="color:#687284;font-size:12px;">Po–Pia 7:00–18:00</div>
              <a href="mailto:astana@astana.sk" style="display:block;margin-top:8px;color:#B95A32;font-size:13px;text-decoration:none;">✉ astana@astana.sk</a>
            </td></tr>
          </table>
          <div style="margin-top:20px;text-align:center;">
            <div style="font-size:13px;color:#687284;">Viac informácií na</div>
            <a href="https://likvidacia-eternitu.sk" style="display:block;margin-top:4px;color:#C86432;font-size:14px;font-weight:600;text-decoration:none;">likvidacia-eternitu.sk</a>
          </div>
        </td></tr>
        <tr><td style="background:#18243B;padding:20px 32px;text-align:center;color:rgba(255,255,255,0.5);">
          <div style="font-size:11px;color:rgba(255,255,255,0.62);line-height:1.6;">ASTANA, s.r.o. · Scherffelova 1364/28, Poprad 058 01 · IČO: 46 157 701</div>
          <div style="margin-top:4px;font-size:11px;color:rgba(255,255,255,0.42);">© 2026 ASTANA, s.r.o.</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.42);">Email odoslaný z likvidacia-eternitu.sk</div>
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
    `Výmera: ${lead.areaEstimate} m2`,
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
    ['Telefón', `<a href="tel:${escapeHtml(phoneHref)}" style="color:#C86432;font-weight:700;text-decoration:none;font-size:16px;">${escapeHtml(lead.phone)}</a>`],
    ['Email', `<a href="mailto:${escapeHtml(lead.email)}" style="color:#185FA5;text-decoration:none;">${escapeHtml(lead.email)}</a>`],
    ['Lokalita', escapeHtml(lead.city)],
    ['Okres', escapeHtml(lead.district || '—')],
    ['Výmera', `${escapeHtml(lead.areaEstimate)} m2`],
    ['Materiál', escapeHtml(lead.materialType)],
    ['Objekt', escapeHtml(lead.objectType)],
    ['Kontakt', `<span style="display:inline-block;background:${contact.bg};color:${contact.color};border:1px solid ${contact.border};border-radius:999px;padding:4px 10px;font-size:12px;font-weight:700;">${contact.label}</span>`],
    ['Termín', escapeHtml(lead.term || '—')],
    ['Poznámka', escapeHtml(lead.note || '—')],
  ];
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0;padding:0;background:#F7F4EE;font-family:Arial,sans-serif;">
    <tr><td style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" align="center" style="width:100%;max-width:600px;margin:0 auto;border-collapse:collapse;background:#ffffff;">
        <tr><td style="background:linear-gradient(135deg,#263451 0%,#18243B 100%);padding:20px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <tr>
              <td style="color:#ffffff;font-size:20px;font-weight:700;">🔔 Nový dopyt</td>
              <td align="right" style="font-size:12px;color:rgba(255,255,255,0.5);line-height:1.5;">${escapeHtml(leadSubmittedAt(lead))}<br /><span style="color:#C86432;font-size:11px;font-weight:600;">likvidacia-eternitu.sk</span></td>
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
          <a href="${adminUrl}" style="display:inline-block;background:#C86432;color:#ffffff;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:700;text-decoration:none;">Otvoriť v admin →</a>
          <div style="margin-top:10px;font-size:11px;color:#687284;">alebo prejdi na: ${escapeHtml(siteUrl())}/admin/</div>
        </td></tr>
        <tr><td style="background:#18243B;padding:16px 28px;text-align:center;color:rgba(255,255,255,0.5);font-size:11px;">ASTANA admin systém · likvidacia-eternitu.sk</td></tr>
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
    `Výmera: ${lead.areaEstimate} m2`,
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
    subject: `🔔 ${lead.city} | ${lead.areaEstimate}m2 | ${lead.fullName} | likvidacia-eternitu.sk`,
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
      `Výmera: ${job.m2} m2`,
      `Cena za m2: ${euro(input.pricePerM2)}`,
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

export async function sendPlannerNotificationEmail(input: { to: string; subject: string; html: string; text: string; replyTo?: string }) {
  const client = transporter();
  if (!client) return { sent: false, reason: 'SMTP nie je nastavené.' };

  try {
    await client.sendMail({
      from: namedFromHeader('ASTANA plánovač'),
      to: input.to,
      replyTo: input.replyTo || leadRecipient(),
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
  } catch (error) {
    return { sent: false, reason: mailErrorMessage(error) };
  }

  return { sent: true };
}

function surname(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : name.trim();
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

function priceOfferEmailHtml(offer: PriceOffer, settings: PriceOfferSettings) {
  const material = priceOfferMaterialLabel(offer);
  const location = [offer.municipality || offer.objectAddress, offer.district].filter(Boolean).join(', ');
  const validUntil = dateSk(offer.validUntil);
  const confirmSubject = encodeURIComponent(`Potvrdenie objednávky č. ${offer.number}`);
  const included = [
    'Dokumentácia pre RÚVZ a OÚ ŽP',
    'Správne poplatky na úradoch',
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
              <div style="color:#263451;font-size:26px;font-weight:800;letter-spacing:-0.5px;">ASTANA</div>
              <div style="margin-top:6px;color:#94A3B8;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;">likvidácia azbestu a eternitu</div>
            </td>
            <td align="right" style="vertical-align:middle;">
              <div style="color:#94A3B8;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;">Cenová ponuka</div>
              <div style="margin-top:4px;color:#263451;font-size:18px;font-weight:700;">č. ${escapeHtml(offer.number)}</div>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="background:linear-gradient(135deg,#C86432 0%,#A94722 100%);padding:20px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:middle;">
              <div style="color:#ffffff;font-size:17px;font-weight:600;">Vaša cenová ponuka je pripravená</div>
              <div style="margin-top:4px;color:rgba(255,255,255,0.7);font-size:12px;">Platná do: ${escapeHtml(validUntil)}</div>
            </td>
            <td align="right" style="vertical-align:middle;">
              <div style="color:#FFF2C4;font-size:26px;font-weight:700;">${euro(offer.totalWithVat)}</div>
              <div style="color:rgba(255,255,255,0.6);font-size:11px;">vrátane DPH ${settings.vatRate}%</div>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:16px 32px 0;background:#ffffff;">
          <div style="background:#FFFBEB;border:1px solid #FDE68A;border-left:3px solid #D4B56A;border-radius:6px;padding:12px 16px;color:#92400E;font-size:13px;line-height:1.6;">
            📎 Cenovú ponuku nájdete v prílohe tohto emailu ako súbor PDF. Vytlačte ju, podpíšte a pošlite nám späť — alebo nám jednoducho odpovedzte na tento email.
          </div>
        </td></tr>
        <tr><td style="background:#ffffff;padding:24px 32px;">
          <p style="margin:0 0 12px;font-size:16px;font-weight:600;color:#1E293B;">Dobrý deň p./pani ${escapeHtml(surname(offer.contactPerson))},</p>
          <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.7;">na základe Vašej požiadavky sme pripravili cenovú ponuku na ekologickú likvidáciu azbestovej krytiny.<br><br>Naša cena je kompletná — zahŕňa dokumentáciu pre RÚVZ a OÚ, demontáž, balenie, odvoz aj všetky správne poplatky. Vy sa o nič nemusíte starať.</p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;background:#FAFAFA;border:1px solid #D7DDEA;border-left:3px solid #263451;border-radius:6px;">
            <tr><td style="padding:16px 20px;">
              <div style="margin-bottom:12px;color:#94A3B8;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Súhrn vašej zákazky</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${tableRow('📍 Lokalita', escapeHtml(location))}
                ${tableRow('🏠 Typ objektu', escapeHtml(offer.objectType))}
                ${tableRow('📐 Výmera', `${escapeHtml(offer.areaM2)} m2`)}
                ${tableRow('🏗 Materiál', escapeHtml(material))}
                ${tableRow('📋 Dokumentácia', offer.includeDocumentation ? 'Áno — RÚVZ a OÚ ŽP' : 'Nie')}
                ${tableRow('📅 Termín', escapeHtml(offer.realizationTerm || 'dohodou'))}
              </table>
            </td></tr>
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;background:#ffffff;border:1px solid #E2E8F0;border-radius:8px;">
            <tr><td style="padding:16px 20px;">
              <div style="margin-bottom:12px;color:#94A3B8;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Cenová kalkulácia</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${calcRow(`Materiál (${offer.areaM2} m2 × ${euro(offer.pricePerM2WithoutVat)}/m2)`, `${euro(offer.materialPriceWithoutVat)} bez DPH`)}
                ${offer.includeDocumentation ? calcRow('Dokumentácia RÚVZ + OÚ', `${euro(offer.documentationFeeWithoutVat)} bez DPH`) : ''}
                ${calcRow('Celkom bez DPH', euro(offer.totalWithoutVat), true)}
                ${calcRow(`DPH ${settings.vatRate}%`, euro(Math.round((offer.totalWithVat - offer.totalWithoutVat) * 100) / 100))}
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
              ['2', 'Dohodneme termín', 'Minimálne 30 dní vopred kvôli úradným lehotám'],
              ['3', 'Realizujeme', 'Prídeme, demontujeme, odvezieme a odovzdáme doklady'],
            ].map(([num, title, text]) => `<td width="33.33%" style="padding:14px 10px;vertical-align:top;"><div style="display:inline-block;width:32px;height:32px;border-radius:50%;background:#263451;color:#ffffff;font-weight:700;line-height:32px;">${num}</div><div style="margin-top:10px;color:#1E293B;font-size:13px;font-weight:700;">${title}</div><div style="margin-top:5px;color:#64748B;font-size:12px;line-height:1.5;">${text}</div></td>`).join('')}
          </tr></table>

          <div style="margin:24px 0;text-align:center;">
            <a href="mailto:astana@astana.sk?subject=${confirmSubject}" style="display:inline-block;background:linear-gradient(135deg,#C86432 0%,#A94722 100%);color:#ffffff;padding:16px 36px;border-radius:8px;font-size:16px;font-weight:700;text-decoration:none;">Mám záujem — potvrdzujem objednávku</a>
            <div style="margin-top:10px;color:#687284;font-size:13px;">alebo zavolajte: 0905 217 946</div>
          </div>

          <div style="margin-bottom:20px;background:#FFFBEB;border-left:3px solid #D4B56A;border-radius:6px;padding:14px 18px;color:#92400E;font-size:13px;line-height:1.6;">⚠ Pre začatie prác je potrebné potvrdiť objednávku min. 30 dní vopred. RÚVZ a OÚ majú zákonnú mesačnú lehotu na vydanie rozhodnutia.</div>
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
          <div style="color:#94A3B8;font-size:11px;">Táto cenová ponuka platí do ${escapeHtml(validUntil)}. · ${escapeHtml(settings.company.name)} · ${escapeHtml(settings.company.street)}, ${escapeHtml(settings.company.city)} ${escapeHtml(settings.company.postalCode)}</div>
          <div style="margin-top:4px;color:#94A3B8;font-size:11px;">© 2026 ASTANA, s.r.o. · <span style="color:#263451;">likvidacia-eternitu.sk</span></div>
        </td></tr>
      </table>
    </td></tr>
  </table>`;
}

function priceOfferEmailText(offer: PriceOffer, settings: PriceOfferSettings) {
  const material = priceOfferMaterialLabel(offer);
  const location = [offer.municipality || offer.objectAddress, offer.district].filter(Boolean).join(', ');
  return [
    `Dobrý deň p. ${surname(offer.contactPerson)},`,
    '',
    `v prílohe posielame cenovú ponuku č. ${offer.number} na ekologickú likvidáciu azbestovej krytiny.`,
    '',
    `Lokalita: ${location}`,
    `Typ objektu: ${offer.objectType}`,
    `Výmera: ${offer.areaM2} m2`,
    `Materiál: ${material}`,
    `Celkom s DPH: ${euro(offer.totalWithVat)}`,
    `Platná do: ${dateSk(offer.validUntil)}`,
    '',
    'Naša cena je kompletná: dokumentácia, demontáž, balenie, odvoz aj správne poplatky.',
    '',
    `Pre potvrdenie odpovedzte na tento email alebo volajte 0905 217 946. Vyhotovil: ${settings.preparedByName}, tel.: ${settings.preparedByPhone}.`,
    '',
    'ASTANA, s.r.o.',
    'likvidacia-eternitu.sk',
  ].join('\n');
}

export async function sendPriceOfferDocumentEmail(offer: PriceOffer, settings: PriceOfferSettings, pdf: Buffer) {
  const client = transporter();
  if (!client) return { sent: false, reason: 'SMTP nie je nastavené.' };
  if (!offer.email) return { sent: false, reason: 'Ponuka nemá email zákazníka.' };
  const c = settings.company;
  const location = offer.municipality || offer.objectAddress || offer.district;

  try {
    await client.sendMail({
      from: namedFromHeader('ASTANA s.r.o. - likvidácia azbestu'),
      to: offer.email,
      cc: c.email,
      replyTo: c.email,
      subject: `Cenová ponuka č. ${offer.number} — ASTANA likvidácia azbestu | ${location}`,
      text: priceOfferEmailText(offer, settings),
      html: priceOfferEmailHtml(offer, settings),
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
