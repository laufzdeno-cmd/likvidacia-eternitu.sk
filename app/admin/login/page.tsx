import { currentAdminEmail } from '@/src/server/auth';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Admin login | ASTANA',
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const email = await currentAdminEmail();
  if (email) redirect('/admin/dopyty');
  const params = await searchParams;

  return (
    <main className="admin-login">
      <form className="admin-login-card" action="/admin/login/submit/" method="post">
        <img src="/assets/astana-logo.svg" alt="ASTANA" width="190" height="64" />
        <h1>Prihlásenie do adminu</h1>
        <p>Dopyty, fotky a cenové ponuky sú chránené prihlásením.</p>
        {params?.error ? <div className="admin-alert">Nesprávny email alebo heslo.</div> : null}
        <label>
          Email
          <input name="email" type="text" inputMode="email" autoComplete="username" required />
        </label>
        <label>
          Heslo
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <button className="button button-primary" type="submit">
          Prihlásiť sa
        </button>
      </form>
    </main>
  );
}
