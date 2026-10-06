import { list } from '@vercel/blob';
import { isValidLeadSubmissionId } from '../lib/lead-submission-id.mjs';
import {
  advanceLeadBlobReconciliation,
  claimLeadBlobReconciliation,
  recordLeadBlobInventoryListFailure,
  releaseLeadBlobReconciliation,
  trackUnreservedLegacyLeadPhoto,
} from './db';

const legacyPath = /^lead-drafts\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|jpeg|png|webp|heic|heif)$/i;
const minimumBlobAgeMs = 48 * 60 * 60 * 1000;
const pageLimit = 100;
const maxPagesPerRun = 3;

type BlobLister = typeof list;

export function oldPrivateLeadPhoto(blob: { pathname: string; uploadedAt: Date | string; etag: string }, nowMs: number) {
  const match = legacyPath.exec(blob.pathname);
  if (!match || !isValidLeadSubmissionId(match[1]) || !blob.etag || blob.etag.length > 256 || /[\u0000-\u001f\u007f]/.test(blob.etag)) return null;
  const uploadedMs = new Date(blob.uploadedAt).getTime();
  if (!Number.isFinite(uploadedMs) || uploadedMs > nowMs - minimumBlobAgeMs) return null;
  return { submissionId: match[1], storageKey: blob.pathname, blobEtag: blob.etag };
}

export async function reconcileLegacyLeadBlobs(listBlobs: BlobLister = list, nowMs = Date.now()) {
  const claim = await claimLeadBlobReconciliation();
  if (!claim) return { busy: true, pages: 0, checked: 0, staged: 0, complete: false };

  let cursor = claim.cursor;
  let pages = 0;
  let checked = 0;
  let staged = 0;
  let complete = false;
  try {
    for (; pages < maxPagesPerRun; pages++) {
      let result: Awaited<ReturnType<BlobLister>>;
      try {
        result = await listBlobs({ prefix: 'lead-drafts/', limit: pageLimit, mode: 'expanded', ...(cursor ? { cursor } : {}), abortSignal: AbortSignal.timeout(10_000) });
      } catch (error) {
        // Transient provider failures keep their cursor; repeated failures
        // eventually restart a scan rather than stranding later objects.
        await recordLeadBlobInventoryListFailure(claim.claimId);
        throw error;
      }
      if (!Array.isArray(result.blobs) || result.blobs.length > pageLimit || typeof result.hasMore !== 'boolean') {
        await recordLeadBlobInventoryListFailure(claim.claimId);
        throw new Error('Unexpected private Blob inventory response.');
      }
      if (result.hasMore && (!result.cursor || result.cursor === cursor || result.cursor.length > 4096)) {
        await recordLeadBlobInventoryListFailure(claim.claimId);
        throw new Error('Private Blob inventory did not advance.');
      }
      for (const blob of result.blobs) {
        checked++;
        const candidate = oldPrivateLeadPhoto(blob, nowMs);
        if (candidate && await trackUnreservedLegacyLeadPhoto(candidate.submissionId, candidate.storageKey, candidate.blobEtag)) staged++;
      }
      cursor = result.hasMore ? result.cursor! : '';
      if (!await advanceLeadBlobReconciliation(claim.claimId, cursor)) {
        throw new Error('Private Blob inventory claim expired.');
      }
      if (!result.hasMore) {
        complete = true;
        pages++;
        break;
      }
    }
    return { busy: false, pages, checked, staged, complete };
  } finally {
    await releaseLeadBlobReconciliation(claim.claimId);
  }
}
