import { csrfTokenForEmail, requireAdminUser } from '@/src/server/auth';
import { getAdminDraftProviderStatus } from '@/src/server/admin-draft-provider';
import DraftComposer from './draft-composer';

export default async function AiAssistantPage() {
  const user = await requireAdminUser();
  const provider = getAdminDraftProviderStatus();
  return <main className="admin-page intelligence-page">
    <header className="intelligence-hero"><div><p>Bezpečný návrhový asistent</p><h1>AI návrhy textov a podkladov</h1><span>Pomáha pripraviť prvý návrh. Neodosiela emaily, nemení záznamy a nevytvára schválenú cenovú ponuku.</span></div></header>
    <p className={`work-notice ${provider.providerReady ? 'is-success' : 'is-warning'}`} role="status"><strong>{provider.label}.</strong> {provider.detail}</p>
    <DraftComposer csrfToken={csrfTokenForEmail(user.email)} providerReady={provider.providerReady} />
  </main>;
}
