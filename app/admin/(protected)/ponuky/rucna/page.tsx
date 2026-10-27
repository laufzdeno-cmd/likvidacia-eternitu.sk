import { csrfTokenForEmail, requireAdminUser } from '@/src/server/auth';
import ManualImportForm from './import-form';
import { getJobPrivateDocument } from '@/src/server/job-workspace-db';

export default async function ManualOfferImportPage({ searchParams }: { searchParams: Promise<{ jobId?: string; documentId?: string }> }) {
  const actor = await requireAdminUser();
  const params = await searchParams;
  const doc = params.documentId && /^[a-f0-9-]{36}$/i.test(params.documentId) ? await getJobPrivateDocument(params.documentId, actor) : null;
  const initialDocument = doc?.kind === 'PDF' ? { id: doc.id, originalName: doc.fileName, sha256: doc.sha256, href: `/api/admin/job-workspace/documents/${doc.id}/` } : null;
  return <main className="admin-page"><header className="admin-heading"><div><p>Ponuky · súkromný import</p><h1>Zaevidovať PDF ponuku</h1><span>Pôvodné číslo, pôvodný dokument a obsah bez opätovného odoslania.</span></div><a href="/admin/ponuky">Späť na ponuky</a></header><ManualImportForm csrfToken={csrfTokenForEmail(actor.email)} jobId={params.jobId || doc?.jobId || undefined} initialDocument={initialDocument} /></main>;
}
