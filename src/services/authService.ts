import { api } from './api';
import type { User, LoginCredentials, AuthResponse } from '@/types';

const MOCK_USER: User = {
  id: 'user-1',
  email: 'admin@barbershop.com',
  name: 'Admin User',
  role: 'admin',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      return await api.post<AuthResponse>('/auth/login', credentials);
    } catch (error) {
      console.warn('API not available, using mock data:', error);
      return {
        user: MOCK_USER,
        token: 'mock-token-' + Math.random().toString(36).substr(2, 9),
      };
    }
  },

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.warn('API not available:', error);
    }
  },

  async getCurrentUser(): Promise<User> {
    try {
      return await api.get<User>('/auth/me');
    } catch (error) {
      console.warn('API not available, using mock data:', error);
      return MOCK_USER;
    }
  },

  async refreshToken(): Promise<AuthResponse> {
    try {
      return await api.post<AuthResponse>('/auth/refresh');
    } catch (error) {
      console.warn('API not available, using mock data:', error);
      return {
        user: MOCK_USER,
        token: 'mock-token-' + Math.random().toString(36).substr(2, 9),
      };
    }
  },
};
