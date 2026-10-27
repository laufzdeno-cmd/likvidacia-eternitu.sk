import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { articleEditorial, articleEditorialBySlug, articles } from '../src/content/seo-content';
import { ArticleEditorialSection } from '../app/seo-components';
import { buildArticleJsonLd } from '../app/seo-json-ld';
import { site } from '../src/content/site';

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

test('každý článok má viditeľnú zodpovednosť, dátum aktualizácie a tematické oficiálne zdroje', async () => {
  assert.match(articleEditorial.contentUpdatedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(articleEditorial.contentUpdatedLabel.length > 8);

  const methodologyOnly = new Set([
    'kolko-stoji-likvidacia-azbestu',
    'ako-zmerat-strechu-pre-cenovu-ponuku',
    'co-poslat-pre-nacenenie-likvidacie-eternitu',
  ]);

  for (const article of articles) {
    const editorial = articleEditorialBySlug[article.slug];
    assert.ok(editorial, `${article.slug} needs editorial metadata`);
    assert.equal(editorial.sources.length === 0, methodologyOnly.has(article.slug), `${article.slug} has an incorrect source mode`);
    for (const source of editorial.sources) {
      assert.match(source.url, /^https:\/\//);
      assert.ok(source.title.length > 5);
      assert.ok(source.publisher.length > 5);
      assert.ok(source.supports.length > 25);
    }

    const rendered = renderToStaticMarkup(createElement(ArticleEditorialSection, { slug: article.slug }));
    assert.match(rendered, new RegExp(site.legalName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(rendered, new RegExp(`datetime="${articleEditorial.contentUpdatedAt}"`, 'i'));
    assert.ok(rendered.includes(articleEditorial.contentUpdatedLabel));
    assert.doesNotMatch(rendered, /vecná a redakčná kontrola|odborná kontrola/i);
    for (const source of editorial.sources) {
      assert.ok(rendered.includes(`href="${source.url}"`), `${article.slug} must render ${source.url}`);
    }
    if (methodologyOnly.has(article.slug)) {
      assert.match(rendered, /Odporúčania z praxe ASTANA/);
      assert.doesNotMatch(rendered, /Použité oficiálne zdroje/);
    }

    const structured = buildArticleJsonLd({
      headline: article.title,
      description: article.quickAnswer,
      path: `/poradna/${article.slug}/`,
      articleBody: article.body.map(([, text]) => text).join('\n\n'),
      image: article.image,
      dateModified: articleEditorial.contentUpdatedAt,
      citations: editorial.sources.map((source) => source.url),
    });
    assert.equal(structured.dateModified, articleEditorial.contentUpdatedAt);
    assert.equal(structured.author['@id'], `${site.website}/#organization`);
    assert.deepEqual('citation' in structured ? structured.citation : [], editorial.sources.map((source) => source.url));
  }

  const component = await readFile(new URL('../app/seo-components.tsx', import.meta.url), 'utf8');
  const articlePage = component.split('export function ArticlePage')[1] || '';
  assert.match(articlePage, /<ArticleEditorialSection slug=\{article\.slug\}/);

  const css = await readFile(new URL('../src/article-editorial.css', import.meta.url), 'utf8');
  assert.match(css, /@media \(max-width: 700px\)[\s\S]*\.seo-source-list\s*\{[\s\S]*grid-template-columns:\s*1fr/);
});
