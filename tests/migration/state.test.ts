// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  buildReport,
  recordMigration,
  resetMigrationState,
  isMigrationComplete,
  readMigrationState,
} from '@/lib/migration/state';

const COUNTS = { users: 1, plans: 3, sessions: 5, files: 2 };

describe('migration state', () => {
  beforeEach(() => resetMigrationState());
  afterEach(() => resetMigrationState());

  it('reports incomplete before recording', () => {
    expect(isMigrationComplete('abc')).toBe(false);
  });

  it('records state and reports complete for the same source checksum', () => {
    recordMigration('abc', COUNTS);
    expect(isMigrationComplete('abc')).toBe(true);
    expect(isMigrationComplete('different-checksum')).toBe(false);
    const state = readMigrationState();
    expect(state?.sourceChecksum).toBe('abc');
    expect(state?.rowCounts).toEqual(COUNTS);
  });

  it('buildReport includes per-row counts and error tally', () => {
    const report = buildReport(COUNTS, ['ERROR failed to migrate plan 5']);
    expect(report).toContain('Plans migrated: 3');
    expect(report).toContain('Sessions migrated: 5');
    expect(report).toContain('Errors: 1');
  });
});
