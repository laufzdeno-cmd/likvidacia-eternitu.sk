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
      <script
        dangerouslySetInnerHTML={{
          __html:
            "document.addEventListener('submit',function(e){var f=e.target;if(!(f instanceof HTMLFormElement)||!f.classList.contains('admin-pending-form'))return;var msg='Sprac\\u00favam po\\u017eiadavku. Chv\\u00ed\\u013eu po\\u010dkajte...';if(f.classList.contains('admin-send-offer-form'))msg='Generujem PDF a odosielam cenov\\u00fa ponuku z\\u00e1kazn\\u00edkovi. M\\u00f4\\u017ee to trva\\u0165 nieko\\u013eko sek\\u00fand...';else if(f.closest('.price-offer-layout'))msg='Uklad\\u00e1m cenov\\u00fa ponuku...';document.body.classList.add('admin-submit-busy');f.classList.add('is-submitting');f.querySelectorAll('button[type=\"submit\"]').forEach(function(b){b.disabled=true;b.classList.add('is-submitting');b.innerHTML='<span class=\"admin-button-spinner\" aria-hidden=\"true\"></span><span>Pracujem...</span>';});var old=document.querySelector('.admin-pending-toast');if(old)old.remove();var t=document.createElement('div');t.className='admin-pending-toast';t.setAttribute('role','status');t.setAttribute('aria-live','polite');var s=document.createElement('span');s.className='admin-button-spinner';s.setAttribute('aria-hidden','true');var strong=document.createElement('strong');strong.textContent=msg;t.append(s,strong);document.body.appendChild(t);},true)",
        }}
      />
    </div>
  );
}
