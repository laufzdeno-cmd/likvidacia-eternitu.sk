export type LeadMeasurementEligibility = {
  duplicate: boolean;
  isQa: boolean;
  isSpam: boolean;
  marketingConsent: boolean;
  conversionEligible: boolean;
};

type LeadIdentity = { email?: string; fullName?: string; note?: string };

/**
 * QA identification is deliberately fail-closed for known non-routable test
 * addresses and the explicit QA marker used by our controlled test procedure.
 * It is not exposed as a public request flag that a browser could forge.
 */
export function isControlledQaLead({ email = '', fullName = '', note = '' }: LeadIdentity) {
  const normalizedEmail = email.trim().toLowerCase();
  const marker = `${fullName}\n${note}`.trim();
  return normalizedEmail.endsWith('@example.test') || normalizedEmail.endsWith('@test.invalid') || /\bQA-(?:PROD|PREVIEW|E2E)-/i.test(marker);
}

export function measurementEligibility(input: {
  duplicate?: boolean;
  isQa?: boolean;
  isSpam?: boolean;
  marketingConsent?: boolean;
}): LeadMeasurementEligibility {
  const duplicate = input.duplicate === true;
  const isQa = input.isQa === true;
  const isSpam = input.isSpam === true;
  const marketingConsent = input.marketingConsent === true;
  return {
    duplicate,
    isQa,
    isSpam,
    marketingConsent,
    conversionEligible: !duplicate && !isQa && !isSpam && marketingConsent,
  };
}
