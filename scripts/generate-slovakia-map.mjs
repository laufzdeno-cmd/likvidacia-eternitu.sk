import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const attribution = 'Podklad: GKÚ Bratislava, ZBGIS® – Hranice územného a správneho usporiadania SR, generalizácia 3 (stav zdroja podľa metadát 2026-06-30). Licencia CC BY 4.0.';
const sourceUrl = 'https://www.gku.sk/geoportal-en/zbgis/download/';

export function parseGeometryPackageBlob(blob) {
  if (blob.subarray(0, 2).toString('ascii') !== 'GP') throw new Error('Súbor neobsahuje hlavičku GeoPackage.');
  const flags = blob[3];
  const littleEndian = Boolean(flags & 1);
  const envelopeIndicator = (flags >> 1) & 7;
  const envelopeBytes = [0, 32, 48, 48, 64][envelopeIndicator];
  if (envelopeBytes === undefined) throw new Error('GeoPackage používa neznámy typ súradnicovej obálky.');
  const offset = 8 + envelopeBytes;
  return parseWkb(blob, offset);
}

function parseWkb(blob, start) {
  let offset = start;
  const readGeometry = () => {
    const byteOrder = blob.readUInt8(offset++);
    if (byteOrder !== 0 && byteOrder !== 1) throw new Error('Neplatné poradie bajtov WKB.');
    const littleEndian = byteOrder === 1;
    const uint32 = () => {
      const value = littleEndian ? blob.readUInt32LE(offset) : blob.readUInt32BE(offset);
      offset += 4;
      return value;
    };
    const double = () => {
      const value = littleEndian ? blob.readDoubleLE(offset) : blob.readDoubleBE(offset);
      offset += 8;
      return value;
    };
    const typeWord = uint32();
    const unflaggedType = typeWord & 0x0fffffff;
    const dimensionType = Math.floor(unflaggedType / 1000);
    const hasZ = Boolean(typeWord & 0x80000000) || dimensionType === 1 || dimensionType === 3;
    const hasM = Boolean(typeWord & 0x40000000) || dimensionType === 2 || dimensionType === 3;
    const type = unflaggedType % 1000;
    const readPoint = () => {
      const point = [double(), double()];
      if (hasZ) double();
      if (hasM) double();
      return point;
    };
    if (type === 6) {
      const count = uint32();
      const polygons = [];
      for (let i = 0; i < count; i++) polygons.push(readGeometry());
      return { type: 'MultiPolygon', coordinates: polygons.map((item) => item.coordinates) };
    }
    if (type === 3) {
      const ringCount = uint32();
      const rings = [];
      for (let ring = 0; ring < ringCount; ring++) {
        const pointCount = uint32();
        const points = [];
        for (let point = 0; point < pointCount; point++) points.push(readPoint());
        rings.push(points);
      }
      return { type: 'Polygon', coordinates: rings };
    }
    throw new Error(`Nepodporovaný typ WKB geometrie: ${type}.`);
  };

  const geometry = readGeometry();
  if (offset > blob.length) throw new Error('Súbor geometrie je poškodený.');
  return geometry;
}

export function renderSvg(geometry) {
  const rings = geometry.coordinates.flatMap((polygon) => polygon);
  const points = rings.flat();
  if (!points.length) throw new Error('Mapový podklad nemá žiadne hranice.');
  const minX = Math.min(...points.map(([x]) => x));
  const maxX = Math.max(...points.map(([x]) => x));
  const minY = Math.min(...points.map(([, y]) => y));
  const maxY = Math.max(...points.map(([, y]) => y));
  const width = 720;
  const height = 420;
  const padding = 16;
  const scale = Math.min((width - 2 * padding) / (maxX - minX), (height - 2 * padding) / (maxY - minY));
  const drawnWidth = (maxX - minX) * scale;
  const drawnHeight = (maxY - minY) * scale;
  const left = (width - drawnWidth) / 2;
  const top = (height - drawnHeight) / 2;
  const paths = rings.map((ring) => {
    const commands = ring.map(([x, y], index) => {
      const px = left + (x - minX) * scale;
      const py = top + (maxY - y) * scale;
      return `${index === 0 ? 'M' : 'L'}${px.toFixed(2)} ${py.toFixed(2)}`;
    });
    return `${commands.join('')}Z`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description">
  <title id="title">Mapa Slovenskej republiky</title>
  <desc id="description">Zovšeobecnené územné hranice Slovenska. Mapa je podkladom pre približné lokality schválených realizácií, nie mapou presných adries.</desc>
  <metadata>${attribution} Zdroj údajov: ${sourceUrl}</metadata>
  <g fill="#eaf0f6" fill-rule="evenodd" stroke="#8ea2ba" stroke-width="1.25" stroke-linejoin="round">
    ${paths.map((data) => `<path d="${data}"/>`).join('\n    ')}
  </g>
</svg>
`;
}

async function main() {
  const [source, destination] = process.argv.slice(2);
  if (!source || !destination) throw new Error('Použitie: node scripts/generate-slovakia-map.mjs <ZBGIS.gpkg> <výstup.svg>');
  const bytes = await readFile(source);
  const geometry = parseGeometryPackageBlob(bytes);
  const svg = renderSvg(geometry);
  const output = path.resolve(destination);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, svg, 'utf8');
  console.log(`Vytvorená generalizovaná mapa: ${output}`);
  console.log(`Licencia: CC BY 4.0; atribúcia: ${attribution}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Mapový podklad sa nepodarilo spracovať.');
    process.exitCode = 1;
  });
}
