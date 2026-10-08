import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const canonicalOutcome = 'potvrdenie alebo dokumentácia po legálnej likvidácii podľa rozsahu zákazky';

test('human and machine-readable service outputs use the same scoped documentation promise', () => {
  const site = read('src/content/site.ts');
  const company = JSON.parse(read('public/data/company.json'));
  const llms = read('public/llms.txt');

  assert.match(site, new RegExp(canonicalOutcome));
  assert.ok(company.services.some((item) => item.toLocaleLowerCase('sk') === canonicalOutcome));
  assert.match(llms.toLocaleLowerCase('sk'), new RegExp(canonicalOutcome));
});

test('public source copy does not retain the broader unconditional documentation promise', () => {
  for (const path of [
    'app/layout.tsx',
    'src/content/seo-content.ts',
    'src/server/site-content.ts',
    'public/data/company.json',
    'public/llms.txt',
  ]) {
    assert.doesNotMatch(read(path), /potvrdenie o legálnej likvidácii/i, path);
  }
});
