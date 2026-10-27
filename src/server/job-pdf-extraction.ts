import { Worker } from 'node:worker_threads';
import { findPackageJSON } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

export const jobPdfLimits = { maxBytes: 3 * 1024 * 1024, maxPages: 25, maxTextCharacters: 100_000, timeoutMs: 15_000 } as const;
export type JobPdfSuggestion = { field: 'originalNumber' | 'issuedOn' | 'email' | 'phone' | 'totalWithVatCents'; value: string; sourceText: string; confidence: 'REVIEW_REQUIRED' };
export type JobPdfExtraction = { state: 'TEXT' | 'MANUAL_REQUIRED'; text: string; pages: number | null; suggestions: JobPdfSuggestion[]; reason: 'scanned_or_empty' | 'encrypted_or_invalid' | 'limits' | 'unavailable' | null };

export function validateJobPdf(bytes: Uint8Array) {
  if (!bytes.byteLength || bytes.byteLength > jobPdfLimits.maxBytes) throw new Error('PDF môže mať najviac 3 MB.');
  if (Buffer.from(bytes.subarray(0, 5)).toString('ascii') !== '%PDF-') throw new Error('Súbor nie je platný PDF dokument.');
}

function validDate(day: string, month: string, year: string) {
  const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  const value = new Date(`${iso}T12:00:00Z`);
  return Number.isFinite(value.valueOf()) && value.toISOString().slice(0, 10) === iso ? iso : '';
}

/** Deterministic proposals only. Text in a PDF never grants permission to send or change a job. */
export function suggestJobPdfFields(text: string): JobPdfSuggestion[] {
  const bounded = text.slice(0, jobPdfLimits.maxTextCharacters);
  const suggestions: JobPdfSuggestion[] = [];
  const add = (field: JobPdfSuggestion['field'], value: string, sourceText: string) => {
    if (value && !suggestions.some((item) => item.field === field && item.value === value)) suggestions.push({ field, value, sourceText: sourceText.slice(0, 180), confidence: 'REVIEW_REQUIRED' });
  };
  const number = bounded.match(/(?:cenov[áa]\s+ponuka|ponuka|CP)\s*(?:č[íi]slo|č\.?|č\.?\s*:|č\.?\s*#|nr\.?|:|#)?\s*[:#]?\s*([A-Z0-9][A-Z0-9\/-]{2,39})/iu);
  if (number) add('originalNumber', number[1], number[0]);
  const issued = bounded.match(/(?:d[áa]tum\s+(?:vystavenia|vyhotovenia)|vystaven[áeé]|vyhotoven[áeé])\s*:?\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(20\d{2})/iu);
  if (issued) add('issuedOn', validDate(issued[1], issued[2], issued[3]), issued[0]);
  // Contact details are proposed only from explicitly labelled customer lines; the company footer is not the customer.
  const customer = bounded.match(/(?:objedn[áa]vate[ľl]|odberate[ľl]|z[áa]kazn[íi]k|kontakt\s+z[áa]kazn[íi]ka)[^\n]{0,800}/iu)?.[0] || '';
  const email = customer.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu);
  if (email) add('email', email[0].toLowerCase(), customer);
  const phone = customer.match(/(?:telef[óo]n|tel\.?|mobil)\s*:?\s*(\+?[\d ()-]{8,25})/iu);
  if (phone) add('phone', phone[1].trim(), phone[0]);
  const total = bounded.match(/(?:celkom\s+s\s*DPH|spolu\s+s\s*DPH|celkom\s+na\s+[úu]hradu|k\s+[úu]hrade)\s*:?\s*(\d[\d\s\u00a0]*(?:[.,]\d{2}))\s*(?:EUR|€)/iu);
  if (total) {
    const amount = Number(total[1].replace(/[\s\u00a0]/g, '').replace(',', '.'));
    if (Number.isFinite(amount) && amount > 0 && amount <= 10_000_000) add('totalWithVatCents', String(Math.round(amount * 100)), total[0]);
  }
  return suggestions;
}

const workerSource = `
const { parentPort, workerData } = require('node:worker_threads');
(async () => {
  const { getDocument } = await import(workerData.moduleUrl);
  const task = getDocument({ data: new Uint8Array(workerData.bytes), isEvalSupported: false, useSystemFonts: false, disableFontFace: true, stopAtErrors: true, verbosity: 0 });
  let document;
  try {
    document = await task.promise;
    if (document.numPages > workerData.maxPages) { parentPort.postMessage({ reason: 'limits' }); return; }
    const lines = [];
    let length = 0;
    for (let i=1; i<=document.numPages; i++) {
      const page = await document.getPage(i);
      const content = await page.getTextContent();
      let line = '';
      for (const item of content.items) {
        if (!('str' in item)) continue;
        line += item.str + (item.hasEOL ? '\\n' : ' ');
      }
      length += line.length;
      if (length > workerData.maxTextCharacters) { parentPort.postMessage({ reason: 'limits' }); return; }
      lines.push(line);
      page.cleanup();
    }
    parentPort.postMessage({ text: lines.join('\\n'), pages: document.numPages });
  } finally { if (document) await document.destroy(); else await task.destroy(); }
})().catch(() => parentPort.postMessage({ reason: 'encrypted_or_invalid' }));
`;

export async function extractJobPdf(bytes: Uint8Array): Promise<JobPdfExtraction> {
  validateJobPdf(bytes);
  const manual = (reason: JobPdfExtraction['reason']): JobPdfExtraction => ({ state: 'MANUAL_REQUIRED', text: '', pages: null, suggestions: [], reason });
  let moduleUrl: string;
  // Use Node's package locator, not require.resolve: Webpack rewrites the latter
  // as an ESM require. Production uses Node 24; worker files are explicitly traced.
  try {
    const manifest = findPackageJSON('pdfjs-dist', pathToFileURL(path.join(process.cwd(), 'package.json')));
    if (!manifest) return manual('unavailable');
    moduleUrl = pathToFileURL(path.join(path.dirname(manifest), 'legacy', 'build', 'pdf.mjs')).href;
  }
  catch { return manual('unavailable'); }
  return new Promise((resolve) => {
    const worker = new Worker(workerSource, {
      eval: true,
      workerData: { moduleUrl, bytes: new Uint8Array(bytes), maxPages: jobPdfLimits.maxPages, maxTextCharacters: jobPdfLimits.maxTextCharacters },
      resourceLimits: { maxOldGenerationSizeMb: 192, maxYoungGenerationSizeMb: 32, stackSizeMb: 4 },
    });
    let settled = false;
    const finish = (result: JobPdfExtraction) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      resolve(result);
    };
    const timer = setTimeout(() => finish(manual('limits')), jobPdfLimits.timeoutMs);
    worker.once('message', (payload: { reason?: JobPdfExtraction['reason']; text?: string; pages?: number }) => {
      if (payload.reason) return finish(manual(payload.reason));
      const text = String(payload.text || '').replace(/\u0000/g, '').trim();
      if (!text) return finish(manual('scanned_or_empty'));
      finish({ state: 'TEXT', text, pages: payload.pages ?? null, suggestions: suggestJobPdfFields(text), reason: null });
    });
    worker.once('error', () => finish(manual('encrypted_or_invalid')));
    worker.once('exit', () => { if (!settled) finish(manual('encrypted_or_invalid')); });
  });
}
