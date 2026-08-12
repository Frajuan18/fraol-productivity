// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  hasShareStats,
  hasShareStreak,
  hasSharePlans,
  hasShareLiveFocus,
  hasShareSnapshots,
  maskFocusStatus,
  privacySummary,
} from '@/lib/repositories/privacyMath';

describe('privacy gates default to shared', () => {
  it('treats missing settings as shared for every gate', () => {
    expect(hasShareStats(undefined)).toBe(true);
    expect(hasShareStreak(null)).toBe(true);
    expect(hasSharePlans(undefined)).toBe(true);
    expect(hasShareLiveFocus(undefined)).toBe(true);
    expect(hasShareSnapshots(undefined)).toBe(true);
  });

  it('only false turns a gate off', () => {
    expect(hasShareStats({ shareWeeklyStats: false })).toBe(false);
    expect(hasShareStats({ shareWeeklyStats: true })).toBe(true);
    expect(hasShareStreak({ shareStreak: false })).toBe(false);
    expect(hasSharePlans({ sharePlans: false })).toBe(false);
    expect(hasShareLiveFocus({ shareLiveFocus: false })).toBe(false);
    expect(hasShareSnapshots({ shareSnapshots: false })).toBe(false);
    expect(hasShareSnapshots({ shareSnapshots: true })).toBe(true);
  });
});

describe('maskFocusStatus', () => {
  it('masks focusing to online when live focus is off', () => {
    expect(maskFocusStatus(false, 'focusing')).toBe('online');
  });

  it('keeps focusing when live focus is on', () => {
    expect(maskFocusStatus(true, 'focusing')).toBe('focusing');
  });

  it('passes other statuses through', () => {
    expect(maskFocusStatus(false, 'online')).toBe('online');
    expect(maskFocusStatus(true, 'online')).toBe('online');
  });
});

describe('privacySummary', () => {
  it('reports shared when all toggles are on', () => {
    const summary = privacySummary({
      shareWeeklyStats: true,
      shareStreak: true,
      shareLiveFocus: true,
      shareSnapshots: true,
    });
    expect(summary).toEqual({
      statistics: 'shared',
      focusStatus: 'shared',
      recentActivity: 'shared',
      snapshots: 'shared',
    });
  });

  it('reports private per toggle', () => {
    const summary = privacySummary({
      shareWeeklyStats: false,
      shareStreak: true,
      shareLiveFocus: false,
      shareSnapshots: false,
    });
    expect(summary.statistics).toBe('private');
    expect(summary.recentActivity).toBe('shared');
    expect(summary.focusStatus).toBe('private');
    expect(summary.snapshots).toBe('private');
  });

  it('defaults to shared for missing settings', () => {
    const summary = privacySummary(null);
    expect(summary).toEqual({
      statistics: 'shared',
      focusStatus: 'shared',
      recentActivity: 'shared',
      snapshots: 'shared',
    });
  });
});
