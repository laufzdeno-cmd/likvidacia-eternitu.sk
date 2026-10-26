import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

test('história obsahu vytvorí verzie a obnoví staršiu bez prepisu auditu', async () => {
  const directory = await mkdtemp(path.join(process.cwd(), '.astana-content-version-'));
  const previous = {
    databaseUrl: process.env.DATABASE_URL,
    nodeEnv: process.env.NODE_ENV,
    localDbPath: process.env.ASTANA_LOCAL_DB_PATH,
  };
  Object.assign(process.env, {
    DATABASE_URL: '',
    NODE_ENV: 'test',
    ASTANA_LOCAL_DB_PATH: path.join(directory, 'local-db.json'),
  });

  try {
    const db = await import(`../src/server/db.ts?site-content-version=${randomUUID()}`);
    await db.upsertSiteContentValues({ heroTitle: 'Prvá verzia', heroText: 'Pôvodný text', internalUnknownKey: 'pôvodná hodnota' }, 'admin@example.invalid');
    const first = (await db.listSiteContentVersions(10))[0];
    assert.equal(first.action, 'saved');

    await db.upsertSiteContentValues({ heroTitle: 'Druhá verzia', heroText: 'Nový text', internalUnknownKey: 'zachovať aktuálnu hodnotu' }, 'admin@example.invalid');
    const currentValues = Object.fromEntries(
      (await db.listSiteContent()).map((item: { key: string; value: string }) => [item.key, item.value]),
    );
    const currentHash = db.siteContentSnapshotHash(currentValues);
    const restored = await db.restoreSiteContentVersion({
      versionId: first.id,
      expectedCurrentHash: currentHash,
      actorEmail: 'admin@example.invalid',
    });
    assert.equal(restored?.action, 'restored');
    assert.equal(restored?.restoredFromId, first.id);
    const after = Object.fromEntries(
      (await db.listSiteContent()).map((item: { key: string; value: string }) => [item.key, item.value]),
    );
    assert.equal(after.heroTitle, 'Prvá verzia');
    assert.equal(after.heroText, 'Pôvodný text');
    assert.equal(after.internalUnknownKey, 'zachovať aktuálnu hodnotu', 'obnova nesmie prepísať nepovolený budúci kľúč');

    const staleAttempt = await db.restoreSiteContentVersion({
      versionId: first.id,
      expectedCurrentHash: currentHash,
      actorEmail: 'admin@example.invalid',
    });
    assert.equal(staleAttempt, null, 'zastaraná obnova sa musí bezpečne zastaviť');
    const history = await db.listSiteContentVersions(10);
    assert.equal(history.filter((version: { action: string }) => version.action === 'restored').length, 1);
  } finally {
    if (previous.databaseUrl === undefined) Reflect.deleteProperty(process.env, 'DATABASE_URL');
    else process.env.DATABASE_URL = previous.databaseUrl;
    if (previous.nodeEnv === undefined) Reflect.deleteProperty(process.env, 'NODE_ENV');
    else Object.assign(process.env, { NODE_ENV: previous.nodeEnv });
    if (previous.localDbPath === undefined) Reflect.deleteProperty(process.env, 'ASTANA_LOCAL_DB_PATH');
    else process.env.ASTANA_LOCAL_DB_PATH = previous.localDbPath;
    await rm(directory, { recursive: true, force: true });
  }
});
