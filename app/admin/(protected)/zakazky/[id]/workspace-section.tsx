import { listAdminUsers, listOperationalWorkers } from '@/src/server/db';
import { getJobWorkspace, listJobPrivateDocuments } from '@/src/server/job-workspace-db';
import type { JobWorkspaceActor } from '@/src/server/job-workspace-types';
import WorkspacePanel from './workspace-panel';
import { jobWorkspaceEnabled } from '@/src/server/job-workspace-feature';
import { JobAuthorityNoticePanel, JobCommunicationPanel, JobOffersPanel, JobPaymentSummary, JobPhotosPanel } from './job-linked-panels';

export default async function JobWorkspaceSection({ jobId, actor, csrfToken, archived, customerName, location }: {
  jobId: string; actor: JobWorkspaceActor; csrfToken: string; archived: boolean; customerName: string; location: string;
}) {
  if (!jobWorkspaceEnabled()) return null;
  const [card, documents, workers, owners] = await Promise.all([
    getJobWorkspace(jobId, actor),
    listJobPrivateDocuments(jobId, actor),
    listOperationalWorkers(true),
    listAdminUsers(),
  ]);
  return <WorkspacePanel card={card} csrfToken={csrfToken} archived={archived} customerName={customerName} location={location}
    documents={documents.map((document) => ({ id: document.id, name: document.fileName }))}
    workers={workers.map((worker) => ({ id: worker.id, name: worker.name }))}
    owners={owners.filter((owner) => owner.active && ['OPERATOR', 'SUPER_ADMIN'].includes(owner.role)).map((owner) => ({ name: owner.name, email: owner.email }))}
    offers={<JobOffersPanel jobId={jobId} actor={actor} archived={archived} />}
    authorityNotice={<JobAuthorityNoticePanel jobId={jobId} actor={actor} csrfToken={csrfToken} archived={archived} />}
    communication={<JobCommunicationPanel jobId={jobId} actor={actor} csrfToken={csrfToken} archived={archived} />}
    photos={<JobPhotosPanel jobId={jobId} actor={actor} csrfToken={csrfToken} archived={archived} />}
    paymentSummary={<JobPaymentSummary jobId={jobId} actor={actor} archived={archived} />} />;
}
