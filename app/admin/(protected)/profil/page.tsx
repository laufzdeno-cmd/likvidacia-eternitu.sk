import { requireAdminUser } from '@/src/server/auth';
import { getAdminUserByEmail } from '@/src/server/db';

export default async function AdminProfilePage() {
  const sessionUser = await requireAdminUser();
  const user = await getAdminUserByEmail(sessionUser.email);
  const twoFactorEnabled = Boolean(user?.twoFactorEnabled);
  const twoFactorRequired = sessionUser.role === 'SUPER_ADMIN';

  return (
    <main className="admin-page">
      <div className="admin-heading">
        <div>
          <p>Môj účet</p>
          <h1>Profil</h1>
        </div>
      </div>

      <section className="admin-card">
        <h2>Prístup</h2>
        <p>Email: <strong>{sessionUser.email}</strong></p>
        <p>Rola: <strong>{sessionUser.role === 'SUPER_ADMIN' ? 'Super admin' : 'Operátor'}</strong></p>
        <p>
          2FA:{' '}
          <strong>
            {twoFactorRequired ? 'Povinné' : twoFactorEnabled ? 'Aktívne' : 'Voliteľné'}
          </strong>
        </p>
        {!twoFactorEnabled ? (
          <a className="admin-primary-button" href="/admin/2fa/setup">
            Zapnúť 2FA
          </a>
        ) : (
          <p className="status-pill">2FA je aktívne</p>
        )}
      </section>
    </main>
  );
}
