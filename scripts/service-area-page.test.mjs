import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (relative) => readFile(new URL(relative, import.meta.url), 'utf8');

test('celoslovenský hub pridáva praktickú pôsobnosť bez mestských klonov', async () => {
  const [page, sitemap, footer] = await Promise.all([
    read('../app/kde-posobime/page.tsx'),
    read('../app/sitemap.ts'),
    read('../app/public-layout.tsx'),
  ]);

  assert.match(page, /path: '\/kde-posobime\/'/);
  assert.match(page, /<h1>Likvidáciu azbestu riešime po celom Slovensku<\/h1>/);
  assert.match(page, /sídlo v Poprade/);
  assert.match(page, /približne medzi\s*6:00 a 6:30/);
  assert.match(page, /Presný čas potvrdíme podľa obce, prístupu, rozsahu demontáže a počasia/);
  assert.match(page, /neznamená to miestne pobočky/);
  assert.match(page, /buildFaqJsonLd\(areaFaqs\)/);
  assert.match(page, /\/\#dopyt/);
  assert.match(sitemap, /page\('\/kde-posobime\/', 0\.82\)/);
  assert.match(footer, /href="\/kde-posobime\/">Celé Slovensko – výjazdy a plánovanie<\/a>/);
  assert.doesNotMatch(page, /\/likvidacia-azbestu-[a-z-]+\//,
    'hub nevytvára ďalšie automatické mestské vstupné stránky');
});

test('regionálne stránky jasne odlišujú výjazd z Popradu od miestnej pobočky', async () => {
  const page = await read('../app/seo-components.tsx');

  assert.match(page, /ASTANA, s\.r\.o\. so sídlom v Poprade zabezpečuje po dohode odbornú likvidáciu/);
  assert.match(page, /Výjazd a termín potvrdíme podľa obce, rozsahu prác a aktuálnej kapacity; v tejto lokalite nemáme pobočku/);
  assert.match(page, /Výjazd z Popradu po dohode/);
  assert.match(page, /Ako plánujeme výjazd do tejto oblasti/);
  assert.match(page, /href="\/kde-posobime\/">Ako plánujeme výjazdy po Slovensku<\/a>/);
  assert.doesNotMatch(page, /<h2>Typické objekty<\/h2>/,
    'odstránený opakovaný zoznam objektov nepridával regionálnu informáciu');
});
