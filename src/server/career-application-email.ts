import { cleanSlovakText } from './slovak-text';
import type { ApplicationNotificationRecipient, CareerApplication } from './types';

const logoUrl = 'https://likvidacia-eternitu.sk/assets/astana-logo-dark.png';

function safeText(value: string | number | boolean | undefined) {
  return cleanSlovakText(String(value ?? ''));
}

function html(value: string | number | boolean | undefined) {
  return safeText(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function submittedAt(value: string) {
  return new Intl.DateTimeFormat('sk-SK', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Bratislava',
  }).format(new Date(value));
}

function yesNo(value: boolean) {
  return value ? 'Áno' : 'Nie';
}

function cooperation(value: CareerApplication['cooperationType']) {
  if (value === 'szco') return 'Živnostník (SZČO)';
  if (value === 'crew') return 'Pracovná partia';
  return 'Iná forma spolupráce';
}

function shell(content: string, preheader: string) {
  return `<!doctype html>
<html lang="sk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F6F3ED;font-family:Arial,sans-serif;color:#263451;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${html(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;margin:0;background:#F6F3ED;">
    <tr><td style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" align="center" style="width:100%;max-width:600px;margin:0 auto;border-collapse:collapse;background:#FFFFFF;border:1px solid #E7E1D7;border-radius:14px;overflow:hidden;">
        <tr><td style="padding:22px 28px;background:#263451;color:#FFFFFF;">
          <img src="${logoUrl}" width="170" alt="ASTANA, s.r.o." style="display:block;width:170px;max-width:100%;height:auto;border:0;">
          <div style="margin-top:9px;color:#FFFFFF;font-size:18px;font-weight:700;line-height:1.25;">ASTANA, s.r.o.</div>
          <div style="margin-top:3px;color:#DCE5F2;font-size:11px;letter-spacing:.08em;text-transform:uppercase;">odborná likvidácia azbestu a eternitu</div>
        </td></tr>
        ${content}
        <tr><td style="padding:18px 28px;background:#F8FAFC;border-top:1px solid #E2E8F0;text-align:center;color:#64748B;font-size:11px;line-height:1.6;">
          ASTANA, s.r.o. · likvidacia-eternitu.sk<br>
          Táto správa bola vytvorená bezpečným firemným systémom ASTANA.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function applicantContent(application: CareerApplication) {
  const content = `
    <tr><td style="padding:14px 28px;background:#ECFDF3;border-left:4px solid #2F855A;color:#166534;font-size:14px;font-weight:700;">✓ Žiadosť o spoluprácu sme prijali</td></tr>
    <tr><td style="padding:30px 28px;background:#FFFFFF;color:#263451;">
      <h1 style="margin:0 0 18px;color:#263451;font-size:24px;line-height:1.25;">Ďakujeme, ${html(application.fullName)}</h1>
      <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.7;">Vašu žiadosť o spoluprácu s ASTANA sme bezpečne prijali. Náš tím ju skontroluje spolu s uvedenými skúsenosťami a dostupnosťou.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0;border-collapse:collapse;background:#F7F4EE;border-left:4px solid #C86432;border-radius:0 9px 9px 0;">
        <tr><td style="padding:17px 20px;color:#263451;font-size:14px;line-height:1.7;">
          <strong>Čo bude nasledovať?</strong><br>
          Ak váš profil zodpovedá aktuálnej potrebe, ozveme sa vám telefonicky alebo emailom a dohodneme ďalší postup.
        </td></tr>
      </table>
      <p style="margin:0;color:#475569;font-size:14px;line-height:1.7;"><strong>Prosíme, nevolajte kvôli overeniu prijatia.</strong> Žiadosť je zaevidovaná a tím ju uvidí v pracovnej fronte.</p>
      <p style="margin:22px 0 0;color:#64748B;font-size:12px;line-height:1.6;">Prijaté: ${html(submittedAt(application.createdAt))} · Forma spolupráce: ${html(cooperation(application.cooperationType))}</p>
    </td></tr>`;
  return {
    fromName: 'ASTANA kariéra',
    subject: '✅ ASTANA prijala vašu žiadosť o spoluprácu',
    html: shell(content, 'Vaša žiadosť o spoluprácu bola bezpečne prijatá.'),
    text: [
      'ASTANA, s.r.o. – potvrdenie kariérnej žiadosti',
      '',
      `Dobrý deň ${safeText(application.fullName)},`,
      '',
      'vašu žiadosť o spoluprácu sme bezpečne prijali.',
      'Ak váš profil zodpovedá aktuálnej potrebe, ozveme sa vám telefonicky alebo emailom.',
      '',
      'Prosíme, nevolajte kvôli overeniu prijatia. Žiadosť je zaevidovaná v našej pracovnej fronte.',
      '',
      `Prijaté: ${submittedAt(application.createdAt)}`,
      `Forma spolupráce: ${cooperation(application.cooperationType)}`,
      '',
      'ASTANA, s.r.o. · likvidacia-eternitu.sk',
    ].join('\n'),
  };
}

function internalContent(application: CareerApplication, adminUrl: string) {
  const fields: Array<[string, string]> = [
    ['Meno', html(application.fullName)],
    ['Telefón', `<a href="tel:${html(application.phone.replace(/[^\d+]/g, ''))}" style="color:#B4532A;font-weight:700;text-decoration:none;">${html(application.phone)}</a>`],
    ['Email', `<a href="mailto:${html(application.email)}" style="color:#185FA5;text-decoration:none;">${html(application.email)}</a>`],
    ['Mesto / okres', html(application.city || 'neuvedené')],
    ['Forma spolupráce', html(cooperation(application.cooperationType))],
    ['Kde môže pracovať', html(application.workRegions || 'neuvedené')],
    ['Živnosť', html(yesNo(application.hasTradeLicense))],
    ['Práca vo výške', html(yesNo(application.workAtHeights))],
    ['Skúsenosť s azbestom', html(yesNo(application.hasAsbestosExperience))],
    ['Životopis', html(application.cv ? 'priložený v chránenom admine' : 'nepriložený')],
    ['Ďalšie skúsenosti', html(application.experience || 'bez doplnenia')],
    ['Poznámka', html(application.note || 'bez poznámky')],
  ];
  const content = `
    <tr><td style="padding:14px 28px;background:#FFF7ED;border-left:4px solid #C86432;color:#9A3412;font-size:14px;font-weight:700;">🦺 Nová kariérna žiadosť</td></tr>
    <tr><td style="padding:26px 28px;background:#FFFFFF;color:#263451;">
      <h1 style="margin:0 0 5px;color:#263451;font-size:23px;line-height:1.25;">${html(application.fullName)}</h1>
      <p style="margin:0 0 20px;color:#64748B;font-size:12px;">Prijaté ${html(submittedAt(application.createdAt))}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        ${fields.map(([label, value]) => `<tr><td style="width:145px;padding:8px 12px 8px 0;color:#64748B;font-size:12px;vertical-align:top;">${html(label)}:</td><td style="padding:8px 0;color:#263451;font-size:14px;font-weight:600;vertical-align:top;overflow-wrap:anywhere;">${value}</td></tr>`).join('')}
      </table>
      <div style="margin-top:24px;text-align:center;">
        <a href="${html(adminUrl)}" style="display:inline-block;padding:13px 24px;border-radius:8px;background:#C86432;color:#FFFFFF;font-size:15px;font-weight:700;text-decoration:none;">Otvoriť žiadosť v admine →</a>
      </div>
      <p style="margin:16px 0 0;color:#64748B;font-size:11px;line-height:1.6;text-align:center;">Životopis a osobné údaje zostávajú dostupné iba v chránenom admine.</p>
    </td></tr>`;
  return {
    fromName: 'ASTANA nábor',
    subject: `🦺 ${safeText(application.city || 'Bez lokality')} | ${safeText(application.fullName)} | kariérna žiadosť`,
    html: shell(content, `Nová kariérna žiadosť: ${application.fullName}`),
    text: [
      'Nová kariérna žiadosť z likvidacia-eternitu.sk',
      '',
      `Meno: ${safeText(application.fullName)}`,
      `Telefón: ${safeText(application.phone)}`,
      `Email: ${safeText(application.email)}`,
      `Mesto / okres: ${safeText(application.city || 'neuvedené')}`,
      `Forma spolupráce: ${cooperation(application.cooperationType)}`,
      `Kde môže pracovať: ${safeText(application.workRegions || 'neuvedené')}`,
      `Živnosť: ${yesNo(application.hasTradeLicense)}`,
      `Práca vo výške: ${yesNo(application.workAtHeights)}`,
      `Skúsenosť s azbestom: ${yesNo(application.hasAsbestosExperience)}`,
      `Životopis: ${application.cv ? 'priložený v chránenom admine' : 'nepriložený'}`,
      `Ďalšie skúsenosti: ${safeText(application.experience || 'bez doplnenia')}`,
      `Poznámka: ${safeText(application.note || 'bez poznámky')}`,
      '',
      `Otvoriť žiadosť: ${adminUrl}`,
    ].join('\n'),
  };
}

export function careerApplicationEmailContent(
  application: CareerApplication,
  recipient: ApplicationNotificationRecipient,
  adminUrl: string,
) {
  return recipient === 'applicant'
    ? applicantContent(application)
    : internalContent(application, adminUrl);
}
