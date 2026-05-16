import nodemailer from 'nodemailer';
import type { Lead } from './types';

function mailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.MAIL_FROM && process.env.LEAD_TO_EMAIL);
}

function transporter() {
  if (!mailConfigured()) return null;
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

export async function sendLeadEmails(lead: Lead, fileCount: number) {
  const client = transporter();
  if (!client) return { sent: false, reason: 'SMTP nie je nastavené.' };

  const adminText = [
    'Prišiel nový dopyt z webu likvidacia-eternitu.sk.',
    '',
    `Meno: ${lead.fullName}`,
    `Telefón: ${lead.phone}`,
    `Email: ${lead.email}`,
    `Lokalita: ${lead.city}${lead.district ? `, okres ${lead.district}` : ''}`,
    `Typ objektu: ${lead.objectType}`,
    `Materiál: ${lead.materialType}`,
    `Výmera: ${lead.areaEstimate} m²`,
    `Strechár: ${lead.roofer || 'neuvedené'}`,
    `Termín: ${lead.term || 'neuvedené'}`,
    `Fotky: ${fileCount}`,
    '',
    `Poznámka: ${lead.note || 'bez poznámky'}`,
    '',
    `Detail v adminovi: ${process.env.NEXT_PUBLIC_SITE_URL || 'https://likvidacia-eternitu.sk'}/admin/dopyty/${lead.id}`,
  ].join('\n');

  await client.sendMail({
    from: process.env.MAIL_FROM,
    to: process.env.LEAD_TO_EMAIL,
    subject: `Nový dopyt ASTANA – ${lead.city}`,
    text: adminText,
  });

  await client.sendMail({
    from: process.env.MAIL_FROM,
    to: lead.email,
    subject: 'Prijali sme váš dopyt – ASTANA',
    text: [
      `Dobrý deň, ${lead.fullName},`,
      '',
      'ďakujeme za dopyt. Prijali sme vaše údaje k cenovej ponuke na likvidáciu azbestu / eternitu. Výmera v m² je základom nacenenia, fotky nám pomôžu spresniť prístup a náročnosť.',
      'Po potvrdení objednávky pripravíme potrebné podklady a podania ku konkrétnej stavbe. Práce sa plánujú až po zákonnom postupe a vybavení potrebnej dokumentácie.',
      'Ozveme sa vám s ďalším postupom.',
      '',
      'ASTANA, s.r.o.',
      '0905 217 946',
      'astana@astana.sk',
    ].join('\n'),
  });

  return { sent: true };
}
