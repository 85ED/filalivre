import { useState, useEffect, useCallback, useRef } from 'react';
import { barberService } from '@/services';
import { DEFAULT_BARBERSHOP_ID } from '@/config/api';
import type { Barber } from '@/types';

export function useBarbers(barbershopId: number = DEFAULT_BARBERSHOP_ID, autoRefresh = false, refreshInterval = 10000) {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const initialLoadDone = useRef(false);

  const fetchBarbers = useCallback(async () => {
    try {
      if (!initialLoadDone.current) setLoading(true);
      const data = await barberService.getBarbers(barbershopId);
      setBarbers(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      if (!initialLoadDone.current) {
        initialLoadDone.current = true;
        setLoading(false);
      }
    }
  }, [barbershopId]);

  useEffect(() => {
    fetchBarbers();
  }, [fetchBarbers]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchBarbers, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, fetchBarbers]);

  return {
    barbers,
    loading,
    error,
    refetch: fetchBarbers,
  };
}
