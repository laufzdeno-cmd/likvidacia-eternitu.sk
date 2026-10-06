export const maxCareerCvBytes = 5 * 1024 * 1024;

export const careerCvUploadContentTypes = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream',
] as const;

const submissionIdPattern = /^[a-zA-Z0-9_-]{16,120}$/;
const uploadNamePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|doc|docx)$/i;
const sha256Pattern = /^[0-9a-f]{64}$/;

export function isCareerCvSubmissionId(value: string) {
  return submissionIdPattern.test(value);
}

export function isCareerCvUploadPath(submissionId: string, pathname: string) {
  if (!isCareerCvSubmissionId(submissionId)) return false;
  const prefix = `career-cv/${submissionId}/`;
  return pathname.startsWith(prefix) && uploadNamePattern.test(pathname.slice(prefix.length));
}

export function validateCareerCvReservation(input: {
  submissionId: string;
  pathname: string;
  originalName: string;
  expectedSize: number;
  expectedSha256: string;
}) {
  const { submissionId, pathname, originalName, expectedSize, expectedSha256 } = input;
  if (!isCareerCvUploadPath(submissionId, pathname)) return false;
  if (typeof originalName !== 'string' || originalName.length < 5 || originalName.length > 255 ||
      originalName.trim() !== originalName || /[\\/\x00-\x1f\x7f]/.test(originalName)) return false;
  const originalExtension = originalName.match(/\.(pdf|doc|docx)$/i)?.[1]?.toLowerCase();
  const pathExtension = pathname.match(/\.(pdf|doc|docx)$/i)?.[1]?.toLowerCase();
  if (!originalExtension || originalExtension !== pathExtension) return false;
  return Number.isSafeInteger(expectedSize) && expectedSize > 0 && expectedSize <= maxCareerCvBytes &&
    sha256Pattern.test(expectedSha256);
}
