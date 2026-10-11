import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { transportPolicy } from '../src/content/transport-policy.mjs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const homepage = read('../app/homepage-critical-client.tsx');
const publicClient = read('../app/landing-client.tsx');
const calculator = read('../src/lib/price-calculator.ts');
const homepageMarkup = read('../app/page.tsx');
const pricePage = read('../app/cena-likvidacie-azbestu/page.tsx');
const publicShell = read('../app/public-layout.tsx');
const pricePageClient = read('../app/price-page-client.tsx');
const roofersPage = read('../app/strechari/page.tsx');
const productionHarness = read('../scripts/photo-intake-browser.integration.mjs');

test('homepage and public pages use the same working price-calculator initializer', () => {
  assert.match(homepage, /initializePriceCalculators\(trackAnalytics\)/);
  assert.match(publicClient, /initializePriceCalculators\(trackAnalytics\)/);
  assert.match(homepageMarkup, /data-price-calculator/);
  assert.match(pricePage, /className="price-calculator"/);
  assert.match(calculator, /querySelectorAll<HTMLElement>\('\[data-price-calculator\], \.price-calculator'\)/);
});

test('price calculator material keys match the visible controls, including smooth eternit', () => {
  for (const material of ['vlnity', 'hladky', 'boleticky', 'neviem']) {
    assert.match(homepageMarkup, new RegExp(`data-price-material="${material}"`));
    assert.match(pricePage, new RegExp(`data-price-material="${material}"`));
  }
  assert.match(calculator, /hladky:\s*'plocha'/);
  assert.match(calculator, /plocha:\s*\{ min: 9, max: 15 \}/);
  assert.match(calculator, /activeMaterial = materialAliases\[rawMaterial\] \|\| rawMaterial/);
});

test('calculator updates displayed area/range and removes listeners on unmount', () => {
  assert.match(calculator, /areaOutput\.textContent = `\$\{area\} m2`/);
  assert.match(calculator, /minOutput\.textContent = formatPrice\(area \* rates\.min\)/);
  assert.match(calculator, /maxOutput\.textContent = formatPrice\(area \* rates\.max\)/);
  assert.match(calculator, /areaInput\.removeEventListener\('input', onAreaInput\)/);
  assert.match(calculator, /button\.removeEventListener\('click', onMaterialClick\)/);
});

test('price-page calculator uses a mobile-safe quote CTA without removing desktop contact', () => {
  assert.match(pricePage, /data-price-quote href="\/#dopyt"/);
  assert.match(pricePage, /<PublicPageShell[^>]+hideWhatsappOnMobile>/);
  assert.match(publicShell, /<PublicWidgets hideWhatsappOnMobile=\{hideWhatsappOnMobile\} \/>/);
});

test('both calculator disclosures apply the approved transport threshold', () => {
  assert.match(homepageMarkup, /transportPolicy\.freeFromThreshold/);
  assert.match(homepageMarkup, /transportPolicy\.belowThreshold/);
  assert.match(pricePage, /transportPolicy\.freeFromThreshold/);
  assert.match(pricePage, /transportPolicy\.belowThreshold/);
  assert.equal(
    transportPolicy.full,
    'Pri ploche od 100 m² dopravu po Slovensku neúčtujeme. Pri menšej výmere prípadnú dopravu uvedieme samostatne v cenovej ponuke.',
  );
  assert.equal(`${transportPolicy.freeFromThreshold} ${transportPolicy.belowThreshold}`, transportPolicy.full);
});

test('standalone price page avoids the full lead and gallery client', () => {
  assert.doesNotMatch(publicShell, /LandingClient|PricePageClient|client\?:/);
  assert.match(pricePage, /import PricePageClient from '\.\.\/price-page-client'/);
  assert.match(pricePage, /<PricePageClient \/>/);
  assert.match(pricePageClient, /initializePriceCalculators\(trackAnalyticsEvent\)/);
  assert.doesNotMatch(pricePageClient, /LandingClient|lead-form|gallery|roofer/i);
  assert.match(roofersPage, /<LandingClient \/>/, 'roofer page keeps its dedicated full client');
  assert.match(productionHarness, /price route must not load the full roofer client/);
  assert.match(productionHarness, /article route must not load price or roofer-only clients/);
});

test('both calculators expose the current selection and changing price to assistive technology', () => {
  for (const markup of [homepageMarkup, pricePage]) {
    assert.match(markup, /className="price-materials" role="group" aria-label="Typ materiálu"/);
    assert.match(markup, /data-price-material="vlnity"[^>]*aria-pressed="true"/);
    for (const key of ['hladky', 'boleticky', 'neviem']) {
      assert.match(markup, new RegExp(`data-price-material="${key}"[^>]*aria-pressed="false"`));
    }
    assert.match(markup, /className="price-result" aria-live="polite"/);
  }
});
