'use client';

import { usePathname } from 'next/navigation';
import SearchWorkspace from './vyhladavanie/search-workspace';

const crumbs = [
  { href: '/admin/asistent', label: 'Dnes' },
  { href: '/admin/vyhladavanie', label: 'Vyhľadávanie' },
  { href: '/admin/ai-asistent', label: 'Návrhy textov' },
  { href: '/admin/kontrola-dat', label: 'Kontrola prevádzky' },
  { href: '/admin/automatizacie', label: 'Automatizácie' },
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/dopyty', label: 'Dopyty' },
  { href: '/admin/zakazky', label: 'Zákazky' },
  { href: '/admin/zakazky/pohladavky', label: 'Pohľadávky a platby' },
  { href: '/admin/ponuky', label: 'Ponuky' },
  { href: '/admin/planovac', label: 'Plánovač' },
  { href: '/admin/rok', label: 'Ročný prehľad' },
  { href: '/admin/reviews/request', label: 'Referencie a hodnotenia' },
  { href: '/admin/reviews', label: 'Referencie a hodnotenia' },
  { href: '/admin/realizacie', label: 'Realizácie' },
  { href: '/admin/realizacie/fotky', label: 'Fotky z terénu' },
  { href: '/admin/referencie', label: 'Referencie a hodnotenia' },
  { href: '/admin/strechari', label: 'Strechári' },
  { href: '/admin/kariera', label: 'Kariéra' },
  { href: '/admin/obsah', label: 'Texty webu' },
  { href: '/admin/analytics', label: 'Analytika' },
  { href: '/admin/import', label: 'Import' },
  { href: '/admin/profil', label: 'Profil' },
  { href: '/admin/audit', label: 'Audit aktivít' },
  { href: '/admin/nastavenia', label: 'Nastavenia' },
  { href: '/admin/users', label: 'Používatelia' },
  { href: '/admin/health', label: 'Kontrola systému' },
];

function activeCrumb(pathname: string) {
  return crumbs
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.label ?? 'Admin';
}

export default function AdminTopbar({ email, name, role, initial, csrfToken, workspaceEnabled = false }: { email: string; name: string; role: string; initial: string; csrfToken: string; workspaceEnabled?: boolean }) {
  const pathname = usePathname();

  return (
    <header className="admin-topbar">
      <span>ASTANA CRM / {activeCrumb(pathname)}</span>
      {workspaceEnabled && (role === 'SUPER_ADMIN' || role === 'OPERATOR') ? <SearchWorkspace compact csrfToken={csrfToken} role={role} /> : null}
      <div className="admin-topbar-actions">
        <div className="admin-user-chip">
          <small>Prihlásený ako:</small>
          <strong title={name || email}>{name || email}</strong>
          <em>{role === 'SUPER_ADMIN' ? 'Super admin' : role === 'META_REVIEWER' ? 'Kontrolór Meta' : 'Operátor'}</em>
          <span>{initial}</span>
        </div>
        <form action="/admin/logout" method="post">
          <input type="hidden" name="_csrf" value={csrfToken} />
          <button className="admin-topbar-logout" type="submit">Odhlásiť</button>
        </form>
      </div>
    </header>
  );
}
