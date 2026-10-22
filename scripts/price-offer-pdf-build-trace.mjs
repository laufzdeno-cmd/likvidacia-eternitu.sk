import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Run only after `next build`: a source-level config assertion cannot prove
// that the PDF function actually contains Chromium's runtime dependencies.
const tracePath = new URL('../.next/server/app/api/admin/ponuka/[id]/pdf/route.js.nft.json', import.meta.url);
const trace = JSON.parse(await readFile(tracePath, 'utf8'));
const files = new Set(trace.files.map((file) => file.replaceAll('\\', '/')));
for (const suffix of [
  'node_modules/@puppeteer/browsers/package.json',
  'node_modules/@puppeteer/browsers/lib/browser-data/browser-data.js',
  'node_modules/@sparticuz/chromium/bin/chromium.br',
  'public/assets/astana-logo-print.png',
]) {
  assert.ok([...files].some((file) => file.endsWith(suffix)), `PDF route trace is missing ${suffix}`);
}
console.log('PASS: zostavená PDF funkcia obsahuje Puppeteer, Chromium aj tlačové logo.');
