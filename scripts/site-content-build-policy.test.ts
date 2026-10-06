import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  NEXT_PRODUCTION_BUILD_PHASE,
  shouldFallbackToDefaultSiteContent,
  shouldInitializeSiteContentSchema,
  shouldUseDefaultSiteContent,
} from '../src/server/site-content-build-policy';

test('production builds never initialize database schema for public site content', () => {
  assert.equal(shouldInitializeSiteContentSchema(NEXT_PRODUCTION_BUILD_PHASE), false);
  assert.equal(shouldInitializeSiteContentSchema('phase-production-server'), true);
});

test('database-less builds use defaults without reading local mutable storage', async () => {
  assert.equal(shouldUseDefaultSiteContent(NEXT_PRODUCTION_BUILD_PHASE, false), true);
  assert.equal(shouldUseDefaultSiteContent(NEXT_PRODUCTION_BUILD_PHASE, true), false);
  assert.equal(shouldUseDefaultSiteContent('phase-production-server', false), false);
  const dbSource = await readFile(new URL('../src/server/db.ts', import.meta.url), 'utf8');
  assert.match(dbSource, /export async function listSiteContent\(\): Promise<SiteContentItem\[]> \{\s*const phase = process\.env\.NEXT_PHASE;\s*if \(shouldUseDefaultSiteContent\(phase, Boolean\(databaseUrl\)\)\) return \[\];\s*const db = getPool\(\);/);
});

test('only a missing table may fall back during build', () => {
  assert.equal(shouldFallbackToDefaultSiteContent({ code: '42P01' }, NEXT_PRODUCTION_BUILD_PHASE), true);
  assert.equal(shouldFallbackToDefaultSiteContent({ code: '08006' }, NEXT_PRODUCTION_BUILD_PHASE), false);
  assert.equal(shouldFallbackToDefaultSiteContent({ code: '42P01' }, 'phase-production-server'), false);
});
