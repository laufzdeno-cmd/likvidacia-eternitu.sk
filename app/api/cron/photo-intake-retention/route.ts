import { del } from '@vercel/blob';
import { NextResponse } from 'next/server';
import {
  claimDuePhotoIntakeDeletions,
  claimPhotoIntakeSanitizationCleanups,
  completePhotoIntakeDeletion,
  completePhotoIntakeSanitizationCleanup,
  failPhotoIntakeSanitizationCleanup,
  markPhotoIntakeDeletionFailed,
} from '@/src/server/db';
import { photoIntakeRetentionRequested, privatePhotoIntakeBlobToken, privatePhotoIntakeStorageReady } from '@/src/server/photo-intake-config';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!secret || token !== secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!photoIntakeRetentionRequested()) return NextResponse.json({ ok: true, skipped: true, reason: 'Photo retention is disabled.' });
  if (!privatePhotoIntakeStorageReady()) return NextResponse.json({ ok: false, error: 'Private photo storage is not verified or its delete token is unavailable.' }, { status: 503 });

  let candidates;
  let sanitizationCleanups;
  try {
    sanitizationCleanups = await claimPhotoIntakeSanitizationCleanups(50);
    candidates = await claimDuePhotoIntakeDeletions(50);
  } catch (error) {
    console.error('Photo intake retention claim failed.', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ ok: false, error: 'Retention queue unavailable.' }, { status: 503 });
  }

  let deleted = 0;
  let failed = 0;
  let temporaryDeleted = 0;
  for (const cleanup of sanitizationCleanups) {
    try {
      if (cleanup.storageDriver !== 'vercel_blob') throw new Error('Unsupported private storage driver.');
      await del(cleanup.storageKey, { token: privatePhotoIntakeBlobToken() });
      if (await completePhotoIntakeSanitizationCleanup(cleanup.id)) temporaryDeleted += 1;
    } catch (error) {
      try { await failPhotoIntakeSanitizationCleanup(cleanup.id); } catch { /* Daily worker retries the durable cleanup row. */ }
      console.error('Photo intake sanitization cleanup failed.', error instanceof Error ? error.message : 'unknown');
      failed += 1;
    }
  }
  for (const candidate of candidates) {
    try {
      if (candidate.storageDriver !== 'vercel_blob') throw new Error('Unsupported private storage driver.');
      await del(candidate.storageKey, { token: privatePhotoIntakeBlobToken() });
      if (await completePhotoIntakeDeletion(candidate.id)) deleted += 1;
    } catch (error) {
      try {
        await markPhotoIntakeDeletionFailed(candidate.id);
      } catch {
        console.error('Photo intake retention retry state could not be saved.');
      }
      console.error('Photo intake retention deletion failed.', error instanceof Error ? error.message : 'unknown');
      failed += 1;
    }
  }

  return NextResponse.json({ ok: failed === 0, checked: candidates.length, deleted, temporaryDeleted, failed });
}
