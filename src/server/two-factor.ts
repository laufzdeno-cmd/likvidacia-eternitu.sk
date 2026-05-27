import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { generateSecret, generateURI, verifySync } from 'otplib';

function twoFactorSecret() {
  return process.env.AUTH_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'local-dev-auth-secret-change-me');
}

function hmac(value: string) {
  const secret = twoFactorSecret();
  if (!secret) throw new Error('AUTH_SECRET is missing.');
  return createHmac('sha256', secret).update(value.trim().toUpperCase()).digest('base64url');
}

export function generateTotpSecret() {
  return generateSecret();
}

export function totpUri(email: string, secret: string) {
  return generateURI({ issuer: 'ASTANA admin', label: email.trim().toLowerCase(), secret });
}

export function verifyTotp(token: string, secret: string) {
  return verifySync({ token: token.replace(/\s+/g, ''), secret }).valid;
}

export function generateBackupCodes() {
  return Array.from({ length: 8 }, () => randomBytes(5).toString('hex').toUpperCase().replace(/(.{5})/, '$1-'));
}

export function hashBackupCode(code: string) {
  return hmac(code);
}

export function hashBackupCodes(codes: string[]) {
  return codes.map(hashBackupCode);
}

export function consumeBackupCode(code: string, hashes: string[]) {
  const candidate = Buffer.from(hashBackupCode(code));
  const index = hashes.findIndex((hash) => {
    const stored = Buffer.from(hash);
    return stored.length === candidate.length && timingSafeEqual(stored, candidate);
  });
  if (index < 0) return null;
  return hashes.filter((_, itemIndex) => itemIndex !== index);
}

export function isTwoFactorRequired(role: string) {
  return role === 'SUPER_ADMIN';
}
