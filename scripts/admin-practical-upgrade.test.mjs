import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('praktické admin rozšírenia dodržia oprávnenia a nemenia schvaľovacie hranice', async () => {
  const [navigation, customers, media, history, actions] = await Promise.all([
    read('app/admin/(protected)/admin-nav.tsx'),
    read('app/admin/(protected)/klienti/page.tsx'),
    read('app/admin/(protected)/media/page.tsx'),
    read('app/admin/(protected)/obsah/historia/page.tsx'),
    read('app/admin/(protected)/obsah/actions.ts'),
  ]);

  assert.match(navigation, /href: '\/admin\/klienti'/);
  assert.match(navigation, /href: '\/admin\/media'.*superOnly: true/);
  assert.match(customers, /await requireAdminUser\(\)/);
  assert.match(customers, /searchParams: Promise<\{ page\?: string \}>/);
  assert.doesNotMatch(customers, /query\.set\(['"](?:email|phone)/);
  assert.match(media, /await requireSuperAdmin\(\)/);
  assert.match(media, /nič sa automaticky nezverejní/i);
  assert.match(history, /await requireSuperAdmin\(\)/);
  assert.match(history, /name="expectedCurrentHash"/);
  assert.match(actions, /restoreSiteContentVersionAction[\s\S]*await verifyCsrf\(formData\)[\s\S]*await requireSuperAdmin\(\)/);
  assert.match(actions, /confirmation !== 'OBNOVIŤ'/);
});

test('knižnica médií iba číta existujúce súkromné fotografie', async () => {
  const [page, db] = await Promise.all([
    read('app/admin/(protected)/media/page.tsx'),
    read('src/server/db.ts'),
  ]);
  assert.match(page, /\/api\/photo-intake\/media\/\$\{photo\.id\}/);
  assert.doesNotMatch(page, /reviewPhotoIntakeRecord|updatePhotoIntakeMetadata|publishRealizationCase/);
  assert.match(db, /m\.status <> 'pending_upload'/);
  assert.match(db, /m\.status <> 'deletion_pending'/);
});
