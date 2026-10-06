import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import localityDataset from '../src/data/slovakia-locality-points.json' with { type: 'json' };

const require = createRequire(import.meta.url);
const { mapPublishedRealizationLocalityPoints } = require('../src/lib/published-realization-locality-points.ts');

const makeCase = (id, locality, localityPrecision = 'municipality', extra = {}) => ({ id, locality, localityPrecision, ...extra });
const rows = (...locations) => ({ locations });

test('maps Poprad only to the static point matching declared municipality or district precision', () => {
  const cases = [makeCase('poprad-obec', 'Poprad'), makeCase('poprad-okres', 'Poprad', 'district')];
  assert.deepEqual(mapPublishedRealizationLocalityPoints(cases), [
    { caseId: 'poprad-obec', x: 435.99, y: 152.13 },
    { caseId: 'poprad-okres', x: 425.42, y: 159.27 },
  ]);
});

test('matches exact official names after Unicode diacritic, case and whitespace normalization', () => {
  const source = rows(['Banská Bystrica', 'obec', 31, 42]);
  const result = mapPublishedRealizationLocalityPoints([
    makeCase('spacing-case', '  bANSKÁ    bYSTRICA  '),
    makeCase('unicode-normalization', 'Banska\u0301 Bystrica'),
  ], source);
  assert.deepEqual(result, [
    { caseId: 'spacing-case', x: 31, y: 42 },
    { caseId: 'unicode-normalization', x: 31, y: 42 },
  ]);
});

test('ambiguous duplicate names in the required granularity produce no point', () => {
  const source = rows(['Poprad', 'obec', 1, 2], [' POPRAD ', 'obec', 3, 4], ['Poprad', 'okres', 5, 6]);
  assert.deepEqual(mapPublishedRealizationLocalityPoints([makeCase('duplicate', 'Poprad')], source), []);
});

test('wrong granularity never falls back between municipality and district', () => {
  const source = rows(['Poprad', 'okres', 5, 6], ['Kežmarok', 'obec', 7, 8]);
  assert.deepEqual(mapPublishedRealizationLocalityPoints([
    makeCase('need-obec', 'Poprad', 'municipality'),
    makeCase('need-okres', 'Kežmarok', 'district'),
  ], source), []);
});

test('normalizes explicit locality prefixes only when they match declared precision', () => {
  const source = rows(['Poprad', 'okres', 5, 6], ['Poprad', 'obec', 1, 2]);
  assert.deepEqual(mapPublishedRealizationLocalityPoints([
    makeCase('prefixed-district', 'okres Poprad', 'district'),
    makeCase('prefixed-municipality', 'obec Poprad', 'municipality'),
    makeCase('wrong-prefix', 'okres Poprad', 'municipality'),
  ], source), [
    { caseId: 'prefixed-district', x: 5, y: 6 },
    { caseId: 'prefixed-municipality', x: 1, y: 2 },
  ]);
});

test('unknown, empty and explicitly approximate names or unsupported precision are omitted', () => {
  const source = rows(['Poprad', 'obec', 1, 2]);
  assert.deepEqual(mapPublishedRealizationLocalityPoints([
    makeCase('unknown', 'Neznáme mesto'),
    makeCase('empty', '   '),
    makeCase('deliberately-unmapped', '', 'none'),
    makeCase('estimated', 'Poprad – okolie'),
    makeCase('estimated-marker', 'cca Poprad'),
    makeCase('unknown-type', 'Poprad', 'city'),
    makeCase('none', 'Poprad', 'none'),
  ], source), []);
});

test('explicitly non-published lifecycle values are rejected at runtime', () => {
  assert.deepEqual(mapPublishedRealizationLocalityPoints([
    makeCase('draft', 'Poprad', 'municipality', { lifecycle: 'draft' }),
    makeCase('published', 'Poprad', 'municipality', { lifecycle: 'published' }),
  ], rows(['Poprad', 'obec', 1, 2])), [{ caseId: 'published', x: 1, y: 2 }]);
});

test('bundled ZBGIS rows expose only the exact static Poprad SVG point per type', () => {
  assert.deepEqual(mapPublishedRealizationLocalityPoints([
    makeCase('poprad-obec', 'Poprad'), makeCase('poprad-okres', 'Poprad', 'district'),
  ], localityDataset), [
    { caseId: 'poprad-obec', x: 435.99, y: 152.13 },
    { caseId: 'poprad-okres', x: 425.42, y: 159.27 },
  ]);
});
