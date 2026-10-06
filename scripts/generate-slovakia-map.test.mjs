import assert from 'node:assert/strict';
import test from 'node:test';
import { parseGeometryPackageBlob, renderSvg } from './generate-slovakia-map.mjs';

function fixtureGeoPackageGeometry() {
  const header = Buffer.from([0x47, 0x50, 0x00, 0x01, 0x8a, 0x15, 0x00, 0x00]);
  const multiPolygon = Buffer.alloc(1 + 4 + 4);
  let offset = 0;
  multiPolygon.writeUInt8(1, offset++);
  multiPolygon.writeUInt32LE(1006, offset); offset += 4;
  multiPolygon.writeUInt32LE(1, offset); offset += 4;
  const polygon = Buffer.alloc(1 + 4 + 4 + 4 + 5 * 24);
  offset = 0;
  polygon.writeUInt8(1, offset++);
  polygon.writeUInt32LE(0x80000003, offset); offset += 4;
  polygon.writeUInt32LE(1, offset); offset += 4;
  polygon.writeUInt32LE(5, offset); offset += 4;
  for (const [x, y] of [[0, 0], [10, 0], [10, 5], [0, 5], [0, 0]]) {
    polygon.writeDoubleLE(x, offset); offset += 8;
    polygon.writeDoubleLE(y, offset); offset += 8;
    polygon.writeDoubleLE(100, offset); offset += 8;
  }
  return Buffer.concat([header, multiPolygon, polygon]);
}

test('GeoPackage 3D multipolygon is converted to a 2D SVG outline with attribution', () => {
  const geometry = parseGeometryPackageBlob(fixtureGeoPackageGeometry());
  const svg = renderSvg(geometry);
  assert.equal(geometry.type, 'MultiPolygon');
  assert.equal(geometry.coordinates[0][0].length, 5);
  assert.match(svg, /<title id="title">Mapa Slovenskej republiky<\/title>/);
  assert.match(svg, /GKÚ Bratislava/);
  assert.match(svg, /CC BY 4\.0/);
  assert.match(svg, /<path d="M/);
  assert.doesNotMatch(svg, /100(?:\.00)?/);
});

test('map conversion refuses an unrecognized or empty GeoPackage geometry', () => {
  assert.throws(() => parseGeometryPackageBlob(Buffer.from('not-gpkg')), /hlavičku GeoPackage/);
  assert.throws(() => renderSvg({ type: 'MultiPolygon', coordinates: [] }), /nemá žiadne hranice/);
});
