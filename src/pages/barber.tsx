import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Play, CircleCheck, X, Clock, User, AlertCircle, LogOut, BarChart3, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useQueue, useBarbers, useAuth } from '@/hooks';
import { Container } from '@/components/layout';
import { queueService, barberService } from '@/services';
import { reportsService } from '@/services/reportsService';
import type { ReportsData, BarberClientData } from '@/services/reportsService';
import { useNavigate } from 'react-router-dom';
import { FilaLivreLogo } from '@/components/ui/filalivre-logo';

function getBarbershopId(): number {
  const stored = localStorage.getItem('barbershop_id');
  return stored ? parseInt(stored) : 0;
}

function getLoggedBarberId(): string | null {
  return localStorage.getItem('barber_id');
}

export function BarberPage() {
  const [barberStatus, setBarberStatus] = useState<'available' | 'serving' | 'paused'>('available');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [statsData, setStatsData] = useState<{ today: ReportsData | null; month: ReportsData | null; clients: BarberClientData | null }>({ today: null, month: null, clients: null });
  const [statsLoading, setStatsLoading] = useState(false);
  const { user, logout, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const barbershopId = getBarbershopId();
  const LOGGED_BARBER_ID = getLoggedBarberId();

  useEffect(() => {
    document.title = 'FilaLivre — Profissional';
  }, []);

  const { barbers } = useBarbers(barbershopId || 1, !!barbershopId, 5000);
  const { queue, refetch: refetchQueue } = useQueue(barbershopId || 1, !!barbershopId, 5000);

  // Se não há barber_id vinculado, mostrar mensagem
  if (!authLoading && !LOGGED_BARBER_ID) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-4 max-w-sm px-4">
          <AlertCircle className="w-12 h-12 text-orange-400 mx-auto" />
          <h1 className="text-2xl font-bold text-neutral-900">Conta não vinculada</h1>
          <p className="text-neutral-600">
            Sua conta de usuário ainda não está vinculada a um profissional. Peça ao administrador do estabelecimento para vincular seu login.
          </p>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="px-6 py-2 rounded-xl bg-neutral-900 text-white font-semibold"
          >
            Voltar ao login
          </button>
        </div>
      </div>
    );
  }

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

  const openStatsModal = async () => {
    setShowStats(true);
    setStatsLoading(true);
    try {
      const [today, month, clients] = await Promise.all([
        reportsService.getReports(barbershopId, 'today'),
        reportsService.getReports(barbershopId, 'month'),
        reportsService.getBarberReport(barbershopId, parseInt(LOGGED_BARBER_ID!), 'today'),
      ]);
      setStatsData({ today, month, clients });
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleCallNext = async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await queueService.callNext(LOGGED_BARBER_ID!, barbershopId);
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
      await queueService.finishClient(LOGGED_BARBER_ID!, barbershopId);
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
      await queueService.skipClient(clientId, barbershopId);
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
      await barberService.updateStatus(LOGGED_BARBER_ID!, newStatus);
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
    ? Math.max(0, Math.floor((Date.now() - new Date(currentClient.serviceStartTime || currentClient.createdAt).getTime()) / 1000))
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
          {/* Linha 1: Nome */}
          <div className="flex items-center gap-3">
            <FilaLivreLogo className="w-9 h-9 flex-shrink-0" />
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-4xl font-black text-neutral-900 truncate">
                {currentBarber?.name || 'Carregando...'}
              </h1>
              <p className="text-sm font-semibold text-neutral-500">Profissional &bull; FilaLivre</p>
            </div>
          </div>
          {/* Linha 2: Botões */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={openStatsModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 border-neutral-200 text-neutral-500 hover:bg-neutral-100 transition-all text-xs font-semibold h-9"
              title="Estatísticas"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Estatísticas</span>
            </button>
            <button
              onClick={handleToggleStatus}
              disabled={loading}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 font-bold text-xs transition-all h-9 ${
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
              <div className={`w-2 h-2 rounded-full ${getStatusDotColor()} ${barberStatus !== 'paused' && !currentClient ? 'animate-pulse' : ''}`} />
              {getStatusLabel()}
            </button>
            <button
              onClick={() => { logout(); navigate('/login'); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 border-neutral-200 text-neutral-500 hover:bg-neutral-100 transition-all text-xs font-semibold h-9"
              title="Sair"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair
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
            Fila do {currentBarber?.name || 'profissional'} ({barberQueue.length})
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
              <p className="text-sm font-semibold">Nenhum cliente escolheu este profissional</p>
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

      {/* Stats Modal */}
      {showStats && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[80vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-neutral-900">Estatísticas</h3>
              <button onClick={() => setShowStats(false)} className="p-2 rounded-lg hover:bg-neutral-100">
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>
            {statsLoading ? (
              <p className="text-center py-8 text-sm text-neutral-400">Carregando...</p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-blue-50 rounded-xl p-4 text-center border border-blue-100">
                    <p className="text-xs text-blue-600 font-semibold mb-1">Hoje</p>
                    <p className="text-2xl font-black text-blue-700">{statsData.today?.totalFinished || 0}</p>
                  </div>
                  <div className="bg-purple-50 rounded-xl p-4 text-center border border-purple-100">
                    <p className="text-xs text-purple-600 font-semibold mb-1">No mês</p>
                    <p className="text-2xl font-black text-purple-700">{statsData.month?.totalFinished || 0}</p>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-4 text-center border border-emerald-100">
                    <p className="text-xs text-emerald-600 font-semibold mb-1">Tempo médio</p>
                    <p className="text-2xl font-black text-emerald-700">{statsData.today?.avgTime || 0}<span className="text-sm">min</span></p>
                  </div>
                </div>

                {statsData.clients?.clients && statsData.clients.clients.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-neutral-700 mb-2">Clientes atendidos hoje</h4>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {statsData.clients.clients.map((c) => (
                        <div key={c.id} className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-50 border border-neutral-100">
                          <span className="text-sm text-neutral-800 font-medium">{c.name}</span>
                          <span className="text-xs text-neutral-500">
                            {new Date(c.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto border-t border-neutral-100 py-6">
        <p className="text-center text-xs text-neutral-400">
          FilaLivre &copy; Sistema inteligente de fila de atendimento
        </p>
      </div>
    </div>
  );
}
