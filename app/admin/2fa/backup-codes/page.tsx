import { redirect } from 'next/navigation';
import { consumePendingBackupCodes, requireAdminUser } from '@/src/server/auth';

export const metadata = {
  title: 'Zálohovacie 2FA kódy | ASTANA',
  robots: { index: false, follow: false },
};

export default async function TwoFactorBackupCodesPage() {
  await requireAdminUser();
  const codes = await consumePendingBackupCodes();
  if (!codes.length) redirect('/admin/dopyty');

  return (
    <main className="admin-login">
      <section className="admin-login-card">
        <img src="/assets/astana-logo.png" alt="ASTANA" width="190" height="64" />
        <h1>Zálohovacie kódy</h1>
        <p>Tieto kódy sa zobrazia iba raz. Uložte ich mimo telefónu.</p>
        <div className="admin-alert">
          Každý kód je jednorazový. Po použití prestane platiť.
        </div>
        <ul style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: 0, listStyle: 'none' }}>
          {codes.map((code) => (
            <li key={code}><code>{code}</code></li>
          ))}
        </ul>
        <a className="button button-primary" href="/admin/dopyty" style={{ width: '100%', textAlign: 'center' }}>Pokračovať do adminu</a>
      </section>
    </main>
  );
}
