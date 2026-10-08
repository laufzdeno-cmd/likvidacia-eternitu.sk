import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { chromium } from 'playwright';
import { renderPriceOfferPdf, renderPriceOfferPdfHtml } from '../src/server/price-offer-pdf';
import type { PriceOffer, PriceOfferSettings } from '../src/server/types';

const outputDir = path.join(process.cwd(), 'tmp', 'pdfs');
const outputPath = path.join(outputDir, 'price-offer-boundary-test.pdf');
const execFileAsync = promisify(execFile);

function words(seed: string, maxLength: number) {
  return `${seed} `.repeat(Math.ceil(maxLength / (seed.length + 1))).slice(0, maxLength).trim();
}

function exactLengthEmail() {
  const email = `${'l'.repeat(64)}@${'d'.repeat(63)}.${'e'.repeat(63)}.${'f'.repeat(61)}`;
  assert.equal(email.length, 254);
  return email;
}

const boundaryNote = 'TEST - NEKONTAKTOVAŤ. Dlhá poznámka overuje, že text zostáva čitateľný, neprekrýva cenu, podpisy ani pätičku a že sa žiadna časť cenovej ponuky pri tlači na formát A4 nestratí. '.repeat(4).slice(0, 500);

const offer = {
  id: 'visual-boundary-test',
  number: '20269999',
  jobId: '',
  createdAt: '2026-10-06T08:00:00.000Z',
  validUntil: '2026-12-31',
  objectType: 'O'.repeat(120),
  objectAddress: 'A'.repeat(250),
  municipality: 'M'.repeat(120),
  district: 'D'.repeat(120),
  contactPerson: 'K'.repeat(160),
  phone: '+421905123456789012345678901234567890123',
  email: exactLengthEmail(),
  realizationTerm: 'T'.repeat(250),
  materialType: 'VLNITY_ETERNIT',
  areaM2: 100_000,
  pricePerM2WithoutVat: 100_000,
  documentationFeeWithoutVat: 1_000_000,
  includeDocumentation: true,
  documentationPromotion: false,
  includeTransport: true,
  transportFrom: 'P'.repeat(250),
  transportTo: 'C'.repeat(250),
  transportRoundTripKm: 4_000,
  transportPricePerKm: 100,
  offerNote: boundaryNote,
  internalNote: '',
  sourceInquiry: 'dopyt:00000000-0000-4000-8000-000000000999',
  vatRate: 23,
  materialPriceWithoutVat: 10_000_000_000,
  totalWithoutVat: 10_001_400_000,
  totalWithVat: 12_301_722_000,
  status: 'PRIPRAVENA',
} as PriceOffer;

const settings = {
  materialPrices: {
    VLNITY_ETERNIT: 10.5,
    HLADKY_ETERNIT: 10.5,
    AZBESTOVE_RURY: 10.5,
    PODHLADOVE_DOSKY: 10.5,
    BOLETICKY: 10.5,
    INE: 10.5,
  },
  documentationFee: 161,
  vatRate: 23,
  preparedByName: 'Ing. Peklanská Jadroňová',
  preparedByPhone: '0918 518 277',
  company: {
    name: 'ASTANA, s.r.o.',
    street: 'Scherffelova 1364/28',
    city: 'Poprad',
    postalCode: '058 01',
    phone: '0905 217 946',
    email: 'astana@astana.sk',
    mainWeb: 'astana.sk',
    asbestosWeb: 'likvidacia-eternitu.sk',
    ico: '46 157 701',
    dic: '2023253771',
    icDph: 'SK2023253771',
    authorization: '',
    preparedByName: 'Ing. Peklanská Jadroňová',
    preparedByPhone: '0918 518 277',
    vatRate: 23,
  },
} satisfies PriceOfferSettings;

async function inspectPdfStructure(pdf: Buffer) {
  const pdfInfoExecutable = process.env.PDFINFO_PATH?.trim() || 'pdfinfo';
  const runPdfInfo = async (args: string[]) => {
    try {
      const { stdout, stderr } = await execFileAsync(pdfInfoExecutable, args, {
        encoding: 'utf8',
        maxBuffer: 8 * 1024 * 1024,
      });
      assert.equal(String(stderr).trim(), '', `pdfinfo nahlásil chybu štruktúry: ${String(stderr).trim()}`);
      return String(stdout);
    } catch (error) {
      throw new Error(
        'Štrukturálna PDF kontrola vyžaduje lokálny nástroj pdfinfo (Poppler); test nevykonáva sieťové volania.',
        { cause: error },
      );
    }
  };

  const summary = await runPdfInfo(['-enc', 'UTF-8', outputPath]);
  assert.match(summary, /^Title:\s+Cenová ponuka č\. 20269999 \| ASTANA, s\.r\.o\.$/m);
  assert.match(summary, /^Tagged:\s+yes$/mi);
  assert.match(summary, /^Pages:\s+2$/mi);
  assert.match(summary, /^Page size:.*\(A4\)$/mi);

  const pdfSource = pdf.toString('latin1');
  assert.match(pdfSource, /\/Lang\s*\(sk\)/, 'PDF katalóg neobsahuje slovenský jazyk /Lang (sk).');
  assert.match(pdfSource, /\/StructTreeRoot\b/, 'PDF katalóg neobsahuje /StructTreeRoot.');
  assert.match(pdfSource, /\/Outlines\b/, 'PDF neobsahuje outline vytvorený z nadpisov dokumentu.');

  const structure = await runPdfInfo(['-struct-text', '-enc', 'UTF-8', outputPath]);
  const normalizedStructure = structure.toLocaleLowerCase('sk-SK');
  const readingOrderMarkers = [
    'CENOVÁ PONUKA',
    'Objekt:',
    'Dobrý deň,',
    'Položka',
    'V cene je zahrnuté',
    'Obchodné podmienky',
    'Táto cenová ponuka platí do:',
    'S cenovou ponukou súhlasíme',
  ];
  let previousIndex = -1;
  for (const marker of readingOrderMarkers) {
    const markerIndex = normalizedStructure.indexOf(marker.toLocaleLowerCase('sk-SK'), previousIndex + 1);
    assert.ok(markerIndex > previousIndex, `Čítacie poradie PDF neobsahuje marker „${marker}“ v očakávanom poradí.`);
    previousIndex = markerIndex;
  }
}

async function main() {
  const html = renderPriceOfferPdfHtml(offer, settings);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 1600 } });
    await page.setContent(html, { waitUntil: 'networkidle' });
    const pages = await page.locator('.page').evaluateAll((nodes) => nodes.map((node, index) => {
      const pageElement = node as HTMLElement;
      const content = node.querySelector('.page-content') as HTMLElement;
      const footer = node.querySelector('.footer') as HTMLElement | null;
      const lastFlow = node.querySelector(index === 0 ? '.included-wrap' : '.approval') as HTMLElement;
      const contentRect = content.getBoundingClientRect();
      const lastFlowRect = lastFlow.getBoundingClientRect();
      const footerRect = footer?.getBoundingClientRect();
      const overflowingElements = [...content.querySelectorAll<HTMLElement>('*')]
        .filter((element) => !element.matches('.watermark, .edge-text'))
        .filter((element) => element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1)
        .map((element) => element.className || element.tagName);
      return {
        classes: node.className,
        clientHeight: pageElement.clientHeight,
        scrollHeight: pageElement.scrollHeight,
        clientWidth: pageElement.clientWidth,
        scrollWidth: pageElement.scrollWidth,
        contentClientHeight: content.clientHeight,
        contentScrollHeight: content.scrollHeight,
        contentClientWidth: content.clientWidth,
        contentScrollWidth: content.scrollWidth,
        lastFlowBottom: lastFlowRect.bottom,
        safeBottom: footerRect ? footerRect.top - 8 : contentRect.bottom - 8,
        overflowingElements,
      };
    }));
    assert.equal(pages.length, 2, 'Cenová ponuka má mať presne dve A4 strany.');
    assert.match(pages[0].classes, /page--compact/);
    assert.match(pages[1].classes, /page--terms-note/);
    for (const [index, dimensions] of pages.entries()) {
      assert.ok(
        dimensions.scrollHeight <= dimensions.clientHeight + 1,
        `Strana ${index + 1} preteká o ${dimensions.scrollHeight - dimensions.clientHeight}px.`,
      );
      assert.ok(
        dimensions.contentScrollHeight <= dimensions.contentClientHeight + 1,
        `Obsah strany ${index + 1} preteká o ${dimensions.contentScrollHeight - dimensions.contentClientHeight}px.`,
      );
      assert.ok(
        dimensions.scrollWidth <= dimensions.clientWidth + 1
          && dimensions.contentScrollWidth <= dimensions.contentClientWidth + 1,
        `Strana ${index + 1} má horizontálne pretečenie: ${JSON.stringify(dimensions)}.`,
      );
      assert.ok(
        dimensions.lastFlowBottom <= dimensions.safeBottom,
        `Obsah strany ${index + 1} zasahuje do pätičky alebo mimo tlačovej plochy.`,
      );
      assert.deepEqual(dimensions.overflowingElements, [], `Vnútorný prvok strany ${index + 1} orezáva obsah.`);
    }
    const minimumCustomerFontPx = await page.locator([
      '.page--compact .header-contact',
      '.page--compact .field-label',
      '.page--compact .field-value',
      '.page--compact .copy',
      '.page--compact .price-table',
      '.page--compact .price-table th',
      '.page--compact .included-item',
      '.slim-header',
      '.page--terms-note .terms p',
      '.signature-line',
      '.footer',
    ].join(',')).evaluateAll((nodes) => Math.min(...nodes.map((node) => Number.parseFloat(getComputedStyle(node).fontSize))));
    assert.ok(minimumCustomerFontPx >= 10.66, `Najmenší zákaznícky text má iba ${minimumCustomerFontPx}px.`);
  } finally {
    await browser.close();
  }

  await mkdir(outputDir, { recursive: true });
  const pdf = await renderPriceOfferPdf(offer, settings);
  assert.ok(pdf.length > 10_000, 'Vygenerovaný PDF súbor je neočakávane malý.');
  await writeFile(outputPath, pdf);
  await inspectPdfStructure(pdf);
  console.log(outputPath);
}

void main();
