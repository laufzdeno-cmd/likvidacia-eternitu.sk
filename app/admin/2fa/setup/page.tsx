import QRCode from 'qrcode';
import { redirect } from 'next/navigation';
import { createGuestCsrfToken, currentAdminEmail, currentPendingTwoFactorEmail } from '@/src/server/auth';
import { getAdminUserByEmail, setAdminUserTwoFactorSecret } from '@/src/server/db';
import { generateTotpSecret, isTwoFactorRequired, totpUri } from '@/src/server/two-factor';
import { confirmTwoFactorSetupAction } from '../actions';

export const metadata = {
  title: 'Nastavenie 2FA | ASTANA',
  robots: { index: false, follow: false },
};

export default async function TwoFactorSetupPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const email = (await currentPendingTwoFactorEmail()) || (await currentAdminEmail());
  if (!email) redirect('/admin/login');
  let user = await getAdminUserByEmail(email);
  if (!user?.active) redirect('/admin/login');
  if (user.twoFactorEnabled) redirect('/admin/dopyty');

  if (!user.twoFactorSecret) {
    user = await setAdminUserTwoFactorSecret(user.email, generateTotpSecret(), user.email);
  }
  if (!user?.twoFactorSecret) redirect('/admin/login');

  const params = await searchParams;
  const csrfToken = await createGuestCsrfToken();
  const qrCode = await QRCode.toDataURL(totpUri(user.email, user.twoFactorSecret));
  const isRequired = isTwoFactorRequired(user.role);

  return (
    <main className="admin-login">
      <form className="admin-login-card" action={confirmTwoFactorSetupAction}>
        <input type="hidden" name="_csrf" value={csrfToken} />
        <img src="/assets/astana-logo.svg" alt="ASTANA" width="190" height="64" />
        <h1>{isRequired ? 'Povinné 2FA pre super admina' : 'Zapnutie 2FA'}</h1>
        <p>Naskenujte QR kód v Google Authenticator a zadajte 6-ciferný kód.</p>
        {params?.error ? <div className="admin-alert">Kód nesedí. Skúste nový aktuálny kód.</div> : null}
        <img src={qrCode} alt="QR kód pre nastavenie 2FA" width="220" height="220" style={{ margin: '0 auto' }} />
        <label className="admin-field">
          6-ciferný kód
          <input name="token" inputMode="numeric" pattern="[0-9 ]{6,12}" autoComplete="one-time-code" required />
        </label>
        <button className="button button-primary" type="submit" style={{ width: '100%' }}>Aktivovať 2FA</button>
      </form>
    </main>
  );
}
