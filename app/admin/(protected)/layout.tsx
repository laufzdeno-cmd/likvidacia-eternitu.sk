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
        <a className="admin-brand" href="/admin/dashboard">
          <img src="/assets/astana-logo.png" alt="ASTANA" width="156" height="52" />
        </a>
        <AdminNav role={user.role} />
        <form action="/admin/logout" method="post">
          <button type="submit">Odhlásiť</button>
        </form>
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
      <script
        dangerouslySetInnerHTML={{
          __html:
            "document.addEventListener('submit',function(e){var f=e.target;if(!(f instanceof HTMLFormElement)||!f.classList.contains('admin-pending-form'))return;var msg='Sprac\\u00favam po\\u017eiadavku. Chv\\u00ed\\u013eu po\\u010dkajte...';if(f.classList.contains('admin-send-offer-form'))msg='Generujem PDF a odosielam cenov\\u00fa ponuku z\\u00e1kazn\\u00edkovi. M\\u00f4\\u017ee to trva\\u0165 nieko\\u013eko sek\\u00fand...';else if(f.closest('.price-offer-layout'))msg='Uklad\\u00e1m cenov\\u00fa ponuku...';document.body.classList.add('admin-submit-busy');f.classList.add('is-submitting');f.querySelectorAll('button[type=\"submit\"]').forEach(function(b){b.disabled=true;b.classList.add('is-submitting');b.innerHTML='<span class=\"admin-button-spinner\" aria-hidden=\"true\"></span><span>Pracujem...</span>';});var old=document.querySelector('.admin-pending-toast');if(old)old.remove();var t=document.createElement('div');t.className='admin-pending-toast';t.setAttribute('role','status');t.setAttribute('aria-live','polite');var s=document.createElement('span');s.className='admin-button-spinner';s.setAttribute('aria-hidden','true');var strong=document.createElement('strong');strong.textContent=msg;t.append(s,strong);document.body.appendChild(t);},true)",
        }}
      />
      <script
        dangerouslySetInnerHTML={{
          __html:
            "document.addEventListener('submit',function(e){var f=e.target;if(!(f instanceof HTMLFormElement))return;if((f.method||'').toLowerCase()!=='post')return;if(f.querySelector('input[name=\"_csrf\"]'))return;var token=document.getElementById('admin-csrf-token');if(!token)return;var input=document.createElement('input');input.type='hidden';input.name='_csrf';input.value=token.getAttribute('data-token')||'';f.appendChild(input);},true)",
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

