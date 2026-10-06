import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

test('súbežné lokálne CMS zápisy zachovajú oba kľúče aj audit', async () => {
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const directory = await mkdtemp(path.join(projectRoot, '.astana-site-content-'));
  const environment = process.env as Record<string, string | undefined>;
  const previous = {
    databaseUrl: environment.DATABASE_URL,
    nodeEnv: environment.NODE_ENV,
    localDbPath: environment.ASTANA_LOCAL_DB_PATH,
  };
  const localDbPath = path.join(directory, 'local-db.json');

  environment.DATABASE_URL = '';
  environment.NODE_ENV = 'test';
  environment.ASTANA_LOCAL_DB_PATH = localDbPath;

  try {
    const { upsertSiteContentValues } = await import('../src/server/db');
    await Promise.all([
      upsertSiteContentValues({ concurrency_test_first: 'Prvý text' }, 'first@example.invalid'),
      upsertSiteContentValues({ concurrency_test_second: 'Druhý text' }, 'second@example.invalid'),
    ]);

    const local = JSON.parse(await readFile(localDbPath, 'utf8'));
    assert.equal(local.siteContent.find((item: { key: string }) => item.key === 'concurrency_test_first')?.value, 'Prvý text');
    assert.equal(local.siteContent.find((item: { key: string }) => item.key === 'concurrency_test_second')?.value, 'Druhý text');
    const writes = local.auditLogs.filter((item: { action: string }) => item.action === 'site_content_updated');
    assert.equal(writes.length, 2);
  } finally {
    if (previous.databaseUrl === undefined) delete environment.DATABASE_URL;
    else environment.DATABASE_URL = previous.databaseUrl;
    if (previous.nodeEnv === undefined) delete environment.NODE_ENV;
    else environment.NODE_ENV = previous.nodeEnv;
    if (previous.localDbPath === undefined) delete environment.ASTANA_LOCAL_DB_PATH;
    else environment.ASTANA_LOCAL_DB_PATH = previous.localDbPath;
    await rm(directory, { recursive: true, force: true });
  }
});
