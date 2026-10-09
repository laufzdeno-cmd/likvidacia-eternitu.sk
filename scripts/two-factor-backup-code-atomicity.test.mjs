import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('backup code is consumed atomically before an admin session is created', async () => {
  const db = await readFile(new URL('../src/server/db.ts', import.meta.url), 'utf8');
  const action = await readFile(new URL('../app/admin/2fa/actions.ts', import.meta.url), 'utf8');
  const consumeStart = db.indexOf('export async function consumeAdminUserBackupCode');
  const consumeEnd = db.indexOf('export async function resetAdminUserTwoFactor', consumeStart);
  const consume = db.slice(consumeStart, consumeEnd);
  assert.match(consume, /two_factor_backup_code_hashes = COALESCE\(/);
  assert.match(consume, /AND two_factor_enabled = true[\s\S]*?AND EXISTS \([\s\S]*?WHERE code_hash = \$1/);
  assert.match(consume, /if \(!user \|\| !user\.active \|\| !user\.twoFactorEnabled[\s\S]*?normalizeAdminSessionEpoch\(user\.sessionEpoch\) !== expectedSessionEpoch[\s\S]*?!user\.twoFactorBackupCodeHashes\.includes\(backupCodeHash\)\) return null/);
  const localBranch = consume.slice(consume.indexOf('if (!db)'), consume.indexOf('const { rows }'));
  assert.match(localBranch, /withLocalLeadSubmissionLock\(async \(\) =>/);
  assert.match(localBranch, /local\.auditLogs\.unshift\(/);
  assert.ok(localBranch.indexOf('local.auditLogs.unshift(') < localBranch.indexOf('await writeLocalDb(local,'));
  assert.doesNotMatch(localBranch, /await addAuditLog\(/);
  assert.match(action, /authenticatedUser = await consumeAdminUserBackupCode\(user\.email, hashBackupCode\(token\), user\.email, user\.sessionEpoch\);\s*if \(!authenticatedUser\) redirect\('\/admin\/2fa\/verify\?error=1'\);[\s\S]*?await setAdminSession\(authenticatedUser\.email, authenticatedUser\.sessionEpoch\)/);
  assert.doesNotMatch(action, /consumeAdminUserBackupCode\(user\.email, remainingBackupCodes/);
});
