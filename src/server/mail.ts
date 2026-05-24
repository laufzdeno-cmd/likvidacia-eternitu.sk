import nodemailer from 'nodemailer';
import type { BusinessJob, Lead, PriceOffer, PriceOfferSettings } from './types';

const siteUrl = () => process.env.ADMIN_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://likvidacia-eternitu.sk';
const leadRecipient = () => process.env.LEAD_TO_EMAIL || 'astana@astana.sk';
const fromEmail = () => process.env.FROM_EMAIL || process.env.MAIL_FROM || 'astana@astana.sk';

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

export async function sendLeadEmails(lead: Lead, fileCount: number, businessJobId?: string) {
  const client = transporter();
  if (!client) return { sent: false, reason: 'SMTP nie je nastavené.' };

  const adminText = [
    'Prišiel nový dopyt z webu likvidacia-eternitu.sk.',
    '',
    `Meno: ${lead.fullName}`,
    `Telefón: ${lead.phone}`,
    `Email: ${lead.email}`,
    `Lokalita: ${lead.city}${lead.district ? `, okres ${lead.district}` : ''}`,
    `m²: ${lead.areaEstimate}`,
    `Typ materiálu: ${lead.materialType}`,
    `Typ objektu: ${lead.objectType}`,
    `Termín: ${lead.term || 'neuvedené'}`,
    `Správa: ${lead.note || 'bez správy'}`,
    `Fotky: ${fileCount}`,
    '',
    `Odkaz do adminu: ${siteUrl()}/admin/zakazky/${businessJobId || lead.id}/`,
    `Pôvodný dopyt: ${siteUrl()}/admin/dopyty/${lead.id}/`,
  ].join('\n');

  await client.sendMail({
    from: fromEmail(),
    to: leadRecipient(),
    replyTo: lead.email,
    subject: `🔔 Nový dopyt — ${lead.fullName} ${lead.city} ${lead.areaEstimate}m²`,
    text: adminText,
  });

  await client.sendMail({
    from: fromEmail(),
    to: lead.email,
    replyTo: leadRecipient(),
    subject: 'ASTANA — potvrdenie prijatia dopytu',
    text: [
      `Dobrý deň ${lead.fullName},`,
      '',
      `váš dopyt sme prijali a ozveme sa vám do 24 hodín na číslo ${lead.phone}.`,
      '',
      'Súhrn vášho dopytu:',
      `Lokalita: ${lead.city} | Výmera: ${lead.areaEstimate}m² | Materiál: ${lead.materialType}`,
      '',
      'V prípade otázok volajte: 0905 217 946',
      '',
      'S pozdravom, tím ASTANA',
    ].join('\n'),
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
