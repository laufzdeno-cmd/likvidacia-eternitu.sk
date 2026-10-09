import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import postcss from 'postcss';

const migrationSourceFiles = [
  'src/styles.css',
  'src/premium-overrides.css',
  'src/final-visual-polish.css',
];
const globalCssFiles = [
  ...migrationSourceFiles,
  'src/responsive-audit-hotfix.css',
];
const homepageCssFiles = ['app/home-critical.css', 'public/assets/home-below-fold.css'];
const homepageRuntimeFiles = new Set([
  'app/page.tsx',
  'app/homepage-critical-client.tsx',
  'app/homepage-client-boundary.tsx',
  'app/homepage-deferred-client.tsx',
  'app/home-deferred-styles.tsx',
]);
const runtimeExtensions = new Set(['.js', '.jsx', '.mjs', '.ts', '.tsx']);

function walkRuntimeFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return walkRuntimeFiles(file);
    return runtimeExtensions.has(path.extname(entry.name)) ? [file.replaceAll('\\', '/')] : [];
  });
}

function selectorTokens(selector) {
  const classes = [...selector.matchAll(/\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g)]
    .map((match) => `.${match[1]}`);
  const ids = [...selector.matchAll(/#(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g)]
    .map((match) => `#${match[1]}`);
  return [...classes, ...ids];
}

function tokenAppears(source, token) {
  const value = token.slice(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^A-Za-z0-9_-])${value}(?=$|[^A-Za-z0-9_-])`).test(source);
}

const runtimeFiles = [...walkRuntimeFiles('app'), ...walkRuntimeFiles('src')];
const homepageSource = runtimeFiles
  .filter((file) => homepageRuntimeFiles.has(file))
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n');
const nonHomepageSource = runtimeFiles
  .filter((file) => !homepageRuntimeFiles.has(file))
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n');
const exclusiveHomepageTokens = new Set();

for (const file of [...globalCssFiles, ...homepageCssFiles]) {
  const root = postcss.parse(readFileSync(file, 'utf8'), { from: file });
  root.walkRules((rule) => {
    for (const selector of rule.selectors ?? []) {
      for (const token of selectorTokens(selector)) {
        if (tokenAppears(homepageSource, token) && !tokenAppears(nonHomepageSource, token)) {
          exclusiveHomepageTokens.add(token);
        }
      }
    }
  });
}

const isSafelyHomepageOwnedSelectors = (selectors) => selectors.length > 0
  && selectors.every((selector) => selectorTokens(selector)
    .some((token) => exclusiveHomepageTokens.has(token)));
const isSafelyHomepageOwnedRule = (rule) => isSafelyHomepageOwnedSelectors(rule.selectors ?? []);

test('homepage ownership requires every selector branch to have an exclusive runtime anchor', () => {
  exclusiveHomepageTokens.add('.home-only-fixture');
  assert.equal(isSafelyHomepageOwnedSelectors(['.home-only-fixture .button']), true);
  assert.equal(isSafelyHomepageOwnedSelectors(['.home-only-fixture', '.shared-button']), false);
  assert.equal(isSafelyHomepageOwnedSelectors(['.home-only-fixture', '.home-only-fixture.is-active']), true);
  exclusiveHomepageTokens.delete('.home-only-fixture');
});

test('critical homepage CSS contains no retired mini-proof selectors', () => {
  const critical = readFileSync('app/home-critical.css', 'utf8');
  assert.doesNotMatch(critical, /hero-mini-proof/);
});

function markedCss(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end);
  assert.ok(startIndex >= 0 && endIndex > startIndex, `missing ordered CSS markers: ${start} / ${end}`);
  return source.slice(startIndex + start.length, endIndex);
}

test('moved homepage blocks contain no unsafe mixed selector list', () => {
  const blocks = [
    markedCss(
      readFileSync('app/home-critical.css', 'utf8'),
      '/* BEGIN HOMEPAGE-ONLY GLOBAL SPLIT: CRITICAL */',
      '/* END HOMEPAGE-ONLY GLOBAL SPLIT: CRITICAL */',
    ),
    markedCss(
      readFileSync('public/assets/home-below-fold.css', 'utf8'),
      '/* BEGIN HOMEPAGE-ONLY GLOBAL SPLIT: DEFERRED */',
      '/* END HOMEPAGE-ONLY GLOBAL SPLIT: DEFERRED */',
    ),
  ];

  for (const [index, css] of blocks.entries()) {
    const root = postcss.parse(css, { from: `homepage split block ${index + 1}` });
    root.walkRules((rule) => {
      assert.equal(
        isSafelyHomepageOwnedRule(rule),
        true,
        `moved rule has a shared or unowned selector branch: ${rule.selector}`,
      );
    });
  }
});

test('homepage presentation is route-scoped and absent from the final shared polish layer', () => {
  const page = readFileSync('app/page.tsx', 'utf8');
  const criticalCss = readFileSync('app/home-critical.css', 'utf8');
  const deferredCss = readFileSync('public/assets/home-below-fold.css', 'utf8');
  const routeCss = `${criticalCss}\n${deferredCss}`;
  assert.match(page, /import '\.\/home-critical\.css'/);
  assert.match(criticalCss, /--home-route-css:\s*1/);
  for (const criticalClass of ['hero-photo', 'quote-card', 'price-calculator-section', 'real-work-card']) {
    assert.match(routeCss, new RegExp(`\\.${criticalClass}\\b`));
  }

  const leakedRules = [];
  for (const file of migrationSourceFiles) {
    const root = postcss.parse(readFileSync(file, 'utf8'), { from: file });
    root.walkRules((rule) => {
      if (isSafelyHomepageOwnedRule(rule)) leakedRules.push(`${file}: ${rule.selector}`);
    });
  }
  assert.deepEqual(leakedRules, [], 'safely route-owned homepage rules leaked into global CSS');

  const root = postcss.parse(routeCss, { from: 'homepage route CSS layers' });
  let rules = 0;
  root.walkRules(() => { rules += 1; });
  assert.ok(rules > 450, `expected a substantial homepage-only layer, got ${rules} rules`);
});

test('late homepage mobile guards preserve the original one-column cascade', () => {
  const deferredCss = readFileSync('public/assets/home-below-fold.css', 'utf8').replaceAll('\r\n', '\n');
  const deferredRoot = postcss.parse(deferredCss, { from: 'public/assets/home-below-fold.css' });
  const initialFaqGrid = deferredCss.indexOf('.faq-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))');
  const finalFaqTwoColumn = deferredCss.lastIndexOf('@media (max-width: 1320px)');
  const finalFaqOneColumn = deferredCss.lastIndexOf('@media (max-width: 860px)');

  assert.ok(finalFaqTwoColumn > initialFaqGrid, 'responsive FAQ guard must follow the desktop FAQ grid');
  assert.ok(finalFaqOneColumn > finalFaqTwoColumn, 'single-column FAQ guard must follow the two-column guard');

  const expected = new Map([
    ['(max-width: 1320px)|.faq-grid', 'repeat(2, minmax(0, 1fr))'],
    ['(max-width: 860px)|.faq-grid', 'minmax(0, 1fr)'],
  ]);
  const actual = new Map();
  deferredRoot.walkRules((rule) => {
    const media = rule.parent?.type === 'atrule' && rule.parent.name === 'media'
      ? rule.parent.params.replace(/\s+/g, ' ')
      : '';
    const selectors = (rule.selectors ?? []).map((selector) => selector.trim()).join(',');
    const key = `${media}|${selectors}`;
    if (!expected.has(key)) return;
    const declaration = rule.nodes
      .filter((node) => node.type === 'decl' && node.prop === 'grid-template-columns')
      .at(-1);
    if (declaration) actual.set(key, `${declaration.value}${declaration.important ? '!important' : ''}`);
  });
  assert.deepEqual(actual, expected, 'late responsive grid guards must match exact media blocks, selectors and declarations');
});

function mediaMatchesWidth(rule, width) {
  for (let parent = rule.parent; parent && parent.type !== 'root'; parent = parent.parent) {
    if (parent.type !== 'atrule' || parent.name !== 'media') continue;
    const queryMatches = parent.params.split(',').some((query) => {
      const minimums = [...query.matchAll(/min-width:\s*(\d+)px/g)].map((match) => Number(match[1]));
      const maximums = [...query.matchAll(/max-width:\s*(\d+)px/g)].map((match) => Number(match[1]));
      return !minimums.some((minimum) => width < minimum)
        && !maximums.some((maximum) => width > maximum);
    });
    if (!queryMatches) return false;
  }
  return true;
}

function selectorSpecificity(selector) {
  const ids = (selector.match(/#[A-Za-z_][\w-]*/g) ?? []).length;
  const classes = (selector.match(/\.[A-Za-z_][\w-]*/g) ?? []).length
    + (selector.match(/\[[^\]]+\]/g) ?? []).length
    + (selector.match(/:(?!:)[A-Za-z_][\w-]*/g) ?? []).length;
  const withoutSpecificTokens = selector
    .replace(/#[A-Za-z_][\w-]*/g, ' ')
    .replace(/\.[A-Za-z_][\w-]*/g, ' ')
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/::?[A-Za-z_][\w-]*(?:\([^)]*\))?/g, ' ')
    .replace(/[>+~*,]/g, ' ');
  const elements = (withoutSpecificTokens.match(/[A-Za-z_][\w-]*/g) ?? []).length;
  return [ids, classes, elements];
}

function compareCascadeRank(left, right) {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

function effectiveGridColumns(className, width) {
  const classPattern = new RegExp(`\\.${className}(?![A-Za-z0-9_-])`);
  let sourceOrder = 0;
  let winner;
  for (const file of [...globalCssFiles, ...homepageCssFiles]) {
    const root = postcss.parse(readFileSync(file, 'utf8'), { from: file });
    root.walkRules((rule) => {
      if (!mediaMatchesWidth(rule, width)) return;
      for (const selector of rule.selectors ?? []) {
        if (!classPattern.test(selector)) continue;
        const specificity = selectorSpecificity(selector);
        for (const declaration of rule.nodes) {
          if (declaration.type !== 'decl' || declaration.prop !== 'grid-template-columns') continue;
          const rank = [declaration.important ? 1 : 0, ...specificity, sourceOrder];
          sourceOrder += 1;
          if (!winner || compareCascadeRank(rank, winner.rank) >= 0) {
            winner = { value: declaration.value.replace(/\s+/g, ''), rank };
          }
        }
      }
    });
  }
  return winner?.value;
}

function relevantGridWidths(className) {
  const classPattern = new RegExp(`\\.${className}(?![A-Za-z0-9_-])`);
  const widths = new Set([320, 360, 390, 568, 760, 761, 768, 1024, 1440]);
  for (const file of [...globalCssFiles, ...homepageCssFiles]) {
    const root = postcss.parse(readFileSync(file, 'utf8'), { from: file });
    root.walkRules((rule) => {
      if (!(rule.selectors ?? []).some((selector) => classPattern.test(selector))) return;
      if (!rule.nodes.some((node) => node.type === 'decl' && node.prop === 'grid-template-columns')) return;
      for (let parent = rule.parent; parent && parent.type !== 'root'; parent = parent.parent) {
        if (parent.type !== 'atrule' || parent.name !== 'media') continue;
        for (const match of parent.params.matchAll(/(?:min|max)-width:\s*(\d+)px/g)) {
          const breakpoint = Number(match[1]);
          for (const candidate of [breakpoint - 1, breakpoint, breakpoint + 1]) {
            if (candidate >= 320 && candidate <= 1440) widths.add(candidate);
          }
        }
      }
    });
  }
  return [...widths].sort((left, right) => left - right);
}

test('effective homepage grid cascade stays correct throughout every breakpoint interval', () => {
  const expectedColumns = {
    'faq-grid': (width) => (width <= 860
      ? 'minmax(0,1fr)'
      : width <= 1320 ? 'repeat(2,minmax(0,1fr))' : 'repeat(3,minmax(0,1fr))'),
  };
  for (const [className, expectation] of Object.entries(expectedColumns)) {
    for (const width of relevantGridWidths(className)) {
      const expected = expectation(width);
      assert.equal(
        effectiveGridColumns(className, width),
        expected,
        `.${className} must resolve to ${expected} at ${width}px`,
      );
    }
  }
});

test('protected homepage layout does not use cascade-bypassing shorthands', () => {
  const gridClasses = ['faq-grid', 'why-card-grid', 'caution-grid', 'roofers-grid'];
  const violations = [];
  for (const file of [...globalCssFiles, ...homepageCssFiles]) {
    const root = postcss.parse(readFileSync(file, 'utf8'), { from: file });
    root.walkRules((rule) => {
      const selectors = rule.selectors ?? [];
      const protectsGrid = gridClasses.some((className) => {
        const pattern = new RegExp(`\\.${className}(?![A-Za-z0-9_-])`);
        return selectors.some((selector) => pattern.test(selector));
      });
      const protectsHeroClaim = selectors.some((selector) => /\.hero-claim(?![A-Za-z0-9_-])/.test(selector));
      for (const declaration of rule.nodes) {
        if (declaration.type !== 'decl') continue;
        const property = declaration.prop.toLowerCase();
        if (protectsGrid && ['grid', 'grid-template', 'all'].includes(property)) {
          violations.push(`${file}:${declaration.source.start.line} ${rule.selector} uses ${declaration.prop}`);
        }
        if (protectsHeroClaim && ['font', 'all'].includes(property)) {
          violations.push(`${file}:${declaration.source.start.line} ${rule.selector} uses ${declaration.prop}`);
        }
      }
    });
  }
  assert.deepEqual(
    violations,
    [],
    'protected grid and hero rules must use explicit longhand properties so cascade tests remain fail-closed',
  );
});

test('consolidated homepage retires unused selectors and accents but preserves the shared risk grid', () => {
  const retiredClasses = [
    'asbestos-section', 'caution-card-icon', 'caution-grid', 'caution-section',
    'included-group-card', 'included-group-grid', 'included-group-head', 'included-group-icon',
    'included-section', 'process-list', 'process-section', 'process-step-copy', 'process-stepper',
    'realization-filter-pills', 'risk-card-icon', 'risk-notice', 'risk-notice-icon', 'risk-section',
    'roofers-actions', 'roofers-grid', 'roofers-section', 'why-card', 'why-card-grid',
    'why-card-icon', 'why-feature-card', 'why-lead', 'why-section',
  ];
  for (const className of retiredClasses) {
    const token = `.${className}`;
    assert.equal(tokenAppears(`${homepageSource}\n${nonHomepageSource}`, token), false, `${token} is still used at runtime`);
    for (const file of homepageCssFiles) {
      postcss.parse(readFileSync(file, 'utf8'), { from: file }).walkRules((rule) => {
        assert.equal(selectorTokens(rule.selector).includes(token), false, `${file} retains retired ${token}`);
      });
    }
  }
  assert.match(readFileSync('app/simple-public-page.tsx', 'utf8'), /className="risk-grid"/);
  assert.ok(globalCssFiles.some((file) => /\.risk-grid\b/.test(readFileSync(file, 'utf8'))), 'shared risk-grid styles must remain');
});

function effectiveHeroClaimTypography(width) {
  const winners = new Map();
  let sourceOrder = 0;
  for (const file of [...globalCssFiles, ...homepageCssFiles]) {
    const root = postcss.parse(readFileSync(file, 'utf8'), { from: file });
    root.walkRules((rule) => {
      if (!mediaMatchesWidth(rule, width)) return;
      for (const selector of rule.selectors ?? []) {
        if (!/\.hero-claim(?![A-Za-z0-9_-])/.test(selector)) continue;
        const specificity = selectorSpecificity(selector);
        for (const declaration of rule.nodes) {
          if (declaration.type !== 'decl') continue;
          let property = declaration.prop;
          let value = declaration.value;
          if (property === 'margin') {
            const values = value.trim().split(/\s+/);
            property = 'margin-bottom';
            value = values.length === 1 ? values[0] : values.length === 2 ? values[0] : values[2];
          }
          if (!['margin-bottom', 'font-size', 'line-height'].includes(property)) continue;
          const rank = [declaration.important ? 1 : 0, ...specificity, sourceOrder];
          sourceOrder += 1;
          const winner = winners.get(property);
          if (!winner || compareCascadeRank(rank, winner.rank) >= 0) {
            winners.set(property, { value, rank });
          }
        }
      }
    });
  }
  return new Map([...winners].map(([property, winner]) => [property, winner.value]));
}

test('smallest supported homepage widths keep the pre-split effective claim typography', () => {
  for (const width of [320, 360]) {
    assert.deepEqual(
      effectiveHeroClaimTypography(width),
      new Map([
        ['font-size', '16px'],
        ['line-height', '1.45'],
        ['margin-bottom', '11px'],
      ]),
      `hero claim typography changed at ${width}px`,
    );
  }
});
