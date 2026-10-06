import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { photoSelectionNotice, splitPhotoSelection } from '../src/lib/photo-intake-selection.ts';

test('photo picker reports files beyond the remaining 20-photo queue instead of silently dropping them', async () => {
  const first = Array.from({ length: 20 }, (_, index) => `photo-${index}`);
  assert.deepEqual(splitPhotoSelection(first, 0), {
    accepted: first,
    rejectedCount: 0,
    remainingAfterSelection: 0,
  });

  const partial = splitPhotoSelection(['photo-a', 'photo-b', 'photo-c'], 18);
  assert.deepEqual(partial, {
    accepted: ['photo-a', 'photo-b'],
    rejectedCount: 1,
    remainingAfterSelection: 0,
  });

  const full = splitPhotoSelection(['photo-d'], 20);
  assert.deepEqual(full, { accepted: [], rejectedCount: 1, remainingAfterSelection: 0 });
  assert.equal(photoSelectionNotice(full.accepted.length, full.rejectedCount), 'Pridané fotografie: 0. Nepridané fotografie: 1. Uvoľni miesto odstránením už nahratých položiek zo zoznamu.');
  assert.equal(photoSelectionNotice(2, 1), 'Pridané fotografie: 2. Nepridané fotografie: 1. Uvoľni miesto odstránením už nahratých položiek zo zoznamu.');
  assert.equal(photoSelectionNotice(3, 0), '');

  const client = await readFile(new URL('../app/spolupraca/fotky/photo-intake-client.tsx', import.meta.url), 'utf8');
  assert.match(client, /splitPhotoSelection\(Array\.from\(files\), drafts\.length\)/);
  assert.match(client, /photoSelectionNotice\(fresh\.length, selected\.rejectedCount\)/);
});
