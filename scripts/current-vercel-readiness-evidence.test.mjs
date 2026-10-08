import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('current Vercel evidence keeps production, Preview and Staging claims separate', async () => {
  const [snapshot, matrix] = await Promise.all([
    readFile(new URL('../docs/upgrade-2026-09-30/VERCEL-READONLY-SNAPSHOT-2026-10-08.md', import.meta.url), 'utf8'),
    readFile(new URL('../docs/upgrade-2026-09-30/E8-ACCEPTANCE-MATRIX-2026-10-07.md', import.meta.url), 'utf8'),
  ]);

  assert.match(
    snapshot,
    /Produkčný alias `likvidacia-eternitu\.sk` smeruje na deployment `dpl_FYaPKy6tkko75rkam3RUAbXFSdcT` v stave \*\*READY \/ Current\*\*, prostredie \*\*Production\*\*/,
  );
  assert.match(snapshot, /dpl_3N29jpHnqFQ4ML3nVVp5shyni2nn/);
  assert.match(
    snapshot,
    /Doména `www\.likvidacia-eternitu\.sk` má stav \*\*Valid Configuration\*\* a robí HTTP \*\*308\*\* presmerovanie na `likvidacia-eternitu\.sk`\..*Apex aj projektová doména `likvidacia-eternitu-sk\.vercel\.app` majú stav \*\*Valid Configuration \/ Production\*\*/,
  );
  assert.match(
    snapshot,
    /Production `dpl_FYaPKy6tkko75rkam3RUAbXFSdcT` \*\*READY \/ Current\*\*.*Detail aktuálneho deploymentu označuje Source ako manuálne `vercel deploy`; neposkytuje Git SHA ani vetvu/,
  );
  assert.match(snapshot, /Preview nie je staging/);
  assert.match(snapshot, /produkcia zostáva \*\*NOT VERIFIED\*\*/);
  assert.match(snapshot, /IAM preto zostáva \*\*NOT VERIFIED\*\*/);
  assert.match(snapshot, /`CONVERSION_EVENT_SECRET` \| chýba/);
  assert.match(snapshot, /`GOOGLE_MAPS_API_KEY` \| chýba/);
  assert.match(snapshot, /`PHOTO_INTAKE_\*` a `PHOTO_UPLOAD_SESSION_SECRET` \| chýbajú/);
  assert.match(snapshot, /hodnoty sa pri tejto kontrole neotvárali/i);
  assert.match(snapshot, /živého Preview[^\n]+\*\*NOT VERIFIED\*\*/);
  assert.match(snapshot, /opakovaný read-only review vydal \*\*PASS bez zostávajúceho P1–P3 nálezu\*\*/);
  assert.doesNotMatch(snapshot, /(?:postgres(?:ql)?|https?):\/\/[^\s`]+:[^\s`]+@/i);
  assert.doesNotMatch(snapshot, /(?:value|hodnota)\s*[:=]\s*["'][^"']+["']/i);
  for (const name of [
    'DATABASE_URL',
    'BLOB_READ_WRITE_TOKEN',
    'PHOTO_INTAKE_BLOB_READ_WRITE_TOKEN',
    'SMTP_PASS',
    'ASTANA_RELAY_SECRET',
    'CONVERSION_EVENT_SECRET',
    'PHOTO_UPLOAD_SESSION_SECRET',
    'STAGING_DATABASE_MARKER',
  ]) {
    assert.doesNotMatch(snapshot, new RegExp(`${name}\\s*=\\s*\\S+`, 'i'), `${name} nesmie mať v dôkaze priradenú hodnotu`);
  }

  assert.match(matrix, /VERCEL-READONLY-SNAPSHOT-2026-10-08\.md/);
  assert.match(matrix, /\| O04 \| WAITING \|[^\n]*dpl_FYaPKy6tkko75rkam3RUAbXFSdcT/);
  assert.match(matrix, /\| O04 \| WAITING \|[^\n]*\*\*READY \/ Current\*\*[^\n]*308 presmerovanie/);
  assert.match(matrix, /\| O05 \| PARTIAL \|[^\n]*produkčný návratový bod[^\n]*Git SHA/);
  assert.match(matrix, /\| O07 \| PASS local \/ production WAITING \|/);
  assert.match(matrix, /\| O09 \| PASS local \/ production WAITING \|[^\n]*foto-intake/i);
  assert.match(matrix, /\| O10 \| PARTIAL \|[^\n]*Vercel/i);
  assert.match(matrix, /ochrana živého Preview sú \*\*NOT VERIFIED\*\*/);
});
