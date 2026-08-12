// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, hashToken, generateSessionToken } from '@/lib/auth/password';

describe('password hashing', () => {
  it('verifies a correct password', () => {
    const { hash, salt } = hashPassword('s3cret-pass');
    expect(verifyPassword('s3cret-pass', salt, hash)).toBe(true);
  });

  it('rejects a wrong password', () => {
    const { hash, salt } = hashPassword('right-pass');
    expect(verifyPassword('wrong-pass', salt, hash)).toBe(false);
  });

  it('uses a unique salt per call', () => {
    const a = hashPassword('same-pass');
    const b = hashPassword('same-pass');
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });
});

describe('token helpers', () => {
  it('hashToken is a deterministic 64-char hex digest', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
    expect(hashToken('abc')).toHaveLength(64);
  });

  it('generates unique session tokens', () => {
    expect(generateSessionToken()).not.toBe(generateSessionToken());
  });
});
