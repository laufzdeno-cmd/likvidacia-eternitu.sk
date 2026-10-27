import assert from 'node:assert/strict';
import test from 'node:test';
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import PDFDocument from 'pdfkit';
import { extractJobPdf } from '../src/server/job-pdf-extraction.ts';

test('PDF text extraction works with only the explicitly traced package files, without parent node_modules', async () => {
  const previous = process.cwd();
  const parent = path.resolve(tmpdir());
  const directory = await mkdtemp(path.join(parent, 'astana-pdf-trace-'));
  try {
    const packageRoot = path.join(directory, 'node_modules/pdfjs-dist');
    await mkdir(path.join(packageRoot, 'legacy/build'), { recursive: true });
    for (const file of ['package.json', 'legacy/build/pdf.mjs', 'legacy/build/pdf.worker.mjs']) await cp(path.join(previous, 'node_modules/pdfjs-dist', file), path.join(packageRoot, file));
    await writeFile(path.join(directory, 'package.json'), '{"name":"isolated-pdf-trace","type":"module"}');
    const pdf = new PDFDocument({ compress: true }); const chunks = []; pdf.on('data', chunk => chunks.push(chunk));
    const ended = new Promise(resolve => pdf.once('end', resolve)); pdf.text('Cenova ponuka CP-2026-TRACE\nCelkom s DPH: 1234,56 EUR'); pdf.end(); await ended;
    process.chdir(directory);
    const result = await extractJobPdf(Buffer.concat(chunks));
    assert.equal(result.state, 'TEXT', JSON.stringify(result));
    assert.ok(result.suggestions.some(item => item.field === 'originalNumber' && item.value === 'CP-2026-TRACE'));
  } finally {
    process.chdir(previous);
    assert.ok(path.resolve(directory).startsWith(parent + path.sep));
    await rm(directory, { recursive: true, force: true });
  }
});
