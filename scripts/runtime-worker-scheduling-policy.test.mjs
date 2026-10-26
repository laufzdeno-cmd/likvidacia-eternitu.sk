import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const repo = new URL('../', import.meta.url);

test('every worker surfaced by runtime feature health remains scheduled', async () => {
  const schedule = JSON.parse(await readFile(new URL('vercel.json', repo), 'utf8'));
  const paths = new Set(schedule.crons.map((item) => item.path));

  for (const path of [
    '/api/cron/meta-capi/',
    '/api/cron/photo-intake-retention/',
    '/api/cron/lead-upload-retention/',
    '/api/cron/career-cv-retention/',
  ]) assert.equal(paths.has(path), true, `${path} must remain scheduled so a later valid binding cannot create a false healthy state`);

  for (const path of [
    '/api/cron/application-notifications/',
    '/api/cron/lead-email-delivery/',
    '/api/cron/lead-file-deletions/',
    '/api/cron/review-reminders/',
    '/api/cron/admin-autopilot/',
    '/api/cron/gmail-price-offers/',
  ]) assert.equal(paths.has(path), true, `${path} must remain scheduled`);
});

test('configuration-dependent workers remain implemented and explicitly fail closed', async () => {
  const [meta, leadRetention, photoRetention, careerRetention] = await Promise.all([
    readFile(new URL('app/api/cron/meta-capi/route.ts', repo), 'utf8'),
    readFile(new URL('app/api/cron/lead-upload-retention/route.ts', repo), 'utf8'),
    readFile(new URL('app/api/cron/photo-intake-retention/route.ts', repo), 'utf8'),
    readFile(new URL('app/api/cron/career-cv-retention/route.ts', repo), 'utf8'),
  ]);

  assert.match(meta, /META_CAPI_NOT_CONFIGURED[\s\S]*503/);
  assert.match(leadRetention, /leadBlobRetentionBound\(\)[\s\S]*503/);
  assert.match(photoRetention, /photoIntakeRetentionRequested\(\)[\s\S]*skipped:\s*true/);
  assert.match(photoRetention, /privatePhotoIntakeStorageReady\(\)[\s\S]*503/);
  assert.match(careerRetention, /careerCvRetentionBound\(\)[\s\S]*503/);
});
