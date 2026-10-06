import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { parseGeometryPackageBlob } from './generate-slovakia-map.mjs';

const WIDTH = 720;
const HEIGHT = 420;
const PADDING = 16;
const SOURCE = 'GKÚ Bratislava, ZBGIS® – Hranice územného a správneho usporiadania SR, generalizácia 3';
const SOURCE_URL = 'https://www.gku.sk/geoportal-en/zbgis/download/';
const ATTRIBUTION = 'Podklad: GKÚ Bratislava, ZBGIS® – Hranice územného a správneho usporiadania SR, generalizácia 3. Licencia CC BY 4.0.';

function polygonsOf(geometry) {
  if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type) || !Array.isArray(geometry.coordinates)) return [];
  return geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
}

function validPolygon(polygon) {
  if (!Array.isArray(polygon) || polygon.length === 0) return false;
  return polygon.every((ring) => Array.isArray(ring) && ring.length >= 4
    && ring.every((point) => Array.isArray(point) && point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]))
    && samePoint(ring[0], ring.at(-1))
    && Math.abs(signedArea(ring)) > Number.EPSILON
    && isSimpleRing(ring));
}

function samePoint(a, b) {
  return a?.[0] === b?.[0] && a?.[1] === b?.[1];
}

function signedArea(ring) {
  let twiceArea = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    twiceArea += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return twiceArea / 2;
}

function orientation(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function onSegment(a, b, point) {
  return point[0] >= Math.min(a[0], b[0]) && point[0] <= Math.max(a[0], b[0])
    && point[1] >= Math.min(a[1], b[1]) && point[1] <= Math.max(a[1], b[1]);
}

function segmentsIntersect(a, b, c, d) {
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);
  if (((abC > 0 && abD < 0) || (abC < 0 && abD > 0)) && ((cdA > 0 && cdB < 0) || (cdA < 0 && cdB > 0))) return true;
  return (abC === 0 && onSegment(a, b, c)) || (abD === 0 && onSegment(a, b, d))
    || (cdA === 0 && onSegment(c, d, a)) || (cdB === 0 && onSegment(c, d, b));
}

function isSimpleRing(ring) {
  const edgeCount = ring.length - 1;
  for (let i = 0; i < edgeCount; i++) {
    for (let j = i + 1; j < edgeCount; j++) {
      if (j === i + 1 || (i === 0 && j === edgeCount - 1)) continue;
      if (segmentsIntersect(ring[i], ring[i + 1], ring[j], ring[j + 1])) return false;
    }
  }
  return true;
}

function polygonArea(polygon) {
  return Math.abs(signedArea(polygon[0])) - polygon.slice(1).reduce((sum, ring) => sum + Math.abs(signedArea(ring)), 0);
}

function intersectionsAtY(ring, y) {
  const xs = [];
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    if ((y1 <= y && y < y2) || (y2 <= y && y < y1)) {
      xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
    }
  }
  return xs.sort((a, b) => a - b);
}

function widestInteriorSlice(polygon) {
  const ys = [...new Set(polygon.flatMap((ring) => ring.slice(0, -1).map((point) => point[1])))].sort((a, b) => a - b);
  let best = null;
  for (let i = 0; i < ys.length - 1; i++) {
    const y = ys[i] + (ys[i + 1] - ys[i]) / 2;
    if (!Number.isFinite(y) || y <= ys[i] || y >= ys[i + 1]) continue;
    const xs = polygon.flatMap((ring) => intersectionsAtY(ring, y)).sort((a, b) => a - b);
    for (let j = 0; j + 1 < xs.length; j += 2) {
      const width = xs[j + 1] - xs[j];
      if (width > 0 && (!best || width > best.width || (width === best.width && y < best.y))) {
        best = { point: [xs[j] + width / 2, y], width };
      }
    }
  }
  return best;
}

/**
 * Returns an interior point of the largest valid polygon component. For each
 * component it scans between consecutive vertex Y values, pairs crossings by
 * even/odd parity (therefore excluding holes), and selects the widest interior
 * interval. Ties are resolved toward the smaller source Y for repeatability.
 */
export function representativePoint(geometry) {
  const candidates = polygonsOf(geometry)
    .filter(validPolygon)
    .map((polygon) => ({ area: polygonArea(polygon), slice: widestInteriorSlice(polygon) }))
    .filter(({ area, slice }) => area > 0 && slice && Number.isFinite(slice.point[0]) && Number.isFinite(slice.point[1]))
    .sort((a, b) => b.area - a.area || b.slice.width - a.slice.width || a.slice.point[1] - b.slice.point[1] || a.slice.point[0] - b.slice.point[0]);
  return candidates[0]?.slice.point ?? null;
}

export function geometryBounds(geometry) {
  const points = polygonsOf(geometry).flatMap((polygon) => polygon.flat()).filter((point) =>
    Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]));
  if (!points.length) throw new Error('Podklad mapy neobsahuje platné hranice.');
  const minX = Math.min(...points.map(([x]) => x));
  const maxX = Math.max(...points.map(([x]) => x));
  const minY = Math.min(...points.map(([, y]) => y));
  const maxY = Math.max(...points.map(([, y]) => y));
  if (!(maxX > minX) || !(maxY > minY)) throw new Error('Podklad mapy má neplatný rozsah.');
  return { minX, maxX, minY, maxY };
}

/** Uses the exact centered scale, 16px padding and inverted Y-axis of renderSvg. */
export function projectToSvg([x, y], bounds, width = WIDTH, height = HEIGHT) {
  const scale = Math.min((width - 2 * PADDING) / (bounds.maxX - bounds.minX), (height - 2 * PADDING) / (bounds.maxY - bounds.minY));
  const drawnWidth = (bounds.maxX - bounds.minX) * scale;
  const drawnHeight = (bounds.maxY - bounds.minY) * scale;
  const left = (width - drawnWidth) / 2;
  const top = (height - drawnHeight) / 2;
  return [left + (x - bounds.minX) * scale, top + (bounds.maxY - y) * scale];
}

function compareStable(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function makeLocations(rows, bounds) {
  const locations = [];
  const skipped = { emptyName: 0, invalidGeometry: 0 };
  for (const row of rows) {
    const name = typeof row.name === 'string' ? row.name.trim().normalize('NFC') : '';
    if (!name) {
      skipped.emptyName++;
      continue;
    }
    let point;
    try {
      const geometry = row.geometry && !ArrayBuffer.isView(row.geometry)
        ? row.geometry
        : parseGeometryPackageBlob(Buffer.from(row.geometry));
      point = representativePoint(geometry);
    } catch {
      point = null;
    }
    if (!point) {
      skipped.invalidGeometry++;
      continue;
    }
    const [x, y] = projectToSvg(point, bounds);
    if (![x, y].every(Number.isFinite) || x < 0 || x > WIDTH || y < 0 || y > HEIGHT) {
      skipped.invalidGeometry++;
      continue;
    }
    // Compact tuple schema: [officialName, officialLocalityType, svgX, svgY].
    locations.push([name, row.type, Number(x.toFixed(2)), Number(y.toFixed(2))]);
  }
  locations.sort((a, b) => compareStable(a[0], b[0]) || compareStable(a[1], b[1]) || a[2] - b[2] || a[3] - b[3]);
  return { locations, skipped };
}

export function buildLocalityDataset({ municipalityRows, districtRows, countryGeometry, dataDates }) {
  const bounds = geometryBounds(countryGeometry);
  const municipality = makeLocations(municipalityRows.map((row) => ({ ...row, type: 'obec' })), bounds);
  const district = makeLocations(districtRows.map((row) => ({ ...row, type: 'okres' })), bounds);
  const locations = [...municipality.locations, ...district.locations]
    .sort((a, b) => compareStable(a[0], b[0]) || compareStable(a[1], b[1]) || a[2] - b[2] || a[3] - b[3]);
  return {
    source: SOURCE,
    sourceUrl: SOURCE_URL,
    attribution: ATTRIBUTION,
    license: 'CC BY 4.0',
    dataDates: [...dataDates].sort(compareStable),
    viewBox: `0 0 ${WIDTH} ${HEIGHT}`,
    locations,
  };
}

function readLayer(db, tableName, nameColumn, type) {
  // Identifiers are fixed constants, never caller-provided values.
  return db.prepare(`SELECT "${nameColumn}" AS name, "Shape" AS geometry FROM "${tableName}"`).all()
    .map((row) => ({ ...row, type }));
}

function getDataDates(db) {
  const dates = db.prepare('SELECT DISTINCT "DOW" AS date FROM "obec_3" UNION SELECT DISTINCT "DOW" AS date FROM "okres_3"').all()
    .map((row) => typeof row.date === 'string' ? row.date.slice(0, 10) : '')
    .filter(Boolean)
    .sort(compareStable);
  if (dates.length) return dates;
  throw new Error('V GeoPackage sa nenašiel dátum aktualizácie vrstiev.');
}

export async function generateLocalityPoints(source, destination) {
  const db = new DatabaseSync(source, { readOnly: true });
  try {
    const actualLayers = new Set(db.prepare('SELECT table_name FROM gpkg_contents WHERE data_type = ?').all('features').map((row) => row.table_name));
    for (const required of ['obec_3', 'okres_3', 'sr_3']) {
      if (!actualLayers.has(required)) throw new Error(`GeoPackage neobsahuje požadovanú vrstvu ${required}.`);
    }
    const municipalityRows = readLayer(db, 'obec_3', 'NM4', 'obec');
    const districtRows = readLayer(db, 'okres_3', 'NM3', 'okres');
    const countryBlob = db.prepare('SELECT "Shape" AS geometry FROM "sr_3" LIMIT 1').get()?.geometry;
    const countryGeometry = parseGeometryPackageBlob(Buffer.from(countryBlob));
    const result = buildLocalityDataset({ municipalityRows, districtRows, countryGeometry, dataDates: getDataDates(db) });
    await mkdir(path.dirname(path.resolve(destination)), { recursive: true });
    await writeFile(destination, `${JSON.stringify(result)}\n`, 'utf8');
    return { municipalityCount: result.locations.filter(([, type]) => type === 'obec').length, districtCount: result.locations.filter(([, type]) => type === 'okres').length, bytes: Buffer.byteLength(JSON.stringify(result) + '\n'), dataDates: result.dataDates };
  } finally {
    db.close();
  }
}

async function main() {
  const [source, destination] = process.argv.slice(2);
  if (!source || !destination) throw new Error('Použitie: node scripts/generate-slovakia-locality-points.mjs <USJ_hranice_3.gpkg> <výstup.json>');
  const result = await generateLocalityPoints(source, destination);
  console.log(`Vytvorený dataset lokalít: ${path.resolve(destination)}`);
  console.log(`Dátumy záznamov: ${result.dataDates.join(', ')}; obce: ${result.municipalityCount}; okresy: ${result.districtCount}; veľkosť: ${result.bytes} B.`);
  console.log(`Licencia: CC BY 4.0; ${ATTRIBUTION}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Body lokalít sa nepodarilo vytvoriť.');
    process.exitCode = 1;
  });
}
