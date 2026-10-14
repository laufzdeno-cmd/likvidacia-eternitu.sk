import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync(new URL('../app/postup/page.tsx', import.meta.url), 'utf8');

test('strešná reklamná cesta má stabilný odkaz na koordináciu s pokrývačmi', () => {
  assert.match(page, /id="nadvazujuca-strecha"/);
  assert.match(page, /Meníte zároveň aj strechu\?/);
  assert.match(page, /pracovných dňoch od 8:00 do 18:00/);
  assert.match(page, /konkrétny čas nástupu dohodneme/);
  assert.match(page, /href="\/#dopyt"/);
});
