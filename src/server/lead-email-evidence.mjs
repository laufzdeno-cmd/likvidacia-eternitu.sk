const evidenceByOutcome = Object.freeze({
  sent: new Set(['inbox_message_found']),
  failed: new Set(['provider_rejected']),
});

export function isLeadEmailEvidenceValid(outcome, evidence) {
  return Object.hasOwn(evidenceByOutcome, outcome) && evidenceByOutcome[outcome].has(evidence);
}
