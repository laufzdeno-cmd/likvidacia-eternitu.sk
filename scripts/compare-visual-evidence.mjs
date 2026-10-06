import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const scriptPath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(scriptPath), '..');

export async function compareVisualEvidence(beforeRoot, afterRoot) {
  const roots = [beforeRoot, afterRoot];
  const [beforeFiles, afterFiles] = await Promise.all(roots.map((root) => readdir(root)));
  assert.deepEqual([...beforeFiles].sort(), [...afterFiles].sort(), 'evidence sets must contain the same files');

  const results = [];
  for (const file of [...beforeFiles].sort()) {
    if (file === 'manifest.json') continue;
    assert.match(file, /^[a-z0-9-]+\.png$/);
    const images = await Promise.all(roots.map(async (root) => {
      const pipeline = sharp(path.join(root, file)).ensureAlpha();
      const metadata = await pipeline.metadata();
      const pixels = await pipeline.raw().toBuffer();
      return { metadata, pixels };
    }));
    assert.equal(images[0].metadata.width, images[1].metadata.width, `${file} width changed`);
    assert.equal(images[0].metadata.height, images[1].metadata.height, `${file} height changed`);
    assert.equal(images[0].pixels.length, images[1].pixels.length, `${file} pixel buffer changed`);

    let changedPixels = 0;
    let changedPixelsOver3 = 0;
    let changedPixelsOver10 = 0;
    let maxChannelDelta = 0;
    let absoluteChannelDelta = 0;
    for (let offset = 0; offset < images[0].pixels.length; offset += 4) {
      let pixelDelta = 0;
      for (let channel = 0; channel < 4; channel += 1) {
        const delta = Math.abs(images[0].pixels[offset + channel] - images[1].pixels[offset + channel]);
        pixelDelta = Math.max(pixelDelta, delta);
        maxChannelDelta = Math.max(maxChannelDelta, delta);
        absoluteChannelDelta += delta;
      }
      if (pixelDelta > 0) changedPixels += 1;
      if (pixelDelta > 3) changedPixelsOver3 += 1;
      if (pixelDelta > 10) changedPixelsOver10 += 1;
    }
    const totalPixels = images[0].pixels.length / 4;
    results.push({
      file,
      width: images[0].metadata.width,
      height: images[0].metadata.height,
      changedPercent: Number((100 * changedPixels / totalPixels).toFixed(5)),
      changedOver3Percent: Number((100 * changedPixelsOver3 / totalPixels).toFixed(5)),
      changedOver10Percent: Number((100 * changedPixelsOver10 / totalPixels).toFixed(5)),
      meanAbsoluteChannelDelta: Number((absoluteChannelDelta / images[0].pixels.length).toFixed(6)),
      maxChannelDelta,
    });
  }
  return results;
}

export function assertVisualEvidenceThreshold(results, maxChangedOver10Percent = 0) {
  assert.ok(Number.isFinite(maxChangedOver10Percent) && maxChangedOver10Percent >= 0,
    'visual threshold must be a non-negative number');
  assert.ok(results.length > 0, 'visual evidence must compare at least one PNG file');
  const offenders = results.filter((result) => result.changedOver10Percent > maxChangedOver10Percent);
  assert.deepEqual(offenders, [],
    `visual evidence exceeded ${maxChangedOver10Percent}% pixels with a channel delta over 10: ${JSON.stringify(offenders)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const positional = process.argv.slice(2).filter((argument) => !argument.startsWith('--'));
  assert.equal(positional.length, 2,
    'usage: node scripts/compare-visual-evidence.mjs <before-label> <after-label> [--max-changed-over-10-percent=N]');
  for (const label of positional) assert.match(label, /^[a-z0-9-]{1,40}$/, 'evidence labels must be path-safe');
  const thresholdArgument = process.argv.slice(2).find((argument) => argument.startsWith('--max-changed-over-10-percent='));
  const maxChangedOver10Percent = thresholdArgument ? Number(thresholdArgument.split('=')[1]) : 0;
  const roots = positional.map((label) => path.join(projectRoot, 'tmp', 'visual-evidence-exports', label));
  const results = await compareVisualEvidence(roots[0], roots[1]);
  const report = { before: positional[0], after: positional[1], maxChangedOver10Percent, results };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  assertVisualEvidenceThreshold(results, maxChangedOver10Percent);
}
