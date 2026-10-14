import { csrfTokenForEmail, requireAdminUser } from '@/src/server/auth';
import AdminNav from './admin-nav';
import AdminTopbar from './admin-topbar';

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdminUser();
  const email = user.email;
  const initial = (user.name || email).trim().charAt(0).toUpperCase() || 'A';
  const csrfToken = csrfTokenForEmail(email);

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <a className="admin-brand" href="/admin/asistent">
          <img src="/assets/astana-logo.png" alt="ASTANA" width="156" height="52" />
        </a>
        <div className="admin-navigation-desktop">
          <AdminNav role={user.role} />
          <form action="/admin/logout" method="post">
            <button type="submit">Odhlásiť</button>
          </form>
        </div>
        <details className="admin-navigation-mobile">
          <summary>
            <span>Menu administrácie</span>
            <span className="admin-navigation-open-label" aria-hidden="true">Otvoriť</span>
            <span className="admin-navigation-close-label" aria-hidden="true">Zavrieť</span>
          </summary>
          <AdminNav role={user.role} />
          <form action="/admin/logout" method="post">
            <button type="submit">Odhlásiť</button>
          </form>
        </details>
      </aside>
      <div className="admin-main">
        <AdminTopbar email={email} name={user.name || email} role={user.role} initial={initial} />
        <span id="admin-csrf-token" data-token={csrfToken} hidden />
        {children}
      </div>
      <script
        dangerouslySetInnerHTML={{
          __html:
            "document.addEventListener('click',function(e){var b=e.target.closest('[data-print]');if(b){e.preventDefault();window.print();}})",
        }}
      />
      {/* React action forms mounted by client navigation need not have a method attribute. */}
      <script
        dangerouslySetInnerHTML={{
          __html:
            "document.addEventListener('submit',function(e){var f=e.target;if(!(f instanceof HTMLFormElement))return;if(f.querySelector('input[name=\"_csrf\"]'))return;if((f.getAttribute('method')||'get').toLowerCase()!=='post'&&!f.classList.contains('admin-pending-form'))return;var token=document.getElementById('admin-csrf-token');if(!token)return;var input=document.createElement('input');input.type='hidden';input.name='_csrf';input.value=token.getAttribute('data-token')||'';f.appendChild(input);},true)",
        }}
      />
      <script
        dangerouslySetInnerHTML={{
          __html:
            "document.addEventListener('submit',function(e){var f=e.target;if(!(f instanceof HTMLFormElement))return;var name=f.getAttribute('data-confirm-delete-file');if(name&&!confirm('Naozaj zmazať '+name+'?'))e.preventDefault();},true)",
        }}
      />
      <script
        dangerouslySetInnerHTML={{
          __html:
            "document.addEventListener('submit',function(e){var f=e.target;if(!(f instanceof HTMLFormElement))return;var message=f.getAttribute('data-confirm-submit');if(message&&!confirm(message))e.preventDefault();},true)",
        }}
      />
    </div>
  );
}

