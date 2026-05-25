'use client';

import { usePathname } from 'next/navigation';

const crumbs = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/dopyty', label: 'Dopyty' },
  { href: '/admin/zakazky', label: 'Zákazky' },
  { href: '/admin/ponuky', label: 'Ponuky' },
  { href: '/admin/rok', label: 'Ročný prehľad' },
  { href: '/admin/reviews/request', label: 'Žiadosť o recenziu' },
  { href: '/admin/reviews', label: 'Recenzie' },
  { href: '/admin/realizacie', label: 'Realizácie' },
  { href: '/admin/referencie', label: 'Referencie' },
  { href: '/admin/strechari', label: 'Strechári' },
  { href: '/admin/obsah', label: 'Texty webu' },
  { href: '/admin/analytics', label: 'Analytika' },
  { href: '/admin/import', label: 'Import' },
  { href: '/admin/nastavenia', label: 'Nastavenia' },
  { href: '/admin/health', label: 'Kontrola systému' },
];

function activeCrumb(pathname: string) {
  return crumbs
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.label ?? 'Admin';
}

export default function AdminTopbar({ email, initial }: { email: string; initial: string }) {
  const pathname = usePathname();

  return (
    <header className="admin-topbar">
      <span>ASTANA CRM / {activeCrumb(pathname)}</span>
      <div className="admin-user-chip">
        <strong>{email}</strong>
        <span>{initial}</span>
      </div>
    </header>
  );
}
