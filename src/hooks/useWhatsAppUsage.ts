import { useState, useCallback, useEffect } from 'react';
import { api } from '@/services/api';

export interface WhatsAppUsageStats {
  used: number;
  limit: number;
  extra_credits: number;
  total_available: number;
  percentage: number;
  can_send: boolean;
  alert: {
    active: boolean;
    threshold: number;
    message: string | null;
  };
}

export interface BuyCreditsResponse {
  success: boolean;
  data: {
    url: string;
    sessionId: string;
  };
}

interface UsageApiResponse {
  success: boolean;
  data: WhatsAppUsageStats;
}

export function useWhatsAppUsage() {
  const [stats, setStats] = useState<WhatsAppUsageStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [buyingCredits, setBuyingCredits] = useState(false);

  // Fetch usage stats
  const fetchUsage = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      const response = await api.get<UsageApiResponse>('/whatsapp/usage');
      setStats(response.data);
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err : new Error('Failed to fetch usage'));
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  // Auto-fetch on mount
  useEffect(() => {
    fetchUsage(false);
  }, [fetchUsage]);

  // Polling leve para manter o contador “em tempo real” no dashboard
  useEffect(() => {
    const id = window.setInterval(() => {
      fetchUsage(true);
    }, 15000);
    return () => window.clearInterval(id);
  }, [fetchUsage]);

  // Buy credits
  const buyCredits = useCallback(async (packageQuantity: '100' | '250' | '700') => {
    try {
      setBuyingCredits(true);
      setError(null);
      const response = await api.post<BuyCreditsResponse>('/whatsapp/buy-credits', {
        package: packageQuantity,
      });

      // Redirecionar para Stripe Checkout
      if (response.data?.url) {
        // Usar setTimeout para garantir que a transação foi iniciada
        setTimeout(() => {
          window.location.href = response.data.url;
        }, 500);
      }

      return response;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to buy credits');
      setError(error);
      throw error;
    } finally {
      setBuyingCredits(false);
    }
  }, []);

  return {
    stats,
    loading,
    error,
    buyingCredits,
    refetch: () => fetchUsage(false),
    buyCredits,
  };
}
