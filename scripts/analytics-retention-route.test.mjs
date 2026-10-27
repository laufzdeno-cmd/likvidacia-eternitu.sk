import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Socket } from 'node:net';
import test from 'node:test';

test('analytics maintenance verifies authentication and deployment before any database IO', async (t) => {
  const directory = await fs.mkdtemp(path.join(process.cwd(), '.tmp-analytics-retention-route-'));
  const databasePath = path.join(directory, 'local-db.json');
  Object.assign(process.env, { NODE_ENV: 'test', DATABASE_URL: '', ASTANA_LOCAL_DB_PATH: databasePath, ADMIN_EMAIL: '', VERCEL: '', VERCEL_ENV: '', VERCEL_TARGET_ENV: '', CRON_SECRET: 'isolated-retention-fixture' });
  t.mock.method(Socket.prototype, 'connect', () => { throw new Error('No network in route test.'); });
  t.mock.method(globalThis, 'fetch', () => { throw new Error('No network in route test.'); });
  const { GET } = await import('../app/api/cron/analytics-retention/route.ts');
  const request = (authorization) => new Request('https://example.invalid/api/cron/analytics-retention/', { headers: authorization ? { authorization } : {} });
  const authorized = () => request('Bearer isolated-retention-fixture');
  const exists = async () => fs.stat(databasePath).then(() => true, () => false);
  try {
    assert.equal((await GET(request())).status, 401);
    assert.equal((await GET(request('Bearer wrong'))).status, 401);
    assert.equal((await GET(request('Bearer áááááááááááááááááááááááááá'))).status, 401);
    process.env.CRON_SECRET = '';
    assert.equal((await GET(authorized())).status, 401);
    assert.equal(await exists(), false, 'unauthorized paths must not initialize local data');
    process.env.CRON_SECRET = 'isolated-retention-fixture';
    Object.assign(process.env, { NODE_ENV: 'production', VERCEL: '1', VERCEL_ENV: 'preview', VERCEL_TARGET_ENV: 'preview' });
    assert.equal((await GET(authorized())).status, 403);
    Object.assign(process.env, { VERCEL_ENV: 'production', VERCEL_TARGET_ENV: 'preview' });
    assert.equal((await GET(authorized())).status, 403);
    assert.equal(await exists(), false, 'deployment rejection must precede DB initialization');
    Object.assign(process.env, { NODE_ENV: 'test', VERCEL: '', VERCEL_ENV: '', VERCEL_TARGET_ENV: '' });
    const success = await GET(authorized());
    assert.equal(success.status, 200);
    assert.deepEqual(await success.json(), { cutoff: (await JSON.parse(await fs.readFile(databasePath, 'utf8'))).analyticsRetentionCutoff, deleted: 0, remaining: false, invalidDates: 0, batches: 1, ok: true });
    const data = JSON.parse(await fs.readFile(databasePath, 'utf8'));
    data.analyticsEvents.push({ id: 'malformed-fixture', createdAt: 'damaged', eventType: 'page_view' });
    await fs.writeFile(databasePath, JSON.stringify(data));
    const damaged = await GET(authorized());
    assert.equal(damaged.status, 503, 'cannot claim successful cleanup with damaged timestamp');
    assert.equal((await damaged.json()).invalidDates, 1);
    await fs.writeFile(databasePath, '{damaged-json');
    const errorLog = t.mock.method(console, 'error', () => undefined);
    const failed = await GET(authorized());
    assert.equal(failed.status, 503);
    assert.deepEqual(await failed.json(), { ok: false, error: 'Analytics retention is unavailable.' });
    assert.deepEqual(errorLog.mock.calls.at(-1).arguments, ['Analytics retention failed', 'Error'], 'never log private events or raw storage error');
  } finally {
    assert.equal(path.dirname(directory), process.cwd());
    await fs.rm(directory, { recursive: true, force: true });
  }
});
