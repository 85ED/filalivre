export type BarberStatus = 'available' | 'serving' | 'paused';

export interface Barber {
  id: string;
  name: string;
  photoUrl: string | null;
  role: string | null;
  active: boolean;
  status: BarberStatus;
  currentClientId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBarberDto {
  name: string;
  photo_url?: string | null;
  role?: string | null;
  active?: boolean;
}

export interface UpdateBarberDto {
  name?: string;
  photo_url?: string | null;
  role?: string | null;
  active?: boolean;
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
