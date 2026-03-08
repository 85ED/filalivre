import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Play, CircleCheck, X, Clock, User, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { useQueue, useBarbers } from '@/hooks';
import { DEFAULT_BARBERSHOP_ID } from '@/config/api';
import { Container } from '@/components/layout';
import { queueService, barberService } from '@/services';

// Barbeiro logado (em produção virá do auth/localStorage)
const LOGGED_BARBER_ID = '1';

export function BarberPage() {
  const [barberStatus, setBarberStatus] = useState<'available' | 'serving' | 'paused'>('available');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { barbers } = useBarbers(DEFAULT_BARBERSHOP_ID, true, 5000);
  const { queue, refetch: refetchQueue } = useQueue(DEFAULT_BARBERSHOP_ID, true, 5000);

  const currentBarber = barbers.find((b) => b.id === LOGGED_BARBER_ID);

  // Fila específica do barbeiro (clientes que escolheram este barbeiro e aguardam)
  const barberQueue = queue.filter(
    (q) => q.barberId === LOGGED_BARBER_ID && q.status === 'waiting'
  );

  // Fila geral (clientes sem barbeiro específico que aguardam)
  const generalQueue = queue.filter(
    (q) => !q.barberId && q.status === 'waiting'
  );

  // Próximo cliente para este barbeiro (prioridade: fila específica > fila geral)
  const nextClient = barberQueue[0] || generalQueue[0] || null;

  // Cliente sendo atendido por este barbeiro
  const currentClient = queue.find(
    (q) => q.barberId === LOGGED_BARBER_ID && (q.status === 'serving' || q.status === 'called')
  );

  const handleCallNext = async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await queueService.callNext(LOGGED_BARBER_ID, DEFAULT_BARBERSHOP_ID);
      if (next) {
        setBarberStatus('serving');
      }
      await refetchQueue();
    } catch (err) {
      console.error('Failed to call next:', err);
      setError('Erro ao chamar próximo cliente');
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = async () => {
    setLoading(true);
    setError(null);
    try {
      await queueService.finishClient(LOGGED_BARBER_ID, DEFAULT_BARBERSHOP_ID);
      setBarberStatus('available');
      await refetchQueue();
    } catch (err) {
      console.error('Failed to finish client:', err);
      setError('Erro ao finalizar atendimento');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async (clientId: string) => {
    setLoading(true);
    setError(null);
    try {
      await queueService.skipClient(clientId, DEFAULT_BARBERSHOP_ID);
      setBarberStatus('available');
      await refetchQueue();
    } catch (err) {
      console.error('Failed to skip client:', err);
      setError('Erro ao pular cliente');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    const newStatus = barberStatus === 'paused' ? 'available' : 'paused';
    setLoading(true);
    try {
      await barberService.updateStatus(LOGGED_BARBER_ID, newStatus);
      setBarberStatus(newStatus);
    } catch (err) {
      console.error('Failed to toggle status:', err);
      setError('Erro ao alterar status');
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = () => {
    if (currentClient) return 'Atendendo';
    if (barberStatus === 'paused') return 'Em pausa';
    return 'Disponível';
  };

  const getStatusDotColor = () => {
    if (currentClient) return 'bg-emerald-500';
    if (barberStatus === 'paused') return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const serveTime = currentClient
    ? Math.max(0, Math.floor((Date.now() - new Date(currentClient.createdAt).getTime()) / 1000))
    : 0;

  return (
    <div className="min-h-screen bg-white pb-32">
      <Container maxWidth="sm" className="py-8 space-y-6">

        {/* HEADER */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-1"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-black text-neutral-900">
                {currentBarber?.name || 'Carregando...'}
              </h1>
              <p className="text-sm font-semibold text-neutral-500">Barbeiro &bull; Barbearia Gilmar</p>
            </div>
            <button
              onClick={handleToggleStatus}
              disabled={loading}
              className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 font-bold text-sm transition-all ${
                barberStatus === 'paused'
                  ? 'bg-yellow-50 border-yellow-300 text-yellow-700'
                  : currentClient
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : 'bg-blue-50 border-blue-300 text-blue-700'
              }`}
              title={
                barberStatus === 'paused'
                  ? 'Clique para voltar ao atendimento'
                  : 'Clique para entrar em pausa'
              }
            >
              <div className={`w-2.5 h-2.5 rounded-full ${getStatusDotColor()} ${barberStatus !== 'paused' && !currentClient ? 'animate-pulse' : ''}`} />
              {getStatusLabel()}
            </button>
          </div>
        </motion.div>

        {/* ERROR */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 font-semibold">{error}</p>
          </motion.div>
        )}

        {/* ATENDENDO AGORA */}
        {currentClient && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-200"
          >
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500 mb-4">
              Atendendo agora
            </h2>
            <div className="bg-emerald-50 rounded-xl p-5 space-y-4 border border-emerald-200">
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-600 flex items-center justify-center mx-auto mb-3">
                  <User className="w-7 h-7 text-white" />
                </div>
                <p className="text-2xl font-black text-neutral-900">{currentClient.name}</p>
              </div>

              <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-white border border-emerald-200">
                <Clock className="w-5 h-5 text-emerald-600" />
                <div>
                  <p className="text-xs text-emerald-600 font-semibold">TEMPO DECORRIDO</p>
                  <p className="text-lg font-mono font-bold text-emerald-900">{formatTime(serveTime)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={handleFinish}
                  disabled={loading}
                  className="h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-sm"
                >
                  <CircleCheck className="w-4 h-4 mr-2" />
                  Finalizar
                </Button>
                <Button
                  onClick={() => handleSkip(currentClient.id)}
                  disabled={loading}
                  className="h-11 bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded-lg border border-red-200 text-sm"
                >
                  <X className="w-4 h-4 mr-2" />
                  Pular
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* PRÓXIMO CLIENTE */}
        {!currentClient && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-200"
          >
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500 mb-4">
              Próximo cliente
            </h2>
            {nextClient ? (
              <div className="bg-blue-50 rounded-xl p-5 space-y-4 border border-blue-200">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-blue-600">Próxima pessoa</p>
                    <p className="text-lg font-black text-neutral-900">{nextClient.name}</p>
                  </div>
                </div>

                <Button
                  onClick={handleCallNext}
                  disabled={loading || barberStatus === 'paused'}
                  className="w-full h-11 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-300 text-white font-semibold rounded-lg"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Chamar próximo
                </Button>
              </div>
            ) : (
              <div className="text-center py-8 px-4 text-neutral-500 bg-neutral-50 rounded-xl border border-neutral-200">
                <p className="text-sm font-semibold">Nenhum cliente na fila</p>
              </div>
            )}
          </motion.div>
        )}

        {/* FILA DO BARBEIRO */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-200"
        >
          <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500 mb-4">
            Fila do {currentBarber?.name || 'barbeiro'} ({barberQueue.length})
          </h2>
          {barberQueue.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {barberQueue.map((client, index) => (
                <motion.div
                  key={client.id}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="flex items-center p-3 rounded-lg bg-neutral-50 border border-neutral-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-neutral-300 flex items-center justify-center font-bold text-sm text-neutral-900">
                      {index + 1}
                    </div>
                    <p className="font-semibold text-neutral-900 text-sm">{client.name}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-neutral-500 bg-neutral-50 rounded-lg border border-neutral-200">
              <p className="text-sm font-semibold">Nenhum cliente escolheu este barbeiro</p>
            </div>
          )}
        </motion.div>

        {/* FILA GERAL */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-200"
        >
          <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500 mb-4">
            Fila geral ({generalQueue.length})
          </h2>
          {generalQueue.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {generalQueue.slice(0, 10).map((client, index) => (
                <motion.div
                  key={client.id}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="flex items-center p-3 rounded-lg bg-neutral-50 border border-neutral-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-neutral-300 flex items-center justify-center font-bold text-sm text-neutral-900">
                      {index + 1}
                    </div>
                    <p className="font-semibold text-neutral-900 text-sm">{client.name}</p>
                  </div>
                </motion.div>
              ))}
              {generalQueue.length > 10 && (
                <p className="text-center py-2 text-xs text-neutral-500 font-semibold">
                  +{generalQueue.length - 10} mais na fila
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-6 text-neutral-500 bg-neutral-50 rounded-lg border border-neutral-200">
              <p className="text-sm font-semibold">Fila geral vazia</p>
            </div>
          )}
        </motion.div>

      </Container>
    </div>
  );
}
