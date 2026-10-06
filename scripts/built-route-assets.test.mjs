import assert from 'node:assert/strict';
import test from 'node:test';
import { extractStylesheetHrefs } from './built-route-assets.mjs';

test('stylesheet extraction is independent of link attribute order and quote style', () => {
  assert.deepEqual(extractStylesheetHrefs(`
    <link rel="stylesheet" href="/_next/static/a.css?x=1">
    <link href='/_next/static/b.css' media='all' rel='preload stylesheet'>
    <link rel="preload" href="/_next/static/not-css.js">
  `), ['/_next/static/a.css?x=1', '/_next/static/b.css']);
});
