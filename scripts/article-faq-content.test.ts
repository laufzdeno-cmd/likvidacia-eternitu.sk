import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { articles } from '../src/content/seo-content';

test('každý článok poradne má vlastné FAQ zhodné pre čitateľa aj štruktúrované dáta', async () => {
  assert.equal(articles.length, 8);
  const seenQuestions = new Set<string>();

  for (const article of articles) {
    assert.ok(article.faqs.length >= 2, `${article.slug} needs at least two FAQs`);
    for (const faq of article.faqs) {
      assert.ok(faq.question.trim().endsWith('?'), `${article.slug} has a question without a question mark`);
      assert.ok(faq.answer.trim().length >= 40, `${article.slug} has an empty or thin answer`);
      assert.ok(!seenQuestions.has(faq.question), `FAQ question is duplicated: ${faq.question}`);
      seenQuestions.add(faq.question);
    }
  }

  const component = await readFile(new URL('../app/seo-components.tsx', import.meta.url), 'utf8');
  const articlePage = component.split('export function ArticlePage')[1] || '';
  assert.match(articlePage, /const faqs = article\.faqs/);
  assert.match(articlePage, /buildFaqJsonLd\(faqs\)/);
  assert.match(articlePage, /<FaqSection faqs=\{faqs\}/);
});
