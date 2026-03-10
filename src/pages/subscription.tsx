import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import {
  CreditCard,
  Clock,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  Loader2,
  Sparkles,
} from 'lucide-react';

interface SubscriptionInfo {
  subscriptionStatus: string;
  trialExpiresAt: string | null;
  blocked: boolean;
  daysRemaining: number | null;
}

interface Plan {
  id: number;
  name: string;
  price_cents: number;
  interval: 'monthly' | 'yearly';
  features: string[] | null;
}

function getBarbershopId(): number {
  const stored = localStorage.getItem('barbershop_id');
  return stored ? parseInt(stored) : 0;
}

export function SubscriptionPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [info, setInfo] = useState<SubscriptionInfo | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<number | null>(null);

  const barbershopId = getBarbershopId();

  useEffect(() => {
    Promise.all([
      api.get<SubscriptionInfo>(`/barbershops/${barbershopId}/subscription`),
      api.get<{ plans: Plan[] }>('/plans'),
    ])
      .then(([subInfo, plansData]) => {
        setInfo(subInfo);
        setPlans(plansData.plans);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [barbershopId]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  const isTrial = info?.subscriptionStatus === 'trial';
  const isActive = info?.subscriptionStatus === 'active';
  const isBlocked = info?.blocked;

  const handleCheckout = async (planId: number) => {
    setCheckoutLoading(planId);
    try {
      const data = await api.post<{ checkout_url: string }>('/subscription/checkout', {
        planId,
        barbershopId,
      });
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      alert(err?.data?.error || err?.message || 'Erro ao iniciar checkout');
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handlePortal = async () => {
    try {
      const data = await api.post<{ portal_url: string }>('/subscription/portal', {});
      if (data.portal_url) {
        window.location.href = data.portal_url;
      }
    } catch (err: any) {
      console.error('Portal error:', err);
      alert(err?.data?.error || err?.message || 'Erro ao abrir portal');
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex-1 max-w-lg mx-auto px-4 py-8 space-y-6 w-full">
        {/* Back */}
        <button
          onClick={() => navigate('/admin')}
          className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-700"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar ao painel
        </button>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-2"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mx-auto">
            <CreditCard className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-neutral-900">Assinatura</h1>
          <p className="text-neutral-500 text-sm">Gerencie seu plano FilaLivre</p>
        </motion.div>

        {/* Status Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className={`rounded-2xl p-6 border-2 ${
            isBlocked
              ? 'bg-red-50 border-red-200'
              : isActive
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-blue-50 border-blue-200'
          }`}
        >
          <div className="flex items-center gap-3 mb-4">
            {isBlocked ? (
              <AlertTriangle className="w-6 h-6 text-red-600" />
            ) : isActive ? (
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            ) : (
              <Clock className="w-6 h-6 text-blue-600" />
            )}
            <div>
              <p className="font-bold text-neutral-900 text-lg">
                {isBlocked
                  ? 'Trial expirado'
                  : isActive
                  ? 'Assinatura ativa'
                  : 'Período de avaliação'}
              </p>
              <p className="text-sm text-neutral-600">
                {isBlocked
                  ? 'Seu período de avaliação terminou. Assine para continuar.'
                  : isActive
                  ? 'Seu plano está ativo e funcionando.'
                  : `Você tem ${info?.daysRemaining ?? 0} dia${(info?.daysRemaining ?? 0) !== 1 ? 's' : ''} restante${(info?.daysRemaining ?? 0) !== 1 ? 's' : ''} de avaliação gratuita.`}
              </p>
            </div>
          </div>

          {isTrial && !isBlocked && info?.daysRemaining != null && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold text-neutral-600">
                <span>Progresso do trial</span>
                <span>{7 - info.daysRemaining}/7 dias</span>
              </div>
              <div className="h-2 w-full bg-white rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all"
                  style={{ width: `${((7 - info.daysRemaining) / 7) * 100}%` }}
                />
              </div>
            </div>
          )}
        </motion.div>

        {/* Manage subscription button (active only) */}
        {isActive && (
          <Button
            onClick={handlePortal}
            variant="outline"
            className="w-full h-12 rounded-xl font-semibold"
          >
            Gerenciar assinatura
          </Button>
        )}

        {/* Plans */}
        {plans.map((plan, i) => (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
            className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm"
          >
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-purple-500" />
              <h2 className="font-bold text-neutral-900">{plan.name}</h2>
            </div>
            <p className="text-2xl font-bold text-neutral-900 mb-4">
              R$ {(plan.price_cents / 100).toFixed(2)}
              <span className="text-sm font-normal text-neutral-500">/{plan.interval === 'monthly' ? 'mês' : 'ano'}</span>
            </p>
            {plan.features && plan.features.length > 0 && (
              <ul className="space-y-2 text-sm text-neutral-700 mb-6">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            )}
            <Button
              onClick={() => !isActive && handleCheckout(plan.id)}
              className="w-full h-12 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-xl text-base"
              disabled={isActive || checkoutLoading === plan.id}
            >
              {checkoutLoading === plan.id ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <CreditCard className="w-5 h-5 mr-2" />
              )}
              {isActive ? 'Plano ativo' : 'Assinar agora'}
            </Button>
          </motion.div>
        ))}

        {plans.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm text-center"
          >
            <Sparkles className="w-8 h-8 text-purple-400 mx-auto mb-2" />
            <p className="text-neutral-600 text-sm">Planos de assinatura estarão disponíveis em breve.</p>
          </motion.div>
        )}
      </div>

      {/* Footer */}
      <footer className="py-6 border-t border-neutral-100 mt-auto">
        <p className="text-center text-xs text-neutral-400">
          FilaLivre &copy; Sistema inteligente de fila de atendimento
        </p>
      </footer>
    </div>
  );
}
