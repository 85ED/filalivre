import { useState, useEffect, useCallback, useRef } from 'react';
import { queueService } from '@/services';
import type { QueueItem, CreateQueueItemDto } from '@/types';

export function useQueue(barbershopId: number, autoRefresh = false, refreshInterval = 10000) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const initialLoadDone = useRef(false);

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

  const joinQueue = useCallback(async (data: CreateQueueItemDto) => {
    try {
      const newItem = await queueService.joinQueue({ ...data, barbershopId });
      setQueue((prev) => [...prev, newItem]);
      return newItem;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [barbershopId]);

  const removeFromQueue = useCallback(async (id: string) => {
    try {
      await queueService.removeFromQueue(id, barbershopId);
      setQueue((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [barbershopId]);

  const callNext = useCallback(async (barberId: string) => {
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
  }, [barbershopId, fetchQueue]);

  const finishClient = useCallback(async (barberId: string) => {
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
  }, [barbershopId, fetchQueue]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

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
    refetch: fetchQueue,
    joinQueue,
    removeFromQueue,
    callNext,
    finishClient,
  };
}
