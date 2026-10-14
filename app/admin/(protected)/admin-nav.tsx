'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import type { AdminRole } from '@/src/server/types';

const navGroups = [
  {
    title: 'HLAVNÉ',
    items: [
      { href: '/admin/asistent', label: 'Dnes', icon: 'spark' },
      { href: '/admin/dashboard', label: 'Prehľad', icon: 'chart' },
      { href: '/admin/vyhladavanie', label: 'Vyhľadávanie', icon: 'search' },
      { href: '/admin/ai-asistent', label: 'Návrhy textov', icon: 'spark' },
    ],
  },
  {
    title: 'OBCHOD',
    items: [
      { href: '/admin/dopyty', label: 'Dopyty', icon: 'mail' },
      { href: '/admin/ponuky', label: 'Ponuky', icon: 'doc' },
      { href: '/admin/strechari', label: 'Strechári', icon: 'users' },
    ],
  },
  {
    title: 'REALIZÁCIA',
    items: [
      { href: '/admin/zakazky', label: 'Zákazky', icon: 'list' },
      { href: '/admin/planovac', label: 'Plánovač', icon: 'calendar' },
      { href: '/admin/realizacie', label: 'Realizácie', icon: 'image' },
      { href: '/admin/realizacie/fotky', label: 'Fotky z terénu', icon: 'image', superOnly: true },
    ],
  },
  {
    title: 'FINANCIE',
    items: [
      { href: '/admin/zakazky/pohladavky', label: 'Pohľadávky a platby', icon: 'trend', superOnly: true },
      { href: '/admin/rok', label: 'Ročný prehľad', icon: 'calendar', superOnly: true },
    ],
  },
  {
    title: 'MARKETING',
    items: [
      { href: '/admin/analytics', label: 'Analytika', icon: 'trend', superOnly: true },
      { href: '/admin/realizacie/pripady', label: 'Koncepty prípadov', icon: 'doc', superOnly: true },
      { href: '/admin/referencie', label: 'Referencie a hodnotenia', icon: 'badge' },
      { href: '/admin/obsah', label: 'Obsah a GEO', icon: 'doc', superOnly: true },
    ],
  },
  {
    title: 'SPRÁVA',
    items: [
      { href: '/admin/kontrola-dat', label: 'Kontrola prevádzky', icon: 'shield' },
      { href: '/admin/automatizacie', label: 'Automatizácie', icon: 'bolt', superOnly: true },
      { href: '/admin/kariera', label: 'Kariéra', icon: 'users' },
      { href: '/admin/nastavenia', label: 'Nastavenia', icon: 'gear', superOnly: true },
      { href: '/admin/profil', label: 'Profil', icon: 'user' },
      { href: '/admin/import', label: 'Import', icon: 'upload', superOnly: true },
      { href: '/admin/users', label: 'Používatelia', icon: 'users', superOnly: true },
      { href: '/admin/audit', label: 'Audit aktivít', icon: 'shield', superOnly: true },
      { href: '/admin/health', label: 'Kontrola systému', icon: 'shield', superOnly: true },
    ],
  },
];

function Icon({ name }: { name: string }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const paths: Record<string, ReactNode> = {
    chart: <><path d="M4 19V9" /><path d="M12 19V5" /><path d="M20 19v-7" /></>,
    list: <><path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" /></>,
    doc: <><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5" /><path d="M10 13h6" /><path d="M10 17h6" /></>,
    calendar: <><path d="M7 3v4" /><path d="M17 3v4" /><path d="M4 9h16" /><path d="M5 5h14v16H5z" /></>,
    star: <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />,
    trend: <><path d="M4 17 10 11l4 4 6-8" /><path d="M14 7h6v6" /></>,
    gear: <><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" /><path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" /></>,
    upload: <><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M5 20h14" /></>,
    chat: <path d="M21 12a8 8 0 0 1-8 8H5l2-4a8 8 0 1 1 14-4Z" />,
    mail: <><path d="M4 6h16v12H4z" /><path d="m4 7 8 6 8-6" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="9.5" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
    image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="m21 15-5-5L5 20" /></>,
    badge: <><path d="m12 3 2.2 2.2 3.1-.2.9 3 2.6 1.7-1.5 2.7.6 3-3 1-1.3 2.8-3-1-2.7 1.5-1.8-2.6-3-.6.2-3-2.2-2.1 2.1-2.2-.2-3 3-.8z" /><path d="m9 12 2 2 4-4" /></>,
    shield: <><path d="M12 3 20 6v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6z" /><path d="m8.5 12 2.2 2.2 4.8-4.8" /></>,
    spark: <><path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" /><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    bolt: <path d="m13 2-9 12h8l-1 8 9-12h-8z" />,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" {...common}>{paths[name]}</svg>;
}

export default function AdminNav({ role }: { role: AdminRole }) {
  const pathname = usePathname();
  const groups = navGroups.map((group) => ({
    ...group,
    items: group.items.filter((item) => role === 'SUPER_ADMIN' || !('superOnly' in item && item.superOnly)),
  }));
  const activeHref = groups
    .flatMap((group) => group.items)
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav>
      {groups.map((group) => (
        <div className="admin-nav-group" key={group.title}>
          <span className="admin-nav-title">{group.title}</span>
          {group.items.map((item) => (
            <a key={item.href} href={item.href} aria-current={activeHref === item.href ? 'page' : undefined}>
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </a>
          ))}
        </div>
      ))}
    </nav>
  );
}
