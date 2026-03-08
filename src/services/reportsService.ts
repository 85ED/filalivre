import { api } from './api';
import { API_ENDPOINTS, DEFAULT_BARBERSHOP_ID } from '@/config/api';

export interface ReportsData {
  period: string;
  totalFinished: number;
  avgTime: number;
  currentWaiting: number;
  byBarber: Array<{
    barber_id: number;
    barber_name: string;
    total: number;
  }>;
  dailyCounts: Array<{
    day: number;
    total: number;
  }>;
}

export interface BarberClientData {
  barberId: number;
  clients: Array<{
    id: number;
    name: string;
    phone: string | null;
    status: string;
    created_at: string;
    updated_at: string;
    finished_at: string | null;
  }>;
}

export const reportsService = {
  async getReports(barbershopId: number = DEFAULT_BARBERSHOP_ID, period: 'today' | 'week' | 'month' = 'today'): Promise<ReportsData> {
    return api.get<ReportsData>(`${API_ENDPOINTS.reports(barbershopId)}?period=${period}`);
  },

  async getBarberReport(barbershopId: number, barberId: number, period: 'today' | 'week' | 'month' = 'today'): Promise<BarberClientData> {
    return api.get<BarberClientData>(`${API_ENDPOINTS.barberReport(barbershopId, barberId)}?period=${period}`);
  },
};
