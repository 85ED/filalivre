import { useSubscription } from '@/hooks/useSubscription';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TrialGuardProps {
  children: React.ReactNode;
}

export function TrialGuard({ children }: TrialGuardProps) {
  const { blocked, loading } = useSubscription();
  const navigate = useNavigate();

  if (loading) return <>{children}</>;

  if (!blocked) return <>{children}</>;

  return (
    <div className="relative min-h-screen">
      {/* Blurred content */}
      <div className="filter blur-sm pointer-events-none select-none" aria-hidden="true">
        {children}
      </div>

      {/* Overlay */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-neutral-900">
            Período de avaliação encerrado
          </h2>
          <p className="text-neutral-600 text-sm">
            Seu trial de 7 dias expirou. Para continuar utilizando o FilaLivre,
            assine um plano.
          </p>
          <Button
            onClick={() => navigate('/assinatura')}
            className="w-full h-12 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-xl"
          >
            <CreditCard className="w-5 h-5 mr-2" />
            Ver planos e assinar
          </Button>
        </div>
      </div>
    </div>
  );
}
