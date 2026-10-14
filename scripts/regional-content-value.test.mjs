import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { locationPages } from '../src/content/seo-content.ts';

const regionalSlugs = ['bratislava', 'trnava', 'trencin', 'nitra', 'zilina', 'banska-bystrica', 'presov', 'kosice'];

test('všetkých osem krajov má vlastnú regionálnu stránku a Poprad zostáva samostatnou lokálnou stránkou', () => {
  assert.equal(locationPages.length, 9);
  assert.deepEqual(
    regionalSlugs.filter((slug) => !locationPages.some((page) => page.slug === slug)),
    [],
  );
  assert.ok(locationPages.some((page) => page.slug === 'poprad'));
});

test('regionálne title a meta description sú jedinečné a majú použiteľnú dĺžku', () => {
  assert.equal(new Set(locationPages.map((page) => page.title)).size, locationPages.length);
  assert.equal(new Set(locationPages.map((page) => page.description)).size, locationPages.length);

  for (const page of locationPages) {
    assert.ok(page.title.length >= 40 && page.title.length <= 60, `${page.slug} má nevhodnú dĺžku title`);
    assert.ok(page.description.length >= 100 && page.description.length <= 160, `${page.slug} má nevhodnú dĺžku meta description`);
  }
});

test('každá lokalita prináša vlastné územné a dopytové informácie bez predstierania dôkazov', () => {
  const headings = new Set();
  const notes = new Set();
  const checklistSignatures = new Set();
  const planningSignatures = new Set();

  for (const page of locationPages) {
    assert.ok(page.coverageAreas.length >= 4, `${page.slug} má príliš úzke územné vysvetlenie`);
    assert.equal(new Set(page.coverageAreas).size, page.coverageAreas.length, `${page.slug} opakuje lokalitu`);
    assert.equal(page.requestChecklist.length, 3, `${page.slug} potrebuje tri praktické podklady`);
    assert.ok(page.requestChecklist.every((item) => item.length >= 24), `${page.slug} má príliš všeobecný podklad`);
    assert.equal(page.planningPoints.length, 3, `${page.slug} potrebuje tri miestne plánovacie body`);
    assert.ok(
      page.planningPoints.every(([title, text]) => title.length >= 12 && text.length >= 90),
      `${page.slug} má príliš všeobecný plánovací bod`,
    );
    headings.add(page.coverageHeading);
    notes.add(page.localNote);
    checklistSignatures.add(page.requestChecklist.join('|'));
    planningSignatures.add(page.planningPoints.flat().join('|'));
  }

  assert.equal(headings.size, locationPages.length);
  assert.equal(notes.size, locationPages.length);
  assert.equal(checklistSignatures.size, locationPages.length);
  assert.equal(planningSignatures.size, locationPages.length);
});

test('regionálne prepojenia smerujú iba na existujúce odlišné lokality', () => {
  const slugs = new Set(locationPages.map((page) => page.slug));

  for (const page of locationPages) {
    assert.equal(page.relatedSlugs.length, 3, `${page.slug} potrebuje tri súvisiace oblasti`);
    assert.equal(new Set(page.relatedSlugs).size, page.relatedSlugs.length, `${page.slug} opakuje súvisiacu oblasť`);
    assert.ok(!page.relatedSlugs.includes(page.slug), `${page.slug} nesmie odkazovať sám na seba`);
    assert.ok(page.relatedSlugs.every((slug) => slugs.has(slug)), `${page.slug} odkazuje na neexistujúcu oblasť`);
  }
});

test('regionálny renderer vysvetľuje význam zoznamu a nevydáva ho za pobočky alebo realizácie', async () => {
  const renderer = await readFile(new URL('../app/seo-components.tsx', import.meta.url), 'utf8');
  assert.match(renderer, /Zoznam vyjadruje územie pôsobnosti, nie miestne pobočky ani potvrdené realizácie/);
  assert.match(renderer, /location\.coverageAreas\.join\(', '\)/);
  assert.match(renderer, /location\.requestChecklist\.map/);
  assert.match(renderer, /location\.planningPoints\.map/);
  assert.match(renderer, /location\.relatedSlugs/);
  assert.match(renderer, /Všetky oblasti a plánovanie výjazdov/);
  assert.match(renderer, /breadcrumbParents=\{\[\{ name: 'Kde pôsobíme', path: '\/kde-posobime\/' \}\]\}/);
  assert.match(renderer, /breadcrumb=\{\{ name: h1, path \}\}/);
  assert.match(
    renderer,
    /hideWhatsappOnMobile/,
    'regionálne stránky nesmú na mobile prekryť obsah plávajúcim WhatsApp tlačidlom',
  );
});

test('stránka Kde pôsobíme odkazuje v hlavnom obsahu na všetky regionálne stránky', async () => {
  const hub = await readFile(new URL('../app/kde-posobime/page.tsx', import.meta.url), 'utf8');
  assert.match(hub, /locationPages\.map/);
  assert.match(hub, /href=\{`\/likvidacia-azbestu-\$\{location\.slug\}\/?`\}/);
  assert.match(hub, /Uvedené mestá a okresy označujú pôsobnosť, nie pobočky ani potvrdené realizácie/);
});

test('každá regionálna route má samostatný canonical a všetky lokality vstupujú do sitemap', async () => {
  const sitemap = await readFile(new URL('../app/sitemap.ts', import.meta.url), 'utf8');
  assert.match(sitemap, /\.\.\.locationPages\.map\(\(location\) => page\(`\/likvidacia-azbestu-\$\{location\.slug\}\//);

  for (const page of locationPages) {
    const route = await readFile(
      new URL(`../app/likvidacia-azbestu-${page.slug}/page.tsx`, import.meta.url),
      'utf8',
    );
    assert.match(route, new RegExp(`path: '/likvidacia-azbestu-${page.slug}/'`));
    assert.match(route, new RegExp(`item\\.slug === '${page.slug}'`));
  }
});
