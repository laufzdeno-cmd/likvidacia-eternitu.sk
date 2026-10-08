import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import postcss from 'postcss';

const globalCssFiles = [
  'src/styles.css',
  'src/premium-overrides.css',
  'src/final-visual-polish.css',
  'src/responsive-audit-hotfix.css',
];

const isProcessRouteSelector = (selector) =>
  /\.postup-process(?:-|\b)/.test(selector)
  || /:has\(\.postup-process-page\)/.test(selector);

test('process-page presentation is owned by the /postup route', () => {
  const page = readFileSync('app/postup/page.tsx', 'utf8');
  const layout = readFileSync('app/postup/layout.tsx', 'utf8');
  const routeCss = readFileSync('app/postup/postup-route.css', 'utf8');
  const buildHarness = readFileSync('scripts/photo-intake-browser.integration.mjs', 'utf8');

  assert.match(page, /<main className="seo-page postup-process-page"/);
  assert.match(
    page,
    /<PublicPageShell[^>]*breadcrumb=\{\{ name: 'Postup likvidácie', path: '\/postup\/' \}\}[^>]*hideWhatsappOnMobile>/,
    '/postup/ must hide the floating WhatsApp on mobile through PublicPageShell',
  );
  assert.match(layout, /import '\.\/postup-route\.css'/);
  assert.match(routeCss, /--postup-route-css:\s*1/);
  assert.match(routeCss, /body:has\(\.postup-process-page\) \.whatsapp-btn/);
  assert.match(buildHarness, /processCssLoadedOnlyOnProcess:\s*true/);
  assert.match(buildHarness, /--postup-route-css/);

  const routeRoot = postcss.parse(routeCss, { from: 'app/postup/postup-route.css' });
  let routeRules = 0;
  routeRoot.walkRules((rule) => {
    if (rule.selector !== ':root') routeRules += 1;
  });
  assert.equal(routeRules, 120, `expected all 120 process-page rules, got ${routeRules}`);

  for (const file of globalCssFiles) {
    const root = postcss.parse(readFileSync(file, 'utf8'), { from: file });
    root.walkRules((rule) => {
      for (const selector of rule.selectors ?? []) {
        assert.equal(
          isProcessRouteSelector(selector),
          false,
          `${file} still contains process-route selector: ${selector}`,
        );
      }
    });
  }
});

test('process-page photos use the shared responsive image contract', () => {
  const page = readFileSync('app/postup/page.tsx', 'utf8');
  const responsiveImage = readFileSync('src/components/responsive-image.tsx', 'utf8');

  const figureContents = (className) => {
    const match = page.match(new RegExp(`<figure className="${className}">([\\s\\S]*?)<\\/figure>`));
    assert.ok(match, `missing ${className} figure`);
    return match[1];
  };

  assert.match(page, /import \{ ResponsiveImage \} from '@\/src\/components\/responsive-image'/);
  assert.equal((page.match(/<ResponsiveImage\b/g) ?? []).length, 3);
  assert.doesNotMatch(page, /<img[^>]+src=\{(?:heroPhoto|step\.image|sitePhoto)\.jpg\}/);

  const hero = figureContents('postup-process-hero-media');
  assert.match(hero, /<ResponsiveImage[\s\S]*image=\{heroPhoto\}/);
  assert.match(hero, /loading="eager"/);
  assert.match(hero, /fetchPriority="high"/);
  assert.match(hero, /width=\{1600\}[\s\S]*height=\{1200\}/);
  assert.match(hero, /sizes="\(max-width: 820px\) calc\(100vw - 28px\), \(max-width: 1228px\) 47vw, 545px"/);
  assert.match(hero, /<figcaption>Reálna fotografia práce ASTANA na streche<\/figcaption>/);

  const step = figureContents('postup-process-step-media');
  assert.match(step, /<ResponsiveImage[\s\S]*image=\{step\.image\}/);
  assert.match(step, /loading="lazy"/);
  assert.match(step, /width=\{1600\}[\s\S]*height=\{1200\}/);
  assert.match(step, /sizes="\(max-width: 820px\) calc\(100vw - 28px\), \(max-width: 1228px\) calc\(50vw - 32px\), 582px"/);

  const wideProof = figureContents('postup-process-wide-proof');
  assert.match(wideProof, /<ResponsiveImage[\s\S]*image=\{sitePhoto\}/);
  assert.match(wideProof, /loading="lazy"/);
  assert.match(wideProof, /width=\{1600\}[\s\S]*height=\{1200\}/);
  assert.match(wideProof, /sizes="\(max-width: 760px\) calc\(100vw - 28px\), 720px"/);
  assert.match(wideProof, /<figcaption>Kontrolované pracovisko a pripravený postup na streche<\/figcaption>/);

  assert.match(responsiveImage, /alt=\{image\.alt\}/);
  assert.match(responsiveImage, /title=\{image\.title\}/);
  assert.match(responsiveImage, /<source srcSet=\{webpSrcSet\} sizes=\{sizes\} type="image\/webp" \/>/);
  assert.match(responsiveImage, /srcSet=\{jpgSrcSet\}/);
});
