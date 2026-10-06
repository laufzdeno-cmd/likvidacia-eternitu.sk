import { NextResponse } from 'next/server';
import { claimLeadFileDeletionJobs, completeLeadFileDeletionJob, failLeadFileDeletionJob } from '@/src/server/db';
import { deleteStoredLeadFile } from '@/src/server/storage';

export const runtime = 'nodejs';
const MAX_DELETIONS_PER_RUN = 10;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get('authorization') === `Bearer ${secret}`);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const jobs = await claimLeadFileDeletionJobs(MAX_DELETIONS_PER_RUN);
    let deleted = 0;
    let failed = 0;
    for (const job of jobs) {
      if (!job.claimId) { failed += 1; continue; }
      try {
        await deleteStoredLeadFile(job);
        if (await completeLeadFileDeletionJob(job.id, job.claimId)) deleted += 1;
      } catch {
        // Keep the durable job and retry later; never log private object keys or lead data.
        const recorded = await failLeadFileDeletionJob(job.id, job.claimId, 'Úložisko nepotvrdilo odstránenie súkromnej prílohy.');
        if (recorded) failed += 1;
      }
    }
    return NextResponse.json({ ok: failed === 0, considered: jobs.length, deleted, failed }, { status: failed ? 500 : 200 });
  } catch {
    return NextResponse.json({ ok: false, error: 'Private attachment cleanup failed', code: 'LEAD_FILE_DELETION_WORKER_FAILED' }, { status: 500 });
  }
}
