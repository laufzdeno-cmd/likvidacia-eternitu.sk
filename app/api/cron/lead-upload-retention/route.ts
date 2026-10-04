import { del } from '@vercel/blob';
import { NextResponse } from 'next/server';
import {
  claimExpiredLeadUploadDrafts,
  completeLeadUploadDraftDeletion,
  mayDeleteClaimedLeadUploadDraft,
} from '@/src/server/db';

export const runtime = 'nodejs';

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!secret || token !== secret) return json({ error: 'Unauthorized' }, 401);

  // Vercel Cron runs only on production deployments. Keep a shared preview
  // database from ever deleting production blobs when this route is invoked manually.
  if (process.env.VERCEL && process.env.VERCEL_ENV !== 'production') {
    return json({ error: 'Not found' }, 404);
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN || !process.env.DATABASE_URL) {
    return json({ error: 'Retention storage is not configured.' }, 503);
  }

  try {
    const claims = await claimExpiredLeadUploadDrafts(50);
    let deleted = 0;
    let skipped = 0;
    let failed = 0;

    for (const claim of claims) {
      try {
        if (!(await mayDeleteClaimedLeadUploadDraft(claim.storageKey, claim.claimId))) {
          skipped += 1;
          continue;
        }

        // The external delete happens first. If the following DB transaction
        // fails, the expired claim is retried and the Blob delete stays idempotent.
        await del(claim.storageKey);
        if (await completeLeadUploadDraftDeletion(claim.storageKey, claim.claimId)) deleted += 1;
        else skipped += 1;
      } catch (error) {
        failed += 1;
        console.error('Lead upload retention item failed', error instanceof Error ? error.name : 'unknown');
      }
    }

    return json({ ok: failed === 0, claimed: claims.length, deleted, skipped, failed }, failed ? 500 : 200);
  } catch (error) {
    console.error('Lead upload retention failed', error instanceof Error ? error.name : 'unknown');
    return json({ error: 'Retention failed.' }, 500);
  }
}
