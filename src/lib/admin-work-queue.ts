import type { BusinessAssistantPriority, BusinessAssistantTone } from './business-assistant';
import type { AdminWorkItem, AdminWorkItemPriority, AdminWorkItemStatus } from '@/src/server/types';

export type AdminWorkQueueView = 'all' | 'overdue' | 'today' | 'critical' | 'mine' | 'unassigned' | 'done' | 'done_today' | 'cancelled';
export type AdminWorkQueueSource = 'all' | 'automatic' | 'manual';
export type AdminWorkQueueGroup = 'OVERDUE' | 'TODAY' | 'UPCOMING' | 'DONE' | 'CANCELLED';

export type AdminWorkQueueItem = {
  id: string;
  source: 'automatic' | 'manual';
  group: AdminWorkQueueGroup;
  tone: BusinessAssistantTone | 'manual';
  title: string;
  detail: string;
  eyebrow: string;
  metric: string;
  href: string;
  actionLabel: string;
  priority: AdminWorkItemPriority | '';
  dueDate: string;
  ownerEmail: string;
  status: AdminWorkItemStatus;
  rank: number;
  manualItem?: AdminWorkItem;
};

export type AdminWorkQueueFilters = {
  view: AdminWorkQueueView;
  source: AdminWorkQueueSource;
  query: string;
};

function manualTone(priority: AdminWorkItemPriority): BusinessAssistantTone | 'manual' {
  if (priority === 'CRITICAL') return 'critical';
  if (priority === 'HIGH') return 'warning';
  return 'manual';
}

function manualRank(priority: AdminWorkItemPriority) {
  return { CRITICAL: 2, HIGH: 18, NORMAL: 55, LOW: 75 }[priority];
}

function automaticGroup(item: BusinessAssistantPriority): AdminWorkQueueGroup {
  if (item.timing === 'overdue') return 'OVERDUE';
  if (item.timing === 'upcoming') return 'UPCOMING';
  return 'TODAY';
}

function manualGroup(item: AdminWorkItem, today: string): AdminWorkQueueGroup {
  if (item.status === 'DONE') return 'DONE';
  if (item.status === 'CANCELLED') return 'CANCELLED';
  if (!item.dueDate) return 'UPCOMING';
  if (item.dueDate < today) return 'OVERDUE';
  if (item.dueDate === today) return 'TODAY';
  return 'UPCOMING';
}

function completedOn(item: AdminWorkItem, today: string) {
  if (!item.completedAt) return false;
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Bratislava' }).format(new Date(item.completedAt)) === today;
}

export function normalizeAdminWorkQueueFilters(input: Partial<Record<'view' | 'source' | 'q', string>>): AdminWorkQueueFilters {
  const viewValues: AdminWorkQueueView[] = ['all', 'overdue', 'today', 'critical', 'mine', 'unassigned', 'done', 'done_today', 'cancelled'];
  const sourceValues: AdminWorkQueueSource[] = ['all', 'automatic', 'manual'];
  return {
    view: viewValues.includes(input.view as AdminWorkQueueView) ? input.view as AdminWorkQueueView : 'all',
    source: sourceValues.includes(input.source as AdminWorkQueueSource) ? input.source as AdminWorkQueueSource : 'all',
    query: String(input.q ?? '').trim().slice(0, 80),
  };
}

export function buildAdminWorkQueue(input: {
  priorities: BusinessAssistantPriority[];
  workItems: AdminWorkItem[];
  manualCounts?: { overdue: number; today: number; mine: number; unassigned: number; doneToday: number; cancelled: number };
  today: string;
  currentEmail: string;
  filters: AdminWorkQueueFilters;
}) {
  const automaticItems: AdminWorkQueueItem[] = input.priorities
    .filter((item) => item.id !== 'all-clear')
    .map((item) => ({
      id: `automatic:${item.id}`,
      source: 'automatic',
      group: automaticGroup(item),
      tone: item.tone,
      title: item.title,
      detail: item.detail,
      eyebrow: item.eyebrow,
      metric: item.metric,
      href: item.href,
      actionLabel: item.actionLabel,
      priority: '',
      dueDate: input.today,
      ownerEmail: '',
      status: 'OPEN',
      rank: item.rank,
    }));
  const manualItems: AdminWorkQueueItem[] = input.workItems.map((item) => ({
    id: `manual:${item.id}`,
    source: 'manual',
    group: manualGroup(item, input.today),
    tone: manualTone(item.priority),
    title: item.title,
    detail: item.note || 'Bez doplňujúcej poznámky.',
    eyebrow: 'Manuálna úloha',
    metric: '',
    href: '',
    actionLabel: '',
    priority: item.priority,
    dueDate: item.dueDate,
    ownerEmail: item.ownerEmail,
    status: item.status,
    rank: manualRank(item.priority),
    manualItem: item,
  }));
  const allItems = [...automaticItems, ...manualItems];
  const currentEmail = input.currentEmail.trim().toLowerCase();
  const query = input.filters.query.toLocaleLowerCase('sk');
  const groupOrder: Record<AdminWorkQueueGroup, number> = { OVERDUE: 0, TODAY: 1, UPCOMING: 2, DONE: 3, CANCELLED: 4 };

  const items = allItems.filter((item) => {
    if (input.filters.source !== 'all' && item.source !== input.filters.source) return false;
    if (input.filters.view === 'overdue' && (item.status !== 'OPEN' || item.group !== 'OVERDUE')) return false;
    if (input.filters.view === 'today' && (item.status !== 'OPEN' || item.group !== 'TODAY')) return false;
    if (input.filters.view === 'critical' && item.tone !== 'critical') return false;
    if (input.filters.view === 'mine' && item.ownerEmail.toLowerCase() !== currentEmail) return false;
    if (input.filters.view === 'unassigned' && (item.source !== 'manual' || item.status !== 'OPEN' || item.ownerEmail)) return false;
    if (input.filters.view === 'done' && item.status !== 'DONE') return false;
    if (input.filters.view === 'done_today' && (item.status !== 'DONE' || !item.manualItem || !completedOn(item.manualItem, input.today))) return false;
    if (input.filters.view === 'cancelled' && item.status !== 'CANCELLED') return false;
    if (input.filters.view === 'all' && (item.status === 'DONE' || item.status === 'CANCELLED')) return false;
    if (['critical', 'mine', 'unassigned', 'overdue', 'today'].includes(input.filters.view) && item.status !== 'OPEN') return false;
    if (query && !`${item.title} ${item.detail} ${item.ownerEmail} ${item.eyebrow}`.toLocaleLowerCase('sk').includes(query)) return false;
    return true;
  }).sort((left, right) => (
    groupOrder[left.group] - groupOrder[right.group]
    || left.rank - right.rank
    || left.dueDate.localeCompare(right.dueDate)
    || left.title.localeCompare(right.title, 'sk')
  ));

  return {
    items,
    counts: {
      overdue: automaticItems.filter((item) => item.group === 'OVERDUE').length
        + (input.manualCounts?.overdue ?? manualItems.filter((item) => item.status === 'OPEN' && item.group === 'OVERDUE').length),
      today: automaticItems.filter((item) => item.group === 'TODAY').length
        + (input.manualCounts?.today ?? manualItems.filter((item) => item.status === 'OPEN' && item.group === 'TODAY').length),
      mine: input.manualCounts?.mine ?? manualItems.filter((item) => item.status === 'OPEN' && item.ownerEmail.toLowerCase() === currentEmail).length,
      unassigned: input.manualCounts?.unassigned ?? manualItems.filter((item) => item.status === 'OPEN' && !item.ownerEmail).length,
      doneToday: input.manualCounts?.doneToday ?? input.workItems.filter((item) => item.status === 'DONE' && completedOn(item, input.today)).length,
      cancelled: input.manualCounts?.cancelled ?? manualItems.filter((item) => item.status === 'CANCELLED').length,
    },
  };
}
