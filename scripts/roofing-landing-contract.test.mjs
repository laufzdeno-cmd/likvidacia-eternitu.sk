import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync(new URL('../app/postup/page.tsx', import.meta.url), 'utf8');
const company = readFileSync(new URL('../public/data/company.json', import.meta.url), 'utf8');
const llms = readFileSync(new URL('../public/llms.txt', import.meta.url), 'utf8');

test('strešná reklamná cesta má stabilný odkaz na koordináciu s pokrývačmi', () => {
  assert.match(page, /id="nadvazujuca-strecha"/);
  assert.match(page, /Meníte zároveň aj strechu\?/);
  assert.match(page, /pracovných dňoch od 8:00 do 18:00/);
  assert.match(page, /konkrétny čas nástupu dohodneme/);
  assert.match(page, /<p className="postup-process-column-label">Strechár<\/p>/);
  assert.match(page, /svoju cenovú ponuku, zmluvu a záruku priamo so zákazníkom/);
  assert.match(page, /ASTANA ponúka aj strechy a krovy/);
  assert.match(page, /ak vám strechársku prácu nacení ASTANA/);
  assert.match(page, /dohodu uzatvoríte s ASTANA, s.r.o./);
  assert.match(page, /zodpovednosť za strechársku prácu riešite\s+priamo s ním/);
  assert.match(page, /Ak už máte vlastného strechára, zosúladíme len nadväznosť prác/);
  assert.match(company, /Centrálna firemná stránka ASTANA uvádza strechy a krovy/);
  assert.match(company, /https:\/\/www\.astana\.sk\/Strechy-krovy/);
  assert.match(llms, /potvrdených služieb \[strechy a krovy\]/);
  assert.doesNotMatch(page, /ASTANA sa tým nestáva strechárskou firmou/);
  assert.match(page, /href="\/#dopyt"/);
});
