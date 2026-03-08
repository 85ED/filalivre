export type BarberStatus = 'available' | 'serving' | 'paused';

export interface Barber {
  id: string;
  name: string;
  status: BarberStatus;
  currentClientId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBarberDto {
  name: string;
}

export interface UpdateBarberDto {
  name?: string;
  status?: BarberStatus;
  currentClientId?: string | null;
}

export interface BarberStats {
  barberId: string;
  barberName: string;
  clientsToday: number;
  averageTime: number;
  status: BarberStatus;
}
