// Match accepted UUID versions while excluding Zod's special nil/max UUIDs,
// which are shared constants and cannot identify an individual form attempt.
const submissionIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidLeadSubmissionId(value) {
  return submissionIdPattern.test(value);
}
