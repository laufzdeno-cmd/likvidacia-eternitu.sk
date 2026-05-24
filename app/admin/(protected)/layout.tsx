import { requireAdmin } from '@/src/server/auth';

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const email = await requireAdmin();

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <a className="admin-brand" href="/admin/dopyty">
          <img src="/assets/astana-logo.svg" alt="ASTANA" width="156" height="52" />
        </a>
        <nav>
          <a href="/admin/dashboard">Dashboard</a>
          <a href="/admin/zakazky">Zákazky</a>
          <a href="/admin/rok">Ročný prehľad</a>
          <a href="/admin/reviews">Recenzie</a>
          <a href="/admin/analytics">Analytika</a>
          <a href="/admin/nastavenia">Nastavenia</a>
          <a href="/admin/import">Import</a>
          <a href="/admin/reviews/request">Žiadosť o recenziu</a>
          <a href="/admin/dopyty">Dopyty</a>
          <a href="/admin/cenove-ponuky">Cenové ponuky</a>
          <a href="/admin/strechari">Strechári</a>
          <a href="/admin/realizacie">Realizácie</a>
          <a href="/admin/obsah">Obsah webu</a>
          <a href="/admin/health">Kontrola systému</a>
        </nav>
        <form action="/admin/logout" method="post">
          <button type="submit">Odhlásiť</button>
        </form>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <span>ASTANA CRM</span>
          <strong>{email}</strong>
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
