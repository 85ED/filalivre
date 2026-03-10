import { useState, useEffect } from 'react';
import { api } from '@/services/api';

interface SubscriptionInfo {
  subscriptionStatus: string;
  trialExpiresAt: string | null;
  blocked: boolean;
  daysRemaining: number | null;
}

export function useSubscription() {
  const [info, setInfo] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('barbershop_id');
    if (!stored) {
      setLoading(false);
      return;
    }
    const barbershopId = parseInt(stored);

    api
      .get<SubscriptionInfo>(`/barbershops/${barbershopId}/subscription`)
      .then(setInfo)
      .catch(() => setInfo(null))
      .finally(() => setLoading(false));
  }, []);

  return {
    loading,
    blocked: info?.blocked ?? false,
    subscriptionStatus: info?.subscriptionStatus ?? null,
    daysRemaining: info?.daysRemaining ?? null,
    trialExpiresAt: info?.trialExpiresAt ?? null,
  };
}
