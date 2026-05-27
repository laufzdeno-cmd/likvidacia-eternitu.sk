import { createGuestCsrfToken, currentAdminEmail } from '@/src/server/auth';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Admin login | ASTANA',
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({ searchParams }: { searchParams?: Promise<{ error?: string; reset?: string }> }) {
  const email = await currentAdminEmail();
  if (email) redirect('/admin/dopyty');
  const params = await searchParams;
  const csrfToken = await createGuestCsrfToken();

  const fieldStyle = {
    display: 'grid',
    gap: '6px',
    width: '100%',
  } as const;

  const inputStyle = {
    display: 'block',
    width: '100%',
    boxSizing: 'border-box',
  } as const;

  return (
    <main className="admin-login">
      <form className="admin-login-card" action="/admin/login/submit/" method="post">
        <input type="hidden" name="_csrf" value={csrfToken} />
        <img src="/assets/astana-logo.png" alt="ASTANA" width="190" height="64" />
        <h1>Prihlásenie do adminu</h1>
        <p>Dopyty, fotky a cenové ponuky sú chránené prihlásením.</p>
        {params?.error ? <div className="admin-alert">{params.error === 'csrf' ? 'Platnosť formulára vypršala. Skúste to znova.' : 'Nesprávny email alebo heslo.'}</div> : null}
        {params?.reset ? <div className="admin-alert">Heslo bolo zmenené. Prihláste sa novým heslom.</div> : null}
        <label className="admin-field" style={fieldStyle}>
          Email
          <input name="email" type="text" inputMode="email" autoComplete="username" required style={inputStyle} />
        </label>
        <label className="admin-field" style={fieldStyle}>
          Heslo
          <input name="password" type="password" autoComplete="current-password" required style={inputStyle} />
        </label>
        <button className="button button-primary" type="submit" style={{ width: '100%' }}>
          Prihlásiť sa
        </button>
        <p>
          <a href="/admin/reset-password">Zabudli ste heslo?</a>
        </p>
      </form>
    </main>
  );
}
