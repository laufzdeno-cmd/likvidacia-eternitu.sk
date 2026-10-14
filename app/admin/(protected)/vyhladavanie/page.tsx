import { csrfTokenForEmail, requireAdminUser } from '@/src/server/auth';
import SearchWorkspace from './search-workspace';

export default async function AdminSearchPage() {
  const user = await requireAdminUser();
  return <main className="admin-page intelligence-page">
    <header className="intelligence-hero"><div><p>Jedno miesto pre celé CRM</p><h1>Globálne vyhľadávanie</h1><span>Hľadajte podľa mena, telefónu, emailu, mesta, čísla ponuky, faktúry alebo interného ID.</span></div></header>
    <SearchWorkspace csrfToken={csrfTokenForEmail(user.email)} role={user.role} />
  </main>;
}
