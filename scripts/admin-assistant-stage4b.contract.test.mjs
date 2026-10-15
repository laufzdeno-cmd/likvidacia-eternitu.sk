import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('owner and due suggestion stays explicit, editable and stale-safe', async () => {
  const [page, actions, db, suggestion] = await Promise.all([
    read('app/admin/(protected)/asistent/page.tsx'),
    read('app/admin/(protected)/asistent/actions.ts'),
    read('src/server/db.ts'),
    read('src/server/admin-task-suggestion.ts'),
  ]);
  assert.match(page, /Návrh asistenta/);
  assert.match(page, /Použiť návrh/);
  assert.match(page, /Ponechať nepriradené/);
  assert.match(page, /pred uložením ho môžete zmeniť/);
  assert.match(actions, /await verifyCsrf\(formData\)/);
  assert.match(actions, /getAdminWorkItemSuggestion/);
  assert.match(actions, /current\.sourceRevision !== submitted\.sourceRevision/);
  assert.match(actions, /notice === 'stale'.*recordAdminAssistantSuggestionOutcome/s);
  assert.match(db, /active=true.*role='SUPER_ADMIN'/s);
  assert.match(suggestion, /lowest_open_workload/);
  assert.match(suggestion, /addBusinessDays/);
  assert.doesNotMatch(actions, /sendPriceOffer|sendReview|publish|finalizeBusinessJob/);
});

test('assistant benefit metrics are aggregate, superadmin-only and non-causal', async () => {
  const [page, metrics] = await Promise.all([
    read('app/admin/(protected)/automatizacie/page.tsx'),
    read('src/server/admin-assistant-metrics.ts'),
  ]);
  assert.match(page, /assistantMetrics\.title/);
  assert.match(metrics, /Prevádzkové ukazovatele asistenta/);
  assert.match(page, /Dopyt → prvá CP/);
  assert.match(page, /Odoslaná CP → výsledok/);
  assert.match(metrics, /role !== 'SUPER_ADMIN'/);
  assert.match(metrics, /nie o dokázanú úsporu času/);
  assert.match(metrics, /suggestionDecisions/);
  assert.doesNotMatch(metrics, /customerName|customerEmail|phone/);
});

test('production runtime and release tooling apply the complete additive assistant schema', async () => {
  const [db, migration] = await Promise.all([
    read('src/server/db.ts'),
    read('scripts/admin-assistant-production-schema.mjs'),
  ]);
  assert.match(db, /if \(!runtimeSchemaInitializationAllowed\(\)\) \{\s+await ensureAdminAutopilotSchema\(\)/);
  assert.match(db, /CREATE TABLE IF NOT EXISTS business_job_completion/);
  assert.match(db, /review_request_blocked_at/);
  assert.match(db, /response_token_hash/);
  assert.match(db, /astana_targeted_schema_revisions/);
  assert.match(migration, /--apply/);
  assert.match(migration, /--confirm-production/);
  assert.match(migration, /DATABASE_URL_UNPOOLED \|\| process\.env\.POSTGRES_URL_NON_POOLING/);
  assert.match(migration, /ASTANA_RELEASE_SITE_ORIGIN/);
  assert.match(migration, /NEXT_PUBLIC_SITE_URL/);
  assert.match(migration, /missingConstraints/);
});
