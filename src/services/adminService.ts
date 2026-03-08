import { api } from './api';

export interface DashboardStats {
  clientsToday: number;
  clientsInQueue: number;
  averageWaitTime: number;
}

const MOCK_STATS: DashboardStats = {
  clientsToday: 42,
  clientsInQueue: 7,
  averageWaitTime: 23,
};

export const adminService = {
  async getDashboardStats(): Promise<DashboardStats> {
    try {
      return await api.get<DashboardStats>('/admin/stats');
    } catch (error) {
      console.warn('API not available, using mock data:', error);
      return MOCK_STATS;
    }
  },

  async resetQueue(): Promise<void> {
    try {
      await api.post('/admin/queue/reset');
    } catch (error) {
      console.warn('API not available:', error);
    }
  },
};
