import { NextResponse } from 'next/server';
import { BlobNotFoundError, head } from '@vercel/blob';
import { claimExpiredLeadUploadDrafts, completeLeadUploadDraftDeletion, mayDeleteClaimedLeadUploadDraft } from '@/src/server/db';
import { reconcileLegacyLeadBlobs } from '@/src/server/lead-blob-reconciliation';
import { leadBlobRetentionBound } from '@/src/server/lead-blob-retention-binding';
import { deleteStoredLeadFile } from '@/src/server/storage';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!secret || token !== secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!process.env.BLOB_READ_WRITE_TOKEN && !(process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY)) {
    return NextResponse.json({ ok: false, error: 'Private lead-photo storage is not configured.' }, { status: 503 });
  }
  if (process.env.BLOB_READ_WRITE_TOKEN && !leadBlobRetentionBound()) {
    return NextResponse.json({ ok: false, error: 'Private lead-photo retention is not bound to this production store and database.' }, { status: 503 });
  }

  // First production rollout may inventory a private store without deleting any
  // existing draft. S3-only installations keep their existing retention mode.
  const deletionEnabled = !process.env.BLOB_READ_WRITE_TOKEN || process.env.LEAD_UPLOAD_RETENTION_DELETE_ENABLED === '1';
  let candidates: Awaited<ReturnType<typeof claimExpiredLeadUploadDrafts>> = [];
  if (deletionEnabled) {
    try {
      candidates = await claimExpiredLeadUploadDrafts(50);
    } catch (error) {
      console.error('Lead upload retention claim failed.', error instanceof Error ? error.name : 'unknown');
      return NextResponse.json({ ok: false, error: 'Lead upload retention queue unavailable.' }, { status: 503 });
    }
  }

  let deleted = 0;
  let failed = 0;
  let protectedCount = 0;
  for (const candidate of candidates) {
    try {
      if (!await mayDeleteClaimedLeadUploadDraft(candidate.storageKey, candidate.claimId)) {
        protectedCount++;
        continue;
      }
      try {
        await deleteStoredLeadFile({ storageDriver: candidate.storageDriver, storageKey: candidate.storageKey, blobEtag: candidate.blobEtag });
      } catch (deleteError) {
        // Blob deletion may have succeeded before the DB audit/claim failed.
        // Only a provider-confirmed absence can close that interrupted attempt;
        // an ETag mismatch with a still-present object must remain a failure.
        if (candidate.storageDriver !== 'vercel_blob') throw deleteError;
        let confirmedAbsent = false;
        try {
          await head(candidate.storageKey);
        } catch (headError) {
          if (!(headError instanceof BlobNotFoundError)) throw headError;
          confirmedAbsent = true;
        }
        if (!confirmedAbsent) throw deleteError;
      }
      if (await completeLeadUploadDraftDeletion(candidate.storageKey, candidate.claimId)) deleted += 1;
      else {
        console.error('Lead upload retention could not confirm deletion in the database.');
        failed++;
      }
    } catch (error) {
      // Keep the row in `deleting`; the next scheduled run will retry it.
      console.error('Lead upload retention deletion failed.', error instanceof Error ? error.name : 'unknown');
      failed += 1;
    }
  }

  let inventory: Awaited<ReturnType<typeof reconcileLegacyLeadBlobs>> | null = null;
  let inventoryFailed = false;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      inventory = await reconcileLegacyLeadBlobs();
    } catch (error) {
      // Never log Blob URLs, pathnames or provider response bodies.
      console.error('Legacy private lead Blob inventory failed.', error instanceof Error ? error.name : 'unknown');
      inventoryFailed = true;
    }
  }
  const ok = failed === 0 && protectedCount === 0 && !inventoryFailed;
  return NextResponse.json({ ok, mode: deletionEnabled ? 'retention' : 'inventory_only', checked: candidates.length, deleted, failed, protected: protectedCount, inventory, inventoryFailed }, { status: ok ? 200 : 503 });
}
