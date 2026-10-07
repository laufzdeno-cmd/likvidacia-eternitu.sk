import type { PriceOffer, PriceOfferSettings } from './types';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { calculatePriceOfferPricing, reconcilePriceOfferGrossLines } from '../lib/price-offer-pricing';
import { resolvePriceOfferVatRate } from '../lib/price-offer-vat';

function astanaLogoDataUri() {
  const logo = readFileSync(path.join(process.cwd(), 'public', 'assets', 'astana-logo-print.png'));
  return `data:image/png;base64,${logo.toString('base64')}`;
}

const materialTypeLabels: Record<string, string> = {
  VLNITY_ETERNIT: 'Vlnitý eternit (AZC)',
  HLADKY_ETERNIT: 'Hladký eternit',
  AZBESTOVE_RURY: 'Azbestové rúry',
  PODHLADOVE_DOSKY: 'Podhľadové dosky',
  BOLETICKY: 'Boletické panely',
  INE: 'Iný azbestový materiál',
};

function escapeHtml(value: string | number | undefined | null) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function moneyPdf(value: number, decimals = 2) {
  return new Intl.NumberFormat('sk-SK', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value || 0);
}

function dateSk(value: string | Date) {
  return new Intl.DateTimeFormat('sk-SK', { day: 'numeric', month: 'numeric', year: 'numeric' }).format(new Date(value));
}

function materialLabel(offer: PriceOffer) {
  return materialTypeLabels[offer.materialType] || 'Azbestový materiál';
}

function includedItems(offer: PriceOffer) {
  return [
    ...(offer.includeDocumentation ? [offer.documentationPromotion ? 'Oznámenie plánovaných prác RÚVZ a súvisiace podklady (AKCIA 0,00 €)' : 'Písomné oznámenie plánovaných prác príslušnému RÚVZ a súvisiace podklady', 'Prípadné správne poplatky podľa konkrétneho konania, ak vzniknú'] : []),
    'Vytvorenie ochranného pásma',
    'Stabilizácia penetračným postrekom',
    'Odborná demontáž',
    'Balenie do PE vriec ADR 9',
    'Dekontaminácia pracoviska',
    'Preprava na skládku NO',
    'Poplatok za skládkovanie',
    'Záverečná správa a doklady',
    'Potvrdenie o legálnom zneškodnení',
  ];
}

export function renderPriceOfferPdfHtml(offer: PriceOffer, settings: PriceOfferSettings) {
  const c = settings.company;
  const logo = astanaLogoDataUri();
  const material = materialLabel(offer);
  const vatRate = resolvePriceOfferVatRate(offer, settings.vatRate);
  const pricing = { ...calculatePriceOfferPricing(offer, vatRate), totalWithoutVat: offer.totalWithoutVat, totalWithVat: offer.totalWithVat };
  const grossLines = reconcilePriceOfferGrossLines({
    materialWithoutVat: pricing.materialPriceWithoutVat,
    documentationWithoutVat: pricing.documentationWithoutVat,
    transportWithoutVat: pricing.transportWithoutVat,
    vatRate,
    includeDocumentation: offer.includeDocumentation,
    documentationPromotion: offer.documentationPromotion,
    includeTransport: offer.includeTransport,
    totalWithVat: pricing.totalWithVat,
  });
  const vatValue = offer.totalWithVat - offer.totalWithoutVat;
  const items = includedItems(offer);
  const leftItems = items.slice(0, 6);
  const rightItems = items.slice(6);
  const offerNote = offer.offerNote?.trim() || '';
  const longOfferNote = offerNote.length > 220;
  const transportRoute = offer.includeTransport
    ? `${offer.transportFrom.trim()} – ${offer.transportTo.trim()}`
    : '';
  const longTransportRoute = transportRoute.length > 180;
  const firstPageDensity = [
    offer.objectType,
    offer.objectAddress,
    offer.municipality,
    offer.district,
    offer.contactPerson,
    offer.realizationTerm,
    offer.email,
    longTransportRoute ? '' : transportRoute,
  ].reduce((total, value) => total + String(value || '').length, 0);
  const compactFirstPage = firstPageDensity > 430;

  return `<!doctype html>
<html lang="sk">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <style>
    :root {
      --navy: #263451;
      --plum-light: #EEF2F7;
      --gold: #D4B56A;
      --accent: #B95A32;
      --burgundy: #8F163C;
      --gray: #475569;
      --text: #1E293B;
      --muted: #94A3B8;
      --soft: #FAFAFA;
      --border: #D7DDEA;
      --white: #FFFFFF;
    }
    * { box-sizing: border-box; }
    @page { size: A4; margin: 0; }
    html, body { margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; color: var(--gray); background: white; }
    .page { position: relative; width: 210mm; height: 297mm; min-height: 297mm; background: white; overflow: hidden; break-after: page; page-break-after: always; }
    .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-25deg); z-index: 0; pointer-events: none; color: rgba(107,45,94,0.035); font-size: 130px; font-weight: 800; letter-spacing: 15px; white-space: nowrap; }
    .page-content { position: relative; z-index: 1; height: 297mm; min-height: 297mm; overflow: hidden; }
    .page:last-child { break-after: auto; page-break-after: auto; }
    .top-header { min-height: 92px; padding: 24px 40px 20px; background: var(--white); border-bottom: 3px solid var(--burgundy); color: var(--text); display: table; width: 100%; }
    .top-header-cell { display: table-cell; vertical-align: middle; }
    .brand { color: var(--navy); font-size: 28px; font-weight: 800; letter-spacing: -0.5px; line-height: 1; }
    .brand-logo { display: block; width: 160px; max-height: 58px; object-fit: contain; object-position: left center; }
    .brand-legal { margin-top: 2px; color: var(--text); font-size: 11px; font-weight: 700; }
    .gold-line { width: 58px; height: 3px; margin: 8px 0 7px; background: var(--burgundy); }
    .tagline { color: var(--muted); font-size: 10.67px; letter-spacing: 0.05em; text-transform: uppercase; }
    .header-contact { text-align: right; color: #64748B; font-size: 10.67px; line-height: 1.55; }
    .accent { height: 4px; background: var(--burgundy); }
    .document-title { padding: 28px 40px 20px; display: table; width: 100%; }
    .document-title-left, .document-title-right { display: table-cell; vertical-align: top; }
    .document-title-right { text-align: right; color: var(--muted); font-size: 11px; padding-top: 7px; }
    h1 { margin: 0; color: var(--navy); font-size: 24px; font-weight: 800; letter-spacing: 0.02em; }
    .offer-number { margin-top: 4px; color: var(--accent); font-size: 16px; font-weight: 700; }
    .subtitle { margin-top: 4px; color: var(--muted); font-size: 11px; }
    .info-box { margin: 0 40px 20px; padding: 14px 18px; background: var(--soft); border-left: 4px solid var(--navy); border-radius: 0 6px 6px 0; display: table; width: calc(100% - 80px); }
    .info-col { display: table-cell; width: 50%; vertical-align: top; padding-right: 24px; }
    .field-label { margin: 0 0 5px; color: var(--muted); font-size: 10.67px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
    .field-value { margin: 0 0 11px; color: var(--text); font-size: 12px; font-weight: 600; line-height: 1.45; overflow-wrap: anywhere; }
    .field-email { color: var(--accent); font-size: 12px; font-weight: 600; overflow-wrap: anywhere; }
    .body { padding: 0 40px; }
    .greeting { margin: 0 0 8px; color: var(--text); font-size: 13px; font-weight: 700; }
    .copy { margin: 0 0 16px; color: var(--gray); font-size: 12px; line-height: 1.65; overflow-wrap: anywhere; }
    .price-table { width: 100%; table-layout: fixed; border-collapse: collapse; margin: 0 0 20px; font-size: 12px; }
    .price-table th { background: var(--accent); color: white; text-align: left; padding: 9px 14px; font-size: 10.67px; text-transform: uppercase; letter-spacing: 0.08em; }
    .price-table td { padding: 9px 14px; border-bottom: 1px solid #F1F5F9; color: var(--text); overflow-wrap: anywhere; }
    .price-table tbody tr:nth-child(even) td { background: var(--soft); }
    .price-table .right { text-align: right; white-space: normal; overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
    .price-table .summary td { background: var(--plum-light); color: var(--text); font-weight: 700; border-top: 1px solid var(--border); }
    .price-table .total td { background: var(--accent); color: white; padding: 12px 14px; font-size: 12px; font-weight: 700; border-bottom: 0; }
    .price-table .total .amount { color: #FFF2C4; font-size: 16px; font-weight: 800; }
    .included-wrap { background: var(--soft); border-radius: 8px; padding: 16px 20px; margin: 0 0 16px; }
    .included-title { margin: 0 0 10px; color: var(--navy); font-size: 11px; font-weight: 700; text-transform: uppercase; }
    .included { display: table; width: 100%; margin-top: 4px; }
    .included-col { display: table-cell; width: 50%; vertical-align: top; padding-right: 18px; }
    .included-item { color: var(--gray); font-size: 11px; line-height: 1.8; }
    .checkmark { display: inline-block; width: 6px; height: 10px; margin: 0 8px 0 1px; border-right: 2px solid var(--navy); border-bottom: 2px solid var(--navy); transform: rotate(45deg); vertical-align: 1px; }
    .slim-header { height: 36px; background: var(--navy); color: rgba(255,255,255,0.72); font-size: 10.67px; padding: 0 40px; line-height: 36px; }
    .terms { padding: 24px 40px 0; }
    .section-title { margin: 0 0 12px; color: var(--navy); font-size: 13px; font-weight: 700; text-transform: uppercase; border-bottom: 2px solid var(--navy); padding-bottom: 6px; }
    .terms p { margin: 0 0 13px; color: var(--gray); font-size: 11px; line-height: 1.7; }
    .terms-note { margin: 0 0 14px; padding: 10px 14px; background: var(--soft); border-left: 3px solid var(--gold); border-radius: 0 6px 6px 0; }
    .terms-note strong { display: block; margin-bottom: 5px; color: var(--navy); font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
    .terms-note p { margin: 0; font-size: 10.67px; line-height: 1.45; overflow-wrap: anywhere; }
    .two-boxes { padding: 8px 40px 0; display: table; width: 100%; border-spacing: 0; }
    .box-wrap { display: table-cell; width: 50%; vertical-align: top; }
    .box-wrap:first-child { padding-right: 10px; }
    .box-wrap:last-child { padding-left: 10px; }
    .small-box { border: 1px solid var(--border); border-top: 3px solid var(--navy); border-radius: 6px; background: var(--soft); padding: 14px 18px; min-height: 104px; }
    .small-label { margin: 0 0 7px; color: var(--muted); font-size: 11px; }
    .valid-date { margin: 0 0 8px; color: var(--accent); font-size: 15px; font-weight: 700; }
    .small-text { margin: 0; color: var(--gray); font-size: 11px; line-height: 1.5; }
    .prepared-name { margin: 0 0 5px; color: var(--text); font-size: 13px; font-weight: 700; }
    .prepared-phone { margin: 0; color: var(--navy); font-size: 12px; font-weight: 700; }
    .approval { margin: 24px 40px 0; border: 1.5px solid var(--navy); border-radius: 8px; padding: 16px 20px; background: var(--soft); }
    .approval-main { margin: 0 0 20px; color: var(--gray); font-size: 12px; line-height: 1.6; font-style: italic; }
    .approval-help { margin: 0 0 24px; color: var(--muted); font-size: 11px; line-height: 1.5; }
    .signature-row { display: table; width: 100%; margin-top: 12px; }
    .signature { display: table-cell; width: 50%; padding: 0 18px; text-align: center; }
    .signature-line { border-top: 1.5px solid var(--navy); padding-top: 8px; color: var(--muted); font-size: 10.67px; }
    .footer { position: absolute; left: 0; right: 0; bottom: 0; background: var(--navy); color: rgba(255,255,255,0.72); font-size: 10.67px; line-height: 1.45; text-align: center; padding: 12px 40px; }
    .page--compact .top-header { min-height: 74px; padding-top: 13px; padding-bottom: 10px; }
    .page--compact .brand-logo { width: 142px; max-height: 48px; }
    .page--compact .tagline, .page--compact .header-contact { font-size: 10.67px; line-height: 1.35; }
    .page--compact .document-title { padding-top: 14px; padding-bottom: 9px; }
    .page--compact .document-title h1 { font-size: 21px; }
    .page--compact .info-box { margin-bottom: 8px; padding: 8px 12px; }
    .page--compact .field-label { margin-bottom: 2px; font-size: 10.67px; }
    .page--compact .field-value { margin-bottom: 4px; font-size: 11px; line-height: 1.25; }
    .page--compact .field-email { font-size: 10.67px; }
    .page--compact .greeting { margin-bottom: 4px; font-size: 11px; }
    .page--compact .copy { margin-bottom: 7px; font-size: 10.67px; line-height: 1.35; }
    .page--compact .price-table { margin-bottom: 8px; font-size: 10.67px; }
    .page--compact .price-table th, .page--compact .price-table td { padding: 5px 8px; }
    .page--compact .price-table .total td { padding: 8px 10px; }
    .page--compact .price-table .total .amount { font-size: 14px; }
    .page--compact .included-wrap { padding: 8px 14px; margin-bottom: 6px; }
    .page--compact .included-title { margin-bottom: 4px; font-size: 10.67px; }
    .page--compact .included-item { font-size: 10.67px; line-height: 1.35; }
    .page--terms-note .terms { padding-top: 17px; }
    .page--terms-note .terms p { margin-bottom: 8px; font-size: 10.67px; line-height: 1.5; }
    .page--terms-note .terms-note strong, .page--terms-note .terms-note p { font-size: 10.67px; }
    .page--terms-note .two-boxes { padding-top: 4px; }
    .page--terms-note .approval { margin-top: 16px; }
  </style>
</head>
<body>
  <section class="page${compactFirstPage ? ' page--compact' : ''}">
    <div class="watermark">ASTANA</div>
    <div class="page-content">
    <header class="top-header">
      <div class="top-header-cell">
        <img class="brand-logo" src="${logo}" alt="ASTANA, s.r.o." />
        <div class="brand-legal">ASTANA, s.r.o.</div>
        <div class="gold-line"></div>
        <div class="tagline">likvidácia a odvoz nebezpečného odpadu</div>
      </div>
      <div class="top-header-cell header-contact">
        <strong>${escapeHtml(c.name)}</strong><br>
        ${escapeHtml(c.street)}, ${escapeHtml(c.city)} ${escapeHtml(c.postalCode)}<br>
        tel: ${escapeHtml(c.phone)}<br>
        IČO: ${escapeHtml(c.ico)} | DIČ: ${escapeHtml(c.dic)}<br>
        IČ DPH: ${escapeHtml(c.icDph)}<br>
        ${escapeHtml(c.mainWeb)}
      </div>
    </header>
    <div class="accent"></div>

    <div class="document-title">
      <div class="document-title-left">
        <h1>CENOVÁ PONUKA</h1>
        <div class="offer-number">č. ${escapeHtml(offer.number)}</div>
        <div class="subtitle">na ekologickú likvidáciu AZBESTU</div>
      </div>
      <div class="document-title-right">v Poprade ${dateSk(offer.createdAt)}</div>
    </div>

    <div class="info-box">
      <div class="info-col">
        <p class="field-label">Objekt:</p>
        <p class="field-value">${escapeHtml(offer.objectType)}, ${escapeHtml(offer.objectAddress || offer.municipality)} okres ${escapeHtml(offer.district)}</p>
        <p class="field-label">Kontakt:</p>
        <p class="field-value">${escapeHtml(offer.contactPerson)}, tel.: ${escapeHtml(offer.phone)}<br><span class="field-email">${escapeHtml(offer.email)}</span></p>
      </div>
      <div class="info-col">
        <p class="field-label">Termín realizácie:</p>
        <p class="field-value">${escapeHtml(offer.realizationTerm || 'dohodou')}</p>
      </div>
    </div>

    <main class="body">
      <p class="greeting">Dobrý deň,</p>
      <p class="copy">Na základe Vašej požiadavky Vám zasielame cenovú ponuku na materiál ${escapeHtml(material)} na objekte typu ${escapeHtml(offer.objectType)}. Uvedená výmera je orientačná.</p>
      ${offerNote && !longOfferNote ? `<p class="copy" style="background:#FAFAFA;border-left:3px solid #D4B56A;padding:10px 14px;border-radius:0 6px 6px 0;">${escapeHtml(offerNote)}</p>` : ''}

      <table class="price-table">
        <colgroup><col style="width:38%"><col style="width:20%"><col style="width:21%"><col style="width:21%"></colgroup>
        <thead>
          <tr><th>Položka</th><th>Množstvo</th><th class="right">Cena bez DPH</th><th class="right">Cena s DPH</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>${escapeHtml(material)}</td>
            <td>${escapeHtml(offer.areaM2)} m2</td>
            <td class="right">${moneyPdf(offer.materialPriceWithoutVat)} €</td>
            <td class="right">${moneyPdf(grossLines.materialWithVat)} €</td>
          </tr>
          ${offer.includeDocumentation ? `<tr>
            <td>${offer.documentationPromotion ? 'Dokumentácia — AKCIA 0,00 €' : 'Oznámenie plánovaných prác RÚVZ a súvisiace podklady'}</td>
            <td>1 ks</td>
            <td class="right">${moneyPdf(pricing.documentationWithoutVat)} €</td>
            <td class="right">${moneyPdf(grossLines.documentationWithVat)} €</td>
          </tr>` : ''}
          ${offer.includeTransport ? `<tr><td>Doprava: ${longTransportRoute ? 'trasa je uvedená na druhej strane' : escapeHtml(transportRoute)}</td><td>${moneyPdf(offer.transportRoundTripKm)} km × ${moneyPdf(offer.transportPricePerKm)} €/km</td><td class="right">${moneyPdf(pricing.transportWithoutVat)} €</td><td class="right">${moneyPdf(grossLines.transportWithVat)} €</td></tr>` : ''}
          <tr class="summary"><td colspan="2">Celkom bez DPH:</td><td colspan="2" class="right">${moneyPdf(pricing.totalWithoutVat)} €</td></tr>
          <tr><td colspan="2">DPH ${vatRate}%:</td><td colspan="2" class="right">${moneyPdf(vatValue)} €</td></tr>
          <tr class="total"><td colspan="2">CELKOM S DPH:</td><td colspan="2" class="right amount">${moneyPdf(offer.totalWithVat)} €</td></tr>
        </tbody>
      </table>

      <div class="included-wrap">
        <p class="included-title">V cene je zahrnuté</p>
        <div class="included">
          <div class="included-col">
            ${leftItems.map((item) => `<div class="included-item"><span class="checkmark"></span>${escapeHtml(item)}</div>`).join('')}
          </div>
          <div class="included-col">
            ${rightItems.map((item) => `<div class="included-item"><span class="checkmark"></span>${escapeHtml(item)}</div>`).join('')}
          </div>
        </div>
      </div>
    </main>
    </div>
  </section>

  <section class="page${longOfferNote || longTransportRoute ? ' page--terms-note' : ''}">
    <div class="watermark">ASTANA</div>
    <div class="page-content">
    <div class="slim-header">ASTANA, s.r.o. — Cenová ponuka č. ${escapeHtml(offer.number)} — ${dateSk(offer.createdAt)}</div>
    <main class="terms">
      <h2 class="section-title">Obchodné podmienky</h2>
      ${longOfferNote ? `<div class="terms-note"><strong>Poznámka k cenovej ponuke</strong><p>${escapeHtml(offerNote)}</p></div>` : ''}
      ${longTransportRoute ? `<div class="terms-note"><strong>Účtovaná trasa dopravy</strong><p>${escapeHtml(transportRoute)}</p></div>` : ''}
      <p>Rozsah služieb a jednotlivé účtované položky sú uvedené v cenovej kalkulácii. Uvedená cena vychádza z odhadovanej výmery; pri odlišnom skutočnom množstve sa môže po dohode upraviť.</p>
      <p>Plánované práce vopred písomne oznamujeme príslušnému RÚVZ; nejde o žiadosť o povolenie. Potvrdenie RÚVZ nie je záverečným dokladom. Potrebné doklady Vám odovzdáme po dokončení zákazky.</p>
      <p>Potvrdenie cenovej ponuky objednávkou žiadame najmenej 30 dní pred začiatkom realizačných prác. Pri plánovanom odstraňovaní azbestu zo stavby držiteľ oprávnenia písomne oznamuje práce príslušnému orgánu verejného zdravotníctva najmenej 30 dní vopred vrátane požadovaných podkladov; nejde o žiadosť o povolenie. Pre mimoriadne havarijné alebo živelné udalosti platí osobitný režim.${offer.includeDocumentation && !offer.documentationPromotion ? ` V prípade zrušenia objednávky si spoločnosť ASTANA, s.r.o. vyhradzuje právo účtovať dohodnutú dokumentáciu vo výške ${moneyPdf(offer.documentationFeeWithoutVat)} €.` : ''}</p>
      <p>Vo verejnom zozname ÚVZ SR zverejnenom k 19. 9. 2024 je ASTANA, s.r.o. uvedená s rozsahmi EXT, BJ a INT. Aktuálny stav po tomto dátume odporúčame overiť u príslušného úradu.</p>
    </main>

    <div class="two-boxes">
      <div class="box-wrap">
        <div class="small-box">
          <p class="small-label">Táto cenová ponuka platí do:</p>
          <p class="valid-date">${dateSk(offer.validUntil)}</p>
          <p class="small-text">Po záväznej objednávke budú práce realizované po dohode.</p>
        </div>
      </div>
      <div class="box-wrap">
        <div class="small-box">
          <p class="small-label">Vyhotovil:</p>
          <p class="prepared-name">${escapeHtml(settings.preparedByName)}</p>
          <p class="prepared-phone">tel.: ${escapeHtml(settings.preparedByPhone)}</p>
        </div>
      </div>
    </div>

    <div class="approval">
      <p class="approval-main">S cenovou ponukou súhlasíme ako je uvedené vyššie a práce záväzne objednávame podľa ponuky.</p>
      <p class="approval-help">/v prípade záujmu nám potvrdenú cenovú ponuku obratom doručte na adresu ASTANA, s.r.o., alebo mail: astana@astana.sk/</p>
      <div class="signature-row">
        <div class="signature"><div class="signature-line">objednávateľ</div></div>
        <div class="signature"><div class="signature-line">zhotoviteľ</div></div>
      </div>
    </div>

    <footer class="footer">${escapeHtml(c.name)} · ${escapeHtml(c.street)}, ${escapeHtml(c.city)} ${escapeHtml(c.postalCode)} · tel: ${escapeHtml(c.phone)} · IČO: ${escapeHtml(c.ico)} · DIČ: ${escapeHtml(c.dic)} · IČ DPH: ${escapeHtml(c.icDph)} · ${escapeHtml(c.mainWeb)}</footer>
    </div>
  </section>
</body>
</html>`;
}

async function renderHtmlToPdf(html: string) {
  let browser: any = null;
  try {
    if (process.env.VERCEL) {
      const chromium = (await import('@sparticuz/chromium')).default;
      const puppeteer = await import('puppeteer-core');
      browser = await puppeteer.launch({
        args: [...chromium.args, '--font-render-hinting=none', '--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: { width: 1200, height: 1600 },
        executablePath: await chromium.executablePath(),
        headless: true,
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
      });
      return Buffer.from(pdf);
    }

    const { chromium } = await import('playwright');
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser?.close();
  }
}

export async function renderPriceOfferPdf(offer: PriceOffer, settings: PriceOfferSettings) {
  return renderHtmlToPdf(renderPriceOfferPdfHtml(offer, settings));
}
