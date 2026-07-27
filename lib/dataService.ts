// lib/dataService.ts
import type { AppData, Session, Plan } from '@/src/types';
import { getDefaultData } from '@/src/utils/defaults';

class DataService {
  private baseUrl = '/api/data';
  private defaultData: AppData = getDefaultData();

  async loadData(): Promise<AppData> {
    try {
      const response = await fetch(this.baseUrl);
      if (response.ok) {
        const data = await response.json();
        return data;
      }
      return this.defaultData;
    } catch (error) {
      console.error('Failed to load data:', error);
      return this.defaultData;
    }
  }

  async saveData(data: AppData): Promise<boolean> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      return response.ok;
    } catch (error) {
      console.error('Failed to save data:', error);
      return false;
    }
  }

  // Helper method to get default data structure
  getDefaultData(): AppData {
    return this.defaultData;
  }

  // Helper method to check if data exists
  async dataExists(): Promise<boolean> {
    try {
      const response = await fetch(this.baseUrl);
      if (response.ok) {
        const data = await response.json();
        return data && Object.keys(data).length > 0;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  // Helper method to clear all data
  async clearData(): Promise<boolean> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(this.defaultData),
      });
      return response.ok;
    } catch (error) {
      console.error('Failed to clear data:', error);
      return false;
    }
  }
}

export const dataService = new DataService();
