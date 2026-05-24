import PDFDocument from 'pdfkit';
import type { PriceOffer, PriceOfferSettings } from './types';
import { materialTypeLabels } from './db';

function moneyPdf(value: number, decimals = 2) {
  const rounded = Math.round((value || 0) * 100) / 100;
  const fraction = decimals ? rounded.toFixed(decimals).replace('.', ',') : String(Math.round(rounded));
  return `${fraction.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')},-€`;
}

function dateSk(value: string | Date) {
  return new Intl.DateTimeFormat('sk-SK', { dateStyle: 'medium' }).format(new Date(value));
}

function addFooter(doc: PDFKit.PDFDocument, settings: PriceOfferSettings) {
  const c = settings.company;
  const y = 785;
  doc.fontSize(7).fillColor('#333').text(
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

  doc.font('Helvetica');
  doc.fillColor('#0F1F3D').fontSize(28).text('ASTANA', 42, 34);
  doc.fillColor('#8a1538').fontSize(10).text('likvidácia a odvoz nebezpečného odpadu', 42, 66);
  doc.fillColor('#111').fontSize(8).text(
    `${c.name}, ${c.street},\n${c.city} ${c.postalCode}, tel: ${c.phone},\nIČO: ${c.ico}, DIČ: ${c.dic}, IČ DPH: ${c.icDph}\n${c.mainWeb}, ${c.email}`,
    330,
    34,
    { width: 220, align: 'right' },
  );
  doc.moveTo(42, 100).lineTo(553, 100).strokeColor('#8a1538').lineWidth(1).stroke();

  doc.fillColor('#111').fontSize(18).text('CENOVÁ PONUKA', 42, 118, { align: 'center' });
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
  doc.text(
    `na základe Vašej požiadavky Vám zasielame cenovú ponuku na ekologickú likvidáciu „AZC" krytiny (${materialLabel}) vo výmere plochy strechy cca ${offer.areaM2}m2 v súlade s platnými legislatívnymi ustanoveniami.`,
    { align: 'justify' },
  );
  doc.moveDown(0.5);
  doc.text(
    `Cena za m2 azc krytiny: ${moneyPdf(offer.pricePerM2WithoutVat)} bez DPH (${moneyPdf(offer.pricePerM2WithoutVat * (1 + vat / 100))} s DPH) presné množstvo m2 azbestu bude spočítané na mieste.`,
    { align: 'justify' },
  );
  if (offer.materialType === 'VLNITY_ETERNIT') {
    doc.text(
      '(je potrebné počítať s rovnakou výmerou m2 azbestu ako pri kúpe novej strešnej krytiny) Množstvo vypočíta ako výška * šírka jednej tabule vynásobená počtom kusov pri vlnitom eternite.',
      { align: 'justify' },
    );
  }
  if (offer.includeDocumentation) {
    doc.moveDown(0.35);
    doc.text(`Vypracovanie dokumentácie na RÚVZ a OÚ: ${moneyPdf(offer.documentationFeeWithoutVat)} bez DPH (${moneyPdf(offer.documentationFeeWithoutVat * (1 + vat / 100))} s DPH)`);
  }
  doc.moveDown(0.6);
  doc.fontSize(10).text('V cene je zahrnuté:', { underline: true });
  const included = [
    'vypracovanie potrebnej dokumentácie pre RÚVZ k vydaniu povolenia na demontáž (Plán práce, prevádzkový poriadok, oprávnenia od ÚVZ Bratislava a dokumenty) a žiadosti na OÚ ŽP k vydaniu povolenia na zneškodnenie NO',
    'správne poplatky na RÚVZ a OÚ',
    'vytvorenie kontrolovaného pásma, ochranného pásma',
    'stabilizácia azbestových materiálov – penetračný postrek',
    'demontáž a likvidácia azbestových materiálov odborne vyškoleným personálom',
    'zabalenie NO na palety alebo do PE vriec s nápisom „ADR 9"',
    'dekontaminácia prostredia',
    'preprava zabaleného a stabilizovaného azbestového odpadu na skládku nebezpečného odpadu šoférmi s platným osvedčením ADR',
    'uloženie odpadu na skládke nebezpečných odpadov',
    'poplatok za uskladnenie',
    'odovzdanie dokumentácie po uhradení faktúry príslušným úradom a objednávateľovi (Záverečná správa, SLNO + vážny lístok, potvrdenie o zneškodnení odpadu na skládke NO, kópie rozhodnutí z RÚVZ a OÚ)',
  ];
  included.forEach((item, index) => doc.fontSize(8.8).text(`${index + 1}. ${item}`, { indent: 8, align: 'justify' }));

  doc.moveDown(0.5);
  doc.fontSize(10).text(
    `Predpokladaná cena za dielo cca: ${moneyPdf(offer.totalWithoutVat)} bez DPH (${moneyPdf(offer.totalWithVat)} s DPH) cena bude upravovaná podľa skutočných m2 azbestu`,
    { align: 'justify' },
  );
  if (offer.offerNote) {
    doc.moveDown(0.4).text(offer.offerNote, { align: 'justify' });
  }

  doc.addPage();
  doc.fontSize(10).fillColor('#111');
  doc.text('Všetko vybavíme za Vás - cena je kompletná, vrátane demontáže, dopravy, vypracovania potrebných podkladov a všetkých správnych poplatkov. Ak by výmera bola menšia alebo väčšia, cena bude upravená.', { align: 'justify' });
  doc.moveDown(0.6);
  doc.text('Sme platcami DPH. Lehota splatnosti faktúry je 14 dní od dodania služby. Za každý deň omeškania platby po termíne splatnosti budeme účtovať úrok z omeškania v súlade s ust.§3 nar. vlády SR č. 87/1955 Z.z. Všetky podklady (originál SLNO s kópiou vážneho lístka, záverečnú správu, ako aj potvrdenie spoločnosti ASTANA, s.r.o., o zneškodnení odpadu) zasielame až po úhrade faktúry!', { align: 'justify' });
  doc.moveDown(0.6);
  doc.text(`V prípade záujmu Vás žiadame o potvrdenie cenovej ponuky objednávkou min. 30 dní pred začiatkom realizačných prác, nakoľko RÚVZ a OÚ má zákonnú mesačnú lehotu k vydaniu rozhodnutia na povolenie začatia prác. V prípade zrušenia objednávky zo strany objednávateľa si spoločnosť ASTANA, s.r.o., vyhradzuje právo zaúčtovania nákladov spojených s vybavením administratívy na úradoch vo výške ${moneyPdf(offer.documentationFeeWithoutVat)}`, { align: 'justify' });
  doc.moveDown(0.6);
  doc.text(`firma ASTANA, s.r.o. má oprávnenie na likvidáciu a manipuláciu s nebezpečným odpadom č. ${c.authorization} udeleného ÚRADOM VEREJNÉHO ZDRAVOTNÍCTVA SLOVENSKEJ REPUBLIKY.`, { align: 'justify' });
  doc.moveDown(1);
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
