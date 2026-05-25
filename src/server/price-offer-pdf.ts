import { existsSync } from 'node:fs';
import { join } from 'node:path';
import PDFDocument from 'pdfkit';
import type { PriceOffer, PriceOfferSettings } from './types';
import { materialTypeLabels } from './db';

function bundledFontPath() {
  const candidates = [
    join(process.cwd(), 'node_modules', 'next', 'dist', 'compiled', '@vercel', 'og', 'Geist-Regular.ttf'),
    join(process.cwd(), 'node_modules', 'next', 'dist', 'compiled', '@vercel', 'og', 'Geist-Medium.ttf'),
  ];
  return candidates.find((path) => existsSync(path));
}

function moneyPdf(value: number, decimals = 2) {
  const rounded = Math.round((value || 0) * 100) / 100;
  const fraction = decimals ? rounded.toFixed(decimals).replace('.', ',') : String(Math.round(rounded));
  return `${fraction.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} €`;
}

function dateSk(value: string | Date) {
  return new Intl.DateTimeFormat('sk-SK', { day: 'numeric', month: 'numeric', year: 'numeric' }).format(new Date(value));
}

function paragraph(doc: PDFKit.PDFDocument, text: string, options: PDFKit.Mixins.TextOptions = {}) {
  doc.fontSize(9.2).fillColor('#111111').text(text, { align: 'justify', lineGap: 2, ...options });
  doc.moveDown(0.45);
}

function addFooter(doc: PDFKit.PDFDocument, settings: PriceOfferSettings) {
  const c = settings.company;
  const y = 785;
  doc.fontSize(7).fillColor('#333333').text(
    `${c.name}, ${c.street} ${c.city} ${c.postalCode}, tel: ${c.phone}, IČO: ${c.ico}, DIČ: ${c.dic}, IČ DPH: ${c.icDph}\n${c.mainWeb}, ${c.email}`,
    42,
    y,
    { width: 500, align: 'center' },
  );
  doc.save().rotate(90, { origin: [575, 390] }).fontSize(8).fillColor('#8a1538').text(c.mainWeb, 575, 390).restore();
}

export async function renderPriceOfferPdf(offer: PriceOffer, settings: PriceOfferSettings) {
  const doc = new PDFDocument({ size: 'A4', margin: 42, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
  const c = settings.company;
  const vat = settings.vatRate;
  const materialLabel = materialTypeLabels[offer.materialType] || 'azbestový materiál';
  const fontPath = bundledFontPath();

  if (fontPath) {
    doc.registerFont('AstanaBody', fontPath);
    doc.font('AstanaBody');
  } else {
    doc.font('Helvetica');
  }

  doc.fillColor('#0F1F3D').fontSize(28).text('ASTANA', 42, 34);
  doc.fillColor('#8A1538').fontSize(10).text('likvidácia a odvoz nebezpečného odpadu', 42, 66);
  doc.fillColor('#111111').fontSize(8).text(
    `${c.name}, ${c.street},\n${c.city} ${c.postalCode}, tel: ${c.phone},\nIČO: ${c.ico}, DIČ: ${c.dic}, IČ DPH: ${c.icDph}\n${c.mainWeb}, ${c.email}`,
    330,
    34,
    { width: 220, align: 'right' },
  );
  doc.moveTo(42, 100).lineTo(553, 100).strokeColor('#8A1538').lineWidth(1).stroke();

  doc.fillColor('#111111').fontSize(18).text('CENOVÁ PONUKA', 42, 118, { align: 'center' });
  doc.fontSize(13).text(`č. ${offer.number}`, { align: 'center' });
  doc.fontSize(12).text('na ekologickú likvidáciu AZBESTU', { align: 'center' });
  doc.moveDown(0.7);
  doc.fontSize(10).text(`v Poprade ${dateSk(offer.createdAt)}`);
  doc.moveDown(0.7);
  doc.text(`Objekt: ${offer.objectType}, ${offer.objectAddress || offer.municipality} okres ${offer.district}`);
  doc.text(`Kontakt: ${offer.contactPerson}, tel.: ${offer.phone}, ${offer.email}`);
  doc.text(`Termín realizácie: ${offer.realizationTerm}`);
  doc.moveDown(0.7);
  doc.text('Dobrý deň,');
  doc.moveDown(0.35);

  paragraph(
    doc,
    `na základe Vašej požiadavky Vám zasielame cenovú ponuku na ekologickú likvidáciu „AZC“ krytiny (${materialLabel}) vo výmere plochy strechy cca ${offer.areaM2} m² v súlade s platnými legislatívnymi ustanoveniami.`,
  );
  paragraph(
    doc,
    `Cena za m² azbestovej krytiny: ${moneyPdf(offer.pricePerM2WithoutVat)} bez DPH (${moneyPdf(offer.pricePerM2WithoutVat * (1 + vat / 100))} s DPH). Presné množstvo m² azbestu bude spočítané na mieste.`,
  );
  if (offer.materialType === 'VLNITY_ETERNIT') {
    paragraph(
      doc,
      'Pri vlnitom eternite je potrebné počítať s rovnakou výmerou m² azbestu ako pri kúpe novej strešnej krytiny. Množstvo sa vypočíta ako výška × šírka jednej tabule vynásobená počtom kusov.',
    );
  }
  if (offer.includeDocumentation) {
    doc.fontSize(9.2).text(`Vypracovanie dokumentácie na RÚVZ a OÚ: ${moneyPdf(offer.documentationFeeWithoutVat)} bez DPH (${moneyPdf(offer.documentationFeeWithoutVat * (1 + vat / 100))} s DPH)`);
    doc.moveDown(0.5);
  }

  doc.fontSize(10).fillColor('#111111').text('V cene je zahrnuté:', { underline: true });
  doc.moveDown(0.2);
  const included = [
    'vypracovanie potrebnej dokumentácie pre RÚVZ k vydaniu povolenia na demontáž a žiadosti na OÚ ŽP k vydaniu povolenia na zneškodnenie nebezpečného odpadu',
    'správne poplatky na RÚVZ a OÚ',
    'vytvorenie kontrolovaného pásma a ochranného pásma',
    'stabilizácia azbestových materiálov penetračným postrekom',
    'demontáž a likvidácia azbestových materiálov odborne vyškoleným personálom',
    'zabalenie nebezpečného odpadu na palety alebo do PE vriec s nápisom „ADR 9“',
    'dekontaminácia pracoviska',
    'preprava zabaleného a stabilizovaného azbestového odpadu na skládku nebezpečného odpadu šoférmi s platným osvedčením ADR',
    'uloženie odpadu na skládke nebezpečných odpadov',
    'poplatok za uskladnenie',
    'odovzdanie dokumentácie po uhradení faktúry príslušným úradom a objednávateľovi',
  ];
  included.forEach((item, index) => doc.fontSize(8.7).text(`${index + 1}. ${item}`, { indent: 8, align: 'justify', lineGap: 1.5 }));

  doc.moveDown(0.5);
  paragraph(
    doc,
    `Predpokladaná cena za dielo cca: ${moneyPdf(offer.totalWithoutVat)} bez DPH (${moneyPdf(offer.totalWithVat)} s DPH). Cena bude upravovaná podľa skutočných m² azbestu.`,
  );
  if (offer.offerNote) paragraph(doc, offer.offerNote);

  doc.addPage();
  paragraph(doc, 'Všetko vybavíme za Vás - cena je kompletná, vrátane demontáže, dopravy, vypracovania potrebných podkladov a všetkých správnych poplatkov. Ak by výmera bola menšia alebo väčšia, cena bude upravená.');
  paragraph(doc, 'Sme platcami DPH. Lehota splatnosti faktúry je 14 dní od dodania služby. Všetky podklady, originál Sprievodného listu nebezpečných odpadov s kópiou vážneho lístka, záverečnú správu a potvrdenie spoločnosti ASTANA, s.r.o. o zneškodnení odpadu zasielame až po úhrade faktúry.');
  paragraph(doc, `V prípade záujmu Vás žiadame o potvrdenie cenovej ponuky objednávkou minimálne 30 dní pred začiatkom realizačných prác, nakoľko RÚVZ a OÚ má zákonnú mesačnú lehotu na vydanie rozhodnutia. V prípade zrušenia objednávky zo strany objednávateľa si spoločnosť ASTANA, s.r.o. vyhradzuje právo zaúčtovania nákladov spojených s vybavením administratívy na úradoch vo výške ${moneyPdf(offer.documentationFeeWithoutVat)}.`);
  paragraph(doc, `Firma ASTANA, s.r.o. má oprávnenie na likvidáciu a manipuláciu s nebezpečným odpadom č. ${c.authorization} udelené Úradom verejného zdravotníctva Slovenskej republiky.`);

  doc.moveDown(0.8);
  doc.text(`Vyhotovil: ${settings.preparedByName}`, 330, doc.y, { width: 220, align: 'right' });
  doc.text(`tel.: ${settings.preparedByPhone}`, { width: 220, align: 'right' });
  doc.moveDown(1);
  doc.text(`Táto cenová ponuka platí do ${dateSk(offer.validUntil)}.`);
  doc.text('Po záväznej objednávke budú práce realizované po dohode.');
  doc.moveDown(1.5);
  doc.text('S cenovou ponukou súhlasíme ako je uvedené vyššie a práce záväzne objednávame podľa ponuky.');
  doc.text('/v prípade záujmu nám potvrdenú cenovú ponuku obratom doručte na adresu ASTANA, s.r.o., alebo mail: astana@astana.sk/');
  doc.moveDown(2);
  doc.text('_ _ _ _ _ _ _ _ _ _ _ _          _ _ _ _ _ _ _ _ _ _ _ _', { align: 'center' });
  doc.text('objednávateľ                          zhotoviteľ', { align: 'center' });

  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    addFooter(doc, settings);
  }
  doc.end();
  return done;
}
