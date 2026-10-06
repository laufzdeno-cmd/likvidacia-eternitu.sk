import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import postcss from 'postcss';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const publicLayout = read('../app/public-layout.tsx');
const seoComponents = read('../app/seo-components.tsx');
const seoJsonLd = read('../app/seo-json-ld.tsx');
const sitemap = read('../app/sitemap.ts');
const robots = read('../public/robots.txt');
const landingClient = read('../app/landing-client.tsx');
const publicWidgets = read('../app/public-widgets.tsx');
const visualPolish = read('../src/final-visual-polish.css');
const realizationsStyles = read('../app/realizacie/realizations-route.css');
const rootLayout = read('../app/layout.tsx');
const homepage = read('../app/page.tsx');
const priceLanding = read('../app/cena-likvidacie-azbestu/page.tsx');
const notFound = read('../app/not-found.tsx');
const publicCompany = read('../public/data/company.json');
const siteFacts = read('../src/content/site.ts');

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
  assert.doesNotMatch(seoJsonLd, /datePublished|dateModified/);
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
  assert.ok(siteFacts.includes(`value: '${company.founded_year}', confirmed: true`));
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
  assert.match(siteFacts, /openingHours:\s*'Po–Pia 7:00–18:00'/);
  assert.match(seoJsonLd, /opens:\s*'07:00'[\s\S]*closes:\s*'18:00'/);
  assert.match(publicCompany, /"opening_hours":\s*"Po–Pia 7:00–18:00"/);
  assert.match(read('../public/llms.txt'), /Telefonické informácie a objednávky: Po–Pia 7:00–18:00\./);
  for (const surface of [mail, homepageClient, landingClient, roofers]) {
    assert.match(surface, /7:00.{0,24}18:00/);
    assert.doesNotMatch(surface, /(?:8:00.{0,24}16:00|08:00.{0,24}18:00)/);
  }
});

test('machine-readable company facts carry the offer promise and date-bound authorization evidence', () => {
  const company = JSON.parse(publicCompany);
  const llms = read('../public/llms.txt');
  const firmPage = read('../app/o-firme/page.tsx');
  assert.equal(company.quote_response_time, 'Nezáväznú cenovú ponuku pošleme čo najskôr, najneskôr do 24 hodín.');
  assert.equal(company.website, company.domain);
  assert.ok(company.public_pages.includes(`${company.domain}/kde-posobime/`));
  assert.equal(company.authorizations.public_verification_as_of, '2024-09-19');
  assert.deepEqual(company.authorizations.asbestos_removal_scope_as_published, ['EXT, BJ', 'INT']);
  assert.match(company.authorizations.public_verification, /19\. 9\. 2024/);
  assert.match(company.authorizations.public_verification, /aktualnost po uvedenom datume z neho nemožno potvrdit/i);
  assert.ok(company.trust_notes.some((note) => /rozsahy EXT, BJ a INT/.test(note)));
  assert.ok(company.trust_notes.every((note) => !/firma ma opravnenie pre exterier aj interier/i.test(note)));
  assert.match(llms, /Kariéra a spolupráca.*https:\/\/likvidacia-eternitu\.sk\/kariera\//);
  assert.match(llms, /najneskôr do 24 hodín/);
  assert.match(llms, /Tento zoznam sám nepotvrdzuje zmeny po uvedenom dátume/);
  assert.match(firmPage, /site\.compliance\.asbestosRemovalAuthorization\.publicVerification/);
  assert.doesNotMatch(firmPage, /má oprávnenie na odstraňovanie azbestu v exteriéri aj interiéri/);
  assert.match(siteFacts, /publicVerificationAsOf: '2024-09-19'/);
  assert.match(siteFacts, /scopeAsPublished: \['EXT, BJ', 'INT'\]/);
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
  assert.match(homepage, /<PublicWidgets hideWhatsappOnMobile \/>/);
  assert.match(priceLanding, /<PublicPageShell[^>]*hideWhatsappOnMobile>/s);
  assert.match(publicWidgets, /' homepage-mobile-whatsapp'/);
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

test('Plus Jakarta Sans is self-hosted so builds do not depend on Google Fonts availability', () => {
  assert.match(rootLayout, /@fontsource-variable\/plus-jakarta-sans\/wght\.css/);
  assert.doesNotMatch(rootLayout, /next\/font\/google|fonts\.googleapis\.com|fonts\.gstatic\.com/);
  assert.match(read('../src/styles.css'), /--font-plus-jakarta:\s*["']Plus Jakarta Sans Variable["']/);
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
