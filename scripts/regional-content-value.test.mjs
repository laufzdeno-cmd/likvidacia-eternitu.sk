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

test('každá lokalita prináša vlastné územné a dopytové informácie bez predstierania dôkazov', () => {
  const headings = new Set();
  const notes = new Set();
  const checklistSignatures = new Set();

  for (const page of locationPages) {
    assert.ok(page.coverageAreas.length >= 4, `${page.slug} má príliš úzke územné vysvetlenie`);
    assert.equal(new Set(page.coverageAreas).size, page.coverageAreas.length, `${page.slug} opakuje lokalitu`);
    assert.equal(page.requestChecklist.length, 3, `${page.slug} potrebuje tri praktické podklady`);
    assert.ok(page.requestChecklist.every((item) => item.length >= 24), `${page.slug} má príliš všeobecný podklad`);
    headings.add(page.coverageHeading);
    notes.add(page.localNote);
    checklistSignatures.add(page.requestChecklist.join('|'));
  }

  assert.equal(headings.size, locationPages.length);
  assert.equal(notes.size, locationPages.length);
  assert.equal(checklistSignatures.size, locationPages.length);
});

test('regionálny renderer vysvetľuje význam zoznamu a nevydáva ho za pobočky alebo realizácie', async () => {
  const renderer = await readFile(new URL('../app/seo-components.tsx', import.meta.url), 'utf8');
  assert.match(renderer, /Zoznam vyjadruje územie pôsobnosti, nie miestne pobočky ani potvrdené realizácie/);
  assert.match(renderer, /location\.coverageAreas\.join\(', '\)/);
  assert.match(renderer, /location\.requestChecklist\.map/);
  assert.match(
    renderer,
    /<PublicPageShell breadcrumb=\{\{ name: h1, path \}\} hideWhatsappOnMobile>/,
    'regionálne stránky nesmú na mobile prekryť obsah plávajúcim WhatsApp tlačidlom',
  );
});
