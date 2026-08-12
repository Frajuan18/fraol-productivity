// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { isValidPartnership } from '@/src/validators/collaboration';
import { PARTNERSHIP_RELATIONSHIP_TYPE } from '@/src/types/collaboration';

describe('isValidPartnership', () => {
  it('accepts an active fixed_partner partnership without an inviter', () => {
    const partnership = {
      id: 'p1',
      userAId: 'u1',
      userBId: 'u2',
      status: 'active',
      relationshipType: PARTNERSHIP_RELATIONSHIP_TYPE.FIXED_PARTNER,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    expect(isValidPartnership(partnership)).toBe(true);
  });

  it('still accepts legacy records that carry an inviter', () => {
    const partnership = {
      id: 'p2',
      userAId: 'u1',
      userBId: 'u2',
      status: 'active',
      invitedBy: 'u1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    expect(isValidPartnership(partnership)).toBe(true);
  });

  it('rejects partnerships with an unknown status', () => {
    const partnership = {
      id: 'p3',
      userAId: 'u1',
      userBId: 'u2',
      status: 'archived',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    expect(isValidPartnership(partnership)).toBe(false);
  });

  it('rejects records missing required fields', () => {
    expect(isValidPartnership({ id: 'p4', status: 'active' })).toBe(false);
  });
});
