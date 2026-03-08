import { api } from './api';
import { API_ENDPOINTS, DEFAULT_BARBERSHOP_ID } from '@/config/api';
import type { QueueItem, CreateQueueItemDto } from '@/types';

interface BackendQueueItem {
  id: number;
  barbershop_id: number;
  name: string;
  barber_id: number | null;
  status: 'waiting' | 'called' | 'serving' | 'finished' | 'removed';
  position: number;
  created_at: string;
}

interface BackendQueueResponse {
  queue: BackendQueueItem[];
  stats: {
    total: number;
    waiting: number;
    serving: number;
    called: number;
  };
}

// Map backend response to frontend types
const mapBackendQueueItem = (item: BackendQueueItem): QueueItem => ({
  id: String(item.id),
  name: item.name,
  position: item.position,
  status: item.status as any,
  barberId: item.barber_id ? String(item.barber_id) : null,
  createdAt: item.created_at,
  updatedAt: item.created_at,
});

export const queueService = {
  async getQueue(barbershopId: number = DEFAULT_BARBERSHOP_ID): Promise<QueueItem[]> {
    try {
      const response = await api.get<BackendQueueResponse>(
        API_ENDPOINTS.queue(barbershopId)
      );
      return response.queue.map(mapBackendQueueItem);
    } catch (error) {
      console.error('Failed to fetch queue:', error);
      throw error;
    }
  },

  async getQueueItem(id: string, barbershopId: number = DEFAULT_BARBERSHOP_ID): Promise<QueueItem> {
    try {
      const queue = await this.getQueue(barbershopId);
      const item = queue.find((q) => q.id === id);
      if (!item) throw new Error('Queue item not found');
      return item;
    } catch (error) {
      console.error('Failed to fetch queue item:', error);
      throw error;
    }
  },

  async joinQueue(data: { name: string; barbershopId?: number; barberId?: string | null; phone?: string | null }): Promise<QueueItem & { token: string }> {
    try {
      const payload: Record<string, unknown> = {
        barbershopId: data.barbershopId || DEFAULT_BARBERSHOP_ID,
        clientName: data.name,
      };
      if (data.barberId) {
        payload.barberId = parseInt(data.barberId);
      }
      if (data.phone) {
        payload.phone = data.phone;
      }
      const response = await api.post<any>(
        API_ENDPOINTS.joinQueue,
        payload
      );
      // A resposta de joinQueue não segue o padrão BackendQueueItem, então mapeamos manualmente
      return {
        id: String(response.id),
        name: response.name,
        position: response.position,
        status: response.status as any,
        barberId: response.barber_id ? String(response.barber_id) : null,
        createdAt: response.created_at || new Date().toISOString(),
        updatedAt: response.created_at || new Date().toISOString(),
        token: response.token || response.queue_token,
      };
    } catch (error) {
      console.error('Failed to join queue:', error);
      throw error;
    }
  },

  async recoverByToken(token: string): Promise<QueueItem & { token: string }> {
    try {
      const response = await api.get<any>(
        `${API_ENDPOINTS.joinQueue.replace('/join', '')}/recover?token=${token}`
      );
      return {
        id: String(response.id),
        name: response.name,
        position: response.position,
        status: response.status as any,
        barberId: response.barber_id ? String(response.barber_id) : null,
        createdAt: response.created_at || new Date().toISOString(),
        updatedAt: response.created_at || new Date().toISOString(),
        token: response.token || response.queue_token,
      };
    } catch (error) {
      console.error('Failed to recover queue by token:', error);
      throw error;
    }
  },

  async removeFromQueue(
    id: string,
    barbershopId: number = DEFAULT_BARBERSHOP_ID
  ): Promise<void> {
    try {
      await api.post(API_ENDPOINTS.removeFromQueue, {
        queueId: parseInt(id),
        barbershopId,
      });
    } catch (error) {
      console.error('Failed to remove from queue:', error);
      throw error;
    }
  },

  async skipClient(
    id: string,
    barbershopId: number = DEFAULT_BARBERSHOP_ID
  ): Promise<void> {
    try {
      await api.post(API_ENDPOINTS.skipClient, {
        queueId: parseInt(id),
        barbershopId,
      });
    } catch (error) {
      console.error('Failed to skip client:', error);
      throw error;
    }
  },

  async callNext(
    barberId: string,
    barbershopId: number = DEFAULT_BARBERSHOP_ID
  ): Promise<QueueItem | null> {
    try {
      const response = await api.post<{ client: BackendQueueItem | null }>(
        API_ENDPOINTS.callNext,
        {
          barberId: parseInt(barberId),
          barbershopId,
        }
      );
      return response.client ? mapBackendQueueItem(response.client) : null;
    } catch (error) {
      console.error('Failed to call next client:', error);
      throw error;
    }
  },

  async finishClient(
    barberId: string,
    barbershopId: number = DEFAULT_BARBERSHOP_ID
  ): Promise<{ finished: boolean; nextClient: QueueItem | null }> {
    try {
      const response = await api.post<{
        finished: boolean;
        nextClient: BackendQueueItem | null;
      }>(API_ENDPOINTS.finishClient, {
        barberId: parseInt(barberId),
        barbershopId,
      });
      return {
        finished: response.finished,
        nextClient: response.nextClient ? mapBackendQueueItem(response.nextClient) : null,
      };
    } catch (error) {
      console.error('Failed to finish client:', error);
      throw error;
    }
  },
};
