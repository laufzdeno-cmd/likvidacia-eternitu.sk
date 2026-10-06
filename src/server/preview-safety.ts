/** Deployed writes need an explicit production identity until Preview storage is isolated. */
export function deploymentDatabaseAccessBlocked(
  vercelEnv: string | undefined = process.env.VERCEL_ENV,
  nodeEnv: string | undefined = process.env.NODE_ENV,
) {
  return vercelEnv === 'preview' || (nodeEnv === 'production' && vercelEnv !== 'production');
}

export function deploymentRequestBlocked(
  vercelEnv: string | undefined,
  nodeEnv: string | undefined,
  method: string,
  pathname: string,
) {
  if (!deploymentDatabaseAccessBlocked(vercelEnv, nodeEnv)) return false;
  if (/^\/api\/cron(?:\/|$)/i.test(pathname)) return true;
  return !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
}
