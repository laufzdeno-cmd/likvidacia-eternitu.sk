import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('dopyt komunikuje rovnaký prísľub pred aj po odoslaní', async () => {
  const [homepage, client, receipt] = await Promise.all([
    read('app/page.tsx'),
    read('app/homepage-critical-client.tsx'),
    read('app/dopyt-prijaty/route.ts'),
  ]);
  const promise = 'Nezáväznú cenovú ponuku vám pošleme čo najskôr, najneskôr do 24 hodín.';
  assert.match(homepage, new RegExp(promise.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(client, new RegExp(promise.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(receipt, new RegExp(promise.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(homepage, /Dopyt si skontrolujeme|doplníme s vami detaily/);
});

test('stará ponuková adresa smeruje do jediného aktuálneho zoznamu', async () => {
  const [legacyList, legacyDetail] = await Promise.all([
    read('app/admin/(protected)/cenove-ponuky/page.tsx'),
    read('app/admin/(protected)/cenove-ponuky/[id]/page.tsx'),
  ]);
  assert.match(legacyList, /redirect\('\/admin\/ponuky'\)/);
  assert.doesNotMatch(legacyList, /listQuotes|<table/);
  assert.match(legacyDetail, /getQuote\(id\)/);
});

test('stará verejná adresa overených informácií zachováva SEO hodnotu', async () => {
  const config = (await import('../next.config.mjs')).default;
  const redirects = await config.redirects();
  assert.deepEqual(
    redirects.find((item) => item.source === '/overene-informacie/'),
    { source: '/overene-informacie/', destination: '/o-firme/', permanent: true },
  );
});
