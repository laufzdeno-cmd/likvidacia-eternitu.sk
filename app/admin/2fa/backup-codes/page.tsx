import { redirect } from 'next/navigation';
import { csrfTokenForEmail, requireAdminUser } from '@/src/server/auth';
import BackupCodesReveal from './reveal';

export const metadata = {
  title: 'Zálohovacie 2FA kódy | ASTANA',
  robots: { index: false, follow: false },
};

export default async function TwoFactorBackupCodesPage() {
  const user = await requireAdminUser();
  if (user.role !== 'SUPER_ADMIN') redirect('/admin/dopyty');

  return (
    <main className="admin-login">
      <section className="admin-login-card">
        <img src="/assets/astana-logo.png" alt="ASTANA" width="190" height="64" />
        <h1>Zálohovacie kódy</h1>
        <p>Každý kód je jednorazový. Zobrazte si ich a uložte mimo telefónu.</p>
        <BackupCodesReveal csrfToken={csrfTokenForEmail(user.email)} />
        <a className="button button-primary" href="/admin/dopyty" style={{ width: '100%', textAlign: 'center' }}>Pokračovať do adminu</a>
      </section>
    </main>
  );
}
