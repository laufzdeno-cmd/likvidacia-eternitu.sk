'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin, requireSuperAdmin, verifyCsrf } from '@/src/server/auth';
import { archiveCareerApplication, restoreCareerApplication, updateCareerApplicationWorkflow } from '@/src/server/db';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function requiredString(formData: FormData, name: string) {
  const value = formData.get(name);
  if (typeof value !== 'string') throw new Error('Neplatné údaje formulára. Obnovte stránku a skúste to znova.');
  return value;
}

function applicationId(formData: FormData) {
  const id = requiredString(formData, 'id').trim();
  if (!UUID_PATTERN.test(id)) throw new Error('Neplatný identifikátor kariérnej žiadosti.');
  return id;
}

function parseFollowupDate(value: string) {
  if (!value) return '';
  if (!DATE_PATTERN.test(value)) throw new Error('Termín musí byť vo formáte RRRR-MM-DD.');
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('Zadajte platný kalendárny dátum.');
  }
  return value;
}

function revalidateCareerApplication(id: string) {
  revalidatePath('/admin/kariera');
  revalidatePath(`/admin/kariera/${id}`);
}

export async function updateCareerApplicationWorkflowAction(formData: FormData) {
  await verifyCsrf(formData);
  const actorEmail = await requireAdmin();
  const id = applicationId(formData);
  const rawStatus = requiredString(formData, 'status');
  if (rawStatus !== 'new' && rawStatus !== 'reviewed') throw new Error('Neplatný stav kariérnej žiadosti.');

  const ownerEmail = requiredString(formData, 'ownerEmail').trim().toLowerCase();
  if (ownerEmail.length > 254) throw new Error('Vlastník má neplatnú dĺžku.');
  const nextAction = requiredString(formData, 'nextAction').trim();
  if (nextAction.length > 300) throw new Error('Ďalší krok môže mať najviac 300 znakov.');
  const followupDate = parseFollowupDate(requiredString(formData, 'followupDate').trim());
  const expectedUpdatedAt = requiredString(formData, 'expectedUpdatedAt').trim();
  const parsedUpdatedAt = new Date(expectedUpdatedAt);
  if (Number.isNaN(parsedUpdatedAt.getTime()) || parsedUpdatedAt.toISOString() !== expectedUpdatedAt) {
    throw new Error('Neplatná verzia kariérnej žiadosti. Obnovte stránku a skúste to znova.');
  }

  const updated = await updateCareerApplicationWorkflow(id, {
    status: rawStatus,
    ownerEmail,
    nextAction,
    followupDate,
    expectedUpdatedAt,
  }, actorEmail);
  if (!updated) throw new Error('Kariérna žiadosť sa nenašla. Obnovte zoznam a skúste to znova.');
  revalidateCareerApplication(id);
}

export async function archiveCareerApplicationAction(formData: FormData) {
  await verifyCsrf(formData);
  const actorEmail = await requireAdmin();
  const id = applicationId(formData);
  if (requiredString(formData, 'confirm') !== 'archive') throw new Error('Archiváciu treba výslovne potvrdiť.');
  const archived = await archiveCareerApplication(id, actorEmail);
  if (!archived) throw new Error('Kariérna žiadosť sa nenašla. Obnovte zoznam a skúste to znova.');
  revalidateCareerApplication(id);
}

export async function restoreCareerApplicationAction(formData: FormData) {
  await verifyCsrf(formData);
  const actorEmail = (await requireSuperAdmin()).email;
  const id = applicationId(formData);
  const restored = await restoreCareerApplication(id, actorEmail);
  if (!restored) throw new Error('Kariérna žiadosť sa nenašla. Obnovte zoznam a skúste to znova.');
  revalidateCareerApplication(id);
}
