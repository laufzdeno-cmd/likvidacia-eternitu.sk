import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLocalityDataset, geometryBounds, projectToSvg, representativePoint } from './generate-slovakia-locality-points.mjs';

const polygon = (rings) => ({ type: 'Polygon', coordinates: rings });
const rectangle = (x1, y1, x2, y2) => [[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]];
const bounds = { minX: 0, minY: 0, maxX: 100, maxY: 50 };

test('representative point is deterministic and strictly inside a concave polygon', () => {
  const concave = polygon([[[0, 0], [12, 0], [12, 2], [2, 2], [2, 10], [0, 10], [0, 0]]]);
  assert.deepEqual(representativePoint(concave), [6, 1]);
  assert.deepEqual(representativePoint(concave), representativePoint(concave));
});

test('representative point excludes polygon holes and chooses the largest multipolygon component', () => {
  const withHole = polygon([rectangle(0, 0, 10, 10), rectangle(3, 3, 7, 7)]);
  const point = representativePoint(withHole);
  assert.deepEqual(point, [5, 1.5]);
  assert.equal(point[0] > 3 && point[0] < 7 && point[1] > 3 && point[1] < 7, false);

  const multi = { type: 'MultiPolygon', coordinates: [[rectangle(0, 0, 2, 2)], [rectangle(10, 0, 20, 8)]] };
  assert.deepEqual(representativePoint(multi), [15, 4]);
});

test('empty, malformed, degenerate and unsupported geometry fail closed', () => {
  assert.equal(representativePoint({ type: 'Polygon', coordinates: [] }), null);
  assert.equal(representativePoint(polygon([[[0, 0], [1, 1], [2, 2], [0, 0]]])), null);
  assert.equal(representativePoint(polygon([[[0, 0], [1, 0], [Number.NaN, 1], [0, 0]]])), null);
  assert.equal(representativePoint(polygon([[[0, 0], [4, 4], [0, 4], [4, 0], [0, 0]]])), null);
  assert.equal(representativePoint(polygon([[[0, 0], [4, 0], [4, 4], [0, 4]]])), null, 'open rings are malformed');
  assert.equal(representativePoint({ type: 'LineString', coordinates: [] }), null);
});

test('projection matches the map viewBox and keeps both full bounds within 16px padding', () => {
  const corners = [[bounds.minX, bounds.minY], [bounds.minX, bounds.maxY], [bounds.maxX, bounds.minY], [bounds.maxX, bounds.maxY]]
    .map((point) => projectToSvg(point, bounds));
  assert.deepEqual(corners, [[16, 382], [16, 38], [704, 382], [704, 38]]);
  for (const [x, y] of corners) {
    assert.ok(x >= 0 && x <= 720);
    assert.ok(y >= 0 && y <= 420);
  }
  assert.deepEqual(geometryBounds({ type: 'MultiPolygon', coordinates: [[rectangle(0, 0, 100, 50)]] }), bounds);
});

test('dataset is compact, attributed, deterministic and retains duplicate official names in stable order', () => {
  const countryGeometry = { type: 'MultiPolygon', coordinates: [[rectangle(0, 0, 100, 50)]] };
  const a = { name: 'Rovnaká obec', geometry: { type: 'Polygon', coordinates: [rectangle(20, 10, 30, 20)] } };
  const b = { name: 'Rovnaká obec', geometry: { type: 'Polygon', coordinates: [rectangle(60, 10, 70, 20)] } };
  const dataset = buildLocalityDataset({
    municipalityRows: [b, a],
    districtRows: [{ name: 'Okres', geometry: { type: 'Polygon', coordinates: [rectangle(1, 1, 10, 10)] } }],
    countryGeometry,
    dataDates: ['2026-06-30', '2024-12-31'],
  });
  assert.equal(dataset.locations.length, 3);
  assert.deepEqual(dataset.locations.slice(1).map((row) => row.slice(0, 2)), [['Rovnaká obec', 'obec'], ['Rovnaká obec', 'obec']]);
  assert.ok(dataset.locations[1][2] < dataset.locations[2][2]);
  assert.equal(dataset.source, 'GKÚ Bratislava, ZBGIS® – Hranice územného a správneho usporiadania SR, generalizácia 3');
  assert.equal(dataset.license, 'CC BY 4.0');
  assert.deepEqual(dataset.dataDates, ['2024-12-31', '2026-06-30']);
  assert.equal(dataset.viewBox, '0 0 720 420');
  assert.equal(dataset.locations.every((row) => row.length === 4 && typeof row[0] === 'string' && ['obec', 'okres'].includes(row[1]) && Number.isFinite(row[2]) && Number.isFinite(row[3])), true);
  assert.equal(JSON.stringify(dataset).includes('customer'), false);
  assert.deepEqual(
    buildLocalityDataset({ municipalityRows: [a, b], districtRows: [{ name: 'Okres', geometry: { type: 'Polygon', coordinates: [rectangle(1, 1, 10, 10)] } }], countryGeometry, dataDates: ['2024-12-31', '2026-06-30'] }),
    dataset,
  );
});
