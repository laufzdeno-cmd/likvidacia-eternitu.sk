import nodemailer from 'nodemailer';
import type { BusinessJob, Lead } from './types';

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || 'https://likvidacia-eternitu.sk';
const leadRecipient = () => process.env.LEAD_TO_EMAIL || 'astana@astana.sk';

function mailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.MAIL_FROM && process.env.LEAD_TO_EMAIL);
}

function assertAstanaSender() {
  const from = process.env.MAIL_FROM || '';
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
    from: process.env.MAIL_FROM,
    to: leadRecipient(),
    replyTo: lead.email,
    subject: `🔔 Nový dopyt — ${lead.fullName} ${lead.city} ${lead.areaEstimate}m²`,
    text: adminText,
  });

  await client.sendMail({
    from: process.env.MAIL_FROM,
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
    from: process.env.MAIL_FROM,
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
    from: process.env.MAIL_FROM,
    to: leadRecipient(),
    replyTo: input.email,
    subject: `[STRECHÁR] Nová registrácia — ${input.fullName}`,
    text: adminText,
  });

  await client.sendMail({
    from: process.env.MAIL_FROM,
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
