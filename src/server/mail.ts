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
                  <div style="margin-top:6px;color:rgba(255,255,255,0.75);font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">likvidácia azbestu a eternitu</div>
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
              <a href="mailto:astana@astana.sk" style="display:block;margin-top:8px;color:#E8541A;font-size:13px;text-decoration:none;">✉ astana@astana.sk</a>
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
      <td style="padding:7px 12px 7px 0;color:#8A8880;font-size:13px;vertical-align:top;width:42%;">${label}</td>
      <td style="padding:7px 0;color:#0F1F3D;font-size:14px;font-weight:700;vertical-align:top;">${value}</td>
    </tr>`;
}

function calcRow(label: string, value: string, bold = false) {
  return `
    <tr>
      <td style="padding:9px 0;border-bottom:1px solid #F1F0EC;color:#4A4845;font-size:14px;${bold ? 'font-weight:700;' : ''}">${label}</td>
      <td align="right" style="padding:9px 0;border-bottom:1px solid #F1F0EC;color:#0F1F3D;font-size:14px;font-weight:700;">${value}</td>
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
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0;padding:0;background:#F8F7F4;font-family:Arial,sans-serif;">
    <tr><td style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" align="center" style="width:100%;max-width:600px;margin:0 auto;border-collapse:collapse;background:#ffffff;">
        <tr><td style="background:#0F1F3D;padding:28px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:middle;">
              <div style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.4px;">ASTANA</div>
              <div style="margin-top:6px;color:rgba(255,255,255,0.5);font-size:11px;text-transform:uppercase;letter-spacing:0.1em;">likvidácia azbestu a eternitu</div>
            </td>
            <td align="right" style="vertical-align:middle;">
              <div style="color:#E8541A;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;">Cenová ponuka</div>
              <div style="margin-top:4px;color:#ffffff;font-size:20px;font-weight:700;">č. ${escapeHtml(offer.number)}</div>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="background:linear-gradient(135deg,#E8541A 0%,#C93F08 100%);padding:24px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:middle;">
              <div style="color:#ffffff;font-size:20px;font-weight:700;">Vaša cenová ponuka je pripravená</div>
              <div style="margin-top:4px;color:rgba(255,255,255,0.8);font-size:13px;">Platná do: ${escapeHtml(validUntil)}</div>
            </td>
            <td align="right" style="vertical-align:middle;">
              <div style="color:#ffffff;font-size:28px;font-weight:700;">${euro(offer.totalWithVat)}</div>
              <div style="color:rgba(255,255,255,0.7);font-size:11px;">vrátane DPH ${settings.vatRate}%</div>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="background:#FEF9C3;border-left:4px solid #E8541A;padding:14px 20px;color:#713F12;font-size:13px;line-height:1.6;">
          📎 Cenovú ponuku nájdete v prílohe tohto emailu ako súbor PDF. Vytlačte ju, podpíšte a pošlite nám späť — alebo nám jednoducho odpovedzte na tento email.
        </td></tr>
        <tr><td style="background:#ffffff;padding:28px 32px;">
          <p style="margin:0 0 12px;font-size:17px;font-weight:600;color:#0F1F3D;">Dobrý deň p. ${escapeHtml(surname(offer.contactPerson))},</p>
          <p style="margin:0 0 24px;font-size:15px;color:#4A4845;line-height:1.8;">na základe Vašej požiadavky sme pripravili cenovú ponuku na ekologickú likvidáciu azbestovej krytiny.<br><br>Naša cena je kompletná — zahŕňa dokumentáciu pre RÚVZ a OÚ, demontáž, balenie, odvoz aj všetky správne poplatky. Vy sa o nič nemusíte starať.</p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background:#F8F7F4;border-radius:10px;">
            <tr><td style="padding:20px 24px;">
              <div style="margin-bottom:14px;color:#8A8880;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Súhrn vašej zákazky</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${tableRow('📍 Lokalita', escapeHtml(location))}
                ${tableRow('🏠 Typ objektu', escapeHtml(offer.objectType))}
                ${tableRow('📐 Výmera', `${escapeHtml(offer.areaM2)} m²`)}
                ${tableRow('🏗 Materiál', escapeHtml(material))}
                ${tableRow('📋 Dokumentácia', offer.includeDocumentation ? 'Áno — RÚVZ a OÚ ŽP' : 'Nie')}
                ${tableRow('📅 Termín', escapeHtml(offer.realizationTerm || 'dohodou'))}
              </table>
            </td></tr>
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border:2px solid #E8E6DF;border-radius:10px;">
            <tr><td style="padding:20px 24px;">
              <div style="margin-bottom:14px;color:#8A8880;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Cenová kalkulácia</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${calcRow(`Materiál (${offer.areaM2} m² × ${euro(offer.pricePerM2WithoutVat)}/m²)`, `${euro(offer.materialPriceWithoutVat)} bez DPH`)}
                ${offer.includeDocumentation ? calcRow('Dokumentácia RÚVZ + OÚ', `${euro(offer.documentationFeeWithoutVat)} bez DPH`) : ''}
                ${calcRow('Celkom bez DPH', euro(offer.totalWithoutVat), true)}
                ${calcRow(`DPH ${settings.vatRate}%`, euro(Math.round((offer.totalWithVat - offer.totalWithoutVat) * 100) / 100))}
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;background:#FDE8DC;border-radius:6px;"><tr>
                <td style="padding:10px 14px;color:#0F1F3D;font-size:14px;font-weight:700;">CELKOM S DPH:</td>
                <td align="right" style="padding:10px 14px;color:#E8541A;font-size:22px;font-weight:700;">${euro(offer.totalWithVat)}</td>
              </tr></table>
              <div style="margin-top:12px;color:#8A8880;font-size:12px;line-height:1.5;">Presná cena bude upravená podľa skutočného množstva m² azbestu na mieste.</div>
            </td></tr>
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background:#F8F7F4;border-radius:10px;">
            <tr><td style="padding:20px 24px;">
              <div style="margin-bottom:14px;color:#8A8880;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Čo je zahrnuté v cene</div>
              ${included.map((item) => `<div style="font-size:14px;color:#1C1B19;line-height:1.8;"><span style="color:#E8541A;font-weight:700;">✓</span> ${escapeHtml(item)}</div>`).join('')}
            </td></tr>
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;text-align:center;"><tr>
            ${[
              ['1', 'Potvrďte záujem', 'Odpovedzte na tento email alebo zavolajte'],
              ['2', 'Dohodneme termín', 'Minimálne 30 dní vopred kvôli úradným lehotám'],
              ['3', 'Realizujeme', 'Prídeme, demontujeme, odvezieme a odovzdáme doklady'],
            ].map(([num, title, text]) => `<td width="33.33%" style="padding:16px 12px;vertical-align:top;"><div style="display:inline-block;width:32px;height:32px;border-radius:50%;background:#E8541A;color:#ffffff;font-weight:700;line-height:32px;">${num}</div><div style="margin-top:10px;color:#0F1F3D;font-size:13px;font-weight:700;">${title}</div><div style="margin-top:5px;color:#4A4845;font-size:12px;line-height:1.5;">${text}</div></td>`).join('')}
          </tr></table>

          <div style="margin:24px 0;text-align:center;">
            <a href="mailto:astana@astana.sk?subject=${confirmSubject}" style="display:inline-block;background:linear-gradient(135deg,#E8541A,#C93F08);color:#ffffff;padding:16px 36px;border-radius:8px;font-size:16px;font-weight:700;text-decoration:none;">Mám záujem — potvrdzujem objednávku</a>
            <div style="margin-top:10px;color:#8A8880;font-size:13px;">alebo zavolajte: 0905 217 946</div>
          </div>

          <div style="margin-bottom:20px;background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:14px 18px;color:#92400E;font-size:13px;line-height:1.6;">⚠ Pre začatie prác je potrebné potvrdiť objednávku min. 30 dní vopred. RÚVZ a OÚ majú zákonnú mesačnú lehotu na vydanie rozhodnutia.</div>
        </td></tr>
        <tr><td style="border-top:2px solid #F1F0EC;padding:20px 32px;">
          <div style="font-size:14px;color:#4A4845;">S pozdravom a prianím pekného dňa</div>
          <div style="margin-top:8px;font-size:16px;font-weight:700;color:#0F1F3D;">${escapeHtml(settings.preparedByName)}</div>
          <div style="margin-top:4px;color:#E8541A;font-size:14px;">tel.: ${escapeHtml(settings.preparedByPhone)}</div>
          <div style="border-top:1px solid #E8E6DF;margin:16px 0;"></div>
          <div style="font-weight:600;color:#0F1F3D;font-size:13px;">${escapeHtml(settings.company.name)}</div>
          <div style="font-size:12px;color:#8A8880;line-height:1.6;">${escapeHtml(settings.company.street)}, ${escapeHtml(settings.company.city)} ${escapeHtml(settings.company.postalCode)}<br>Tel.: +421 905 217 946<br>E-mail: ${escapeHtml(settings.company.email)}<br>Web: ${escapeHtml(settings.company.mainWeb)} | likvidacia-eternitu.sk<br>IČO: ${escapeHtml(settings.company.ico)} | DIČ: ${escapeHtml(settings.company.dic)} | IČ DPH: ${escapeHtml(settings.company.icDph)}</div>
        </td></tr>
        <tr><td style="background:#0F1F3D;padding:16px 32px;text-align:center;">
          <div style="color:rgba(255,255,255,0.6);font-size:12px;">Táto cenová ponuka platí do ${escapeHtml(validUntil)}.</div>
          <div style="margin-top:4px;color:rgba(255,255,255,0.4);font-size:11px;">© 2026 ASTANA, s.r.o. · likvidacia-eternitu.sk</div>
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
    `Výmera: ${offer.areaM2} m²`,
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
      from: namedFromHeader(`${settings.preparedByName} — ASTANA`),
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
