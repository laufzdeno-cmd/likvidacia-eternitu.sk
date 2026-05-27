import { redirect } from 'next/navigation';
import { createGuestCsrfToken, currentPendingTwoFactorEmail } from '@/src/server/auth';
import { getAdminUserByEmail } from '@/src/server/db';
import { verifyTwoFactorLoginAction } from '../actions';

export const metadata = {
  title: 'Overenie 2FA | ASTANA',
  robots: { index: false, follow: false },
};

export default async function TwoFactorVerifyPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const email = await currentPendingTwoFactorEmail();
  if (!email) redirect('/admin/login');
  const user = await getAdminUserByEmail(email);
  if (!user?.active) redirect('/admin/login');
  if (!user.twoFactorEnabled) redirect('/admin/2fa/setup');
  const params = await searchParams;
  const csrfToken = await createGuestCsrfToken();

  return (
    <main className="admin-login">
      <form className="admin-login-card" action={verifyTwoFactorLoginAction}>
        <input type="hidden" name="_csrf" value={csrfToken} />
        <img src="/assets/astana-logo.svg" alt="ASTANA" width="190" height="64" />
        <h1>Overenie 2FA</h1>
        <p>Zadajte 6-ciferný kód z Google Authenticator alebo jednorazový zálohovací kód.</p>
        {params?.error ? <div className="admin-alert">Kód nie je platný.</div> : null}
        <label className="admin-field">
          Kód
          <input name="token" inputMode="numeric" autoComplete="one-time-code" required />
        </label>
        <button className="button button-primary" type="submit" style={{ width: '100%' }}>Overiť a prihlásiť</button>
      </form>
    </main>
  );
}
