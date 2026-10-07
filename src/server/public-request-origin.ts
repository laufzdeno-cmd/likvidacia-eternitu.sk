function vercelOrigin(host: string | undefined) {
  const normalized = host?.trim().toLowerCase();
  if (!normalized || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.vercel\.app$/.test(normalized)) {
    return null;
  }
  return `https://${normalized}`;
}

export function isTrustedVercelDeploymentOrigin(origin: string) {
  if (process.env.VERCEL !== '1') return false;

  const environment = process.env.VERCEL_ENV;
  if (environment !== 'preview' && environment !== 'production') return false;

  const deploymentOrigin = vercelOrigin(process.env.VERCEL_URL);
  if (deploymentOrigin === origin) return true;

  if (environment !== 'preview') return false;
  return vercelOrigin(process.env.VERCEL_BRANCH_URL) === origin;
}
