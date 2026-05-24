'use server';

import {
  createTestimonialAction as createReferenceTestimonialAction,
  updateTestimonialStatusAction as updateReferenceTestimonialStatusAction,
} from '../referencie/actions';

export async function createTestimonialAction(formData: FormData) {
  return createReferenceTestimonialAction(formData);
}

export async function updateTestimonialStatusAction(formData: FormData) {
  return updateReferenceTestimonialStatusAction(formData);
}
