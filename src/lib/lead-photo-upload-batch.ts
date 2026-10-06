export async function settleLeadPhotoUploadBatch<T>(uploads: Promise<T>[], cancelPending: () => void): Promise<T[]> {
  try {
    return await Promise.all(uploads);
  } catch (error) {
    cancelPending();
    // Do not unlock the form while an aborted upload can still own a cached promise.
    await Promise.allSettled(uploads);
    throw error;
  }
}
