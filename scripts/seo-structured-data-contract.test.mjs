import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import postcss from 'postcss';
import { articles } from '../src/content/seo-content.ts';

const require = createRequire(import.meta.url);
const fontkit = require('fontkit');

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const publicLayout = read('../app/public-layout.tsx');
const seoComponents = read('../app/seo-components.tsx');
const seoJsonLd = read('../app/seo-json-ld.tsx');
const sitemap = read('../app/sitemap.ts');
const robots = read('../public/robots.txt');
const landingClient = read('../app/landing-client.tsx');
const publicWidgets = read('../app/public-widgets.tsx');
const publicWhatsapp = read('../app/public-whatsapp.tsx');
const visualPolish = read('../src/final-visual-polish.css');
const realizationsStyles = read('../app/realizacie/realizations-route.css');
const rootLayout = read('../app/layout.tsx');
const fontFace = read('../src/font-face.css');
const publicFontPreload = read('../src/components/public-font-preload.tsx');
const homepage = read('../app/page.tsx');
const priceLanding = read('../app/cena-likvidacie-azbestu/page.tsx');
const careerLanding = read('../app/kariera/page.tsx');
const realizationsLanding = read('../app/realizacie/page.tsx');
const notFound = read('../app/not-found.tsx');
const publicCompany = read('../public/data/company.json');
const siteFacts = read('../src/content/site.ts');
const contactPage = read('../app/kontakt/page.tsx');
const seoContent = read('../src/content/seo-content.ts');

test('public page shell is the single breadcrumb JSON-LD owner for its pages', () => {
  assert.match(publicLayout, /breadcrumb \? <BreadcrumbJsonLd/);
  assert.match(publicLayout, /parents=\{breadcrumbParents\}/);
  assert.doesNotMatch(seoComponents, /buildBreadcrumbJsonLd/);
  assert.match(seoComponents, /breadcrumbParents=\{\[\{ name: 'Poradňa', path: '\/poradna\/' \}\]\}/);
  assert.match(seoJsonLd, /\.\.\.parents/);
});

test('advice articles emit Article JSON-LD sourced from visible article content', () => {
  assert.match(seoComponents, /buildArticleJsonLd\(\{[\s\S]*headline: article\.title,[\s\S]*description: article\.quickAnswer,[\s\S]*articleBody: article\.body\.map/);
  assert.match(seoJsonLd, /'@type': 'Article'/);
  assert.match(seoJsonLd, /mainEntityOfPage: \{ '@type': 'WebPage', '@id': url \}/);
  assert.match(seoJsonLd, /author: \{ '@id': organizationId \}/);
  assert.match(seoJsonLd, /publisher: \{ '@id': organizationId \}/);
  assert.match(seoComponents, /image: article\.image/);
  assert.match(seoComponents, /dateModified: articleEditorial\.contentUpdatedAt/);
  assert.match(seoComponents, /citations: editorial\.sources\.map/);
  assert.match(seoJsonLd, /image: absoluteUrl\(image\)/);
  assert.match(seoJsonLd, /dateModified/);
  assert.match(seoJsonLd, /citations\.length \? \{ citation: citations \} : \{\}/);
  assert.doesNotMatch(seoJsonLd, /datePublished/, 'neoverený dátum prvého publikovania sa nesmie vymýšľať');
});

test('article trust copy distinguishes content updates from unproven expert review', () => {
  assert.match(seoContent, /contentUpdatedAt: '\d{4}-\d{2}-\d{2}'/);
  assert.match(seoComponents, /<time dateTime=\{articleEditorial\.contentUpdatedAt\}>\{articleEditorial\.contentUpdatedLabel\}<\/time>/);
  assert.doesNotMatch(seoComponents, /vecná a redakčná kontrola|odborná kontrola/i);
});

test('company identity is represented by one linked Organization and ProfessionalService entity', () => {
  assert.match(seoJsonLd, /'@type': \['Organization', 'ProfessionalService'\]/);
  assert.match(seoJsonLd, /'@id': `\$\{SITE_URL\}\/\#organization`/);
  assert.doesNotMatch(seoJsonLd, /'#business'|#business/);
  assert.match(seoJsonLd, /provider: \{ '@id': `\$\{SITE_URL\}\/\#organization` \}/);
});

test('core company JSON agrees with the typed source and JSON-LD reads that source', () => {
  const company = JSON.parse(publicCompany);
  const sourceValues = [
    ['brandName', company.brand],
    ['legalName', company.legal_name],
    ['website', company.domain],
    ['phoneHref', company.phone],
    ['email', company.email],
    ['street', company.address.street],
    ['postalCode', company.address.postal_code],
    ['locality', company.address.city],
    ['country', 'SK'],
    ['ico', company.company_ids.ico],
    ['dic', company.company_ids.dic],
    ['icDph', company.company_ids.ic_dph],
    ['openingHours', company.opening_hours],
    ['areaServed', company.areas_served[0]],
  ];
  for (const [key, value] of sourceValues) {
    assert.ok(siteFacts.includes(`${key}: '${value}'`), `src/content/site.ts ${key} must match company.json`);
  }
  assert.match(siteFacts, new RegExp(`value: '${company.founded_year}',[\\s\\S]{0,120}confirmed: true`));
  assert.ok(siteFacts.includes(`sourceUrl: '${company.founded_year_source}'`));
  assert.equal(company.founded_year_verified_as_of, '2026-10-07');
  assert.ok(siteFacts.includes(`sameAs: ['${company.same_as.join("', '")}']`));
  for (const field of [
    'name: site.brandName', 'legalName: site.legalName', 'url: SITE_URL',
    'telephone: site.phoneHref', 'email: site.email', 'foundingDate: site.claimedStats.foundedOrActiveSince.value',
    'streetAddress: site.address.street', 'postalCode: site.address.postalCode',
    'addressLocality: site.address.locality', 'addressCountry: site.address.country',
    'value: site.ico', 'taxID: site.dic', 'vatID: site.icDph', 'sameAs: site.sameAs',
  ]) {
    assert.ok(seoJsonLd.includes(field), `Organization JSON-LD must use ${field}`);
  }
});

test('approved company opening hours stay aligned across public and email surfaces', () => {
  const mail = read('../src/server/mail.ts');
  const homepageClient = read('../app/homepage-critical-client.tsx');
  const landingClient = read('../app/landing-client.tsx');
  const roofers = read('../app/strechari/page.tsx');
  assert.match(siteFacts, /openingHours:\s*'Po–Pia 8:00–18:00'/);
  assert.match(seoJsonLd, /opens:\s*'08:00'[\s\S]*closes:\s*'18:00'/);
  assert.match(publicCompany, /"opening_hours":\s*"Po–Pia 8:00–18:00"/);
  assert.match(read('../public/llms.txt'), /Telefonické informácie a objednávky: Po–Pia 8:00–18:00\./);
  for (const surface of [mail, homepageClient, landingClient, roofers]) {
    assert.match(surface, /8:00.{0,24}18:00/);
    assert.doesNotMatch(surface, /(?:7:00.{0,24}18:00|8:00.{0,24}16:00)/);
  }
});

test('machine-readable company facts carry the offer promise and distinguish current registry evidence from its historical snapshot', () => {
  const company = JSON.parse(publicCompany);
  const llms = read('../public/llms.txt');
  const firmPage = read('../app/o-firme/page.tsx');
  assert.equal(company.quote_response_time, 'Nezáväznú cenovú ponuku pošleme čo najskôr, najneskôr do 24 hodín.');
  assert.equal(company.website, company.domain);
  assert.ok(company.public_pages.includes(`${company.domain}/kde-posobime/`));
  assert.equal(company.authorizations.public_verification_as_of, '2026-10-14');
  assert.deepEqual(company.authorizations.asbestos_removal_scope_as_published, ['BJ, EXT', 'INT']);
  assert.match(company.authorizations.public_verification, /Centrálny firemný zdroj ASTANA/);
  assert.match(company.authorizations.public_verification, /14\. 10\. 2026/);
  assert.match(company.authorizations.public_verification_url, /\/web\/uvz\/zoznam-fyzickych-osob-podnikatelov/);
  assert.equal(company.authorizations.verification_source_url, 'https://www.astana.sk/overene-informacie');
  assert.equal(company.authorizations.historical_snapshot.as_of, '2024-09-19');
  assert.match(company.authorizations.historical_snapshot.note, /Historický snapshot/);
  assert.ok(company.trust_notes.some((note) => /14\. 10\. 2026/.test(note)));
  assert.ok(company.trust_notes.every((note) => !/firma ma opravnenie pre exterier aj interier/i.test(note)));
  assert.deepEqual(company.services.slice(0, 4), [
    'Likvidácia azbestu',
    'Likvidácia eternitu',
    'Odstránenie azbestu',
    'Demontáž eternitu',
  ]);
  const slovakProse = JSON.stringify([
    company.transport_policy,
    company.authorizations.public_verification,
    company.authorizations.note,
    ...company.services,
    ...company.trust_notes,
    company.gallery_policy.locations_and_area,
  ]);
  assert.doesNotMatch(slovakProse, /\b(?:zverejneny|uvadza|opravneniami|aktualnost|likvidacia|odstranenie|demontaz|bezpecnostnych|dovodov|realizacie|vymery|neuvadzaju|spolahlivo|potvrdene)\b/i);
  assert.match(llms, /Kariéra a spolupráca.*https:\/\/likvidacia-eternitu\.sk\/kariera\//);
  assert.match(llms, /najneskôr do 24 hodín/);
  assert.match(llms, /Centrálny firemný zdroj ASTANA/);
  assert.match(llms, /historickým snapshotom/);
  assert.match(firmPage, /site\.documents\.publicLookupHint/);
  assert.match(homepage, /site\.documents\.publicLookupHint/);
  assert.doesNotMatch(firmPage, /asbestosRemovalAuthorization\.publicVerification/);
  assert.match(siteFacts, /publicLookupHint: 'Oprávnenia spoločnosti ASTANA, s\.r\.o\. si môžete overiť v aktuálnom registri ÚVZ SR podľa IČO 46 157 701\.'/);
  assert.doesNotMatch(firmPage, /má oprávnenie na odstraňovanie azbestu v exteriéri aj interiéri/);
  assert.match(siteFacts, /publicVerificationAsOf: '2026-10-14'/);
  assert.match(siteFacts, /scopeAsPublished: \['BJ, EXT', 'INT'\]/);
});

test('career remains discoverable from every public footer implementation', () => {
  assert.match(publicLayout, /<a href="\/kariera\/">Kariéra<\/a>/);
  assert.match(homepage, /<a href="\/kariera\/">Kariéra<\/a>/);
  assert.match(realizationsLanding, /<a href="\/kariera\/">Kariéra<\/a>/);
});

test('price calculator stays short and leaves locality to the inquiry form', () => {
  assert.match(priceLanding, /data-price-area/);
  assert.match(priceLanding, /data-price-material/);
  assert.doesNotMatch(priceLanding, /data-price-city|priceCity|price-city-field|Obec alebo mesto pre dopyt/);
});

test('sitemap does not claim every page was modified at build time', () => {
  assert.doesNotMatch(sitemap, /lastModified|new Date\s*\(/);
});

test('every explicit robots group keeps API routes out of crawling', () => {
  const groups = robots.split(/^User-agent:\s*/im).slice(1);
  assert.ok(groups.length > 0);
  assert.match(robots, /^User-agent:\s*OAI-SearchBot\s*$/m);
  for (const group of groups) {
    const userAgents = group.split(/\r?\n/, 1)[0].trim();
    assert.match(group, /^Disallow:\s*\/api\//im, `${userAgents} must disallow /api/`);
    assert.match(group, /^Disallow:\s*\/admin\//im, `${userAgents} must disallow /admin/`);
  }
});

test('mobile floating WhatsApp yields to the sticky CTA and never covers the homepage hero', () => {
  assert.match(landingClient, /whatsappButton\?\.classList\.toggle\('is-hidden-by-sticky-cta', shouldShow\)/);
  assert.match(homepage, /<HomepageDeferredWidgets \/>/);
  assert.match(priceLanding, /<PublicPageShell[^>]*hideWhatsappOnMobile>/s);
  assert.match(publicWhatsapp, /' homepage-mobile-whatsapp'/);
  const visualRoot = postcss.parse(visualPolish, { from: 'src/final-visual-polish.css' });
  let mobileWhatsappGuard = null;
  visualRoot.walkRules('.whatsapp-btn.homepage-mobile-whatsapp', (rule) => {
    if (rule.parent?.type === 'atrule' && rule.parent.params.replaceAll(' ', '') === '(max-width:760px)') {
      mobileWhatsappGuard = rule;
    }
  });
  assert.ok(mobileWhatsappGuard, 'shared mobile WhatsApp guard must stay in the 760px media query');
  const display = mobileWhatsappGuard.nodes.find((node) => node.type === 'decl' && node.prop === 'display');
  assert.equal(display?.value, 'none');
  assert.equal(display?.important, true);
  assert.match(realizationsStyles, /body:has\(\.realizations-page\) \.whatsapp-btn\s*\{[^}]*display:\s*none !important;[^}]*bottom:\s*max\(12px, env\(safe-area-inset-bottom, 0px\)\)/);
  assert.match(visualPolish, /\.whatsapp-btn\.is-hidden-by-sticky-cta\s*\{\s*opacity:\s*0\s*!important;/);
});

test('public offer copy consistently treats customer photos as optional', () => {
  assert.match(priceLanding, /Fotky môžu ponuku spresniť, ale nie sú povinné/);
  assert.match(contactPage, /Fotky sú voliteľné/);
  assert.match(seoContent, /Fotografie sú voliteľné/);
  assert.match(seoContent, /Na ponuku stačí m2 a lokalita; fotky sú voliteľné/);
  assert.match(seoContent, /Pošlete výmeru a lokalitu/);
  assert.match(seoContent, /Fotky strechy či materiálu sú voliteľné/);
  assert.match(articles.find(article => article.slug === 'co-poslat-pre-nacenenie-likvidacie-eternitu')?.quickAnswer || '', /Fotografie nie sú povinné/);
  assert.doesNotMatch(seoContent, /Pošlite fotky, výmeru a lokalitu/);
  assert.doesNotMatch(seoContent, /Pošlite celkový záber strechy, detail krytiny/);
  assert.doesNotMatch(seoContent, /Pošlete výmeru, lokalitu a fotky/);
  assert.match(read('../app/faq/page.tsx'), /[Ff]otky sú voliteľné/);
  assert.match(read('../app/postup/page.tsx'), /Fotky sú voliteľné/);
  assert.match(notFound, /Fotky sú voliteľné/);
});

test('price content uses the approved asbestos roof social image', () => {
  assert.match(priceLanding, /image:\s*'\/og\/cena-strecha-realizacia\.jpg'/);
  assert.match(priceLanding, /<Image[\s\S]*?src="\/og\/cena-strecha-realizacia\.jpg"/,
    'the approved roof photo must be visibly rendered on the price page, not only used as social metadata');
  assert.match(priceLanding, /alt="Pracovník ASTANA stabilizuje eternitovú strechu pred bezpečnou demontážou"/);
  assert.equal(articles.find(article => article.slug === 'kolko-stoji-likvidacia-azbestu')?.image, '/og/cena-strecha-realizacia.jpg');
  assert.equal(articles.find(article => article.slug === 'odvoz-a-balenie-azbestoveho-odpadu')?.image, '/og/cena.jpg');
});

test('homepage calculator describes a non-final price range, transport policy and its exclusions', () => {
  assert.match(homepage, /Orientačný cenový rozsah/);
  assert.match(homepage, /Nejde o konečnú cenu/);
  assert.match(homepage, /transportPolicy\.freeFromThreshold/);
  assert.match(homepage, /transportPolicy\.belowThreshold/);
  assert.match(homepage, /Dokumentáciu, individuálne položky/);
  assert.match(homepage, /režim DPH určí až konkrétna cenová ponuka/);
  assert.match(priceLanding, /transportPolicy\.freeFromThreshold/);
  assert.match(priceLanding, /transportPolicy\.belowThreshold/);
});

test('Plus Jakarta Sans is self-hosted and optional so it never delays the first render', () => {
  assert.match(rootLayout, /\.\.\/src\/global-bundle\.css/);
  assert.doesNotMatch(rootLayout, /next\/font\/google|fonts\.googleapis\.com|fonts\.gstatic\.com/);
  assert.match(fontFace, /font-family:\s*['"]Plus Jakarta Sans Variable['"]/);
  assert.match(fontFace, /font-display:\s*optional/);
  assert.match(fontFace, /url\(['"]?\/assets\/fonts\/plus-jakarta-sans-sk-wght-normal\.woff2['"]?\)/);
  const headerStability = read('../src/public-header-stability.css');
  assert.match(headerStability, /@media \(max-width: 760px\)[\s\S]*html,\s*\n\s*body\s*\{[\s\S]*font-family: ui-sans-serif/);
  assert.match(headerStability, /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation:\s*none\s*!important;[\s\S]*transition:\s*none\s*!important/,
    'reduced-motion users must not receive decorative animation or transitions');
  assert.match(headerStability, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.site-header,\s*[\s\S]*\.site-header \*\s*\{[\s\S]*transition:\s*none\s*!important/,
    'the compact header must override its more specific normal-motion transition');
  assert.match(headerStability, /\.site-header \.header-brand-logo\s*\{[\s\S]*display:\s*block\s*!important[\s\S]*object-fit:\s*contain/);
  assert.match(headerStability, /@media \(max-width: 820px\)[\s\S]*\.site-header,\s*[\s\S]*\.site-header \.header-main\s*\{[\s\S]*background:\s*rgba\(15, 31, 61, 0\.985\)\s*!important/,
    'the single contrast-safe header logo requires the navy header at every mobile width');
  assert.match(headerStability, /@media \(min-width: 821px\)[\s\S]*\.site-header \.brand:not\(\.footer-brand\)\s*\{[\s\S]*width:\s*195px\s*!important;[\s\S]*min-width:\s*195px\s*!important/,
    'desktop header brand must reserve the reviewed logo column geometry');
  assert.match(headerStability, /@media \(min-width: 821px\)[\s\S]*\.site-header \.header-brand-logo\s*\{[\s\S]*width:\s*195px\s*!important;[\s\S]*height:\s*65px\s*!important/,
    'desktop header must paint the logo at deterministic dimensions');
  assert.match(headerStability, /\.site-footer \.footer-brand \.brand-logo\[src\^="\/assets\/astana-logo\.png"\][^{]*\{[^}]*width:\s*195px\s*!important/,
    'the shared cache URL must preserve the reviewed footer-logo geometry');
  assert.doesNotMatch(read('../src/final-visual-polish.css'),
    /\.site-header \.brand:not\(\.footer-brand\) \.brand-logo[^{}]*\{[^{}]*content:\s*url\(/,
    'legacy CSS must not initiate a second responsive header-logo request');
  const headerLogo = read('../app/header-brand-logo.tsx');
  for (const publicShell of [read('../app/page.tsx'), read('../app/public-layout.tsx'), read('../app/realizacie/page.tsx')]) {
    assert.match(publicShell,
      /<img className="brand-logo" src="\/assets\/astana-logo\.png\?surface=header" alt="ASTANA" width="195" height="65" loading="lazy" decoding="async" fetchPriority="low" \/>/,
      'below-fold footer logos must reuse the already cached mobile header asset');
  }
  assert.match(headerLogo, /className="header-brand-logo"[\s\S]*src="\/assets\/astana-logo-dark\.png"[\s\S]*alt="ASTANA"[\s\S]*width="195"[\s\S]*height="65"/,
    'the header logo must use one real, accessible image with stable intrinsic geometry');
  assert.equal((fontFace.match(/@font-face/g) || []).length, 1);
  const slovakSubset = readFileSync(new URL('../public/assets/fonts/plus-jakarta-sans-sk-wght-normal.woff2', import.meta.url));
  assert.ok(slovakSubset.byteLength > 20_000 && slovakSubset.byteLength < 35_000);
  const font = fontkit.create(slovakSubset);
  assert.equal(font.type, 'WOFF2');
  assert.deepEqual(font.variationAxes?.wght && {
    min: font.variationAxes.wght.min,
    default: font.variationAxes.wght.default,
    max: font.variationAxes.wght.max,
  }, { min: 200, default: 400, max: 800 });
  for (const glyph of 'áäčďéíĺľňóôŕšťúýžÁÄČĎÉÍĹĽŇÓÔŔŠŤÚÝŽ€–„“') {
    assert.equal(font.hasGlyphForCodePoint(glyph.codePointAt(0)), true, `font is missing Slovak glyph ${glyph}`);
  }
  assert.match(read('../src/styles.css'), /--font-plus-jakarta:\s*["']Plus Jakarta Sans Variable["']/);
});

test('mobile homepage hero serves a Retina AVIF candidate through matching preload data', () => {
  const page = readFileSync('app/page.tsx', 'utf8');
  assert.match(page, /azbest-087-mobile-432\.avif 432w, \/assets\/azbest\/hero\/azbest-087-mobile-824\.avif 824w/);
  assert.match(page, /imageSrcSet=\{heroImage\.mobileAvifSrcSet\}/);
  assert.match(page, /imageSizes="100vw"/);
  const retinaHero = readFileSync(new URL('../public/assets/azbest/hero/azbest-087-mobile-824.avif', import.meta.url));
  assert.ok(retinaHero.byteLength > 24_000 && retinaHero.byteLength < 30_000,
    `mobile Retina hero must stay detailed but lightweight, got ${retinaHero.byteLength} bytes`);
});

test('font preloads stay off the image-led homepage and are scoped to the measured public routes', () => {
  assert.doesNotMatch(rootLayout, /rel=["']preload["'][^>]+plus-jakarta-sans/);
  assert.doesNotMatch(homepage, /PublicFontPreload/);
  assert.match(publicFontPreload, /preload\('\/assets\/fonts\/plus-jakarta-sans-sk-wght-normal\.woff2'/);
  assert.equal((publicFontPreload.match(/\bpreload\(/g) || []).length, 1);
  assert.match(priceLanding, /<PublicFontPreload\s*\/>/);
  assert.match(careerLanding, /<PublicFontPreload\s*\/>/);
  assert.doesNotMatch(realizationsLanding, /PublicFontPreload/,
    'the realizations route must not let a font preload compete with its measured hero proof');
  assert.match(seoComponents, /export function ArticlePage[\s\S]*<PublicFontPreload\s*\/>/);
});

test('homepage retains ISR and CMS build fallback is limited to the reviewed database policy', () => {
  assert.match(homepage, /export const revalidate = 300/);
  assert.match(homepage, /getSiteContentMap\(homeContentDefaults\)/);
  assert.doesNotMatch(homepage, /catch\s*\([^)]*\)\s*\{[^}]*homeContentDefaults/s);
  const database = read('../src/server/db.ts');
  assert.match(database, /shouldFallbackToDefaultSiteContent\(error, phase\)\) return \[\]/);
  const buildPolicy = read('../src/server/site-content-build-policy.ts');
  assert.match(buildPolicy, /error\.code === '42P01'/);
  assert.doesNotMatch(buildPolicy, /ECONNREFUSED|ETIMEDOUT|EACCES/);
});

test('404 page is explicitly non-indexable and does not inherit the homepage canonical', () => {
  assert.match(notFound, /export const metadata:\s*Metadata/);
  assert.match(notFound, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
  assert.doesNotMatch(notFound, /alternates:\s*\{\s*canonical:\s*['"]\//);
  assert.doesNotMatch(rootLayout, /alternates:\s*\{\s*canonical:\s*['"]\//);
  assert.match(homepage, /alternates:\s*\{\s*canonical:\s*['"]\/['"]\s*\}/);
});

test('unverified Google Business Profile URL is not published as TODO content', () => {
  assert.doesNotMatch(publicCompany, /TODO/i);
  assert.doesNotMatch(siteFacts, /TODO:.*Google Business Profile/i);
});
