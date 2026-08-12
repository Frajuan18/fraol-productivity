import type { DashboardLayout } from './types';
import { createDefaultLayout } from './layout';

/**
 * Client-side HTTP service for the local (JSON) dashboard layout. Mirrors the dataService
 * pattern used elsewhere: local mode persists the layout through /api/dashboard-layout;
 * MongoDB mode goes through the authenticated repository gateway instead.
 */
class DashboardLayoutService {
  private baseUrl = '/api/dashboard-layout';

  async load(): Promise<DashboardLayout> {
    try {
      const response = await fetch(this.baseUrl);
      if (response.ok) {
        return (await response.json()) as DashboardLayout;
      }
      return createDefaultLayout();
    } catch (error) {
      console.error('Failed to load dashboard layout:', error);
      return createDefaultLayout();
    }
  }

  async save(layout: DashboardLayout): Promise<boolean> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(layout),
      });
      return response.ok;
    } catch (error) {
      console.error('Failed to save dashboard layout:', error);
      return false;
    }
  }
}

export const dashboardLayoutService = new DashboardLayoutService();
