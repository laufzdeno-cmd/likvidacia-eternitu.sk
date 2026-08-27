export function cronAuthorizationStatus(request: Request, secret = process.env.CRON_SECRET) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  return secret && token === secret ? 0 : 401;
}
