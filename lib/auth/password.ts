import '@/lib/server-only';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'crypto';

const KEY_LENGTH = 64;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

export interface HashedPassword {
  hash: string;
  salt: string;
}

export function hashPassword(plain: string): HashedPassword {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(plain, salt, KEY_LENGTH, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P }).toString('hex');
  return { hash, salt };
}

export function verifyPassword(plain: string, salt: string, expectedHash: string): boolean {
  const candidate = scryptSync(plain, salt, KEY_LENGTH, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  const expected = Buffer.from(expectedHash, 'hex');
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

/** Deterministic hash for session tokens so raw tokens are never stored at rest. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

export function generateUserId(): string {
  return randomBytes(16).toString('hex');
}
