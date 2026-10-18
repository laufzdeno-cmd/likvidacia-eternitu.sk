import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { compileFunction } from 'node:vm';
import { isValidElement } from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { homeContentDefaults } from '../src/server/site-content.ts';
import { cleanSlovakText } from '../src/server/slovak-text.ts';
import { site } from '../src/content/site.ts';
import * as photos from '../src/data/azbestReferences.ts';
import { ResponsiveImage } from '../src/components/responsive-image.tsx';
import { serializeJsonLd } from '../src/lib/json-ld-serialize.mjs';
import * as trustPolicy from '../src/lib/homepage-trust-items.mjs';
import { transportPolicy } from '../src/content/transport-policy.mjs';

const source = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const { outputText, diagnostics } = ts.transpileModule(source, {
  fileName: 'app/page.tsx',
  reportDiagnostics: true,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
});
assert.deepEqual(diagnostics, []);

// Exercise the actual server page with local CMS fixtures. Never import the DB or run client effects.
async function renderPage(overrides = {}) {
  const empty = { default: () => null, __esModule: true };
  const modules = new Map([
    ['react/jsx-runtime', jsxRuntime],
    ['@/src/server/db', { getSiteContentMap: async () => ({ ...homeContentDefaults, ...overrides }) }],
    ['@/src/server/site-content', { homeContentDefaults }],
    ['@/src/server/slovak-text', { cleanSlovakText }],
    ['@/src/content/site', { site }],
    ['@/src/data/azbestReferences', photos],
    ['@/src/components/responsive-image', { ResponsiveImage }],
    ['@/src/lib/json-ld-serialize.mjs', { serializeJsonLd }],
    ['@/src/lib/homepage-trust-items.mjs', trustPolicy],
    ['@/src/content/transport-policy.mjs', { transportPolicy }],
    ['./homepage-client-boundary', empty],
    ['./homepage-deferred-client', empty],
    ['./homepage-deferred-widgets', empty],
    ['./header-brand-logo', empty],
    ['./home-deferred-styles', empty],
    ['./home-critical.css', {}],
    ['./homepage-conversion-layout.module.css', {
      __esModule: true,
      default: new Proxy({}, { get: (_, key) => `conversion-${String(key)}` }),
    }],
  ]);
  const module = { exports: {} };
  compileFunction(outputText, ['module', 'exports', 'require'])(module, module.exports, (name) => {
    assert.ok(modules.has(name), `Unexpected dependency in the isolated page: ${name}`);
    return modules.get(name);
  });
  return module.exports.default();
}

function elements(value, ancestors = []) {
  if (Array.isArray(value)) return value.flatMap((child) => elements(child, ancestors));
  if (!isValidElement(value)) return [];
  return [{ node: value, ancestors }, ...elements(value.props.children, [...ancestors, value])];
}

function byId(tree, id) {
  const matches = elements(tree).filter(({ node }) => node.props.id === id);
  assert.equal(matches.length, 1, `Exactly one visible target for #${id}`);
  return matches[0].node;
}

function textOf(value) {
  if (Array.isArray(value)) return value.map(textOf).join(' ');
  if (isValidElement(value)) return textOf(value.props.children);
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

test('protects the accepted continuous form with optional roofer help, quote section and navigation', () => {
  // 2026-10-18 continuous-form baseline; only CRLF/LF is normalized. No JSX, copy, attributes or whitespace is ignored.
  const protectedBlocks = [
    ['form', /<form className="lead-form"[\s\S]*?<\/form>/, '1dccd6d32e64e5e449a6f534717737b023fa88a14e360ad79fcd3fafe6706efb'],
    ['quote section', /<section className="quote-section"[\s\S]*?<\/section>/, 'dedff1dece5634d9059a556e1111b028714510def9ba35c763ebed4b4779bdab'],
    ['navigation', /<header className="site-header"[\s\S]*?<\/header>/, 'ea30112e452486547d7f35336c532c5ba6eef1cbfeb5e7502a10b37063be765c'],
  ];
  for (const [name, pattern, expected] of protectedBlocks) {
    const block = source.match(pattern)?.[0];
    assert.ok(block, name);
    assert.equal(createHash('sha256').update(block).digest('hex'), expected, `${name} must remain unchanged`);
  }
});

test('renders ten main sections with the calculator immediately before the intact quote section', async () => {
  const tree = await renderPage();
  const main = elements(tree).find(({ node }) => node.type === 'main').node;
  const sections = main.props.children.filter((node) => isValidElement(node) && node.type === 'section');
  assert.equal(sections.length, 10); // Includes the approved, focused roofer-help section.
  assert.equal(sections[0].props.className, 'hero', 'sticky CTA needs main > .hero');
  assert.deepEqual(sections.map((node) => node.props.id || node.props.className), [
    'hero', 'preco', 'orientacna-cena', 'dopyt', 'conversion-rooferHelp', 'realizacie-astana', 'cena', 'azbest', 'faq', 'final-cta',
  ]);
  assert.equal(elements(byId(tree, 'dopyt')).some(({ node }) => node.props['data-price-calculator'] !== undefined), false,
    'quote_section_view must not begin at the calculator');
});

test('retains old section anchors and heading targets once, with visible content and no hidden ancestors', async () => {
  const tree = await renderPage();
  const anchors = [
    'top', 'site-nav', 'hero-title', 'preco', 'why-title', 'orientacna-cena', 'price-calculator-title',
    'dopyt', 'quote-title', 'roofer-help-title', 'realizacie-astana', 'real-work-title', 'cena', 'included-title',
    'ako-to-prebieha', 'process-title', 'strechari', 'roofers-title', 'azbest', 'risk-title',
    'doklady-ku-stavbe', 'caution-title', 'faq', 'faq-title', 'final-title', 'kontakt',
  ];
  for (const id of anchors) {
    const node = byId(tree, id);
    assert.ok(textOf(node).trim(), `#${id} has visible content`);
    const entry = elements(tree).find((item) => item.node === node);
    for (const parent of [...entry.ancestors, node]) {
      assert.ok(!parent.props.hidden && parent.props['aria-hidden'] !== true && parent.props['aria-hidden'] !== 'true');
      assert.notEqual(parent.props.style?.display, 'none');
    }
  }
  for (const { node } of elements(tree)) {
    if (node.type === 'a' && node.props.href?.startsWith('#')) byId(tree, node.props.href.slice(1));
  }
});

test('keeps roofer coordination optional and prevents automatic data sharing', async () => {
  const tree = await renderPage();
  const field = byId(tree, 'roofer-recommendation-field');
  const optIn = byId(tree, 'roofer-recommendation-opt-in');
  const help = byId(tree, 'roofer-help-title');
  const helpSection = elements(tree).find(({ node }) => node.props['aria-labelledby'] === 'roofer-help-title').node;

  assert.equal(field.props.hidden, true, 'the extra choice stays hidden until the customer selects that they have no roofer');
  assert.equal(optIn.props.type, 'checkbox');
  assert.equal(optIn.props.name, undefined, 'the visual opt-in must not create an unreviewed external-sharing field');
  assert.match(textOf(field), /Vaše údaje neposielame strechárovi automaticky/);
  assert.match(textOf(help), /Potrebujete po eternite aj novú strechu/);
  assert.ok(elements(helpSection).some(({ node }) => node.type === 'a'
    && node.props.href === '/?wantsRooferRecommendation=true#dopyt'));
});

test('shows three real photos including a corrugated farm roof, without changing the full gallery', async () => {
  const gallery = byId(await renderPage(), 'realizacie-astana');
  const pictures = elements(gallery).filter(({ node }) => node.type === ResponsiveImage).map(({ node }) => node.props);
  assert.deepEqual(pictures.map(({ image }) => image.id), ['azbest-164', 'azbest-057', 'azbest-110']);
  for (const picture of pictures) {
    const original = photos.getAzbestReference(picture.image.id);
    assert.equal(picture.image.webp, original.webp);
    assert.equal(picture.image.jpg, original.jpg);
    assert.equal(picture.loading, 'lazy');
  }
  assert.match(pictures[1].image.alt, /hospodárska budova s vlnitou strešnou krytinou/);
  assert.match(textOf(gallery), /Práce na hospodárskej budove/);
  assert.doesNotMatch(textOf(gallery), /Balenie a odvoz/);
  assert.equal(photos.realizationHighlights.find((item) => item.title === 'Balenie a odvoz').image.id, 'azbest-120');
  assert.equal(elements(gallery).some(({ node }) => node.props['data-home-gallery-filter'] !== undefined), false);
  assert.ok(elements(gallery).some(({ node }) => node.type === 'a' && node.props.href === '/realizacie/'));
  assert.match(textOf(gallery), /tri ukážky/);
});

test('compact homepage calculator omits locality but retains controls, disclosures and the intact inquiry locality', async () => {
  const tree = await renderPage();
  const calculator = byId(tree, 'orientacna-cena');
  assert.match(calculator.props.className, /conversion-calculator/);
  assert.equal(elements(calculator).filter(({ node }) => node.type === 'input').length, 1);
  const slider = byId(tree, 'price-area');
  assert.deepEqual([slider.props.type, slider.props.min, slider.props.max, slider.props.step], ['range', '10', '500', '10']);
  assert.equal(elements(calculator).filter(({ node }) => node.props['data-price-material']).length, 4);
  assert.doesNotMatch(textOf(calculator), /Obec alebo mesto|Nepovinné pri orientačnom/);
  assert.equal(elements(calculator).some(({ node }) => node.props['data-price-city'] !== undefined), false);
  assert.ok(textOf(calculator).includes(transportPolicy.freeFromThreshold));
  assert.ok(textOf(calculator).includes(transportPolicy.belowThreshold));
  assert.match(textOf(calculator), /Dokumentáciu, individuálne položky a režim DPH určí až konkrétna cenová ponuka/);
  assert.ok(elements(calculator).some(({ node }) => node.props['data-price-quote'] !== undefined && node.props.href === '#dopyt'));
  const city = byId(tree, 'city');
  assert.equal(city.props.name, 'city');
  assert.equal(city.props.required, true);
});

test('consolidates service, process and roofer content without standalone duplicate card grids', async () => {
  const tree = await renderPage();
  const service = byId(tree, 'cena');
  assert.ok(elements(service).some(({ node }) => node.props.id === 'ako-to-prebieha'));
  assert.ok(elements(service).some(({ node }) => node.props.id === 'strechari'));
  assert.equal(elements(service).filter(({ node }) => node.type === 'article').length, 0);
  const retired = /\b(?:why-card-grid|caution-grid|risk-grid|roofers-grid|included-group-grid)\b/;
  for (const { node } of elements(tree)) assert.doesNotMatch(node.props.className || '', retired);
  assert.match(textOf(tree), /Nezáväznú cenovú ponuku vám pošleme čo najskôr, najneskôr do 24 hodín\./);
  assert.ok(textOf(byId(tree, 'preco')).includes(transportPolicy.full));
});

test('keeps editable trust descriptions paired with their titles after consolidation', async () => {
  const trust = byId(await renderPage({ trustItems: 'Doklad A|Popis A\nDoklad B|Popis B' }), 'preco');
  const items = elements(trust).filter(({ node }) => node.props.className === 'trust-item').map(({ node }) => textOf(node).replace(/\s+/g, ' ').trim());
  assert.deepEqual(items, ['Doklad A Popis A', 'Doklad B Popis B']);
});

test('SSR keeps FAQ data in sync with visible answers and requires no database or browser', async () => {
  const tree = await renderPage();
  const faq = byId(tree, 'faq');
  const visible = elements(faq).filter(({ node }) => node.type === 'details').map(({ node }) => {
    const descendants = elements(node);
    return {
      question: textOf(descendants.find(({ node: item }) => item.type === 'summary').node),
      answer: textOf(descendants.find(({ node: item }) => item.type === 'p').node),
    };
  });
  const script = elements(tree).find(({ node }) => node.type === 'script' && node.props.type === 'application/ld+json').node;
  const data = JSON.parse(script.props.dangerouslySetInnerHTML.__html);
  const schemaFaq = data['@graph'].find((item) => item['@type'] === 'FAQPage');
  assert.deepEqual(schemaFaq.mainEntity.map((item) => ({ question: item.name, answer: item.acceptedAnswer.text })), visible);
  const html = renderToStaticMarkup(tree);
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.match(html, /action="\/api\/dopyt\/"/);
});
