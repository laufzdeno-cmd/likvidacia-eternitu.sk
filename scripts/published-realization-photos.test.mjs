import assert from 'node:assert/strict';
import test from 'node:test';
import { selectPublishedRealizationPhotos } from '../src/lib/published-realization-photos.ts';

test('verejná karta zoradí a zobrazí najviac tri schválené fotografie', () => {
  const selected = selectPublishedRealizationPhotos({
    photoIds: [],
    photos: [
      { id: 'after', phase: 'after', publicCaption: 'Hotová plocha', sortOrder: 40 },
      { id: 'during-b', phase: 'during', publicCaption: 'Balenie', sortOrder: 30 },
      { id: 'before', phase: 'before', publicCaption: 'Pôvodný stav', sortOrder: 10 },
      { id: 'during-a', phase: 'during', publicCaption: 'Demontáž', sortOrder: 20 },
    ],
  });

  assert.deepEqual(selected.map((photo) => photo.id), ['before', 'during-a', 'during-b']);
  assert.equal(selected[0].publicCaption, 'Pôvodný stav');
});

test('staršie záznamy s photoIds ostávajú kompatibilné a tiež sa obmedzia na tri', () => {
  const selected = selectPublishedRealizationPhotos({
    photos: [],
    photoIds: ['one', 'two', 'three', 'four'],
  });

  assert.deepEqual(selected.map((photo) => photo.id), ['one', 'two', 'three']);
  assert.ok(selected.every((photo) => photo.phase === 'during'));
});
