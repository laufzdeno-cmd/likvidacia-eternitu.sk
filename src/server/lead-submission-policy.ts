import { createHash } from 'node:crypto';

const customerTextFields = [
  'fullName',
  'phone',
  'email',
  'city',
  'district',
  'objectType',
  'materialType',
  'preferredContact',
  'roofer',
  'selectedRooferId',
  'term',
  'note',
] as const;

export type LeadSubmissionCustomerFields = Partial<Record<(typeof customerTextFields)[number], string>> & {
  areaEstimate?: number | string;
  gdpr?: boolean | 'true' | 'on';
};

export type LeadSubmissionFingerprint = {
  canonical: Record<string, string | number | boolean | string[]>;
  canonicalJson: string;
  hash: string;
};

export type LeadSubmissionFingerprintOptions = {
  uploadedStorageIds?: readonly string[];
};

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => compareStrings(left, right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function createLeadSubmissionFingerprint(
  input: LeadSubmissionCustomerFields | Record<string, unknown>,
  options: LeadSubmissionFingerprintOptions = {},
): LeadSubmissionFingerprint {
  const canonical: LeadSubmissionFingerprint['canonical'] = {};
  const source = input as Record<string, unknown>;

  for (const field of customerTextFields) {
    const value = source[field];
    if (typeof value !== 'string') continue;
    const normalized = value.normalize('NFC').trim();
    canonical[field] = field === 'email' ? normalized.toLowerCase() : normalized;
  }

  const area = source.areaEstimate;
  if ((typeof area === 'number' || (typeof area === 'string' && area.trim() !== '')) && Number.isFinite(Number(area))) {
    canonical.areaEstimate = Number(area);
  }

  const consent = source.gdpr;
  if (typeof consent === 'boolean' || consent === 'true' || consent === 'on') {
    canonical.gdpr = consent === true || consent === 'true' || consent === 'on';
  }

  if (options.uploadedStorageIds !== undefined) {
    canonical.uploadedStorageIds = options.uploadedStorageIds
      .filter((id): id is string => typeof id === 'string')
      .map((id) => id.normalize('NFC').trim())
      .filter(Boolean)
      .sort(compareStrings);
  }

  const canonicalJson = stableJson(canonical);
  const hash = createHash('sha256').update(canonicalJson, 'utf8').digest('hex');
  return { canonical, canonicalJson, hash };
}

export function sameLeadSubmissionFingerprint(
  left: Pick<LeadSubmissionFingerprint, 'hash'>,
  right: Pick<LeadSubmissionFingerprint, 'hash'>,
): boolean {
  return left.hash === right.hash;
}

export async function recordLeadAuditNonFatal<T>(
  result: T,
  writeAudit: () => Promise<unknown>,
  onFailure: (error: unknown) => void,
): Promise<T> {
  try {
    await writeAudit();
  } catch (error) {
    try {
      onFailure(error);
    } catch {
      // The audit and its diagnostic callback are both non-critical to a confirmed submission.
    }
  }
  return result;
}
