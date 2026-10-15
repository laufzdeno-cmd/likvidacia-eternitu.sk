import { createHash } from 'node:crypto';
import type { AdminRole, AdminTaskSuggestion, AdminWorkItemPriority, AdminWorkItemVisibility } from './types';

export type AdminSuggestionCandidate = {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
};

export type AdminSuggestionWorkItem = {
  id: string;
  revision: number;
  ownerEmail: string;
  priority: AdminWorkItemPriority;
  dueDate: string;
};

export type AdminSuggestionLead = {
  id: string;
  ownerEmail: string;
  followupDate: string;
  updatedAt: string;
};

function parseDateOnly(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function isWeekend(date: Date) {
  return date.getUTCDay() === 0 || date.getUTCDay() === 6;
}

export function addBusinessDays(date: string, count: number) {
  const cursor = parseDateOnly(date);
  while (isWeekend(cursor)) cursor.setUTCDate(cursor.getUTCDate() + 1);
  let remaining = Math.max(0, Math.trunc(count));
  while (remaining > 0) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (!isWeekend(cursor)) remaining -= 1;
  }
  return dateKey(cursor);
}

function suggestedDueDate(today: string, priority: AdminWorkItemPriority) {
  return addBusinessDays(today, { CRITICAL: 0, HIGH: 1, NORMAL: 2, LOW: 5 }[priority]);
}

function taskScore(item: AdminSuggestionWorkItem, today: string) {
  if (item.dueDate && item.dueDate < today) return item.priority === 'CRITICAL' ? 8 : 5;
  if (item.dueDate === today) return 4;
  if (item.dueDate && item.dueDate <= addBusinessDays(today, 2)) return 2;
  return 1;
}

export function buildAdminTaskSuggestion(input: {
  candidates: AdminSuggestionCandidate[];
  workItems: AdminSuggestionWorkItem[];
  leads: AdminSuggestionLead[];
  priority: AdminWorkItemPriority;
  visibility: AdminWorkItemVisibility;
  today: string;
  generatedAt: string;
}): AdminTaskSuggestion {
  const candidates = input.candidates
    .filter((candidate) => input.visibility !== 'SUPER_ADMIN' || candidate.role === 'SUPER_ADMIN')
    .sort((left, right) => left.id.localeCompare(right.id));
  if (!candidates.length) throw new Error('Pre túto úlohu nie je dostupný aktívny oprávnený vlastník.');

  const scored = candidates.map((candidate) => {
    const email = candidate.email.trim().toLowerCase();
    const workScore = input.workItems.filter((item) => item.ownerEmail.trim().toLowerCase() === email)
      .reduce((total, item) => total + taskScore(item, input.today), 0);
    const leadScore = input.leads.filter((lead) => lead.ownerEmail.trim().toLowerCase() === email)
      .reduce((total, lead) => total + 1 + (lead.followupDate && lead.followupDate <= input.today ? 3 : 0), 0);
    return { candidate, loadScore: workScore + leadScore };
  }).sort((left, right) => left.loadScore - right.loadScore || left.candidate.id.localeCompare(right.candidate.id));

  const snapshot = JSON.stringify({
    version: 1,
    candidates: candidates.map(({ id, email, role }) => ({ id, email: email.trim().toLowerCase(), role })),
    workItems: [...input.workItems].sort((a, b) => a.id.localeCompare(b.id)),
    leads: [...input.leads].sort((a, b) => a.id.localeCompare(b.id)),
    priority: input.priority,
    visibility: input.visibility,
    today: input.today,
  });
  const winner = scored[0];
  return {
    suggestionVersion: 1,
    suggestedOwnerUserId: winner.candidate.id,
    suggestedOwnerEmail: winner.candidate.email.trim().toLowerCase(),
    suggestedOwnerName: winner.candidate.name || winner.candidate.email,
    suggestedDueDate: suggestedDueDate(input.today, input.priority),
    loadScore: winner.loadScore,
    reasonCode: 'lowest_open_workload',
    sourceRevision: createHash('sha256').update(snapshot).digest('hex'),
    generatedAt: input.generatedAt,
  };
}
