export type QueueStatus = 'waiting' | 'called' | 'serving' | 'finished';

export interface QueueItem {
  id: string;
  name: string;
  position: number;
  status: QueueStatus;
  barberId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateQueueItemDto {
  name: string;
  barberId?: string | null;
  phone?: string | null;
}

export interface UpdateQueueItemDto {
  status?: QueueStatus;
  position?: number;
  barberId?: string | null;
}
