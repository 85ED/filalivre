import { AlertCircle, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useWhatsAppUsage } from '@/hooks/useWhatsAppUsage';

interface WhatsAppUsageCardProps {
  onBuyCreditsClick?: () => void;
}

export function WhatsAppUsageCard({ onBuyCreditsClick }: WhatsAppUsageCardProps) {
  const { stats, loading, error } = useWhatsAppUsage();

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Notificações WhatsApp
          </CardTitle>
          <CardDescription>Carregando...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error || !stats) {
    return (
      <Card className="w-full border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700">
            <AlertCircle className="w-5 h-5" />
            Notificações WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600">
            Erro ao carregar estatísticas: {error?.message || 'Unknown error'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            <CardTitle>Notificações WhatsApp</CardTitle>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{stats.percentage}%</p>
            <p className="text-xs text-muted-foreground">Uso deste mês</p>
          </div>
        </div>
        <CardDescription>
          {stats.used} de {stats.total_available} notificações disponíveis
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress 
            value={Math.min(stats.percentage, 100)} 
            className="h-3"
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Limite mensal: {stats.limit}</span>
            <span>Extra: {stats.extra_credits}</span>
          </div>
        </div>

        {/* Alert when >= 80% */}
        {stats.alert.active && (
          <Alert className="border-amber-200 bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              {stats.alert.message}
            </AlertDescription>
          </Alert>
        )}

        {/* Status */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-muted-foreground">Utilizadas</p>
            <p className="text-lg font-semibold">{stats.used}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-muted-foreground">Restantes</p>
            <p className="text-lg font-semibold text-green-600">
              {stats.total_available - stats.used}
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-muted-foreground">Status</p>
            <p className={`text-lg font-semibold ${stats.can_send ? 'text-green-600' : 'text-red-600'}`}>
              {stats.can_send ? 'Ativo' : 'Limite'}
            </p>
          </div>
        </div>

        {/* Estimativa de dias restantes */}
        {stats.can_send && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
            <p className="text-xs text-blue-600 font-medium">Estimativa de uso</p>
            <p className="text-sm text-blue-800 mt-1">
              {stats.total_available - stats.used} notificações restantes
              <br />
              <span className="text-xs text-blue-600">
                (~{Math.ceil((stats.total_available - stats.used) / 30)} dias)
              </span>
            </p>
          </div>
        )}

        {/* CTA Button - show when >= 70% or limit reached */}
        {(stats.percentage >= 70 || !stats.can_send) && (
          <Button
            onClick={onBuyCreditsClick}
            className="w-full"
            variant={!stats.can_send ? 'destructive' : stats.percentage >= 80 ? 'default' : 'outline'}
          >
            {!stats.can_send ? 'Limite atingido — Comprar créditos' : 'Comprar créditos adicionais'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
