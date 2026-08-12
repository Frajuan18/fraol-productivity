import type { PartnerPrivacySettings, UserStatus } from '@/src/types/collaboration';

/**
 * Pure privacy helpers shared by the Mongo and local adapters and the UI. All gates default
 * to "shared" when no settings document exists, mirroring DEFAULT_PARTNER_PRIVACY.
 */

export type PrivacyGate = 'shared' | 'private';

function isExplicitlyOff(value: boolean | null | undefined): boolean {
  return value === false;
}

/** True when the partner is allowed to see weekly statistics and productivity trends. */
export function hasShareStats(privacy: Pick<PartnerPrivacySettings, 'shareWeeklyStats'> | null | undefined): boolean {
  return !isExplicitlyOff(privacy?.shareWeeklyStats);
}

/** True when the partner is allowed to see the streak and weekly-change trends. */
export function hasShareStreak(privacy: Pick<PartnerPrivacySettings, 'shareStreak'> | null | undefined): boolean {
  return !isExplicitlyOff(privacy?.shareStreak);
}

/** True when the partner is allowed to see explicitly-shared personal plans. */
export function hasSharePlans(privacy: Pick<PartnerPrivacySettings, 'sharePlans'> | null | undefined): boolean {
  return !isExplicitlyOff(privacy?.sharePlans);
}

/** True when the partner is allowed to see whether this user is currently focusing. */
export function hasShareLiveFocus(privacy: Pick<PartnerPrivacySettings, 'shareLiveFocus'> | null | undefined): boolean {
  return !isExplicitlyOff(privacy?.shareLiveFocus);
}

/** True when the partner may upload new snapshots into the shared chat. */
export function hasShareSnapshots(
  privacy: { shareSnapshots?: boolean | null } | null | undefined,
): boolean {
  return !isExplicitlyOff(privacy?.shareSnapshots);
}

/**
 * Coerces a "focusing" status to "online" when live-focus sharing is disabled so a partner
 * can never observe an active focus session through presence. Other statuses pass through.
 */
export function maskFocusStatus(
  shareLiveFocus: boolean | null | undefined,
  status: UserStatus,
): UserStatus {
  if (shareLiveFocus === false && status === 'focusing') return 'online';
  return status;
}

/** The status rows shown in the Partner Privacy settings summary. */
export function privacySummary(
  privacy: Pick<PartnerPrivacySettings, 'shareWeeklyStats' | 'shareStreak' | 'shareLiveFocus' | 'shareSnapshots'> | null | undefined,
): { statistics: PrivacyGate; focusStatus: PrivacyGate; recentActivity: PrivacyGate; snapshots: PrivacyGate } {
  return {
    statistics: hasShareStats(privacy) ? 'shared' : 'private',
    focusStatus: hasShareLiveFocus(privacy) ? 'shared' : 'private',
    recentActivity: hasShareStreak(privacy) ? 'shared' : 'private',
    snapshots: hasShareSnapshots(privacy) ? 'shared' : 'private',
  };
}
