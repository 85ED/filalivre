import { api } from './api';
import { API_ENDPOINTS, DEFAULT_BARBERSHOP_ID } from '@/config/api';
import type { Barber } from '@/types';

interface BackendBarber {
  id: number;
  barbershop_id: number;
  name: string;
  status: string;
  created_at: string;
}

export const barberService = {
  async getBarbers(barbershopId: number = DEFAULT_BARBERSHOP_ID): Promise<Barber[]> {
    try {
      const response = await api.get<{ barbers: BackendBarber[] }>(
        API_ENDPOINTS.barbers(barbershopId)
      );
      return response.barbers.map((barber: BackendBarber) => ({
        id: String(barber.id),
        name: barber.name,
        status: barber.status as any,
        currentClientId: null,
        createdAt: barber.created_at,
        updatedAt: barber.created_at,
      }));
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
      return response.barbers.map((barber: BackendBarber) => ({
        id: String(barber.id),
        name: barber.name,
        status: barber.status as any,
        currentClientId: null,
        createdAt: barber.created_at,
        updatedAt: barber.created_at,
      }));
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
      return {
        id: String(response.id),
        name: response.name,
        status: response.status as any,
        currentClientId: null,
        createdAt: response.created_at,
        updatedAt: response.created_at,
      };
    } catch (error) {
      console.error('Failed to update barber status:', error);
      throw error;
    }
  },
};
