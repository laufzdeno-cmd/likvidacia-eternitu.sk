import { requireAdmin } from '@/src/server/auth';
import AdminNav from './admin-nav';

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const email = await requireAdmin();
  const initial = email.trim().charAt(0).toUpperCase() || 'A';

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <a className="admin-brand" href="/admin/dashboard">
          <img src="/assets/astana-logo.svg" alt="ASTANA" width="156" height="52" />
        </a>
        <AdminNav />
        <form action="/admin/logout" method="post">
          <button type="submit">Odhlásiť</button>
        </form>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <span>ASTANA CRM / Admin</span>
          <div className="admin-user-chip">
            <strong>{email}</strong>
            <span>{initial}</span>
          </div>
        </header>
        {children}
      </div>
      <script
        dangerouslySetInnerHTML={{
          __html:
            "document.addEventListener('click',function(e){var b=e.target.closest('[data-print]');if(b){e.preventDefault();window.print();}})",
        }}
      />
    </div>
  );
}
