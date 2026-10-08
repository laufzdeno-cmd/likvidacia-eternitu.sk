import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('career form keeps an atomic live region mounted and exposes busy, alert and success focus states', async () => {
  const source = await read('../app/career-form-client.tsx');

  assert.match(source, /<form[^>]*aria-busy=\{isSubmitting\}/s);
  assert.match(source, /const messageIsError = Boolean\(message && !isAccepted && !isSuccess && !isSubmitting\)/);
  assert.match(source, /ref=\{messageRef\}[\s\S]*role=\{messageIsError \? 'alert' : 'status'\}/);
  assert.match(source, /aria-live=\{messageIsError \? 'assertive' : 'polite'\}/);
  assert.match(source, /aria-atomic="true"/);
  assert.match(source, /if \(isSuccess\) messageRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
  assert.doesNotMatch(source, /\{message \? <p[^>]*career-form-message/);
});

test('testimonial form times out after 30 seconds, announces progress and always leaves pending state', async () => {
  const source = await read('../app/recenzie/testimonial-form.tsx');

  assert.match(source, /const controller = new AbortController\(\)/);
  assert.match(source, /window\.setTimeout\(\(\) => controller\.abort\(\), 30_000\)/);
  assert.match(source, /signal: controller\.signal/);
  assert.match(source, /setMessage\('Odosielame…'\)/);
  assert.match(source, /finally \{[\s\S]*window\.clearTimeout\(timeout\);[\s\S]*setPending\(false\);[\s\S]*\}/);
  assert.match(source, /submitError\.name === 'AbortError'[\s\S]*Odoslanie trvá príliš dlho/);
  assert.match(source, /<form[^>]*aria-busy=\{pending\}/s);
  assert.match(source, /role=\{error \? 'alert' : 'status'\}/);
  assert.match(source, /aria-live=\{error \? 'assertive' : 'polite'\}/);
  assert.match(source, /aria-atomic="true"/);
  assert.match(source, /messageRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
});

test('signed native testimonial confirmation is the first main content and is focusable without client JavaScript', async () => {
  const page = await read('../app/recenzie/page.tsx');
  const confirmation = page.indexOf('id="referencia-potvrdenie"');
  const hero = page.indexOf('<section className="seo-hero">');

  assert.ok(confirmation > 0 && confirmation < hero, 'confirmation must render before the hero');
  assert.match(page, /id="referencia-potvrdenie"[\s\S]*role="status"[\s\S]*tabIndex=\{-1\}[\s\S]*autoFocus/);
  assert.match(page, /verifyTestimonialReceiptToken\(params\.referencia_receipt, testimonialReceiptSecret\(\)\)/);
});
