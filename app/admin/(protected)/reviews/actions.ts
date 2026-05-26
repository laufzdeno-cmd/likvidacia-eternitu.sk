'use server';

import { verifyCsrf } from '@/src/server/auth';
import {
  createTestimonialAction as createReferenceTestimonialAction,
  updateTestimonialStatusAction as updateReferenceTestimonialStatusAction,
} from '../referencie/actions';

export async function createTestimonialAction(formData: FormData) {
  await verifyCsrf(formData);
  return createReferenceTestimonialAction(formData);
}

export async function updateTestimonialStatusAction(formData: FormData) {
  await verifyCsrf(formData);
  return updateReferenceTestimonialStatusAction(formData);
}
