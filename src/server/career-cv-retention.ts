import { BlobNotFoundError, del, head } from '@vercel/blob';
import {
  claimExpiredCareerCvUploads,
  completeCareerCvUploadDeletion,
  mayDeleteClaimedCareerCvUpload,
} from '@/src/server/db';
import { careerCvRetentionBound } from '@/src/server/career-cv-retention-binding';

export { careerCvRetentionBound } from '@/src/server/career-cv-retention-binding';

type PrivateBlobOperations = { head: typeof head; del: typeof del };

function expectedPrivateBlob(url: string, pathname: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && /^[a-z0-9-]+\.private\.blob\.vercel-storage\.com$/.test(parsed.hostname) &&
      decodeURIComponent(parsed.pathname.slice(1)) === pathname && !parsed.search && !parsed.hash;
  } catch {
    return false;
  }
}

export async function runCareerCvRetention(blob: PrivateBlobOperations = { head, del }) {
  const candidates = await claimExpiredCareerCvUploads(25);
  let deleted = 0;
  let failed = 0;
  let protectedCount = 0;
  for (const candidate of candidates) {
    try {
      if (!await mayDeleteClaimedCareerCvUpload(candidate.pathname, candidate.claimId)) {
        protectedCount += 1;
        continue;
      }
      let objectExists = true;
      try {
        const stored = await blob.head(candidate.pathname);
        if (stored.pathname !== candidate.pathname || !expectedPrivateBlob(stored.url, candidate.pathname) || !stored.etag) {
          throw new Error('Private CV object identity could not be verified.');
        }
        try {
          await blob.del(candidate.pathname, { ifMatch: stored.etag });
        } catch (error) {
          try { await blob.head(candidate.pathname); }
          catch (verifyError) {
            if (verifyError instanceof BlobNotFoundError) objectExists = false;
            else throw verifyError;
          }
          if (objectExists) throw error;
        }
      } catch (error) {
        if (error instanceof BlobNotFoundError) objectExists = false;
        else throw error;
      }
      if (!objectExists || await mayDeleteClaimedCareerCvUpload(candidate.pathname, candidate.claimId)) {
        if (await completeCareerCvUploadDeletion(candidate.pathname, candidate.claimId)) deleted += 1;
        else failed += 1;
      } else {
        protectedCount += 1;
      }
    } catch (error) {
      console.error('Career CV retention failed', error instanceof Error ? error.name : 'unknown');
      failed += 1;
    }
  }
  return { ok: failed === 0 && protectedCount === 0, checked: candidates.length, deleted, failed, protected: protectedCount };
}
