import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Clock,
  TrendingUp,
  Scissors,
  Calendar,
  ChevronLeft,
  BarChart3,
  MessageCircle,
  Settings,
  Wifi,
  WifiOff,
  RefreshCw,
  Loader2,
  QrCode,
  LogOut,
  CreditCard,
  Plus,
  Pencil,
  Trash2,
  X,
  Copy,
  Check,
  Link,
  UserX,
} from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBarbershopStatus, useAuth } from '@/hooks';
import { reportsService } from '@/services/reportsService';
import type { ReportsData, BarberClientData } from '@/services/reportsService';
import { DEFAULT_BARBERSHOP_ID, API_ENDPOINTS } from '@/config/api';
import { api } from '@/services/api';
import { barberService } from '@/services/barberService';
import { queueService } from '@/services/queueService';
import type { Barber } from '@/types';
import { FilaLivreLogo } from '@/components/ui/filalivre-logo';

type Period = 'today' | 'week' | 'month';
type View = 'overview' | 'byBarber' | 'barberDetail' | 'whatsapp' | 'professionals';

const PERIOD_LABELS: Record<Period, string> = {
  today: 'Hoje',
  week: 'Semana',
  month: 'Mês',
};

function getBarbershopId(): number {
  const stored = localStorage.getItem('barbershop_id');
  return stored ? parseInt(stored) : DEFAULT_BARBERSHOP_ID;
}

export function AdminPage() {
  const barbershopId = getBarbershopId();
  const { barbershop, barbers, queue, stats, loading: statusLoading, refetch: refetchStatus } = useBarbershopStatus(barbershopId, 10000);
  const { user, logout, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [period, setPeriod] = useState<Period>('today');
  const [view, setView] = useState<View>('overview');
  const [reports, setReports] = useState<ReportsData | null>(null);
  const [barberDetail, setBarberDetail] = useState<BarberClientData | null>(null);
  const [selectedBarber, setSelectedBarber] = useState<{ id: number; name: string } | null>(null);
  const [reportsLoading, setReportsLoading] = useState(false);

  // WhatsApp state
  const [waStatus, setWaStatus] = useState<'disconnected' | 'connecting' | 'waiting_qr' | 'connected'>('disconnected');
  const [waQr, setWaQr] = useState<string | null>(null);
  const [waLoading, setWaLoading] = useState(false);
  const waPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Professional CRUD state
  const [showProModal, setShowProModal] = useState(false);
  const [editingPro, setEditingPro] = useState<Barber | null>(null);
  const [proForm, setProForm] = useState({ name: '', photo_url: '', role: '' });
  const [proLoading, setProLoading] = useState(false);

  // Slug copy state
  const [copied, setCopied] = useState(false);

  const fetchReports = useCallback(async () => {
    setReportsLoading(true);
    try {
      const data = await reportsService.getReports(barbershopId, period);
      setReports(data);
    } catch (err) {
      console.error('Failed to fetch reports:', err);
    } finally {
      setReportsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  useEffect(() => {
    document.title = 'FilaLivre Admin';
  }, []);

  // WhatsApp: fetch status on mount and when entering whatsapp view
  const fetchWaStatus = useCallback(async () => {
    try {
      const data = await api.get<{ active: boolean; status: string; qr: string | null }>(
        API_ENDPOINTS.whatsappStatus(barbershopId)
      );
      if (data.active) {
        setWaStatus('connected');
        setWaQr(null);
      } else {
        setWaStatus(data.status as typeof waStatus || 'disconnected');
        if (data.qr) setWaQr(data.qr);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (view === 'whatsapp') {
      fetchWaStatus();
      // Poll status every 3s while on whatsapp view
      waPollingRef.current = setInterval(fetchWaStatus, 3000);
      return () => {
        if (waPollingRef.current) clearInterval(waPollingRef.current);
      };
    } else {
      if (waPollingRef.current) clearInterval(waPollingRef.current);
    }
  }, [view, fetchWaStatus]);

  const handleWaConnect = async () => {
    setWaLoading(true);
    try {
      const data = await api.post<{ success: boolean; status: string; qr: string | null }>(
        API_ENDPOINTS.whatsappConnect(barbershopId)
      );
      setWaStatus(data.status as typeof waStatus);
      if (data.qr) setWaQr(data.qr);
    } catch (err) {
      console.error('Erro ao conectar WhatsApp:', err);
    } finally {
      setWaLoading(false);
    }
  };

  const handleWaDisconnect = async () => {
    setWaLoading(true);
    try {
      await api.post(API_ENDPOINTS.whatsappDisconnect(barbershopId));
      setWaStatus('disconnected');
      setWaQr(null);
    } catch (err) {
      console.error('Erro ao desconectar WhatsApp:', err);
    } finally {
      setWaLoading(false);
    }
  };

  // Professional CRUD handlers
  const openCreatePro = () => {
    setEditingPro(null);
    setProForm({ name: '', photo_url: '', role: '' });
    setShowProModal(true);
  };

  const openEditPro = (barber: Barber) => {
    setEditingPro(barber);
    setProForm({ name: barber.name, photo_url: barber.photoUrl || '', role: barber.role || '' });
    setShowProModal(true);
  };

  const handleSavePro = async () => {
    if (!proForm.name.trim()) return;
    setProLoading(true);
    try {
      if (editingPro) {
        await barberService.updateBarber(editingPro.id, {
          name: proForm.name.trim(),
          photo_url: proForm.photo_url.trim() || null,
          role: proForm.role.trim() || null,
        });
      } else {
        await barberService.createBarber(barbershopId, {
          name: proForm.name.trim(),
          photo_url: proForm.photo_url.trim() || null,
          role: proForm.role.trim() || null,
        });
      }
      setShowProModal(false);
      refetchStatus();
    } catch (err) {
      console.error('Failed to save professional:', err);
    } finally {
      setProLoading(false);
    }
  };

  const handleDeletePro = async (barberId: string) => {
    if (!confirm('Remover este profissional?')) return;
    try {
      await barberService.deleteBarber(barberId);
      refetchStatus();
    } catch (err) {
      console.error('Failed to delete professional:', err);
    }
  };

  const handleToggleProActive = async (barber: Barber) => {
    try {
      await barberService.updateBarber(barber.id, { active: !barber.active });
      refetchStatus();
    } catch (err) {
      console.error('Failed to toggle professional active:', err);
    }
  };

  // Remove client from queue
  const handleRemoveClient = async (clientId: string) => {
    try {
      await queueService.removeFromQueue(clientId, barbershopId);
      refetchStatus();
    } catch (err) {
      console.error('Failed to remove client:', err);
    }
  };

  // Copy slug link
  const handleCopySlug = () => {
    if (!barbershop?.slug) return;
    const url = `${window.location.origin}/queue/${barbershop.slug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleBarberClick = async (barberId: number, barberName: string) => {
    setSelectedBarber({ id: barberId, name: barberName });
    setView('barberDetail');
    try {
      const data = await reportsService.getBarberReport(barbershopId, barberId, period);
      setBarberDetail(data);
    } catch (err) {
      console.error('Failed to fetch barber detail:', err);
    }
  };

  const handleCardClick = (card: string) => {
    if (card === 'finished') {
      setView('byBarber');
    }
  };

  const goBack = () => {
    if (view === 'barberDetail') setView('byBarber');
    else if (view === 'byBarber') setView('overview');
    else if (view === 'whatsapp') setView('overview');
    else if (view === 'professionals') setView('overview');
  };

  const totalWaiting = stats.waiting || 0;
  const totalServing = stats.serving || 0;

  const getBarberStatusLabel = (status: string) => {
    switch (status) {
      case 'available': return 'Disponível';
      case 'serving': return 'Atendendo';
      case 'paused': return 'Offline';
      default: return status;
    }
  };

  const isBarberActive = (status: string) => status === 'available' || status === 'serving';

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (start: string, end: string | null) => {
    if (!end) return '-';
    const diff = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
    return `${diff}min`;
  };

  const maxDaily = reports?.dailyCounts?.length
    ? Math.max(...reports.dailyCounts.map(d => d.total))
    : 1;

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">

        {/* HEADER */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {view !== 'overview' ? (
              <button onClick={goBack} className="p-2 rounded-xl hover:bg-neutral-200 transition-colors">
                <ChevronLeft className="w-5 h-5 text-neutral-700" />
              </button>
            ) : (
              <FilaLivreLogo className="w-9 h-9" />
            )}
            <div>
              <h1 className="text-3xl font-bold text-neutral-900">
                {view === 'overview' && 'Dashboard'}
                {view === 'byBarber' && 'Atendimentos por Profissional'}
                {view === 'barberDetail' && selectedBarber?.name}
                {view === 'whatsapp' && 'WhatsApp'}
                {view === 'professionals' && 'Profissionais'}
              </h1>
              <p className="text-neutral-500 text-sm">
                {view === 'overview' && 'Visão geral e relatórios'}
                {view === 'byBarber' && `Período: ${PERIOD_LABELS[period]}`}
                {view === 'barberDetail' && `Clientes atendidos — ${PERIOD_LABELS[period]}`}
                {view === 'whatsapp' && 'Integração e configuração'}
                {view === 'professionals' && 'Gerenciar profissionais do estabelecimento'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {view === 'overview' && (
              <button
                onClick={() => setView('whatsapp')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border shadow-sm ${
                  waStatus === 'connected'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp
                <div className={`w-2 h-2 rounded-full ${waStatus === 'connected' ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
              </button>
            )}

            <div className="flex gap-1 bg-white rounded-xl p-1 border border-neutral-200 shadow-sm">
              {(['today', 'week', 'month'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  period === p
                    ? 'bg-neutral-900 text-white'
                    : 'text-neutral-600 hover:bg-neutral-100'
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

            <button
              onClick={() => navigate('/assinatura')}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-purple-600 hover:bg-purple-50 border border-purple-200 shadow-sm transition-all"
            >
              <CreditCard className="w-4 h-4" />
              Assinatura
            </button>

            <button
              onClick={async () => { await logout(); navigate('/login'); }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-neutral-600 hover:bg-neutral-100 border border-neutral-200 shadow-sm transition-all"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </button>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {view === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* KPI Cards */}
              <div className="grid md:grid-cols-4 gap-4">
                {[
                  {
                    key: 'waiting',
                    title: 'Clientes na fila',
                    value: String(totalWaiting),
                    icon: Users,
                    color: 'from-blue-500 to-cyan-500',
                    clickable: false,
                  },
                  {
                    key: 'serving',
                    title: 'Atendendo agora',
                    value: String(totalServing),
                    icon: Clock,
                    color: 'from-purple-500 to-pink-500',
                    clickable: false,
                  },
                  {
                    key: 'finished',
                    title: `Atendimentos (${PERIOD_LABELS[period]})`,
                    value: reportsLoading ? '...' : String(reports?.totalFinished || 0),
                    icon: TrendingUp,
                    color: 'from-emerald-500 to-teal-500',
                    clickable: true,
                  },
                  {
                    key: 'avgTime',
                    title: 'Tempo médio',
                    value: reportsLoading ? '...' : `${reports?.avgTime || 0}min`,
                    icon: Calendar,
                    color: 'from-orange-500 to-amber-500',
                    clickable: false,
                  },
                ].map((card, index) => {
                  const Icon = card.icon;
                  return (
                    <motion.div
                      key={card.key}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => card.clickable && handleCardClick(card.key)}
                      className={`bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm transition-all ${
                        card.clickable ? 'cursor-pointer hover:shadow-md hover:border-neutral-300' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm text-neutral-500">{card.title}</p>
                          <p className="text-3xl font-bold text-neutral-900 mt-1">
                            {statusLoading && (card.key === 'waiting' || card.key === 'serving') ? '...' : card.value}
                          </p>
                        </div>
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center`}>
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                      </div>
                      {card.clickable && (
                        <p className="text-xs text-neutral-400 mt-3">Clique para detalhar</p>
                      )}
                    </motion.div>
                  );
                })}
              </div>

              {/* Barbers → Profissionais */}
              <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-neutral-900">Profissionais</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-neutral-500">{barbers.length} cadastrados</span>
                    <button
                      onClick={() => setView('professionals')}
                      className="text-xs text-blue-600 hover:underline font-semibold"
                    >
                      Gerenciar
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {barbers.map((barber) => (
                    <div
                      key={barber.id}
                      className={`flex items-center justify-between p-4 rounded-xl bg-neutral-50 border border-neutral-100 ${!barber.active ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        {barber.photoUrl ? (
                          <img src={barber.photoUrl} alt={barber.name} className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                            <Scissors className="w-5 h-5 text-white" />
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-neutral-900">{barber.name}</p>
                          <div className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full ${isBarberActive(barber.status) ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
                            <span className={`text-xs ${isBarberActive(barber.status) ? 'text-emerald-600' : 'text-neutral-500'}`}>
                              {getBarberStatusLabel(barber.status)}
                            </span>
                            {barber.role && <span className="text-xs text-neutral-400 ml-1">• {barber.role}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-neutral-500">Na fila</p>
                        <p className="text-lg font-bold text-neutral-900">
                          {queue.filter(q => q.barberId === barber.id && q.status === 'waiting').length}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Slug / Link público */}
              {barbershop?.slug && (
                <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
                        <Link className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-sm text-neutral-500">Link público da fila</p>
                        <p className="font-semibold text-neutral-900">{window.location.origin}/queue/{barbershop.slug}</p>
                      </div>
                    </div>
                    <button
                      onClick={handleCopySlug}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-neutral-200 hover:bg-neutral-50 transition-all"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-neutral-500" />}
                      {copied ? 'Copiado!' : 'Copiar'}
                    </button>
                  </div>
                </div>
              )}

              {/* Queue + Chart */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      <Users className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-neutral-900">Fila Atual</h3>
                      <p className="text-xs text-neutral-500">{totalWaiting} aguardando</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {queue.filter(q => q.status === 'waiting').length > 0 ? (
                      queue.filter(q => q.status === 'waiting').slice(0, 8).map((client, index) => (
                        <div key={client.id} className="flex items-center justify-between p-3 rounded-lg bg-neutral-50 border border-neutral-100">
                          <span className="text-sm text-neutral-700">{index + 1}. {client.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-neutral-500">
                              {client.barberId
                                ? barbers.find(b => b.id === client.barberId)?.name || 'Profissional'
                                : 'Geral'}
                            </span>
                            <button
                              onClick={() => handleRemoveClient(client.id)}
                              className="p-1 rounded-lg hover:bg-red-50 text-neutral-400 hover:text-red-500 transition-colors"
                              title="Remover da fila"
                            >
                              <UserX className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-center py-4 text-sm text-neutral-400">Nenhum cliente na fila</p>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                      <BarChart3 className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-neutral-900">Atendimentos no mês</h3>
                      <p className="text-xs text-neutral-500">Por dia</p>
                    </div>
                  </div>
                  {reports?.dailyCounts && reports.dailyCounts.length > 0 ? (
                    <div className="flex items-end gap-1 h-40">
                      {reports.dailyCounts.map((day) => {
                        const height = maxDaily > 0 ? (day.total / maxDaily) * 100 : 0;
                        return (
                          <div key={day.day} className="flex-1 flex flex-col items-center justify-end gap-1">
                            <span className="text-[10px] text-neutral-500 font-medium">{day.total}</span>
                            <div
                              className="w-full bg-gradient-to-t from-emerald-500 to-teal-400 rounded-t-sm min-h-[4px] transition-all"
                              style={{ height: `${Math.max(height, 3)}%` }}
                            />
                            <span className="text-[10px] text-neutral-400">{day.day}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-40 text-sm text-neutral-400">
                      Sem dados no período
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {view === 'byBarber' && (
            <motion.div
              key="byBarber"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm">
                <h2 className="text-lg font-semibold text-neutral-900 mb-4">Atendimentos por profissional</h2>
                {reports?.byBarber && reports.byBarber.length > 0 ? (
                  <div className="space-y-3">
                    {reports.byBarber.map((b) => {
                      const maxBarber = Math.max(...reports.byBarber.map(x => x.total));
                      const pct = maxBarber > 0 ? (b.total / maxBarber) * 100 : 0;
                      return (
                        <button
                          key={b.barber_id}
                          onClick={() => handleBarberClick(b.barber_id, b.barber_name)}
                          className="w-full text-left p-4 rounded-xl bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                                <Scissors className="w-5 h-5 text-white" />
                              </div>
                              <span className="font-semibold text-neutral-900">{b.barber_name}</span>
                            </div>
                            <span className="text-xl font-bold text-neutral-900">{b.total}</span>
                          </div>
                          <div className="h-2 bg-neutral-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center py-8 text-sm text-neutral-400">Nenhum atendimento no período</p>
                )}
              </div>
            </motion.div>
          )}

          {view === 'barberDetail' && (
            <motion.div
              key="barberDetail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-neutral-200 bg-neutral-50">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-600">Cliente</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-600">Horário</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-600">Data</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-600">Duração</th>
                      </tr>
                    </thead>
                    <tbody>
                      {barberDetail?.clients && barberDetail.clients.length > 0 ? (
                        barberDetail.clients.map((client) => (
                          <tr key={client.id} className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors">
                            <td className="py-3 px-4 text-sm text-neutral-900 font-medium">{client.name}</td>
                            <td className="py-3 px-4 text-sm text-neutral-600">{formatTime(client.created_at)}</td>
                            <td className="py-3 px-4 text-sm text-neutral-600">{formatDate(client.created_at)}</td>
                            <td className="py-3 px-4 text-sm text-neutral-600">{formatDuration(client.updated_at, client.finished_at)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-sm text-neutral-400">
                            Nenhum atendimento no período
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'whatsapp' && (
            <motion.div
              key="whatsapp"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Status Card */}
              <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    waStatus === 'connected'
                      ? 'bg-gradient-to-br from-emerald-500 to-green-500'
                      : 'bg-gradient-to-br from-neutral-400 to-neutral-500'
                  }`}>
                    <MessageCircle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-neutral-900">WhatsApp</h2>
                    <div className="flex items-center gap-2 mt-0.5">
                      {waStatus === 'connected' ? (
                        <>
                          <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-sm text-emerald-600 font-medium">Conectado</span>
                        </>
                      ) : waStatus === 'waiting_qr' || waStatus === 'connecting' ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                          <span className="text-sm text-amber-600 font-medium">Aguardando escaneamento</span>
                        </>
                      ) : (
                        <>
                          <WifiOff className="w-3.5 h-3.5 text-neutral-400" />
                          <span className="text-sm text-neutral-500">Desconectado</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* QR Code */}
                {waQr && waStatus !== 'connected' && (
                  <div className="mb-6">
                    <div className="bg-white rounded-xl border-2 border-dashed border-neutral-200 p-6 flex flex-col items-center gap-4">
                      <div className="flex items-center gap-2 text-neutral-600">
                        <QrCode className="w-5 h-5" />
                        <span className="text-sm font-semibold">Escaneie o QR Code com o WhatsApp</span>
                      </div>
                      <img
                        src={waQr}
                        alt="WhatsApp QR Code"
                        className="max-w-[280px] rounded-lg"
                      />
                      <p className="text-xs text-neutral-400 text-center max-w-xs">
                        Abra o WhatsApp no celular → Menu (⋮) → Aparelhos conectados → Conectar aparelho
                      </p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  {waStatus === 'connected' ? (
                    <>
                      <button
                        onClick={handleWaConnect}
                        disabled={waLoading}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-neutral-100 text-neutral-700 font-semibold text-sm hover:bg-neutral-200 transition-colors disabled:opacity-50"
                      >
                        <RefreshCw className={`w-4 h-4 ${waLoading ? 'animate-spin' : ''}`} />
                        Reconectar
                      </button>
                      <button
                        onClick={handleWaDisconnect}
                        disabled={waLoading}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-50 text-red-600 font-semibold text-sm hover:bg-red-100 transition-colors disabled:opacity-50"
                      >
                        <WifiOff className="w-4 h-4" />
                        Desconectar
                      </button>
                    </>
                  ) : waStatus === 'waiting_qr' || waStatus === 'connecting' ? (
                    <button
                      disabled
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-50 text-amber-700 font-semibold text-sm opacity-80"
                    >
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Aguardando escaneamento...
                    </button>
                  ) : (
                    <button
                      onClick={handleWaConnect}
                      disabled={waLoading}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50"
                    >
                      {waLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <MessageCircle className="w-4 h-4" />
                      )}
                      Conectar WhatsApp
                    </button>
                  )}
                </div>
              </div>

              {/* Info Card */}
              <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                    <Settings className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="font-semibold text-neutral-900">Como funciona</h3>
                </div>
                <div className="space-y-3">
                  {[
                    'Conecte o WhatsApp da barbearia escaneando o QR Code acima.',
                    'Quando o cliente informar o telefone ao entrar na fila, o número é salvo.',
                    'Quando faltarem 3 posições para o atendimento, o sistema envia um alerta automático.',
                    'A mensagem avisa que faltam poucos atendimentos e que o cliente deve se dirigir à barbearia.',
                    'Cada cliente recebe no máximo um alerta — sem spam.',
                  ].map((text, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-neutral-100 flex items-center justify-center text-xs font-bold text-neutral-500">
                        {i + 1}
                      </span>
                      <p className="text-sm text-neutral-600">{text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {view === 'professionals' && (
            <motion.div
              key="professionals"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-neutral-900">Todos os profissionais</h2>
                  <button
                    onClick={openCreatePro}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-900 text-white text-sm font-semibold hover:bg-neutral-800 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar
                  </button>
                </div>
                <div className="space-y-3">
                  {barbers.map((barber) => (
                    <div
                      key={barber.id}
                      className={`flex items-center justify-between p-4 rounded-xl border ${barber.active ? 'bg-neutral-50 border-neutral-100' : 'bg-neutral-100 border-neutral-200 opacity-60'}`}
                    >
                      <div className="flex items-center gap-3">
                        {barber.photoUrl ? (
                          <img src={barber.photoUrl} alt={barber.name} className="w-12 h-12 rounded-full object-cover" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                            <Scissors className="w-6 h-6 text-white" />
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-neutral-900">{barber.name}</p>
                          <div className="flex items-center gap-2">
                            {barber.role && <span className="text-xs text-neutral-500">{barber.role}</span>}
                            <div className="flex items-center gap-1">
                              <div className={`w-2 h-2 rounded-full ${isBarberActive(barber.status) ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
                              <span className={`text-xs ${isBarberActive(barber.status) ? 'text-emerald-600' : 'text-neutral-500'}`}>
                                {getBarberStatusLabel(barber.status)}
                              </span>
                            </div>
                            {!barber.active && <span className="text-xs text-red-500 font-semibold">Inativo</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleProActive(barber)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            barber.active
                              ? 'border-red-200 text-red-600 hover:bg-red-50'
                              : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                          }`}
                        >
                          {barber.active ? 'Desativar' : 'Ativar'}
                        </button>
                        <button
                          onClick={() => openEditPro(barber)}
                          className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-500 transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeletePro(barber.id)}
                          className="p-2 rounded-lg hover:bg-red-50 text-neutral-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {barbers.length === 0 && (
                    <p className="text-center py-8 text-sm text-neutral-400">Nenhum profissional cadastrado</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Professional Modal */}
        {showProModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-neutral-900">
                  {editingPro ? 'Editar profissional' : 'Novo profissional'}
                </h3>
                <button onClick={() => setShowProModal(false)} className="p-2 rounded-lg hover:bg-neutral-100">
                  <X className="w-5 h-5 text-neutral-500" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-1">Nome *</label>
                  <input
                    type="text"
                    value={proForm.name}
                    onChange={(e) => setProForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-neutral-900 focus:border-transparent outline-none text-sm"
                    placeholder="Nome do profissional"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-1">URL da foto</label>
                  <input
                    type="url"
                    value={proForm.photo_url}
                    onChange={(e) => setProForm(f => ({ ...f, photo_url: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-neutral-900 focus:border-transparent outline-none text-sm"
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-1">Função / Cargo</label>
                  <input
                    type="text"
                    value={proForm.role}
                    onChange={(e) => setProForm(f => ({ ...f, role: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-neutral-900 focus:border-transparent outline-none text-sm"
                    placeholder="Ex: Barbeiro, Cabeleireiro, Manicure..."
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowProModal(false)}
                    className="flex-1 py-2.5 rounded-xl border border-neutral-200 text-sm font-semibold text-neutral-600 hover:bg-neutral-50 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSavePro}
                    disabled={proLoading || !proForm.name.trim()}
                    className="flex-1 py-2.5 rounded-xl bg-neutral-900 text-white text-sm font-semibold hover:bg-neutral-800 disabled:opacity-50 transition-all"
                  >
                    {proLoading ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="py-6 bg-neutral-900 text-white mt-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm mb-1">FilaLivre &copy;</p>
          <p className="text-xs text-neutral-400">Sistema inteligente de fila de atendimento</p>
        </div>
      </footer>
    </div>
  );
}
