import { adminEmail, createGuestCsrfToken, currentAdminEmail } from '@/src/server/auth';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Obnova hesla | ASTANA admin',
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const email = await currentAdminEmail();
  if (email) redirect('/admin/nastavenia');
  const params = await searchParams;
  const csrfToken = await createGuestCsrfToken();
  const error =
    params?.error === 'token'
      ? 'Resetovací token alebo email nesedí.'
      : params?.error === 'password'
        ? 'Nové heslo musí mať aspoň 8 znakov a obe hodnoty musia byť rovnaké.'
        : params?.error === 'csrf'
          ? 'Platnosť formulára vypršala. Skúste to znova.'
        : '';

  return (
    <main className="admin-login">
      <form className="admin-login-card" action="/admin/reset-password/submit/" method="post">
        <input type="hidden" name="_csrf" value={csrfToken} />
        <img src="/assets/astana-logo.png" alt="ASTANA" width="190" height="64" />
        <h1>Obnova hesla</h1>
        <p>Zadajte prihlasovací email, resetovací token a nové heslo. Aktuálne heslo sa z bezpečnostných dôvodov nedá zobraziť.</p>
        {error ? <div className="admin-alert">{error}</div> : null}
        {!process.env.ADMIN_RESET_TOKEN ? <div className="admin-alert">Reset hesla nie je zapnutý. Chýba ADMIN_RESET_TOKEN.</div> : null}
        <label>
          Email
          <input name="email" type="email" defaultValue={adminEmail()} autoComplete="username" required />
        </label>
        <label>
          Resetovací token
          <input name="resetToken" type="password" autoComplete="one-time-code" required />
        </label>
        <label>
          Nové heslo
          <input name="newPassword" type="password" autoComplete="new-password" minLength={8} required />
        </label>
        <label>
          Zopakovať nové heslo
          <input name="repeatPassword" type="password" autoComplete="new-password" minLength={8} required />
        </label>
        <button className="button button-primary" type="submit">
          Nastaviť nové heslo
        </button>
        <p><a href="/admin/login">Späť na prihlásenie</a></p>
      </form>
    </main>
  );
}
