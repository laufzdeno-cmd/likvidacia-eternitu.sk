import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const harness = readFileSync('scripts/lead-private-blob-browser.integration.mjs', 'utf8');

test('public visual audit covers every customer-facing template family and breakpoint boundary', () => {
  const visualFunction = harness.slice(
    harness.indexOf('async function runResponsiveVisualChecks'),
    harness.indexOf('async function runPublicNavigationChecks'),
  );
  assert.ok(visualFunction.startsWith('async function runResponsiveVisualChecks'));
  const routeBlock = visualFunction.match(/const routes = \[([\s\S]*?)\n  \];/)?.[1];
  const viewportBlock = visualFunction.match(/const viewports = \[([\s\S]*?)\n  \];/)?.[1];
  assert.ok(routeBlock, 'visual route matrix must be directly parseable');
  assert.ok(viewportBlock, 'visual viewport matrix must be directly parseable');

  const expectedRoutes = [
    '/', '/cena-likvidacie-azbestu/', '/realizacie/', '/kariera/', '/strechari/', '/postup/', '/kontakt/',
    '/likvidacia-azbestu/', '/likvidacia-eternitu/', '/likvidacia-azbestu-poprad/', '/kde-posobime/', '/faq/',
    '/o-firme/', '/poradna/', '/poradna/kolko-stoji-likvidacia-azbestu/', '/recenzie/',
    '/spolupracujuci-strechari/', '/ochrana-osobnych-udajov/', '/podmienky-pouzivania/', '/cookies/',
  ];
  const actualRoutes = [...routeBlock.matchAll(/\['[^']+',\s*'([^']+)'\]/g)].map((match) => match[1]);
  assert.deepEqual(actualRoutes, expectedRoutes);

  const expectedViewports = [
    { width: 320, height: 568 }, { width: 360, height: 800 }, { width: 390, height: 844 },
    { width: 568, height: 320 }, { width: 760, height: 900 }, { width: 761, height: 900 },
    { width: 768, height: 1024 }, { width: 820, height: 900 }, { width: 821, height: 900 },
    { width: 1024, height: 768 }, { width: 1440, height: 900 },
  ];
  const actualViewports = [...viewportBlock.matchAll(/\{\s*width:\s*(\d+),\s*height:\s*(\d+)\s*\}/g)]
    .map((match) => ({ width: Number(match[1]), height: Number(match[2]) }));
  assert.deepEqual(actualViewports, expectedViewports);

  assert.match(harness, /Math\.max\(metrics\.document, metrics\.body\) <= metrics\.viewport \+ 1/);
  assert.match(harness, /metrics\.h1\.display !== 'none'/);
  assert.match(harness, /metrics\.logo\.complete && metrics\.logo\.naturalWidth > 0/);
  assert.match(harness, /metrics\.logo\.left >= -1 && metrics\.logo\.right <= metrics\.viewport \+ 1/);
  assert.match(harness, /metrics\.logo\.src, '\/assets\/astana-logo\.png\?surface=header'/);
  assert.match(harness, /currentLogoUrl\.origin, appOrigin/);
  assert.match(harness, /viewport\.width <= 820 \? '\/assets\/astana-logo\.png' : '\/assets\/astana-logo-dark\.png'/);
  assert.match(harness, /header logo must be requested exactly once at/);
  assert.match(harness, /mobile header must not download the desktop contrast variant/);
  assert.match(harness, /metrics\.headerMainDisplay, 'flex'/);
  assert.match(harness, /assert\.deepEqual\(hydrationErrors, \[\]/);
  assert.match(harness, /requested\.origin !== appOrigin && requested\.origin !== blobOrigin/);
  assert.match(harness, /assert\.deepEqual\(browserNonGetBlocked, \[/);
  assert.match(harness, /\{ method: 'POST', url: '\/api\/analytics\/', eventType: 'page_view' \}/);
  assert.match(harness, /\{ method: 'POST', url: '\/api\/analytics\/', eventType: 'cta_click' \}/);
  assert.match(harness, /\{ method: 'POST', url: '\/api\/analytics\/', eventType: 'quote_section_view' \}/);
  assert.match(harness, /campaign navigation records each expected funnel event exactly once and in order/);
  assert.match(harness, /assert\.equal\(formsSubmitted, 0, 'visual audit must not submit any form'\)/);
});
