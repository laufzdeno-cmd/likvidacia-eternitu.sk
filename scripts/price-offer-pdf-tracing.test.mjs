import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

test('PDF renderer carries Puppeteer browser-data modules into Next server traces', () => {
  const config = readFileSync(new URL('../next.config.mjs', import.meta.url), 'utf8');
  const packageFile = new URL('../node_modules/@puppeteer/browsers/package.json', import.meta.url);
  const runtimeModule = new URL('../node_modules/@puppeteer/browsers/lib/browser-data/browser-data.js', import.meta.url);
  assert.ok(existsSync(packageFile), '@puppeteer/browsers dependency must be installed');
  assert.ok(existsSync(runtimeModule), 'Puppeteer runtime browser-data module must exist');
  assert.match(config, /['"]\.\/node_modules\/@puppeteer\/browsers\/package\.json['"]/);
  assert.match(config, /['"]\.\/node_modules\/@puppeteer\/browsers\/lib\/\*\*\/\*['"]/);
});
