export function normalizeAdminSessionEpoch(value: unknown) {
  if (value === undefined || value === null || value === '') return 0;
  const epoch = Number(value);
  return Number.isSafeInteger(epoch) && epoch >= 0 ? epoch : -1;
}

export function adminSessionEpochMatchesUser(sessionEpoch: unknown, userEpoch: unknown) {
  return Number.isSafeInteger(sessionEpoch)
    && Number(sessionEpoch) >= 0
    && Number(sessionEpoch) === normalizeAdminSessionEpoch(userEpoch);
}
