import type { PlanCollaborationFields } from '@/src/types/collaboration';

export const PLAN_STATUS = {
  COMPLETED: 'completed',
  IN_PROGRESS: 'in-progress',
  PENDING: 'pending',
  NOT_STARTED: 'not-started',
} as const;

export type PlanStatus = (typeof PLAN_STATUS)[keyof typeof PLAN_STATUS];

export const PLAN_PRIORITY = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;

export type PlanPriority = (typeof PLAN_PRIORITY)[keyof typeof PLAN_PRIORITY];

export const PLAN_TYPE = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
} as const;

export type PlanTypeValue = (typeof PLAN_TYPE)[keyof typeof PLAN_TYPE];

export interface PlanFile {
  id: string;
  originalName: string;
  storedName: string;
  storagePath: string;
  mimeType: string;
  size: number;
  pageCount?: number;
  uploadedAt: string;
}

export interface Plan {
  id: number;
  title: string;
  description: string;
  type: PlanTypeValue;
  status: PlanStatus;
  date: string;
  priority: PlanPriority;
  category: string;
  file?: PlanFile | null;
  /**
   * Collaboration model (optional so existing local data and creation paths keep working):
   * - planType: 'personal' | 'common' (defaults to 'personal')
   * - visibility: 'private' | 'partner_shared' (defaults to 'private')
   * - ownerId / memberRole: identity + role when a multi-user backend is present
   */
  planType?: PlanCollaborationFields['planType'];
  visibility?: PlanCollaborationFields['visibility'];
  ownerId?: PlanCollaborationFields['ownerId'];
  memberRole?: PlanCollaborationFields['memberRole'];
  memberCount?: PlanCollaborationFields['memberCount'];
  updatedAt?: PlanCollaborationFields['updatedAt'];
}

export type NewPlan = Omit<Plan, 'id' | 'status' | 'date'>;

export const SESSION_STATUS = {
  COMPLETED: 'Completed',
  IN_PROGRESS: 'In Progress',
  MISSED: 'Missed',
} as const;

export type SessionStatus = (typeof SESSION_STATUS)[keyof typeof SESSION_STATUS];

export interface Session {
  id: number;
  task: string;
  duration: string;
  date: string;
  status: SessionStatus;
  startTime?: string;
  endTime?: string;
  actualDuration?: string;
  /** Cursor field for paginated history queries (createdAt of the underlying record). */
  createdAt?: string;
}

export interface Stats {
  focusTime: string;
  sessions: number;
  streak: string;
  productivity: string;
  totalFocusHours: number;
  weeklyStreak: number;
  dailyStreak: number;
}

export interface UserProfile {
  name: string;
  streak: number;
  totalFocusHours: number;
  taskTypes: string[];
}

export interface AppData {
  plans: Plan[];
  sessions: Session[];
  stats: Stats;
  user: UserProfile;
}

export interface BibleVerse {
  verse: string;
  reference: string;
}

export function isPlanStatus(value: unknown): value is PlanStatus {
  return typeof value === 'string' && (Object.values(PLAN_STATUS) as string[]).includes(value);
}

export function isSessionStatus(value: unknown): value is SessionStatus {
  return typeof value === 'string' && (Object.values(SESSION_STATUS) as string[]).includes(value);
}

export function isPlanPriority(value: unknown): value is PlanPriority {
  return typeof value === 'string' && (Object.values(PLAN_PRIORITY) as string[]).includes(value);
}

export function isPlanType(value: unknown): value is PlanTypeValue {
  return typeof value === 'string' && (Object.values(PLAN_TYPE) as string[]).includes(value);
}
