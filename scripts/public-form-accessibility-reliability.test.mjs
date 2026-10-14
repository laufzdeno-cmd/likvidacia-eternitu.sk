import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('roofer grouped choices keep errors beside the focused repair control', async () => {
  const [page, client, styles, browserHarness] = await Promise.all([
    readFile(new URL('../app/strechari/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/landing-client.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/strechari/roofer-route.css', import.meta.url), 'utf8'),
    readFile(new URL('./lead-private-blob-browser.integration.mjs', import.meta.url), 'utf8'),
  ]);

  assert.match(page, /id="roofer-regions-error" role="alert" hidden/);
  assert.match(page, /id="roofer-specializations-error" role="alert" hidden/);
  assert.match(page, /aria-describedby="roofer-regions-error"/);
  assert.match(page, /aria-describedby="roofer-specializations-error"/);
  assert.match(page, /className="roofer-registration-status" role="status" aria-live="polite" tabIndex=\{-1\}/);
  assert.match(client, /rooferRegionsError\.hidden = false/);
  assert.match(client, /rooferSpecializationsError\.hidden = false/);
  assert.match(client, /rooferRegistrationStatus\.setAttribute\('role', 'alert'\)/);
  assert.match(client, /rooferRegistrationStatus\.focus\(\)/);
  assert.match(styles, /\.roofer-field-error\[hidden\]\{display:none\}/);
  assert.match(browserHarness, /runRooferLocalValidationCheck/);
  assert.match(browserHarness, /region error stays visible beside the focused choice at 320 px/);
  assert.match(browserHarness, /specialization error stays visible beside the focused choice at 320 px/);
});

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('career form keeps an atomic live region mounted and focuses every settled result', async () => {
  const source = await read('../app/career-form-client.tsx');

  assert.match(source, /<form[^>]*aria-busy=\{isSubmitting\}/s);
  assert.match(source, /const messageIsError = Boolean\(message && !isAccepted && !isSuccess && !isSubmitting\)/);
  assert.match(source, /ref=\{messageRef\}[\s\S]*role=\{messageIsError \? 'alert' : 'status'\}/);
  assert.match(source, /aria-live=\{messageIsError \? 'assertive' : 'polite'\}/);
  assert.match(source, /aria-atomic="true"/);
  assert.match(source, /if \(settledAttempt > 0 && message && !isSubmitting\) messageRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(source, /\}, \[isSubmitting, message, settledAttempt\]\)/);
  assert.match(source, /Životopis môže mať maximálne 5 MB[\s\S]*setSettledAttempt\(\(attempt\) => attempt \+ 1\)/);
  assert.match(source, /finally \{[\s\S]*setSettledAttempt\(\(attempt\) => attempt \+ 1\)[\s\S]*setIsSubmitting\(false\)/);
  assert.match(source, /tabIndex=\{message && !isSubmitting \? -1 : undefined\}/);
  assert.match(source, /const submissionData = new FormData\(form\);[\s\S]*setIsSubmitting\(true\)/);
  assert.match(source, /name="cv"[\s\S]*disabled=\{isSubmitting\}/);
  assert.match(source, /name="gdpr"[^>]*disabled=\{isSubmitting\}/);
  assert.doesNotMatch(source, /\{message \? <p[^>]*career-form-message/);
});

test('continuous mobile lead form owns accessible validation while no-JavaScript keeps native validation', async () => {
  const [page, client] = await Promise.all([
    readFile(new URL('../app/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/homepage-critical-client.tsx', import.meta.url), 'utf8'),
  ]);

  assert.doesNotMatch(page, /<form className="lead-form"[^>]*noValidate/);
  assert.doesNotMatch(client, /initializeMobileFormSteps|data-form-step-next|data-form-step-back|form\.noValidate = true/);
  assert.match(client, /if \(!form\.checkValidity\(\)\)[\s\S]*showValidationSummary\(invalid\)[\s\S]*invalid\[0\]\?\.focus\(\)/);
  assert.match(client, /control\.name === 'gdpr'[\s\S]*Potvrďte súhlas so spracovaním údajov na vybavenie cenovej ponuky\./);
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
  assert.match(source, /if \(message && !pending\) messageRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(source, /tabIndex=\{message && !pending \? -1 : undefined\}/);
  assert.doesNotMatch(source, /message && !error && !pending/);
});

test('signed native testimonial confirmation is the first main content and is focusable without client JavaScript', async () => {
  const page = await read('../app/recenzie/page.tsx');
  const confirmation = page.indexOf('id="referencia-potvrdenie"');
  const hero = page.indexOf('<section className="seo-hero">');

  assert.ok(confirmation > 0 && confirmation < hero, 'confirmation must render before the hero');
  assert.match(page, /id="referencia-potvrdenie"[\s\S]*role="status"[\s\S]*tabIndex=\{-1\}[\s\S]*autoFocus/);
  assert.match(page, /verifyTestimonialReceiptToken\(params\.referencia_receipt, testimonialReceiptSecret\(\)\)/);
});
