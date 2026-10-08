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

test('homepage keeps the four-step mobile lead-form structure', () => {
  const progress = sourceBetween(page, '<div className="quote-form-progress"', '</div>');
  const form = sourceBetween(page, '<form className="lead-form"', '</form>');

  assert.equal((progress.match(/<span><\/span>/g) || []).length, 4,
    'the progress indicator must contain exactly four steps');
  assert.equal((form.match(/className="form-stage(?:\s|\")/g) || []).length, 4,
    'the lead form must contain exactly four form stages');
  assert.match(form, /1\. Výmera a lokalita/);
  assert.match(form, /2\. Typ materiálu a termín/);
  assert.match(form, /3\. Kontakt/);
  assert.match(form, /4\. Fotky voliteľne/);
  assert.equal((form.match(/data-form-step-title/g) || []).length, 4,
    'every mobile step must expose a focusable semantic title');
  assert.equal((form.match(/<h3[^>]+className="form-stage-title"/g) || []).length, 4);
});

test('mobile steps initialize, validate accessibly, and reset to step one', () => {
  const normalizedClient = compact(client);

  assert.match(normalizedClient, /const formStages = Array\.from\(form\?\.querySelectorAll<HTMLElement>\(':scope > \.form-stage'\) \|\| \[\]\);/);
  assert.match(normalizedClient, /const mobileStepMedia = window\.matchMedia\('\(max-width: 760px\)'\);/);
  assert.match(normalizedClient, /let activeFormStep = 0;/);
  assert.match(normalizedClient, /const initializeMobileFormSteps = \(\) => \{/);
  assert.match(normalizedClient, /initializeMobileFormSteps\(\);/);
  assert.match(normalizedClient, /form\?\.setAttribute\('data-active-step', String\(activeFormStep \+ 1\)\);/);
  assert.match(normalizedClient, /next\.textContent = index === 0 \? 'Pokračovať k materiálu' : 'Pokračovať';/);

  assert.match(normalizedClient, /control\.setAttribute\('aria-invalid', 'true'\);/);
  assert.match(normalizedClient, /control\.setAttribute\('aria-describedby', \[control\.getAttribute\('aria-describedby'\), errorId\]\.filter\(Boolean\)\.join\(' '\)\);/);
  assert.match(normalizedClient, /validationSummary\.setAttribute\('role', 'alert'\);/);
  assert.match(normalizedClient, /showValidationSummary\(invalid\); invalid\[0\]\.focus\(\); return;/,
    'step validation must focus the first invalid control');
  assert.match(normalizedClient, /form\.reset\(\); activeFormStep = 0;[\s\S]*?renderFormStep\(\);/,
    'a successful submission must reset and render the first step');
  assert.match(normalizedClient, /clearStepValidation\(formStages\[activeFormStep\]\); activeFormStep =/,
    'moving away from a step must clear errors that would become hidden');
  assert.match(normalizedClient, /querySelector<HTMLElement>\('\[data-form-step-title\]'\)\?\.focus\(\{ preventScroll: true \}\)/,
    'the new step title must receive focus so assistive technology announces the transition');
  assert.match(normalizedClient, /const onMobileStepMediaChange = \(event: MediaQueryListEvent\) => \{[\s\S]*?const focusedElement = document\.activeElement;[\s\S]*?formStages\.findIndex\(\(stage\) => stage\.contains\(focusedElement\)\)[\s\S]*?activeFormStep = focusedStageIndex;[\s\S]*?renderFormStep\(\); \};/,
    'desktop-to-mobile transition must preserve the step that contains the focused control');
  assert.match(normalizedClient, /mobileStepMedia\.addEventListener\('change', onMobileStepMediaChange\);/);
  assert.match(normalizedClient, /mobileStepMedia\.removeEventListener\('change', onMobileStepMediaChange\);/);
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

test('mobile CSS hides inactive steps and stacks hero actions at 360px', () => {
  const root = postcss.parse(criticalCss, { from: 'app/home-critical.css' });
  const deferredRoot = postcss.parse(deferredCss, { from: 'public/assets/home-below-fold.css' });
  const hiddenSteps = declarationsForRule(root, '.is-mobile-steps .form-stage[hidden]');
  const mobileSteps = declarationsForRule(root, '.is-mobile-steps', /max-width:\s*760px/);
  const mobileControls = declarationsForRule(root, '.is-mobile-steps .form-step-controls', /max-width:\s*760px/);
  const compactHeroActions = declarationsForRule(root, 'main>.hero .hero-actions', /max-width:\s*360px/);
  const compactHeroButtons = declarationsForRule(root, '.hero-actions .button', /max-width:\s*360px/);
  const backButton = declarationsForRule(root, '.form-step-back');
  const deferredVisibleControls = declarationsForRule(deferredRoot, '.is-mobile-steps .form-step-controls:not([hidden])', /max-width:\s*760px/);
  const deferredHiddenControls = declarationsForRule(deferredRoot, '.form-step-controls[hidden]');

  assert.deepEqual(hiddenSteps.get('display'), { value: 'none', important: true });
  assert.ok(mobileSteps.has('gap'), 'the mobile step layout must be activated at 760px');
  assert.deepEqual(mobileControls.get('display'), { value: 'flex', important: false });
  assert.deepEqual(compactHeroActions.get('display'), { value: 'grid', important: true });
  assert.equal(backButton.get('flex')?.value, '0 0 auto');
  assert.equal(backButton.get('white-space')?.value, 'nowrap');
  assert.deepEqual(compactHeroActions.get('grid-template-columns'), { value: 'minmax(0,1fr)', important: true });
  assert.deepEqual(compactHeroButtons.get('width'), { value: '100%', important: true });
  assert.deepEqual(deferredVisibleControls.get('display'), { value: 'flex', important: true });
  assert.deepEqual(deferredHiddenControls.get('display'), { value: 'none', important: true });
});
