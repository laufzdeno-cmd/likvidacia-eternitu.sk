import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const repo = new URL('../', import.meta.url);

test('career CV retry response is non-success while explicitly retaining accepted state', async () => {
  const route = await readFile(new URL('app/api/kariera/route.ts', repo), 'utf8');
  const client = await readFile(new URL('app/career-form-client.tsx', repo), 'utf8');
  assert.match(route, /ok:\s*false,[\s\S]{0,100}accepted:\s*true,[\s\S]{0,120}prílohu sa nepodarilo pripojiť/);
  assert.match(route, /Formulár aj súbor zostali zachované/);
  assert.match(client, /if \(response\.ok && result\?\.ok\)\s*\{\s*form\.reset\(\);[\s\S]{0,180}lastAttempt\.current = null;\s*replaceSubmissionId\(newSubmissionId\(\)\);/);
  assert.doesNotMatch(client, /finally\s*\{[^}]*form\.reset\(/);
  assert.match(client, /lastAttempt\.current && lastAttempt\.current\.fingerprint !== identity\.fingerprint/);
  assert.match(client, /pendingCvUpload\.current = null/);
  assert.match(client, /sha256: name === 'cv' \? cvSha256/);
});

test('public notification summary exposes statuses only, not SMTP details', async () => {
  const source = await readFile(new URL('src/server/application-notification-policy.ts', repo), 'utf8');
  assert.match(source, /export function publicNotificationSummary/);
  assert.match(source, /notifications\.map\(\(\{ recipient, status \}\) => \(\{ recipient, status \}\)\)/);
  assert.doesNotMatch(source, /messageId:|lastError:/);
});

test('application notification recovery has its own frequent protected worker while planner remains daily', async () => {
  const schedule = JSON.parse(await readFile(new URL('vercel.json', repo), 'utf8'));
  assert.ok(schedule.crons.some((item) => item.path === '/api/cron/notifications/' && item.schedule === '0 7 * * *'));
  assert.ok(schedule.crons.some((item) => item.path === '/api/cron/application-notifications/' && item.schedule === '*/5 * * * *'));
  const route = await readFile(new URL('app/api/cron/application-notifications/route.ts', repo), 'utf8');
  assert.match(route, /if \(!secret \|\| authorization !== `Bearer \$\{secret\}`\)[\s\S]{0,180}Unauthorized/);
  assert.match(route, /maxDuration = 120/);
  assert.match(route, /runApplicationNotificationRecovery\(2\)/);
  assert.match(route, /applicationNotifications\.health\.unknown === 0/);
  assert.match(route, /const ok = applicationNotifications\.errors === 0/);
  assert.match(route, /status: applicationNotifications\.errors > 0 \? 500 : ok \? 200 : 503/);
  assert.match(route, /dispatchOpsAlert\(\{[\s\S]{0,180}worker: 'application_notifications'/);
  assert.match(route, /reasonCodes: \['worker_exception'\]/);
  const mail = await readFile(new URL('src/server/mail.ts', repo), 'utf8');
  assert.match(mail, /transporter\(options: \{ applicationNotification\?: boolean \} = \{\}\)/);
  assert.match(mail, /connectionTimeout: 10_000,[\s\S]*greetingTimeout: 10_000,[\s\S]*socketTimeout: 20_000/);
  assert.match(mail, /client = transporter\(\{ applicationNotification: true \}\)/);
  const dailyRoute = await readFile(new URL('app/api/cron/notifications/route.ts', repo), 'utf8');
  assert.doesNotMatch(dailyRoute, /runApplicationNotificationRecovery/);
  assert.match(dailyRoute, /listPlannerActions[\s\S]*listDueFollowups/);
});
