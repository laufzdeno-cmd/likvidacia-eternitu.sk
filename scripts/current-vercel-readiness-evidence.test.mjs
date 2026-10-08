import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('current Vercel evidence keeps production, Preview and Staging claims separate', async () => {
  const [snapshot, matrix] = await Promise.all([
    readFile(new URL('../docs/upgrade-2026-09-30/VERCEL-READONLY-SNAPSHOT-2026-10-08.md', import.meta.url), 'utf8'),
    readFile(new URL('../docs/upgrade-2026-09-30/E8-ACCEPTANCE-MATRIX-2026-10-07.md', import.meta.url), 'utf8'),
  ]);

  assert.match(snapshot, /dpl_FYaPKy6tkko75rkam3RUAbXFSdcT/);
  assert.match(snapshot, /dpl_3N29jpHnqFQ4ML3nVVp5shyni2nn/);
  assert.match(snapshot, /Preview nie je staging/);
  assert.match(snapshot, /produkcia zostáva \*\*NOT VERIFIED\*\*/);
  assert.match(snapshot, /IAM preto zostáva \*\*NOT VERIFIED\*\*/);
  assert.match(snapshot, /`CONVERSION_EVENT_SECRET` \| chýba/);
  assert.match(snapshot, /`GOOGLE_MAPS_API_KEY` \| chýba/);
  assert.match(snapshot, /`PHOTO_INTAKE_\*` a `PHOTO_UPLOAD_SESSION_SECRET` \| chýbajú/);
  assert.match(snapshot, /hodnoty sa pri tejto kontrole neotvárali/i);
  assert.doesNotMatch(snapshot, /(?:postgres(?:ql)?|https?):\/\/[^\s`]+:[^\s`]+@/i);
  assert.doesNotMatch(snapshot, /(?:value|hodnota)\s*[:=]\s*["'][^"']+["']/i);

  assert.match(matrix, /VERCEL-READONLY-SNAPSHOT-2026-10-08\.md/);
  assert.match(matrix, /\| O04 \| WAITING \|[^\n]*dpl_FYaPKy6tkko75rkam3RUAbXFSdcT/);
  assert.match(matrix, /\| O07 \| PASS local \/ production WAITING \|/);
  assert.match(matrix, /\| O09 \| PASS local \/ production WAITING \|[^\n]*foto-intake/i);
  assert.match(matrix, /\| O10 \| PARTIAL \|[^\n]*Vercel/i);
});
