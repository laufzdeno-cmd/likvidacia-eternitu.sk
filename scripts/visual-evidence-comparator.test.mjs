import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { assertVisualEvidenceThreshold, compareVisualEvidence } from './compare-visual-evidence.mjs';

test('visual comparator rejects empty evidence sets', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'astana-visual-empty-'));
  const before = path.join(root, 'before');
  const after = path.join(root, 'after');
  await Promise.all([mkdir(before), mkdir(after)]);
  try {
    const empty = await compareVisualEvidence(before, after);
    assert.throws(() => assertVisualEvidenceThreshold(empty), /at least one PNG/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('visual comparator passes identical pixels and fails closed on a real delta', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'astana-visual-compare-'));
  const before = path.join(root, 'before');
  const after = path.join(root, 'after');
  await Promise.all([mkdir(before), mkdir(after)]);
  try {
    const white = await sharp({ create: { width: 2, height: 2, channels: 4, background: '#ffffff' } }).png().toBuffer();
    await Promise.all([
      writeFile(path.join(before, 'sample.png'), white),
      writeFile(path.join(after, 'sample.png'), white),
    ]);
    const identical = await compareVisualEvidence(before, after);
    assert.doesNotThrow(() => assertVisualEvidenceThreshold(identical));

    const black = await sharp({ create: { width: 2, height: 2, channels: 4, background: '#000000' } }).png().toBuffer();
    await writeFile(path.join(after, 'sample.png'), black);
    const changed = await compareVisualEvidence(before, after);
    assert.throws(() => assertVisualEvidenceThreshold(changed), /visual evidence exceeded/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
