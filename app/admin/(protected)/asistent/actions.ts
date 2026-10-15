'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { verifyCsrf, requireAdminUser } from '@/src/server/auth';
import { createAdminWorkItem, getAdminWorkItemSuggestion, recordAdminAssistantSuggestionOutcome, transitionAdminWorkItem, updateAdminWorkItem } from '@/src/server/db';
import { isValidIsoCalendarDate } from '@/src/lib/date-only';

const workItemSchema = z.object({
  title: z.string().trim().min(3).max(120),
  note: z.string().trim().max(1200),
  priority: z.enum(['CRITICAL', 'HIGH', 'NORMAL', 'LOW']),
  dueDate: z.string().trim().refine((value) => !value || isValidIsoCalendarDate(value)),
  ownerEmail: z.union([z.literal(''), z.string().email()]).transform((value) => value.trim().toLowerCase()),
  visibility: z.enum(['TEAM', 'SUPER_ADMIN']),
});

function returnTarget(formData: FormData, notice: string) {
  const raw = String(formData.get('returnTo') || '/admin/asistent');
  let url: URL;
  try {
    url = new URL(raw, 'https://admin.local');
  } catch {
    url = new URL('/admin/asistent', 'https://admin.local');
  }
  if (url.origin !== 'https://admin.local' || url.pathname.replace(/\/$/, '') !== '/admin/asistent') {
    url = new URL('/admin/asistent', 'https://admin.local');
  }
  url.searchParams.set('notice', notice);
  return `${url.pathname}${url.search}`;
}

function noticeFor(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('medzičasom')) return 'stale';
  if (message.includes('vlastník')) return 'owner';
  if (message.includes('nenašla')) return 'missing';
  if (message.includes('superadmin')) return 'forbidden';
  return 'invalid';
}

function parseWorkItem(formData: FormData) {
  return workItemSchema.safeParse({
    title: String(formData.get('title') || ''),
    note: String(formData.get('note') || ''),
    priority: String(formData.get('priority') || 'NORMAL'),
    dueDate: String(formData.get('dueDate') || ''),
    ownerEmail: String(formData.get('ownerEmail') || ''),
    visibility: String(formData.get('visibility') || 'TEAM'),
  });
}

export async function createAdminWorkItemAction(formData: FormData) {
  await verifyCsrf(formData);
  const actor = await requireAdminUser();
  const parsed = parseWorkItem(formData);
  const requestId = z.string().uuid().safeParse(String(formData.get('requestId') || ''));
  let notice = 'created';
  if (!parsed.success || !requestId.success || (parsed.data.visibility === 'SUPER_ADMIN' && actor.role !== 'SUPER_ADMIN')) {
    notice = 'invalid';
  } else {
    let submittedSuggestion: { sourceRevision: string; suggestionVersion: 1 } | undefined;
    try {
      const suggestionApplied = String(formData.get('suggestionApplied') || '') === '1';
      let assistantDecision;
      if (suggestionApplied) {
        const submitted = z.object({
          sourceRevision: z.string().regex(/^[a-f0-9]{64}$/),
          suggestionVersion: z.coerce.number().pipe(z.literal(1)),
          suggestedOwnerEmail: z.string().email().transform((value) => value.trim().toLowerCase()),
          suggestedDueDate: z.string().refine(isValidIsoCalendarDate),
          suggestedPriority: z.enum(['CRITICAL', 'HIGH', 'NORMAL', 'LOW']),
          suggestedVisibility: z.enum(['TEAM', 'SUPER_ADMIN']),
        }).parse({
          sourceRevision: formData.get('sourceRevision'),
          suggestionVersion: formData.get('suggestionVersion'),
          suggestedOwnerEmail: formData.get('suggestedOwnerEmail'),
          suggestedDueDate: formData.get('suggestedDueDate'),
          suggestedPriority: formData.get('suggestedPriority'),
          suggestedVisibility: formData.get('suggestedVisibility'),
        });
        submittedSuggestion = { sourceRevision: submitted.sourceRevision, suggestionVersion: submitted.suggestionVersion };
        const current = await getAdminWorkItemSuggestion({
          actorRole: actor.role, priority: submitted.suggestedPriority, visibility: submitted.suggestedVisibility,
        });
        if (current.sourceRevision !== submitted.sourceRevision
          || current.suggestionVersion !== submitted.suggestionVersion
          || current.suggestedOwnerEmail !== submitted.suggestedOwnerEmail
          || current.suggestedDueDate !== submitted.suggestedDueDate) {
          throw new Error('Návrh sa medzičasom zmenil. Obnovte stránku.');
        }
        const ownerChanged = parsed.data.ownerEmail !== current.suggestedOwnerEmail;
        const dueChanged = parsed.data.dueDate !== current.suggestedDueDate;
        assistantDecision = {
          outcome: ownerChanged || dueChanged ? 'modified' as const : 'accepted' as const,
          ownerChanged,
          dueChanged,
          reasonCode: current.reasonCode,
          suggestionVersion: current.suggestionVersion,
          sourceRevision: current.sourceRevision,
          actorKind: actor.role === 'SUPER_ADMIN' ? 'super_admin' as const : 'operator' as const,
        };
      }
      await createAdminWorkItem(parsed.data, actor.email, actor.role, requestId.data, assistantDecision);
    } catch (error) {
      notice = noticeFor(error);
      if (notice === 'stale' && submittedSuggestion) {
        await recordAdminAssistantSuggestionOutcome({
          decisionId: requestId.data,
          actorEmail: actor.email,
          actorRole: actor.role,
          sourceRevision: submittedSuggestion.sourceRevision,
          suggestionVersion: submittedSuggestion.suggestionVersion,
          outcome: 'stale',
        });
      }
    }
  }
  revalidatePath('/admin/asistent');
  redirect(returnTarget(formData, notice));
}

export async function dismissAdminWorkItemSuggestionAction(formData: FormData) {
  await verifyCsrf(formData);
  const actor = await requireAdminUser();
  const parsed = z.object({
    decisionId: z.string().uuid(),
    sourceRevision: z.string().regex(/^[a-f0-9]{64}$/),
    suggestionVersion: z.coerce.number().pipe(z.literal(1)),
  }).safeParse({
    decisionId: formData.get('decisionId'),
    sourceRevision: formData.get('sourceRevision'),
    suggestionVersion: formData.get('suggestionVersion'),
  });
  let notice = 'suggestion-dismissed';
  if (parsed.success) {
    const current = await getAdminWorkItemSuggestion({ actorRole: actor.role, priority: 'NORMAL', visibility: 'TEAM' });
    const outcome = current.sourceRevision === parsed.data.sourceRevision ? 'dismissed' as const : 'stale' as const;
    await recordAdminAssistantSuggestionOutcome({ ...parsed.data, actorEmail: actor.email, actorRole: actor.role, outcome });
    if (outcome === 'stale') notice = 'stale';
  }
  revalidatePath('/admin/asistent');
  redirect(`/admin/asistent?notice=${notice}#nova-uloha`);
}

export async function updateAdminWorkItemAction(formData: FormData) {
  await verifyCsrf(formData);
  const actor = await requireAdminUser();
  const parsed = parseWorkItem(formData);
  const id = z.string().uuid().safeParse(String(formData.get('id') || ''));
  const revision = z.coerce.number().int().positive().safeParse(formData.get('revision'));
  let notice = 'updated';
  if (!parsed.success || !id.success || !revision.success || (parsed.data.visibility === 'SUPER_ADMIN' && actor.role !== 'SUPER_ADMIN')) {
    notice = 'invalid';
  } else {
    try {
      await updateAdminWorkItem(id.data, parsed.data, revision.data, actor.email, actor.role);
    } catch (error) {
      notice = noticeFor(error);
    }
  }
  revalidatePath('/admin/asistent');
  redirect(returnTarget(formData, notice));
}

export async function transitionAdminWorkItemAction(formData: FormData) {
  await verifyCsrf(formData);
  const actor = await requireAdminUser();
  const parsed = z.object({
    id: z.string().uuid(),
    revision: z.coerce.number().int().positive(),
    status: z.enum(['OPEN', 'DONE', 'CANCELLED']),
    cancelReason: z.string().trim().max(500),
  }).safeParse({
    id: String(formData.get('id') || ''),
    revision: formData.get('revision'),
    status: String(formData.get('status') || ''),
    cancelReason: String(formData.get('cancelReason') || ''),
  });
  let notice = 'updated';
  if (!parsed.success || (parsed.data.status === 'CANCELLED' && parsed.data.cancelReason.length < 3)) {
    notice = 'invalid';
  } else {
    try {
      await transitionAdminWorkItem({
        id: parsed.data.id,
        status: parsed.data.status,
        expectedRevision: parsed.data.revision,
        cancelReason: parsed.data.cancelReason,
        actorEmail: actor.email,
        actorRole: actor.role,
      });
      notice = parsed.data.status === 'DONE' ? 'completed' : parsed.data.status === 'OPEN' ? 'reopened' : 'cancelled';
    } catch (error) {
      notice = noticeFor(error);
    }
  }
  revalidatePath('/admin/asistent');
  redirect(returnTarget(formData, notice));
}
