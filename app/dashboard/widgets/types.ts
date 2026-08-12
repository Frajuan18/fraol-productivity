import type { DashboardBundle } from '@/lib/dashboard/useDashboard';
import type { PlanStatus } from '@/src/types';

export interface DashboardWidgetProps {
  bundle: DashboardBundle;
  onNavigateTab: (tab: string) => void;
  onUpdatePlanStatus?: (id: number, status: PlanStatus) => void;
}
