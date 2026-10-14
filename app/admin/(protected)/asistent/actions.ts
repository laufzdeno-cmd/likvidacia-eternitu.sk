'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { verifyCsrf, requireAdminUser } from '@/src/server/auth';
import { createAdminWorkItem, transitionAdminWorkItem, updateAdminWorkItem } from '@/src/server/db';
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
    try {
      await createAdminWorkItem(parsed.data, actor.email, actor.role, requestId.data);
    } catch (error) {
      notice = noticeFor(error);
    }
  }
  revalidatePath('/admin/asistent');
  redirect(returnTarget(formData, notice));
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
