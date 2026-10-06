import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const vercelIgnore = readFileSync(new URL('../.vercelignore', import.meta.url), 'utf8');
const gitIgnore = readFileSync(new URL('../.gitignore', import.meta.url), 'utf8');
const nextConfig = readFileSync(new URL('../next.config.mjs', import.meta.url), 'utf8');
const proxy = readFileSync(new URL('../proxy.ts', import.meta.url), 'utf8');
const tracedExclusions = nextConfig.match(/outputFileTracingExcludes:\s*\{\s*['"]\/\*['"]:\s*\[([^\]]*)\]/)?.[1] ?? '';

test('local database files are excluded from both Vercel source and server traces', () => {
  assert.match(vercelIgnore, /^\.data\/$/m);
  assert.ok(tracedExclusions.includes("'./.data/**/*'"));
});

test('local attachments and root review data cannot enter server traces', () => {
  for (const directory of ['storage', 'data']) {
    assert.ok(
      tracedExclusions.includes(`'./${directory}/**/*'`),
      `${directory} must be excluded from server traces`,
    );
  }
});

test('local attachments and non-runtime workspace data are excluded from Vercel source', () => {
  for (const directory of ['storage', '.npm', 'data', '.release-empty-dir']) {
    assert.ok(
      vercelIgnore.split(/\r?\n/).includes(`/${directory}/`),
      `${directory} must not be uploaded with the Vercel source`,
    );
  }
});

test('temporary local QA and browser profile files stay out of Git and Vercel source', () => {
  assert.match(gitIgnore, /^\/tmp\/$/m);
  assert.match(vercelIgnore, /^\/tmp\/$/m);
});

test('worker photo intake is private, non-cacheable, and excluded from indexing', () => {
  assert.match(proxy, /matcher:\s*\[[^\]]*['"]\/spolupraca\/fotky\/:path\*['"]/s);
  assert.match(proxy, /pathname\.startsWith\(['"]\/spolupraca\/fotky\//);
  assert.match(proxy, /Cache-Control',\s*'private, no-store, max-age=0, must-revalidate'/);
  assert.match(proxy, /X-Robots-Tag',\s*'noindex, nofollow, noarchive'/);
  assert.match(proxy, /Referrer-Policy',\s*'no-referrer'/);
  assert.doesNotMatch(nextConfig, /source:\s*['"]\/spolupraca\/fotky\/:path\*['"]/);
});

test('internal planning and QA evidence stay out of Vercel CLI uploads', () => {
  assert.match(vercelIgnore, /^\/docs\/$/m);
  for (const file of [
    'AGENTS.md',
    'ASTANA_META_FINAL_ACCOUNT_AUDIT.md',
    'AUDIT.md',
    'CHANGELOG.md',
    'PLANNING.md',
    'README.md',
  ]) {
    assert.ok(
      vercelIgnore.split(/\r?\n/).includes(`/${file}`),
      `${file} is internal documentation and must not be uploaded with Vercel CLI`,
    );
  }
});
