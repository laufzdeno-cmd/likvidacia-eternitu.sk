import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const content = readFileSync(new URL('../src/content/seo-content.ts', import.meta.url), 'utf8');
const components = readFileSync(new URL('../app/seo-components.tsx', import.meta.url), 'utf8');
const faqPage = readFileSync(new URL('../app/faq/page.tsx', import.meta.url), 'utf8');

test('central FAQ answers the current RÚVZ decision question without calling the notification a permit', () => {
  assert.match(content, /Treba na práce povolenie od RÚVZ\?/);
  assert.match(content, /najmenej 30 dní vopred/);
  assert.match(content, /Ide o oznámenie, nie o žiadosť o povolenie/);
});

test('decision FAQ items expose contextual internal links and the shared renderer renders them', () => {
  for (const href of ['/postup/', '/cena-likvidacie-azbestu/', '/kde-posobime/']) {
    assert.match(content, new RegExp(`href: '${href.replaceAll('/', '\\/')}'`));
  }
  assert.match(components, /item\.relatedLink\?\.href|item\.relatedLink\.href/);
  assert.match(components, /item\.relatedLink\.label/);
});

test('FAQ page keeps visible answers and FAQ JSON-LD on the same content collection', () => {
  assert.match(faqPage, /buildFaqJsonLd\(faqPageItems\)/);
  assert.match(faqPage, /<FaqSection faqs=\{faqPageItems\}/);
});
