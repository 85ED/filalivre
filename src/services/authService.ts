import { api } from './api';
import type { User, LoginCredentials, AuthResponse, SignupData, SignupResponse } from '@/types';

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const result = await api.post<AuthResponse>('/auth/login', credentials);
    localStorage.setItem('auth_token', result.token);
    return result;
  },

  async logout(): Promise<void> {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    localStorage.removeItem('barbershop_id');
    localStorage.removeItem('barber_id');
  },

  async getCurrentUser(): Promise<{ user: User }> {
    return api.get<{ user: User }>('/auth/me');
  },

  async signup(data: SignupData): Promise<SignupResponse> {
    const result = await api.post<SignupResponse>('/auth/signup', data);
    localStorage.setItem('auth_token', result.token);
    localStorage.setItem('barbershop_id', String(result.barbershop.id));
    return result;
  },

  getStoredToken(): string | null {
    return localStorage.getItem('auth_token');
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem('auth_token');
  },
};
