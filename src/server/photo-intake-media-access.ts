export type PhotoMediaAdmin = { active: boolean; role: string } | null;

function photoMediaPreflightAccess(input: {
  admin: PhotoMediaAdmin;
  hasInvite: boolean;
  intakeEnabled: boolean;
  storageReady: boolean;
}): 'unauthenticated' | 'forbidden' | 'unavailable' | 'continue' {
  const { admin, hasInvite, intakeEnabled, storageReady } = input;
  if (admin?.active !== true && !hasInvite) return 'unauthenticated';
  if (admin?.active === true && admin.role !== 'SUPER_ADMIN' && !hasInvite) return 'forbidden';
  if (admin?.active === true && admin.role === 'SUPER_ADMIN') {
    return storageReady ? 'continue' : 'unavailable';
  }
  return intakeEnabled ? 'continue' : 'unavailable';
}

type PrivatePhotoRecord = {
  id: string;
  inviteId: string;
  status: string;
  storageKey: string;
  mimeType: string;
};

export async function loadAuthorizedPhotoMedia(input: {
  admin: PhotoMediaAdmin;
  hasInvite: boolean;
  inviteId: string | null;
  intakeEnabled: boolean;
  storageReady: boolean;
  photoId: string;
  lookupRecord: (id: string) => Promise<PrivatePhotoRecord | null>;
  readPrivateBlob: (key: string) => Promise<Buffer>;
}): Promise<
  | { status: 200; record: PrivatePhotoRecord; bytes: Buffer }
  | { status: 401 | 403 | 404 | 503 }
> {
  const preflight = photoMediaPreflightAccess(input);
  if (preflight !== 'continue') {
    const status = preflight === 'unauthenticated' ? 401 : preflight === 'forbidden' ? 403 : 503;
    return { status };
  }

  const record = await input.lookupRecord(input.photoId);
  if (!record || !['pending_review', 'approved_private', 'rejected'].includes(record.status)) return { status: 404 };

  if (input.admin?.active !== true && (!input.inviteId || record.inviteId !== input.inviteId)) return { status: 401 };
  if (input.admin?.active === true && input.admin.role !== 'SUPER_ADMIN'
    && (!input.inviteId || record.inviteId !== input.inviteId)) return { status: 403 };

  const bytes = await input.readPrivateBlob(record.storageKey);
  return { status: 200, record, bytes };
}
