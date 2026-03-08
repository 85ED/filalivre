import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Container } from '@/components/layout';
import { Bell, User, AlertCircle, Gamepad2, Scissors, Smartphone, Phone } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useQueueWithToken, useBarbers } from '@/hooks';
import { DEFAULT_BARBERSHOP_ID } from '@/config/api';
import type { QueueItem } from '@/types';

export function ClientQueuePage() {
  const [step, setStep] = useState<'name' | 'queue'>('name');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [currentQueueItem, setCurrentQueueItem] = useState<QueueItem | null>(null);

  const { 
    queue, 
    joinQueue, 
    removeFromQueue, 
    loading: queueLoading, 
    error: queueError,
    clientQueueItem,
    recover 
  } = useQueueWithToken(DEFAULT_BARBERSHOP_ID, { autoRefresh: true, refreshInterval: 5000 });
  
  const { barbers, loading: barbersLoading, error: barbersError } = useBarbers(DEFAULT_BARBERSHOP_ID, true, 5000);

  // Tentar recuperar cliente do token ao montar
  useEffect(() => {
    const recoverClient = async () => {
      const recovered = await recover();
      if (recovered) {
        setCurrentQueueItem(recovered as any);
        setStep('queue');
      }
    };
    recoverClient();
  }, [recover]);

  const handleJoinQueue = async (barberId?: string) => {
    if (!clientName) return;

    try {
      const newItem = await joinQueue({
        name: clientName,
        barberId: barberId || null,
        phone: clientPhone || null,
      });
      setCurrentQueueItem(newItem as any);
      setStep('queue');
    } catch (error) {
      console.error('Failed to join queue:', error);
    }
  };

  const handleLeaveQueue = async () => {
    if (!currentQueueItem) return;
    try {
      await removeFromQueue(currentQueueItem.id);
      setCurrentQueueItem(null);
      setClientName('');
      setStep('name');
    } catch (error) {
      console.error('Failed to leave queue:', error);
    }
  };

  const userPosition = currentQueueItem
    ? queue.filter(q => q.status !== 'finished').findIndex(q => q.id === currentQueueItem.id) + 1
    : 0;

  const queueLength = queue.filter(q => q.status !== 'finished').length;
  const progress = queueLength > 0 ? ((queueLength - userPosition + 1) / queueLength) * 100 : 0;
  const estimatedTime = (userPosition - 1) * 20;

  const getProgressColor = (progress: number) => {
    if (progress <= 30) return 'from-neutral-300 to-neutral-400';
    if (progress <= 70) return 'from-yellow-300 to-yellow-400';
    return 'from-emerald-400 to-green-500';
  };

  const isAlmostReady = userPosition <= 3 && userPosition > 0;

  if (step === 'name') {
    return (
      <div className="min-h-screen bg-white pb-24">
        <Container maxWidth="md" className="py-8">
          {(queueError || barbersError) && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6"
            >
              <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
                  <div>
                    <h3 className="text-lg font-semibold text-red-900">
                      Conexão com o servidor perdida
                    </h3>
                    <p className="text-sm text-red-700">
                      Não conseguimos conectar ao servidor. Verifique sua conexão e tente novamente.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Branding Header */}
            <div className="bg-gradient-to-r from-neutral-900 to-neutral-800 rounded-3xl p-8 text-white text-center space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white mb-3">
                <Scissors className="w-8 h-8 text-neutral-900" />
              </div>
              <div className="space-y-1">
                <h1 className="text-4xl font-black">Barbearia Gilmar</h1>
                <p className="text-neutral-300 text-lg">Sistema de Fila Digital</p>
              </div>
              <p className="text-neutral-400 text-sm">
                Escaneie o QR code para entrar na fila
              </p>
            </div>

            {/* QR Code Section */}
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-neutral-100 flex items-center justify-center flex-col gap-4">
              <p className="text-sm text-neutral-600 font-semibold">Ou escaneie uma imagem:</p>
              <div className="w-48 h-48 bg-neutral-100 rounded-xl flex items-center justify-center border-2 border-dashed border-neutral-300">
                <div className="text-center">
                  <Smartphone className="w-10 h-10 text-neutral-400 mx-auto mb-2" />
                  <p className="text-sm text-neutral-600">QR Code</p>
                  <p className="text-xs text-neutral-500">localhost:5173/client-queue</p>
                </div>
              </div>
              <p className="text-xs text-neutral-500 text-center max-w-xs">
                Aponte a câmera do seu celular para este código
              </p>
            </div>

            <div className="text-center space-y-2">
              <div className="w-20 h-20 rounded-full bg-neutral-900 flex items-center justify-center mx-auto mb-4">
                <User className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-neutral-900">Ou entre com seu nome</h2>
              <p className="text-neutral-600">Digite seu nome ou apelido</p>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-lg border border-neutral-100 space-y-6">
              <div className="space-y-3">
                <Label htmlFor="name" className="text-neutral-900 text-lg">
                  Como podemos te chamar?
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Seu nome"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="h-14 text-lg rounded-xl border-neutral-200 focus:border-neutral-900"
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="phone" className="text-neutral-900 text-base flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  WhatsApp <span className="text-neutral-400 text-sm font-normal">(opcional)</span>
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(11) 99999-9999"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  className="h-14 text-lg rounded-xl border-neutral-200 focus:border-neutral-900"
                />
              </div>

              <div className="space-y-3">
                <Button
                  onClick={() => handleJoinQueue()}
                  disabled={!clientName || queueLoading}
                  className="w-full h-14 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-lg font-semibold"
                >
                  Entrar na fila geral
                </Button>
              </div>
            </div>

            <div className="bg-neutral-50 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-neutral-900 mb-4">Ou escolha um barbeiro</h3>
              {barbersLoading ? (
                <div className="text-center py-4 text-neutral-600">Carregando...</div>
              ) : (
                <div className="space-y-3">
                  {barbers
                    .filter((barber) => barber.status === 'available' || barber.status === 'serving')
                    .map((barber) => {
                      const barberQueueCount = queue.filter(
                        q => q.barberId === barber.id && (q.status === 'waiting' || q.status === 'called')
                      ).length;
                      return (
                        <motion.div
                          key={barber.id}
                          className="bg-white rounded-xl p-4 shadow-sm border border-neutral-100"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-full bg-emerald-600 flex items-center justify-center flex-shrink-0">
                                <User className="w-6 h-6 text-white" />
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-semibold text-neutral-900 truncate">{barber.name}</h4>
                                <p className="text-sm text-neutral-500">
                                  {barberQueueCount === 0
                                    ? 'Sem fila'
                                    : `${barberQueueCount} ${barberQueueCount === 1 ? 'cliente' : 'clientes'} na fila`}
                                </p>
                              </div>
                            </div>
                          </div>
                          <Button
                            onClick={() => handleJoinQueue(barber.id)}
                            disabled={!clientName || queueLoading}
                            variant="outline"
                            className="w-full mt-3 h-11 rounded-xl font-semibold border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                          >
                            Entrar na fila do {barber.name.split(' ')[0]}
                          </Button>
                        </motion.div>
                      );
                    })}
                  {barbers.filter((barber) => barber.status === 'available' || barber.status === 'serving').length === 0 && (
                    <div className="text-center py-6 text-neutral-500">
                      <p className="text-sm font-medium">Nenhum barbeiro disponível no momento</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </Container>
      </div>
    );
  }

  // ===== QUEUE VIEW =====
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Main Content */}
      <div className="flex-1 w-full">
        <div className="max-w-[420px] mx-auto px-4 py-6 space-y-4">
          {/* Error Message */}
          {(queueError || barbersError) && (
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <h3 className="font-semibold text-red-900">Conexão perdida</h3>
                    <p className="text-red-700 text-xs mt-1">Verifique sua conexão</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Alert: Almost Ready */}
          {isAlmostReady && (
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', bounce: 0.5 }}
            >
              <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl p-6 shadow-sm border-2 border-yellow-300 text-center">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center animate-pulse mx-auto mb-2">
                  <Bell className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-black text-neutral-900 mb-1">
                  Sua vez está chegando
                </h2>
                <p className="text-base font-semibold text-neutral-700">Prepare-se</p>
              </div>
            </motion.div>
          )}

          {/* Position Card (Main Focus) */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.05 }}
            className="bg-white rounded-3xl p-8 shadow-sm border border-neutral-200"
          >
            <div className="text-center mb-6">
              {userPosition <= 3 ? (
                <>
                  <motion.div
                    key="almost"
                    initial={{ scale: 1.1, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-7xl font-black bg-gradient-to-br from-yellow-500 to-orange-500 bg-clip-text text-transparent mb-2"
                  >
                    É AGORA!
                  </motion.div>
                  <p className="text-sm font-medium text-neutral-600">Posição {userPosition}</p>
                </>
              ) : (
                <>
                  <p className="text-xs uppercase tracking-widest font-semibold text-neutral-500 mb-3">
                    Sua posição
                  </p>
                  <motion.div
                    key={userPosition}
                    initial={{ scale: 1.15, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-9xl font-black text-neutral-900 leading-none"
                  >
                    {userPosition}
                  </motion.div>
                </>
              )}
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-neutral-600">Progresso na fila</span>
                <span className="text-sm font-black text-neutral-900">{Math.round(progress)}%</span>
              </div>
              <div className="h-2 w-full bg-neutral-200 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className={`h-full bg-gradient-to-r ${getProgressColor(progress)} rounded-full`}
                />
              </div>
            </div>
          </motion.div>

          {/* Metrics Card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-200"
          >
            <div className="grid grid-cols-3 gap-3">
              {/* Position */}
              <div className="p-3 rounded-lg bg-gradient-to-b from-neutral-50 to-neutral-100 border border-neutral-200 flex flex-col items-center justify-center min-h-[100px]">
                <p className="text-xs font-bold uppercase tracking-wider text-neutral-600 mb-2">Sua vez na fila</p>
                <p className="text-4xl font-black text-neutral-900 leading-none mb-1">{userPosition}</p>
                <p className="text-xs text-neutral-500">de {queueLength}</p>
              </div>

              {/* Ahead */}
              <div className="p-3 rounded-lg bg-gradient-to-b from-blue-50 to-blue-100 border border-blue-200 flex flex-col items-center justify-center min-h-[100px]">
                <p className="text-xs font-bold uppercase tracking-wider text-blue-700 mb-2">Antes de você</p>
                <p className="text-4xl font-black text-blue-900 leading-none mb-1">{Math.max(0, userPosition - 1)}</p>
                <p className="text-xs text-blue-600">pessoas</p>
              </div>

              {/* Estimated Time */}
              <div className="p-3 rounded-lg bg-gradient-to-b from-orange-50 to-orange-100 border border-orange-200 flex flex-col items-center justify-center min-h-[100px]">
                <p className="text-xs font-bold uppercase tracking-wider text-orange-700 mb-2">Tempo estimado</p>
                <div className="flex items-end gap-1">
                  <p className="text-sm font-semibold text-orange-700">~</p>
                  <p className="text-4xl font-black text-orange-900 leading-none">{estimatedTime}</p>
                  <p className="text-xs font-semibold text-orange-700 mb-1">min</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Games Section */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200"
          >
            <h3 className="text-center text-lg font-bold text-neutral-900 mb-4 flex items-center justify-center gap-2">
              <Gamepad2 className="w-5 h-5 text-neutral-700" />
              Passa tempo
            </h3>
            <div className="text-center py-4">
              <p className="text-sm text-neutral-500 font-medium">Jogos em breve</p>
            </div>
          </motion.div>

          {/* Leave Button */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={handleLeaveQueue}
              className="w-full h-11 bg-white hover:bg-red-50 text-red-600 rounded-xl font-semibold border-2 border-red-300 transition-all"
            >
              Sair da fila
            </motion.button>
          </motion.div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-neutral-900 border-t border-neutral-800 py-6 mt-8">
        <div className="max-w-[420px] mx-auto px-4 text-center">
          <p className="text-xs text-neutral-400">Fila App</p>
          <p className="text-xs text-neutral-500 mt-1">© 2026 CODE85</p>
        </div>
      </div>

    </div>
  );
}
