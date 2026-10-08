import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const checklistUrl = new URL('../docs/upgrade-2026-09-30/OWNER-SIGNOFF-CHECKLIST-2026-10-08.md', import.meta.url);
const matrixUrl = new URL('../docs/upgrade-2026-09-30/E8-ACCEPTANCE-MATRIX-2026-10-07.md', import.meta.url);

test('owner checklist stays explicit, private and non-authorizing', async () => {
  const [checklist, matrix] = await Promise.all([
    readFile(checklistUrl, 'utf8'),
    readFile(matrixUrl, 'utf8'),
  ]);

  for (const id of ['G03', 'G04', 'G05', 'G08', 'G11', 'F01', 'F03', 'F04', 'F08', 'F09', 'F12', 'O06', 'O09', 'U04', 'U09', 'U10', 'O10']) {
    assert.match(checklist, new RegExp(`\\b${id}\\b`), `checklist musí obsahovať ${id}`);
  }

  assert.match(checklist, /\*\*nepovoľuje\*\* nasadenie, zmenu cloudových zdrojov, odoslanie formulára alebo e-mailu/);
  assert.match(checklist, /Presná adresa, GPS, meno zákazníka, evidenčné čísla a iné osobné údaje ostávajú iba v internom dôkaze/);
  assert.match(checklist, /najmenej päť odlišných prípadov/i);
  assert.match(checklist, /Stav `unknown` sa nesmie automaticky zmeniť na neúspech ani opätovne odoslať/);
  assert.match(checklist, /historický dôkaz, nie automatické potvrdenie aktuálneho stavu/);
  assert.match(checklist, /Obchodný sľub „do 24 hodín“/);
  assert.match(checklist, /týmto checklistom sa povolenie neudeľuje/);
  assert.match(checklist, /Dopyt doručený do oboch inboxov/);
  assert.match(checklist, /Fyzický mobil a podporované prehliadače/);
  assert.match(checklist, /\| Desktop Chrome \|/);
  assert.match(checklist, /\| Desktop Opera \|/);
  assert.match(checklist, /\| Fyzický Android \+ Chrome \|/);
  assert.match(checklist, /Fyzický iPhone\/iPad \+ Safari/);
  assert.match(checklist, /Anonymné ID testera/);
  assert.match(checklist, /nájdu cenu alebo úspešne odošlú výslovne schválený testovací kontakt/);
  assert.match(checklist, /Dopyt bez fotografie — F03/);
  assert.match(checklist, /Dopyt s dvoma platnými fotografiami — F04/);
  assert.match(checklist, /Kariérny a strechársky tok — F12/);
  assert.match(checklist, /WAITING_FOR_OWNER/);
  assert.match(checklist, /WAITING_FOR_HUMAN_TEST/);
  assert.doesNotMatch(checklist, /\|\s*(?:G03|G04|G05|G08|G11|F01|F03|F04|F08|F09|F12|O06|O09|U04|U09|U10|O10)\s*\|\s*(?:PASS|POTVRDENÉ)\s*\|/);

  for (const secretName of [
    'DATABASE_URL',
    'POSTGRES_URL',
    'BLOB_READ_WRITE_TOKEN',
    'SMTP_PASS',
    'ASTANA_RELAY_SECRET',
    'CRON_SECRET',
    'CONVERSION_EVENT_SECRET',
    'GOOGLE_MAPS_API_KEY',
  ]) {
    assert.doesNotMatch(checklist, new RegExp(`${secretName}\\s*[=:]\\s*\\S+`, 'i'), `${secretName} nesmie mať priradenú hodnotu`);
  }

  assert.match(matrix, /OWNER-SIGNOFF-CHECKLIST-2026-10-08\.md/);
});
