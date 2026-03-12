import { useState } from 'react';
import { AlertCircle, Loader2, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useWhatsAppUsage } from '@/hooks/useWhatsAppUsage';

export const CREDIT_PACKAGES = [
  {
    quantity: '100',
    name: '100 Notificações',
    description: '~1 semana de uso (15 notificações/dia)',
    price: 10.00,
    priceFormatted: 'R$ 10,00',
    recommended: false,
  },
  {
    quantity: '300',
    name: '300 Notificações',
    description: '~3 semanas de uso (45 notificações/dia)',
    price: 20.00,
    priceFormatted: 'R$ 20,00',
    recommended: true,
  },
  {
    quantity: '1000',
    name: '1000 Notificações',
    description: '~2 meses de uso (150 notificações/dia)',
    price: 50.00,
    priceFormatted: 'R$ 50,00',
    recommended: false,
  },
];

interface BuyCreditsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BuyCreditsModal({ open, onOpenChange }: BuyCreditsModalProps) {
  const [selectedPackage, setSelectedPackage] = useState<'100' | '300' | '1000'>('300');
  const [isProcessing, setIsProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { buyCredits, buyingCredits, error } = useWhatsAppUsage();

  const selectedPackageData = CREDIT_PACKAGES.find(p => p.quantity === selectedPackage);

  const handlePurchase = async () => {
    try {
      setIsProcessing(true);
      setErrorMessage(null);
      setSuccess(false);

      await buyCredits(selectedPackage as '100' | '300' | '1000');

      // Sucesso - mostrar mensagem
      setSuccess(true);
      
      // Fechar após 2 segundos
      setTimeout(() => {
        onOpenChange(false);
        setSuccess(false);
        setSelectedPackage('300');
      }, 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao processar compra';
      setErrorMessage(message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Comprar Créditos WhatsApp</DialogTitle>
          <DialogDescription>
            Escolha um pacote e aumente suas notificações mensais
          </DialogDescription>
        </DialogHeader>

        {success ? (
          // Success State
          <div className="flex flex-col items-center justify-center space-y-4 py-8">
            <div className="rounded-full bg-green-100 p-3">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <div className="text-center space-y-2">
              <p className="font-semibold text-lg">Compra realizada com sucesso!</p>
              <p className="text-sm text-muted-foreground">
                {selectedPackageData?.name} foram adicionados à sua conta
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Error Alert */}
            {(error || errorMessage) && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {errorMessage || error?.message || 'Erro ao processar compra. Tente novamente.'}
                </AlertDescription>
              </Alert>
            )}

            {/* Package Selection */}
            <div className="space-y-3">
              {CREDIT_PACKAGES.map((pkg) => (
                <button
                  key={pkg.quantity}
                  onClick={() => setSelectedPackage(pkg.quantity as '100' | '300' | '1000')}
                  className={`w-full rounded-lg border-2 p-4 text-left transition-all ${
                    selectedPackage === pkg.quantity
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{pkg.name}</p>
                        {pkg.recommended && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                            Recomendado
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{pkg.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">{pkg.priceFormatted}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Summary */}
            {selectedPackageData && (
              <div className="rounded-lg bg-slate-50 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pacote selecionado:</span>
                  <span className="font-semibold">{selectedPackageData.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Preço:</span>
                  <span className="font-semibold">{selectedPackageData.priceFormatted}</span>
                </div>
                <div className="border-t pt-2 flex justify-between text-base font-bold">
                  <span>Total:</span>
                  <span className="text-blue-600">{selectedPackageData.priceFormatted}</span>
                </div>
              </div>
            )}

            {/* Info Alert */}
            <Alert className="border-blue-200 bg-blue-50">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800 text-sm">
                Os créditos serão adicionados imediatamente após confirmação do pagamento via Stripe
              </AlertDescription>
            </Alert>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isProcessing || buyingCredits}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handlePurchase}
                disabled={isProcessing || buyingCredits}
                className="flex-1"
              >
                {isProcessing || buyingCredits ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  `Comprar por ${selectedPackageData?.priceFormatted}`
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
