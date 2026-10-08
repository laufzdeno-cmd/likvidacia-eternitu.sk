import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('career submissions use shared trusted rate limits and distinguish accepted follow-up work', async () => {
  const [route, cvUploadRoute, client, styles] = await Promise.all([
    readFile(new URL('../app/api/kariera/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/kariera/cv-upload/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/career-form-client.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/kariera/career.module.css', import.meta.url), 'utf8'),
  ]);
  assert.match(route, /consumeSharedRateLimit\('career-application-attempt-address', clientIp, 30, 10 \* 60_000\)/);
  assert.match(route, /consumeSharedRateLimit\('career-application-address', clientIp, 10, 10 \* 60_000\)/);
  assert.match(route, /consumeSharedRateLimit\('career-application-email', parsed\.data\.email\.toLowerCase\(\), 3, 10 \* 60_000\)/);
  assert.doesNotMatch(route, /new Map<string, \{ count: number; resetAt: number \}>/);
  assert.match(route, /if \(!origin\) return process\.env\.NODE_ENV !== 'production'/);
  assert.match(route, /allowed\.includes\(origin\) \|\| isTrustedVercelDeploymentOrigin\(origin\)/);
  assert.match(route, /return isTrustedLocalDevelopmentOrigin\(origin, request\.nextUrl\.origin\)/);
  assert.match(cvUploadRoute, /if \(isTrustedVercelDeploymentOrigin\(origin\)\) return true/);
  assert.match(cvUploadRoute, /return isTrustedLocalDevelopmentOrigin\(origin, request\.nextUrl\.origin\)/);
  assert.doesNotMatch(cvUploadRoute, /process\.env\.VERCEL_ENV === 'preview'/);
  assert.match(client, /accepted\?: boolean/);
  assert.match(client, /isAccepted \? ' is-warning'/);
  assert.match(styles, /\.formMessage\.warning/);
});

test('career header keeps applicants on the career application path', async () => {
  const [page, publicLayout, browserHarness] = await Promise.all([
    readFile(new URL('../app/kariera/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/public-layout.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./lead-private-blob-browser.integration.mjs', import.meta.url), 'utf8'),
  ]);

  assert.match(page, /headerCta=\{\{ href: '#prihlasit-sa', label: 'Chcem sa prihlásiť' \}\}/);
  assert.match(page, /className="button button-primary" href="#prihlasit-sa">Chcem sa prihlásiť<\/a>/);
  assert.match(publicLayout, /<PublicHeader primaryCta=\{headerCta\} \/>/);
  assert.match(publicLayout, /className="button button-primary header-button" href=\{primaryCta\.href\}>\{primaryCta\.label\}<\/a>/);
  assert.match(publicLayout, /className="nav-mobile-cta" href=\{primaryCta\.href\}>\{primaryCta\.label\}<\/a>/);
  assert.match(publicLayout, /href: '\/#dopyt',[\s\S]*label: 'Získať cenovú ponuku'/);
  assert.match(browserHarness, /page\.locator\('\.career-hero a\[href="#prihlasit-sa"\]'\)\.click\(\)/);
  assert.doesNotMatch(browserHarness, /page\.locator\('a\[href="#prihlasit-sa"\]'\)\.first\(\)\.click\(\)/);
});
