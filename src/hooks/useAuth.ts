import { useState, useCallback, useEffect } from 'react';
import { authService } from '@/services';
import type { User, LoginCredentials, SignupData } from '@/types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Auto-load user from token on mount
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      authService.getCurrentUser()
        .then((response) => {
          setUser(response.user);
          if (response.user.barbershopId) {
            localStorage.setItem('barbershop_id', String(response.user.barbershopId));
          }
          if (response.user.barberId) {
            localStorage.setItem('barber_id', String(response.user.barberId));
          }
        })
        .catch(() => {
          localStorage.removeItem('auth_token');
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    try {
      setLoading(true);
      setError(null);
      const response = await authService.login(credentials);
      setUser(response.user);
      localStorage.setItem('auth_token', response.token);
      if (response.user.barbershopId) {
        localStorage.setItem('barbershop_id', String(response.user.barbershopId));
      }
      if (response.user.barberId) {
        localStorage.setItem('barber_id', String(response.user.barberId));
      }
      return response.user;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const signup = useCallback(async (data: SignupData) => {
    try {
      setLoading(true);
      setError(null);
      const response = await authService.signup(data);
      setUser(response.user);
      return response;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  const getCurrentUser = useCallback(async () => {
    try {
      setLoading(true);
      const response = await authService.getCurrentUser();
      setUser(response.user);
      if (response.user.barbershopId) {
        localStorage.setItem('barbershop_id', String(response.user.barbershopId));
      }
      if (response.user.barberId) {
        localStorage.setItem('barber_id', String(response.user.barberId));
      }
      return response.user;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getRedirectPath = useCallback((userRole: string) => {
    switch (userRole) {
      case 'platform_owner': return '/platform-admin';
      case 'admin':
      case 'owner': return '/admin';
      case 'barber': return '/barbeiro';
      default: return '/';
    }
  }, []);

  return {
    user,
    loading,
    error,
    login,
    signup,
    logout,
    getCurrentUser,
    getRedirectPath,
    isAuthenticated: !!user,
  };
}
