import { api } from './api';
import { API_ENDPOINTS, DEFAULT_BARBERSHOP_ID } from '@/config/api';
import type { Barber } from '@/types';

interface BackendBarber {
  id: number;
  barbershop_id: number;
  name: string;
  photo_url: string | null;
  role: string | null;
  active: boolean;
  status: string;
  created_at: string;
}

const mapBarber = (barber: BackendBarber): Barber => ({
  id: String(barber.id),
  name: barber.name,
  photoUrl: barber.photo_url || null,
  role: barber.role || null,
  active: barber.active !== undefined ? Boolean(barber.active) : true,
  status: barber.status as any,
  currentClientId: null,
  createdAt: barber.created_at,
  updatedAt: barber.created_at,
});

export const barberService = {
  async getBarbers(barbershopId: number = DEFAULT_BARBERSHOP_ID): Promise<Barber[]> {
    try {
      const response = await api.get<{ barbers: BackendBarber[] }>(
        API_ENDPOINTS.barbers(barbershopId)
      );
      return response.barbers.map(mapBarber);
    } catch (error) {
      console.error('Failed to fetch barbers:', error);
      throw error;
    }
  },

  async getAvailableBarbers(barbershopId: number = DEFAULT_BARBERSHOP_ID): Promise<Barber[]> {
    try {
      const response = await api.get<{ barbers: BackendBarber[] }>(
        API_ENDPOINTS.availableBarbers(barbershopId)
      );
      return response.barbers.map(mapBarber);
    } catch (error) {
      console.error('Failed to fetch available barbers:', error);
      throw error;
    }
  },

  async updateStatus(barberId: string, status: 'available' | 'paused'): Promise<Barber> {
    try {
      const response = await api.patch<BackendBarber>(
        API_ENDPOINTS.updateBarberStatus,
        { barberId: parseInt(barberId), status }
      );
      return mapBarber(response);
    } catch (error) {
      console.error('Failed to update barber status:', error);
      throw error;
    }
  },

  async createBarber(barbershopId: number, data: { name: string; photo_url?: string | null; role?: string | null; active?: boolean }): Promise<Barber> {
    try {
      const response = await api.post<BackendBarber>('/barbers', {
        barbershopId,
        ...data,
      });
      return mapBarber(response);
    } catch (error) {
      console.error('Failed to create barber:', error);
      throw error;
    }
  },

  async updateBarber(barberId: string, data: { name?: string; photo_url?: string | null; role?: string | null; active?: boolean }): Promise<Barber> {
    try {
      const response = await api.patch<BackendBarber>(`/barbers/${barberId}`, data);
      return mapBarber(response);
    } catch (error) {
      console.error('Failed to update barber:', error);
      throw error;
    }
  },

  async deleteBarber(barberId: string): Promise<void> {
    try {
      await api.delete(`/barbers/${barberId}`);
    } catch (error) {
      console.error('Failed to delete barber:', error);
      throw error;
    }
  },
};
