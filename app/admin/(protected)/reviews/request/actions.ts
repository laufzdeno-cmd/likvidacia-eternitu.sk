'use server';

import { redirect } from 'next/navigation';

export async function createReviewRequestAction() {
  redirect('/admin/referencie');
}

export async function updateReviewRequestStatusAction() {
  redirect('/admin/referencie');
}

export async function getStoredGoogleReviewLink() {
  redirect('/admin/referencie');
}
