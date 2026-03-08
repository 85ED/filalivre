import { useState, useEffect, useCallback, useRef } from 'react';
import { queueService } from '@/services';
import { tokenService } from '@/services/tokenService';
import { DEFAULT_BARBERSHOP_ID } from '@/config/api';
import type { QueueItem, CreateQueueItemDto } from '@/types';

interface UseQueueWithTokenOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

/**
 * Hook aprimorado que gerencia fila com persistência de token
 * Permite que clientes recuperem sua posição após refresh de página
 */
export function useQueueWithToken(
  barbershopId: number = DEFAULT_BARBERSHOP_ID,
  options: UseQueueWithTokenOptions = {}
) {
  const { autoRefresh = false, refreshInterval = 10000 } = options;

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [clientQueueItem, setClientQueueItem] = useState<(QueueItem & { token: string }) | null>(null);
  const initialLoadDone = useRef(false);

  // Recuperar cliente por token se existir
  const recoverFromToken = useCallback(async () => {
    try {
      const validToken = tokenService.getValidToken();
      if (validToken) {
        const item = await queueService.recoverByToken(validToken.token);
        setClientQueueItem(item);
        return item;
      }
    } catch (err) {
      console.error('Failed to recover from token:', err);
      tokenService.clearToken();
    }
    return null;
  }, []);

  const fetchQueue = useCallback(async () => {
    try {
      if (!initialLoadDone.current) setLoading(true);
      const data = await queueService.getQueue(barbershopId);
      setQueue(data);
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

  const joinQueue = useCallback(
    async (data: CreateQueueItemDto) => {
      try {
        const newItem = await queueService.joinQueue({ ...data, barbershopId });
        
        // Salvar token no localStorage com expiração de 2 horas
        if (newItem.token) {
          const expiresAt = new Date();
          expiresAt.setHours(expiresAt.getHours() + 2);
          
          tokenService.saveToken(
            newItem.token,
            barbershopId,
            expiresAt.toISOString()
          );
          setClientQueueItem(newItem as any);
        }

        setQueue((prev) => [...prev, newItem]);
        return newItem;
      } catch (err) {
        setError(err as Error);
        throw err;
      }
    },
    [barbershopId]
  );

  const removeFromQueue = useCallback(
    async (id: string) => {
      try {
        // Usar token do cliente atual OU recuperar do tokenService
        const token = clientQueueItem?.token || tokenService.getToken() || undefined;
        await queueService.removeFromQueue(id, barbershopId, token);
        setQueue((prev) => prev.filter((item) => item.id !== id));
        
        // Limpar token se for o cliente atual
        if (clientQueueItem?.id === id) {
          tokenService.clearToken();
          setClientQueueItem(null);
        }
      } catch (err) {
        setError(err as Error);
        throw err;
      }
    },
    [barbershopId, clientQueueItem]
  );

  const callNext = useCallback(
    async (barberId: string) => {
      try {
        const nextItem = await queueService.callNext(barberId, barbershopId);
        if (nextItem) {
          await fetchQueue();
        }
        return nextItem;
      } catch (err) {
        setError(err as Error);
        throw err;
      }
    },
    [barbershopId, fetchQueue]
  );

  const finishClient = useCallback(
    async (barberId: string) => {
      try {
        const result = await queueService.finishClient(barberId, barbershopId);
        if (result.finished) {
          await fetchQueue();
        }
        return result;
      } catch (err) {
        setError(err as Error);
        throw err;
      }
    },
    [barbershopId, fetchQueue]
  );

  // Carregar cliente do token ao montar o componente
  useEffect(() => {
    recoverFromToken();
    fetchQueue();
  }, [recoverFromToken, fetchQueue]);

  // Auto-refresh se ativado
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchQueue, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, fetchQueue]);

  return {
    queue,
    loading,
    error,
    clientQueueItem,
    refetch: fetchQueue,
    recover: recoverFromToken,
    joinQueue,
    removeFromQueue,
    callNext,
    finishClient,
  };
}
