import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import postcss from 'postcss';

const page = readFileSync('app/page.tsx', 'utf8');
const client = readFileSync('app/homepage-critical-client.tsx', 'utf8');
const criticalCss = readFileSync('app/home-critical.css', 'utf8');
const deferredCss = readFileSync('public/assets/home-below-fold.css', 'utf8');

const compact = (value) => value.replace(/\s+/g, ' ');

function sourceBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `missing source boundary: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `missing source boundary: ${end}`);
  return source.slice(startIndex, endIndex + end.length);
}

function declarationsForRule(root, selectorFragment, mediaPattern) {
  const declarations = new Map();

  const collect = (container) => {
    container.walkRules((rule) => {
      if (!rule.selector.includes(selectorFragment)) return;
      rule.walkDecls((declaration) => {
        declarations.set(declaration.prop, {
          value: declaration.value,
          important: Boolean(declaration.important),
        });
      });
    });
  };

  if (!mediaPattern) {
    collect(root);
    return declarations;
  }

  root.walkAtRules('media', (media) => {
    if (mediaPattern.test(media.params)) collect(media);
  });
  return declarations;
}

test('homepage presents one continuous lead form with an honest effort estimate', () => {
  const form = sourceBetween(page, '<form className="lead-form"', '</form>');

  assert.match(page, /className="quote-form-summary">Jeden formulár · 7 povinných údajov · približne 1 minúta<\/p>/);
  assert.doesNotMatch(page, /quote-form-progress/,
    'the page must not suggest a multi-step flow when every field is in one continuous form');
  assert.equal((form.match(/className="form-stage(?:\s|\")/g) || []).length, 4,
    'semantic groups keep related fields readable without acting as hidden steps');
  assert.match(form, />O streche a lokalite<\/h3>/);
  assert.match(form, />Doplňujúce údaje<\/h3>/);
  assert.match(form, />Kontakt na vás<\/h3>/);
  assert.match(form, />Fotky a poznámka \(voliteľné\)<\/h3>/);
  assert.doesNotMatch(form, /data-form-step-title|>\s*[1-4]\.\s/);
  assert.equal((form.match(/<h3[^>]+className="form-stage-title"/g) || []).length, 4);
});

test('continuous mobile form validates accessibly without generated next/back controls', () => {
  const normalizedClient = compact(client);

  assert.match(normalizedClient, /const firstFormStage = form\?\.querySelector<HTMLElement>\(':scope > \.form-stage'\);/);
  assert.match(normalizedClient, /form\.insertBefore\(validationSummary, firstFormStage \|\| form\.firstChild\);/);
  assert.doesNotMatch(normalizedClient, /mobileStepMedia|activeFormStep|initializeMobileFormSteps|data-form-step-next|data-form-step-back/);

  assert.match(normalizedClient, /control\.setAttribute\('aria-invalid', 'true'\);/);
  assert.match(normalizedClient, /control\.setAttribute\('aria-describedby', \[control\.getAttribute\('aria-describedby'\), errorId\]\.filter\(Boolean\)\.join\(' '\)\);/);
  assert.match(normalizedClient, /validationSummary\.setAttribute\('role', 'alert'\);/);
  assert.match(normalizedClient, /showValidationSummary\(invalid\); invalid\[0\]\?\.focus\(\); return;/,
    'validation must summarize errors and focus the first invalid control');
  assert.match(normalizedClient, /const result = await submitLeadForm\(payload\); form\.reset\(\);/,
    'a successful submission must reset the continuous form');
  assert.match(normalizedClient, /const focusSubmitResult = \(\) => \{ if \(!status\) return; status\.tabIndex = -1; status\.focus\(\{ preventScroll: true \}\); \};/,
    'the visible submit result must be programmatically focusable and receive focus');
  const nativeSuccess = sourceBetween(normalizedClient, 'if (verifiedReceipt?.accepted === true)', '} else {');
  assert.match(nativeSuccess, /setStatus\([\s\S]*?'success'\); focusSubmitResult\(\);/,
    'verified native submission must focus its confirmation');
  const nativeFailure = sourceBetween(normalizedClient, '} else { setStatus(\'Výsledok odoslania', '} } else if (errorMessage)');
  assert.match(nativeFailure, /setStatus\([\s\S]*?'error'\); focusSubmitResult\(\);/,
    'an unverifiable native submission must focus its error result');
  const javascriptSuccess = sourceBetween(normalizedClient, 'const result = await submitLeadForm(payload);', '} catch (error) {');
  assert.match(javascriptSuccess, /setStatus\([\s\S]*?'success', 'submit',[\s\S]*?\); focusSubmitResult\(\);/,
    'JavaScript submission with or without photos must focus its confirmation');
  const javascriptFailure = sourceBetween(normalizedClient, "} catch (error) { if (error instanceof Error && 'retryPhotoPathname'", '} finally {');
  assert.match(javascriptFailure, /setStatus\([\s\S]*?'error', \); focusSubmitResult\(\);/,
    'JavaScript submission failure or timeout must focus its error result');
});

test('mobile CSS keeps every form group visible and stacks hero actions at 360px', () => {
  const root = postcss.parse(criticalCss, { from: 'app/home-critical.css' });
  const deferredRoot = postcss.parse(deferredCss, { from: 'public/assets/home-below-fold.css' });
  const summary = declarationsForRule(root, '.quote-form-summary');
  const deferredSummary = declarationsForRule(deferredRoot, '.quote-form-summary');
  const mobileStage = declarationsForRule(root, '.form-stage', /max-width:\s*760px/);
  const compactHeroActions = declarationsForRule(root, 'main>.hero .hero-actions', /max-width:\s*360px/);
  const compactHeroButtons = declarationsForRule(root, '.hero-actions .button', /max-width:\s*360px/);

  assert.equal(summary.get('font-weight')?.value, '800');
  assert.equal(deferredSummary.get('background')?.value, '#f3fbfe');
  assert.equal(mobileStage.get('grid-template-columns')?.value, 'minmax(0,1fr)');
  assert.doesNotMatch(criticalCss, /is-mobile-steps|form-step-controls|form-step-next|form-step-back|quote-form-progress/);
  assert.doesNotMatch(deferredCss, /is-mobile-steps|form-step-controls|form-step-next|form-step-back|quote-form-progress/);
  assert.deepEqual(compactHeroActions.get('display'), { value: 'grid', important: true });
  assert.deepEqual(compactHeroActions.get('grid-template-columns'), { value: 'minmax(0,1fr)', important: true });
  assert.deepEqual(compactHeroButtons.get('width'), { value: '100%', important: true });
});
