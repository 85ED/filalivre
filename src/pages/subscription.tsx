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
  Users,
} from 'lucide-react';

interface SubscriptionInfo {
  subscriptionStatus: string;
  trialExpiresAt: string | null;
  blocked: boolean;
  daysRemaining: number | null;
  seatPriceCents: number;
  activeCount: number;
  totalCents: number;
}

function getBarbershopId(): number {
  const stored = localStorage.getItem('barbershop_id');
  return stored ? parseInt(stored) : 0;
}

export function SubscriptionPage() {
  const { loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [info, setInfo] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const barbershopId = getBarbershopId();

  useEffect(() => {
    api
      .get<SubscriptionInfo>(`/barbershops/${barbershopId}/subscription`)
      .then(setInfo)
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
  const seatPrice = (info?.seatPriceCents ?? 3500) / 100;
  const activeCount = info?.activeCount ?? 0;
  const total = (info?.totalCents ?? 0) / 100;

  const handleCheckout = async () => {
    setCheckoutLoading(true);
    try {
      const data = await api.post<{ checkout_url: string }>('/subscription/checkout', {
        barbershopId,
      });
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      alert(err?.data?.error || err?.message || 'Erro ao iniciar checkout');
    } finally {
      setCheckoutLoading(false);
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
          <p className="text-neutral-500 text-sm">Modelo por profissional — pague apenas pelo que usa</p>
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

        {/* Per-seat pricing card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-purple-500" />
            <h2 className="font-bold text-neutral-900">Seu plano</h2>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-neutral-100">
              <span className="text-sm text-neutral-600">Profissionais ativos</span>
              <span className="font-bold text-neutral-900">{activeCount}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-neutral-100">
              <span className="text-sm text-neutral-600">Valor por profissional</span>
              <span className="font-bold text-neutral-900">R$ {seatPrice.toFixed(2)}/mês</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm font-semibold text-neutral-700">Total mensal</span>
              <span className="text-2xl font-bold text-purple-600">R$ {total.toFixed(2)}</span>
            </div>
          </div>

          {activeCount === 0 && (
            <p className="text-xs text-amber-600 mt-3">
              Cadastre pelo menos um profissional ativo para assinar.
            </p>
          )}

          {!isActive && activeCount > 0 && (
            <Button
              onClick={handleCheckout}
              className="w-full h-12 mt-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-xl text-base"
              disabled={checkoutLoading}
            >
              {checkoutLoading ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <CreditCard className="w-5 h-5 mr-2" />
              )}
              Assinar agora
            </Button>
          )}
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-neutral-50 rounded-2xl p-6"
        >
          <h3 className="font-semibold text-neutral-900 mb-3">O que está incluso</h3>
          <ul className="space-y-2 text-sm text-neutral-700">
            {[
              'Fila digital ilimitada',
              'Painel administrativo completo',
              'Relatórios e KPIs em tempo real',
              'Monitor público para clientes',
              'Notificações WhatsApp',
              'Cobrança proporcional ao crescimento',
            ].map((f) => (
              <li key={f} className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </motion.div>
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
