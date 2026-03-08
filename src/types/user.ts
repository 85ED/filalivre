export type UserRole = 'platform_owner' | 'admin' | 'barber' | 'owner' | 'client';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  barbershopId?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface SignupData {
  establishmentName: string;
  name: string;
  email: string;
  password: string;
  phone?: string;
}

export interface SignupResponse {
  user: User;
  token: string;
  barbershop: {
    id: number;
    name: string;
    slug: string;
    trialExpiresAt: string;
  };
}
