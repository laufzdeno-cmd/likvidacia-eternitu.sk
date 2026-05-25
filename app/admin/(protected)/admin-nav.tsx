'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const navItems = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: 'chart' },
  { href: '/admin/zakazky', label: 'Zákazky', icon: 'list' },
  { href: '/admin/ponuky', label: 'Ponuky', icon: 'doc' },
  { href: '/admin/rok', label: 'Ročný prehľad', icon: 'calendar' },
  { href: '/admin/reviews', label: 'Recenzie', icon: 'star' },
  { href: '/admin/analytics', label: 'Analytika', icon: 'trend' },
  { href: '/admin/nastavenia', label: 'Nastavenia', icon: 'gear' },
  { href: '/admin/import', label: 'Import', icon: 'upload' },
  { href: '/admin/reviews/request', label: 'Žiadosť o recenziu', icon: 'chat' },
  { href: '/admin/dopyty', label: 'Dopyty', icon: 'mail' },
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
    chat: <><path d="M21 12a8 8 0 0 1-8 8H5l2-4a8 8 0 1 1 14-4Z" /></>,
    mail: <><path d="M4 6h16v12H4z" /><path d="m4 7 8 6 8-6" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" {...common}>{paths[name]}</svg>;
}

export default function AdminNav() {
  const pathname = usePathname();
  return (
    <nav>
      {navItems.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <a key={item.href} href={item.href} aria-current={active ? 'page' : undefined}>
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </a>
        );
      })}
    </nav>
  );
}
