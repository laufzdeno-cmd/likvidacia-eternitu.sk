import nodemailer from 'nodemailer';
import type { BusinessJob, Lead, PriceOffer, PriceOfferSettings } from './types';

const siteUrl = () => process.env.ADMIN_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://likvidacia-eternitu.sk';
const leadRecipient = () => process.env.LEAD_TO_EMAIL || 'astana@astana.sk';
const fromEmail = () => process.env.FROM_EMAIL || process.env.MAIL_FROM || 'astana@astana.sk';
const fromHeader = () => {
  const from = fromEmail();
  return from.includes('<') ? from : `ASTANA likvidácia azbestu <${from}>`;
};

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

function stripHtml(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h1|h2|h3|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function customerLeadEmailHtml(lead: Lead) {
  return `
  <div style="margin:0;padding:24px;background:#F8F7F4;font-family:Arial,Helvetica,sans-serif;color:#1C1B19;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;">
      <div style="height:60px;background:#0F1F3D;padding:0 28px;display:flex;align-items:center;">
        <div style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.02em;">ASTANA</div>
      </div>
      <div style="padding:32px;background:#ffffff;">
        <p style="margin:0 0 18px;font-size:16px;color:#1C1B19;">Dobrý deň ${escapeHtml(lead.fullName)},</p>
        <p style="margin:0 0 22px;font-size:15px;color:#4A4845;line-height:1.7;">váš dopyt sme prijali.<br />Cenovú ponuku vám pošleme do 24 hodín.</p>
        <div style="margin:0 0 24px;padding:20px;background:#F8F7F4;border-radius:8px;">
          <p style="margin:0 0 14px;font-size:15px;font-weight:700;color:#0F1F3D;">Súhrn vášho dopytu</p>
          <p style="margin:0 0 8px;font-size:14px;color:#4A4845;">📍 <strong>Lokalita:</strong> ${escapeHtml(lead.city)}</p>
          <p style="margin:0 0 8px;font-size:14px;color:#4A4845;">📐 <strong>Výmera:</strong> ${escapeHtml(lead.areaEstimate)} m²</p>
          <p style="margin:0 0 8px;font-size:14px;color:#4A4845;">🏗 <strong>Materiál:</strong> ${escapeHtml(lead.materialType)}</p>
          <p style="margin:0;font-size:14px;color:#4A4845;">📞 <strong>Kontakt:</strong> ${escapeHtml(lead.preferredContact || 'Zavolajte mi')}</p>
        </div>
        <p style="margin:0 0 10px;font-size:14px;color:#8A8880;">V prípade otázok nás kontaktujte:</p>
        <p style="margin:0;color:#0F1F3D;font-size:16px;font-weight:600;">📞 0905 217 946</p>
        <p style="margin:4px 0 14px;color:#8A8880;font-size:13px;">Po–Pia 7:00–18:00</p>
        <p style="margin:0;color:#E8541A;font-size:14px;">✉ astana@astana.sk</p>
      </div>
      <div style="padding:20px;background:#0F1F3D;color:rgba(255,255,255,0.6);font-size:12px;line-height:1.6;">
        <p style="margin:0 0 10px;">ASTANA, s.r.o.<br />Scherffelova 1364/28, Poprad<br />IČO: 46 157 701</p>
        <p style="margin:0 0 10px;">Tento email bol odoslaný automaticky. Neodpovedajte naňho.</p>
        <p style="margin:0;">© 2026 ASTANA, s.r.o.<br />likvidacia-eternitu.sk</p>
      </div>
    </div>
  </div>`;
}

function adminLeadEmailHtml(lead: Lead, businessJobId?: string) {
  const adminUrl = `${siteUrl()}/admin/zakazky/${businessJobId || lead.id}/`;
  const rows: Array<[string, string | number]> = [
    ['Meno', lead.fullName],
    ['Telefón', lead.phone],
    ['Email', lead.email],
    ['Lokalita', lead.city],
    ['Okres', lead.district || 'neuvedené'],
    ['Výmera', `${lead.areaEstimate} m²`],
    ['Materiál', lead.materialType],
    ['Objekt', lead.objectType],
    ['Kontakt', lead.preferredContact || 'Zavolajte mi'],
    ['Termín', lead.term || 'neuvedené'],
    ['Poznámka', lead.note || 'bez poznámky'],
  ];
  return `
  <div style="margin:0;padding:24px;background:#F8F7F4;font-family:Arial,Helvetica,sans-serif;color:#1C1B19;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;">
      <div style="background:#0F1F3D;padding:20px 24px;color:#ffffff;font-size:20px;font-weight:700;">🔔 Nový dopyt</div>
      <div style="padding:24px;background:#ffffff;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          ${rows.map(([label, value]) => `
            <tr>
              <td style="padding:8px 10px 8px 0;width:120px;color:#0F1F3D;font-weight:700;font-size:14px;vertical-align:top;">${escapeHtml(label)}:</td>
              <td style="padding:8px 0;color:#4A4845;font-size:14px;vertical-align:top;">${escapeHtml(value)}</td>
            </tr>`).join('')}
        </table>
        <p style="margin:22px 0 0;">
          <a href="${adminUrl}" style="display:inline-block;background:#E8541A;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">Otvoriť v admin →</a>
        </p>
      </div>
      <div style="padding:16px 24px;background:#0F1F3D;color:rgba(255,255,255,0.65);font-size:12px;">ASTANA admin systém</div>
    </div>
  </div>`;
}

export async function sendLeadEmails(lead: Lead, fileCount: number, businessJobId?: string) {
  const client = transporter();
  if (!client) return { sent: false, reason: 'SMTP nie je nastavené.' };
  const adminHtml = adminLeadEmailHtml(lead, businessJobId);
  const customerHtml = customerLeadEmailHtml(lead);

  await client.sendMail({
    from: fromHeader(),
    to: leadRecipient(),
    replyTo: leadRecipient(),
    subject: `Nový dopyt — ${lead.fullName} ${lead.city} ${lead.areaEstimate}m²`,
    text: `${stripHtml(adminHtml)}\n\nFotky: ${fileCount}\nPôvodný dopyt: ${siteUrl()}/admin/dopyty/${lead.id}/`,
    html: adminHtml,
  });

  await client.sendMail({
    from: fromHeader(),
    to: lead.email,
    replyTo: leadRecipient(),
    subject: 'Prijali sme váš dopyt — ASTANA',
    text: stripHtml(customerHtml),
    html: customerHtml,
  });

  return { sent: true };
}

export async function sendBusinessQuoteEmail(job: BusinessJob, input: { validUntil: string; pricePerM2: number; totalPrice: number; note?: string }) {
  const client = transporter();
  if (!client) return { sent: false, reason: 'SMTP nie je nastavené.' };
  if (!job.customerEmail) return { sent: false, reason: 'Zákazka nemá email zákazníka.' };

  await client.sendMail({
    from: fromEmail(),
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

  await client.sendMail({
    from: fromEmail(),
    to: offer.email,
    cc: c.email,
    replyTo: c.email,
    subject: `Cenová ponuka č. ${offer.number} — ASTANA likvidácia azbestu`,
    text: body,
    attachments: [{ filename: `ASTANA-CP-${offer.number}.pdf`, content: pdf, contentType: 'application/pdf' }],
  });

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
    from: fromEmail(),
    to: leadRecipient(),
    replyTo: input.email,
    subject: `[STRECHÁR] Nová registrácia — ${input.fullName}`,
    text: adminText,
  });

  await client.sendMail({
    from: fromEmail(),
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
