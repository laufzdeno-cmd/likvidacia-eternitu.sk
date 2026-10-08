export const rooferReferralEvidenceMinLength = 8;

export type RooferReferralApproval = {
  customerReferralApproved: boolean;
  customerReferralEvidence: string;
  customerReferralApprovedAt?: string;
  customerReferralApprovedBy: string;
};

export function resolveRooferReferralApproval(
  approved: boolean,
  evidence: string | undefined,
  actorEmail: string,
  approvedAt = new Date().toISOString(),
): RooferReferralApproval {
  if (!approved) {
    return {
      customerReferralApproved: false,
      customerReferralEvidence: '',
      customerReferralApprovedAt: undefined,
      customerReferralApprovedBy: '',
    };
  }

  const normalizedEvidence = evidence?.trim() ?? '';
  const normalizedActor = actorEmail.trim().toLowerCase();
  if (normalizedEvidence.length < rooferReferralEvidenceMinLength) {
    throw new Error('Na odporúčanie strechára zákazníkovi je potrebný interný podklad súhlasu.');
  }
  if (!normalizedActor || !Number.isFinite(Date.parse(approvedAt))) {
    throw new Error('Schválenie odporúčania strechára nemá platný interný záznam.');
  }

  return {
    customerReferralApproved: true,
    customerReferralEvidence: normalizedEvidence,
    customerReferralApprovedAt: new Date(approvedAt).toISOString(),
    customerReferralApprovedBy: normalizedActor,
  };
}

export function resolveRooferReferralApprovalUpdate(
  current: RooferReferralApproval,
  approved: boolean,
  evidence: string | undefined,
  actorEmail: string,
  approvedAt = new Date().toISOString(),
) {
  const next = resolveRooferReferralApproval(approved, evidence, actorEmail, approvedAt);
  if (
    next.customerReferralApproved
    && current.customerReferralApproved
    && current.customerReferralEvidence.trim() === next.customerReferralEvidence
    && current.customerReferralApprovedBy.trim()
    && current.customerReferralApprovedAt
    && Number.isFinite(Date.parse(current.customerReferralApprovedAt))
  ) {
    return {
      ...next,
      customerReferralApprovedAt: new Date(current.customerReferralApprovedAt).toISOString(),
      customerReferralApprovedBy: current.customerReferralApprovedBy.trim().toLowerCase(),
    };
  }
  return next;
}

export function isRooferReferralEligible(input: {
  active: boolean;
  customerReferralApproved: boolean;
  customerReferralEvidence?: string;
  customerReferralApprovedAt?: string;
  customerReferralApprovedBy?: string;
}) {
  return Boolean(
    input.active
    && input.customerReferralApproved
    && (input.customerReferralEvidence?.trim().length ?? 0) >= rooferReferralEvidenceMinLength
    && input.customerReferralApprovedBy?.trim()
    && input.customerReferralApprovedAt
    && Number.isFinite(Date.parse(input.customerReferralApprovedAt)),
  );
}
