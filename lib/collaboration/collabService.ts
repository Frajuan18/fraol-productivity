import type { CollabData } from '@/src/types/collaboration';
import { getDefaultCollabData } from '@/src/validators/collaboration';

class CollabService {
  private baseUrl = '/api/collaboration';
  private defaultData: CollabData = getDefaultCollabData();

  async loadData(): Promise<CollabData> {
    try {
      const response = await fetch(this.baseUrl);
      if (response.ok) {
        const data = (await response.json()) as CollabData;
        return data;
      }
      return this.defaultData;
    } catch (error) {
      console.error('Failed to load collaboration data:', error);
      return this.defaultData;
    }
  }

  async saveData(data: CollabData): Promise<boolean> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return response.ok;
    } catch (error) {
      console.error('Failed to save collaboration data:', error);
      return false;
    }
  }

  async clearData(): Promise<boolean> {
    try {
      const response = await fetch(this.baseUrl, { method: 'DELETE' });
      return response.ok;
    } catch (error) {
      console.error('Failed to clear collaboration data:', error);
      return false;
    }
  }
}

export const collabService = new CollabService();
