import { motion } from 'framer-motion';
import { Container } from '@/components/layout';
import { useQueue } from '@/hooks';
import { API_ENDPOINTS } from '@/config/api';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, Clock, Volume2, MapPin, Loader2, AlertCircle } from 'lucide-react';
import { reportsService } from '@/services/reportsService';
import { api } from '@/services/api';
import { FilaLivreLogo } from '@/components/ui/filalivre-logo';

interface BarbershopInfo {
  id: number;
  name: string;
  slug: string;
}

export function MonitorPage() {
  const { slug } = useParams<{ slug: string }>();
  const [barbershopInfo, setBarbershopInfo] = useState<BarbershopInfo | null>(null);
  const [slugLoading, setSlugLoading] = useState(true);
  const [slugError, setSlugError] = useState(false);

  // Resolver barbershopId a partir do slug da URL
  useEffect(() => {
    if (!slug) { setSlugError(true); setSlugLoading(false); return; }
    setSlugLoading(true);
    api.get<BarbershopInfo>(API_ENDPOINTS.barbershopBySlug(slug))
      .then((res) => {
        setBarbershopInfo(res);
        setSlugError(false);
      })
      .catch(() => setSlugError(true))
      .finally(() => setSlugLoading(false));
  }, [slug]);

  const barbershopId = barbershopInfo?.id ?? 0;

  useEffect(() => {
    document.title = barbershopInfo ? `${barbershopInfo.name} — Monitor` : 'FilaLivre Monitor';
  }, [barbershopInfo]);
  const { queue, loading } = useQueue(barbershopId || 1, !!barbershopId, 2000);
  const [time, setTime] = useState(new Date());
  const [prevServing, setPrevServing] = useState<string | null>(null);
  const [highlightNewClient, setHighlightNewClient] = useState(false);
  const [avgTime, setAvgTime] = useState(0);
  const [totalToday, setTotalToday] = useState(0);
  const statsRef = useRef({ avgTime: 0, totalToday: 0 });

  // Buscar stats reais do backend (avg time e total hoje)
  const fetchMonitorStats = useCallback(async () => {
    try {
      const data = await reportsService.getReports(barbershopId, 'today');
      statsRef.current = { avgTime: data.avgTime || 0, totalToday: data.totalFinished || 0 };
      setAvgTime(data.avgTime || 0);
      setTotalToday(data.totalFinished || 0);
    } catch {
      // ignore
    }
  }, [barbershopId]);

  useEffect(() => {
    fetchMonitorStats();
    const interval = setInterval(fetchMonitorStats, 15000);
    return () => clearInterval(interval);
  }, [fetchMonitorStats]);

  // Atualizar relógio a cada segundo
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Detectar Quando muda o cliente sendo atendido
  const currentServing = queue.find((q) => q.status === 'serving');
  useEffect(() => {
    if (currentServing?.id !== prevServing) {
      setPrevServing(currentServing?.id || null);
      setHighlightNewClient(true);
      const timer = setTimeout(() => setHighlightNewClient(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [currentServing, prevServing]);

  // Encontrar dados da fila
  const calledClient = queue.find((q) => q.status === 'called');
  const nextWaiting = queue
    .filter((q) => q.status === 'waiting')
    .slice(0, 5);
  const totalWaiting = queue.filter((q) => q.status === 'waiting').length;

  if (slugLoading) {
    return (
      <div className="h-screen bg-neutral-900 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-neutral-500" />
      </div>
    );
  }

  if (slugError || !barbershopInfo) {
    return (
      <div className="h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertCircle className="w-14 h-14 text-red-400 mx-auto" />
          <h1 className="text-3xl font-bold text-white">Estabelecimento não encontrado</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 overflow-hidden">
      <Container maxWidth="5xl" className="py-4 space-y-3 h-full flex flex-col">
        {/* Cabeçalho */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-1"
        >
          <div className="flex items-center justify-center gap-3 mb-2">
            <FilaLivreLogo className="h-10 w-10" variant="light" />
            <h1 className="text-4xl font-black text-white drop-shadow-lg">{barbershopInfo.name}</h1>
          </div>
          <div className="flex items-center justify-center gap-3 text-neutral-300">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <p className="text-base font-semibold">Sistema Online • Atualizado em Tempo Real</p>
          </div>
          <p className="text-2xl text-neutral-200 font-mono font-bold tracking-wider">
            {time.toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </p>
        </motion.div>

        {/* Seção: Chamando Agora */}
        {currentServing ? (
          <motion.div
            key={currentServing.id}
            initial={highlightNewClient ? { scale: 0.95, opacity: 0 } : { scale: 1, opacity: 1 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="bg-gradient-to-r from-emerald-500 via-emerald-600 to-green-600 rounded-2xl p-6 shadow-2xl border-4 border-emerald-300 overflow-hidden relative"
          >
            {/* Animated background pulses */}
            <div className="absolute inset-0 opacity-20">
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 bg-white rounded-3xl"
              />
            </div>

            <div className="relative z-10 space-y-3">
              <p className="text-xl text-emerald-50 font-bold tracking-widest text-center flex items-center justify-center gap-3">
                <CheckCircle className="w-7 h-7" /> CHAMANDO AGORA
              </p>
              <motion.div
                animate={highlightNewClient ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 0.5 }}
                className="text-center"
              >
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="text-7xl font-black text-white drop-shadow-lg mb-2 leading-tight"
                >
                  {currentServing.name}
                </motion.div>
              </motion.div>
              <div className="text-center">
                <p className="text-lg text-emerald-100 font-semibold flex items-center justify-center gap-2">
                  <Clock className="w-5 h-5" /> Dirija-se ao atendimento
                </p>
              </div>
            </div>
          </motion.div>
        ) : calledClient ? (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-gradient-to-r from-yellow-500 to-orange-600 rounded-2xl p-6 shadow-2xl border-4 border-yellow-300 overflow-hidden"
          >
            <div className="space-y-3">
              <p className="text-xl text-yellow-100 font-bold tracking-widest text-center flex items-center justify-center gap-3">
                <Volume2 className="w-7 h-7" /> CHAMADO
              </p>
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                className="text-7xl font-black text-white text-center leading-tight drop-shadow-lg"
              >
                {calledClient.name}
              </motion.div>
              <p className="text-center text-yellow-100 text-lg font-semibold flex items-center justify-center gap-2">
                <MapPin className="w-5 h-5" /> Dirija-se ao atendimento
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl p-6 shadow-2xl border-4 border-blue-400"
          >
            <div className="space-y-3 text-center">
              <p className="text-4xl font-black text-white drop-shadow-lg">
                Bem-vindo!
              </p>
              <p className="text-xl text-blue-100 font-semibold flex items-center justify-center gap-2">
                {totalWaiting > 0
                  ? `${totalWaiting} cliente${totalWaiting !== 1 ? 's' : ''} aguardando`
                  : <><CheckCircle className="w-5 h-5" /> Fila vazia</>}
              </p>
            </div>
          </motion.div>
        )}

        {/* Próximos na Fila */}
        <div className="flex-1 min-h-0">
          <h2 className="text-2xl font-black text-white mb-3 tracking-wide drop-shadow-lg">
            PRÓXIMOS DA FILA
          </h2>
          {nextWaiting.length > 0 ? (
            <div className="grid grid-cols-5 gap-3">
              {nextWaiting.map((client, index) => (
                <motion.div
                  key={client.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-gradient-to-br from-neutral-700 to-neutral-800 rounded-xl p-4 border border-neutral-600 shadow-xl hover:border-neutral-500 transition-colors"
                >
                  <p className="text-neutral-400 text-xs font-bold mb-1">POSIÇÃO</p>
                  <div className="text-5xl font-black text-transparent bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text mb-2">
                    {index + 1}
                  </div>
                  <p className="text-xl font-bold text-white break-words leading-snug">
                    {client.name}
                  </p>
                </motion.div>
              ))}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-8"
            >
              <p className="text-xl text-neutral-400 font-semibold">
                Nenhum cliente aguardando
              </p>
            </motion.div>
          )}
        </div>

        {/* Estatísticas Rodapé */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-3 gap-3"
        >
          <div className="bg-gradient-to-br from-neutral-700 to-neutral-800 rounded-xl p-4 border border-neutral-600 text-center shadow-lg hover:border-neutral-500 transition-colors">
            <p className="text-neutral-400 text-sm font-bold mb-2">ESPERANDO</p>
            <motion.p
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-4xl font-black text-emerald-400 drop-shadow-lg"
            >
              {totalWaiting}
            </motion.p>
          </div>
          <div className="bg-gradient-to-br from-neutral-700 to-neutral-800 rounded-xl p-4 border border-neutral-600 text-center shadow-lg hover:border-neutral-500 transition-colors">
            <p className="text-neutral-400 text-sm font-bold mb-2">TEMPO MÉD.</p>
            <p className="text-4xl font-black text-blue-400 drop-shadow-lg">
              {avgTime}
              <span className="text-xl">min</span>
            </p>
          </div>
          <div className="bg-gradient-to-br from-neutral-700 to-neutral-800 rounded-xl p-4 border border-neutral-600 text-center shadow-lg hover:border-neutral-500 transition-colors">
            <p className="text-neutral-400 text-sm font-bold mb-2">TOTAL HOJE</p>
            <p className="text-4xl font-black text-purple-400 drop-shadow-lg">
              {totalToday}
            </p>
          </div>
        </motion.div>

        {/* Status Online */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center"
        >
            <div className="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-neutral-700 border border-neutral-600 shadow-lg">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-neutral-200 font-bold text-sm">
              FilaLivre &copy; Sistema inteligente de fila de atendimento
            </span>
          </div>
        </motion.div>
      </Container>
    </div>
  );
}
