import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('career submissions use shared trusted rate limits and distinguish accepted follow-up work', async () => {
  const [route, client, styles] = await Promise.all([
    readFile(new URL('../app/api/kariera/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/career-form-client.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/kariera/career.module.css', import.meta.url), 'utf8'),
  ]);
  assert.match(route, /consumeSharedRateLimit\('career-application-attempt-address', clientIp, 30, 10 \* 60_000\)/);
  assert.match(route, /consumeSharedRateLimit\('career-application-address', clientIp, 10, 10 \* 60_000\)/);
  assert.match(route, /consumeSharedRateLimit\('career-application-email', parsed\.data\.email\.toLowerCase\(\), 3, 10 \* 60_000\)/);
  assert.doesNotMatch(route, /new Map<string, \{ count: number; resetAt: number \}>/);
  assert.match(route, /if \(!origin\) return process\.env\.NODE_ENV !== 'production'/);
  assert.match(client, /accepted\?: boolean/);
  assert.match(client, /isAccepted \? ' is-warning'/);
  assert.match(styles, /\.formMessage\.warning/);
});
