import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/services/api';
import { API_ENDPOINTS, DEFAULT_BARBERSHOP_ID } from '@/config/api';
import type { QueueItem } from '@/types';
import type { Barber } from '@/types';

interface BackendBarber {
  id: number;
  barbershop_id: number;
  name: string;
  status: string;
  current_client_id: number | null;
  created_at: string;
  updated_at: string;
}

interface BackendQueueItem {
  id: number;
  barbershop_id: number;
  name: string;
  phone: string | null;
  barber_id: number | null;
  status: string;
  position: number;
  created_at: string;
  updated_at: string;
}

interface StatusResponse {
  barbers: BackendBarber[];
  queue: BackendQueueItem[];
  stats: {
    total: number;
    waiting: number;
    serving: number;
    called: number;
  };
}

const mapBarber = (b: BackendBarber): Barber => ({
  id: String(b.id),
  name: b.name,
  status: b.status as any,
  currentClientId: b.current_client_id ? String(b.current_client_id) : null,
  createdAt: b.created_at,
  updatedAt: b.updated_at || b.created_at,
});

const mapQueueItem = (q: BackendQueueItem): QueueItem => ({
  id: String(q.id),
  name: q.name,
  position: q.position,
  status: q.status as any,
  barberId: q.barber_id ? String(q.barber_id) : null,
  createdAt: q.created_at,
  updatedAt: q.updated_at || q.created_at,
});

export function useBarbershopStatus(
  barbershopId: number = DEFAULT_BARBERSHOP_ID,
  refreshInterval = 10000
) {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState({ total: 0, waiting: 0, serving: 0, called: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);
  const initialLoadDone = useRef(false);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.get<StatusResponse>(
        API_ENDPOINTS.barbershopStatus(barbershopId)
      );
      if (!mountedRef.current) return;

      // Atualiza silenciosamente sem causar loading/flicker
      setBarbers(data.barbers.map(mapBarber));
      setQueue(data.queue.map(mapQueueItem));
      setStats({
        total: data.stats.total || 0,
        waiting: data.stats.waiting || 0,
        serving: data.stats.serving || 0,
        called: data.stats.called || 0,
      });
      setError(null);

      if (!initialLoadDone.current) {
        initialLoadDone.current = true;
        setLoading(false);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err as Error);
      if (!initialLoadDone.current) {
        initialLoadDone.current = true;
        setLoading(false);
      }
    }
  }, [barbershopId]);

  useEffect(() => {
    mountedRef.current = true;
    fetchStatus();

    const interval = setInterval(fetchStatus, refreshInterval);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchStatus, refreshInterval]);

  return { barbers, queue, stats, loading, error, refetch: fetchStatus };
}
