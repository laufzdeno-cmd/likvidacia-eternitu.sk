const evidenceByResolution = Object.freeze({
  delivered: new Set(['inbox_message_found']),
  not_delivered: new Set(['provider_rejected']),
});

export function isApplicationNotificationEvidenceValid(resolution, evidence) {
  return typeof resolution === 'string'
    && Object.hasOwn(evidenceByResolution, resolution)
    && typeof evidence === 'string'
    && evidenceByResolution[resolution].has(evidence);
}
