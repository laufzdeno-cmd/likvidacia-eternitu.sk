import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const mail = readFileSync(new URL('../src/server/mail.ts', import.meta.url), 'utf8');
const offerEmail = mail.slice(mail.indexOf('export function priceOfferEmailHtml'), mail.indexOf('export async function sendPriceOfferDocumentEmail'));
const offerPdf = readFileSync(new URL('../src/server/price-offer-pdf.ts', import.meta.url), 'utf8');
const compliance = readFileSync(new URL('../app/seo-components.tsx', import.meta.url), 'utf8');
const homepage = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
const processPage = readFileSync(new URL('../app/postup/page.tsx', import.meta.url), 'utf8');
const cmsDefaults = readFileSync(new URL('../src/server/site-content.ts', import.meta.url), 'utf8');
const complianceSection = compliance.match(/export function TrustComplianceSection\(\) \{([\s\S]*?)\n\}/)?.[1];

test('both offer templates separate booking terms from the statutory notice rule', () => {
  for (const [name, copy] of [['offer email', offerEmail], ['offer PDF', offerPdf]]) {
    assert.match(copy, /plánované práce vopred písomne oznamujeme príslušnému RÚVZ/i, `${name} describes advance notification to RÚVZ`);
    assert.match(copy, /nejde o žiadosť o povolenie/i, `${name} distinguishes notice from a permit request`);
    assert.doesNotMatch(copy, /RÚVZ a OÚ majú zákonnú mesačnú lehotu na vydanie rozhodnutia/);
    assert.doesNotMatch(copy, /nakoľko RÚVZ a OÚ má zákonnú mesačnú lehotu na vydanie rozhodnutia/);
    assert.match(copy, /Potvrdenie RÚVZ nie je záverečným dokladom/i, `${name} does not imply a final RÚVZ certificate`);
  }
  assert.match(offerPdf, /Potvrdenie cenovej ponuky objednávkou žiadame najmenej 30 dní pred začiatkom/i, 'PDF preserves the booking notice');
  assert.match(offerPdf, /pre mimoriadne havarijné alebo živelné udalosti platí osobitný režim/i, 'PDF acknowledges the statutory emergency exception');
  assert.match(offerEmail, /podľa rozsahu zákazky[\s\S]*kópiu príslušného rozhodnutia orgánu životného prostredia, ak bolo vydané[\s\S]*dokladu o preprave alebo prevzatí odpadu, ak bol vystavený[\s\S]*doklad o hmotnosti odpadu, ak bol vystavený[\s\S]*potvrdenie o zneškodnení azbestu firmou ASTANA, s\.r\.o\./i);
  assert.match(offerEmail, /Prípadné správne poplatky podľa konkrétneho konania, ak vzniknú/i);
  assert.doesNotMatch(offerEmail, /Správne poplatky na úradoch/);
  assert.doesNotMatch(offerEmail, /Dokumentácia RÚVZ \+ OÚ|Áno — RÚVZ a OÚ ŽP/);
  assert.doesNotMatch(offerPdf, /Dokumentácia RÚVZ a OÚ ŽP/);
  assert.match(offerPdf, /V prípade zrušenia objednávky si spoločnosť ASTANA, s\.r\.o\. vyhradzuje právo účtovať dohodnutú dokumentáciu/i, 'PDF discloses the agreed documentation fee when documentation is charged');
});

test('price offer PDF keeps a decodable high-resolution print logo separate from optimized public logos', async () => {
  assert.match(offerPdf, /astana-logo-print\.png/);
  const publicLogoUrl = new URL('../public/assets/astana-logo.png', import.meta.url);
  const publicDarkLogoUrl = new URL('../public/assets/astana-logo-dark.png', import.meta.url);
  const printLogoUrl = new URL('../public/assets/astana-logo-print.png', import.meta.url);
  const publicLogo = statSync(publicLogoUrl);
  const publicDarkLogo = statSync(publicDarkLogoUrl);
  const printLogo = statSync(printLogoUrl);
  assert.ok(publicLogo.size <= 15_000, 'public logo stays optimized for page delivery');
  assert.ok(publicDarkLogo.size <= 15_000, 'public dark logo stays optimized for page delivery');
  assert.ok(printLogo.size > publicLogo.size, 'PDF keeps the separate high-resolution source');
  const [publicMetadata, publicDarkMetadata, printMetadata, publicStats, publicDarkStats, printStats] = await Promise.all([
    sharp(fileURLToPath(publicLogoUrl)).metadata(),
    sharp(fileURLToPath(publicDarkLogoUrl)).metadata(),
    sharp(fileURLToPath(printLogoUrl)).metadata(),
    sharp(fileURLToPath(publicLogoUrl)).stats(),
    sharp(fileURLToPath(publicDarkLogoUrl)).stats(),
    sharp(fileURLToPath(printLogoUrl)).stats(),
  ]);
  assert.deepEqual([publicMetadata.format, publicMetadata.width, publicMetadata.height, publicMetadata.hasAlpha], ['png', 480, 144, true]);
  assert.deepEqual([publicDarkMetadata.format, publicDarkMetadata.width, publicDarkMetadata.height, publicDarkMetadata.hasAlpha], ['png', 480, 144, true]);
  assert.deepEqual([printMetadata.format, printMetadata.width, printMetadata.height, printMetadata.hasAlpha], ['png', 960, 288, true]);
  assert.ok(publicStats.entropy > 0.5, 'public logo must decode to non-empty visual content');
  assert.ok(publicDarkStats.entropy > 0.5, 'public dark logo must decode to non-empty visual content');
  assert.ok(printStats.entropy > 0.5, 'print logo must decode to non-empty visual content');
});

test('public compliance component accurately scopes statutory notice and links to current law', () => {
  assert.ok(complianceSection, 'the shared public compliance component exists');
  assert.match(complianceSection, /Pri plánovanom odstraňovaní azbestu zo stavby držiteľ oprávnenia písomne oznamuje práce príslušnému orgánu verejného zdravotníctva najmenej 30 dní vopred a predkladá požadované podklady/i);
  assert.match(complianceSection, /Ak ide o neodkladné odstraňovanie v súvislosti s mimoriadnou havarijnou alebo živelnou udalosťou, oznámenie s podkladmi sa predkladá najneskôr do 48 hodín od začatia odstraňovania/i);
  assert.match(complianceSection, /<a href="https:\/\/static\.slov-lex\.sk\/static\/SK\/ZZ\/2007\/355\/20260801\.print\.html"/);
  assert.doesNotMatch(complianceSection, /pri konkrétnej zákazke sa rieši rozhodnutie príslušného RÚVZ/i);
});

test('homepage and process FAQ distinguish RÚVZ notification from a permit', () => {
  for (const [name, copy] of [['homepage', homepage], ['process page', processPage], ['homepage CMS defaults', cmsDefaults]]) {
    assert.match(copy, /Treba na práce povolenie od RÚVZ/i, `${name} gives visitors a direct permit answer`);
    assert.match(copy, /oznamuje práce[^.]{0,180}najmenej 30 dní vopred/i, `${name} states the statutory advance notice`);
    assert.match(copy, /nie o žiadosť o povolenie/i, `${name} does not imply that the notification is a permit request`);
    assert.doesNotMatch(copy, /posúdenie RÚVZ/i, `${name} must not describe the work notice as an approval`);
  }
  assert.match(homepage, /Stačí, že firma má oprávnenie na odstraňovanie azbestu/);
  assert.match(homepage, /rozsah oprávnenia zodpovedá konkrétnemu typu prác/i);
  assert.doesNotMatch(`${homepage}\n${cmsDefaults}`, /všeobecné oprávnenie/i);
  assert.match(homepage, /<strong>Doklady<\/strong>\s*<span>po likvidácii<\/span>/i);
  assert.match(processPage, /Zoznam k 19\. 9\. 2024/);
  assert.doesNotMatch(`${homepage}\n${processPage}`, /Verejný register/i);
});
