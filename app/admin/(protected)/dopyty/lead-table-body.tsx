'use client';

import { useRouter } from 'next/navigation';
import type { MouseEvent, ReactNode } from 'react';

export function LeadTableBody({ children }: { children: ReactNode }) {
  const router = useRouter();

  function openLead(event: MouseEvent<HTMLTableSectionElement>) {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const target = event.target;
    if (!(target instanceof Element) || target.closest('a, button, input, select, textarea, label, form')) return;
    if (window.getSelection()?.toString()) return;
    const row = target.closest<HTMLTableRowElement>('tr[data-lead-href]');
    if (!row || !event.currentTarget.contains(row)) return;
    const href = row.dataset.leadHref;
    if (href?.startsWith('/admin/dopyty/')) router.push(href);
  }

  return <tbody onClick={openLead}>{children}</tbody>;
}
