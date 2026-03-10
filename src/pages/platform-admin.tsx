import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks';
import { api } from '@/services/api';
import { FilaLivreLogo } from '@/components/ui/filalivre-logo';
import {
  Building2,
  Users,
  TrendingUp,
  LogOut,
  Loader2,
  Plus,
  Trash2,
  Pencil,
  X,
  CheckCircle,
  CreditCard,
  Scissors,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Barbershop {
  id: number;
  name: string;
  slug: string;
  owner_name: string | null;
  email: string | null;
  phone: string | null;
  image_url: string | null;
  subscription_status: 'trial' | 'active' | 'cancelled' | 'expired' | null;
  trial_expires_at: string | null;
  seat_price_cents: number;
  created_at: string;
}

interface PlatformStats {
  totalEstablishments: number;
  activeSubscriptions: number;
  activeTrials: number;
  expiredTrials: number;
  dailyServicesToday: number;
}

const emptyForm = {
  name: '',
  slug: '',
  owner_name: '',
  email: '',
  phone: '',
  image_url: '',
  subscription_status: 'trial' as const,
  trial_expires_at: '',
  seat_price: '35.00',
};

export function PlatformAdminPage() {
  const { user, logout, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [barbershops, setBarbershops] = useState<Barbershop[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  useEffect(() => {
    document.title = 'FilaLivre — Painel da Plataforma';
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [shopData, statsData] = await Promise.all([
        api.get<{ barbershops: Barbershop[] }>('/barbershops'),
        api.get<PlatformStats>('/barbershops/platform/stats'),
      ]);
      setBarbershops(shopData.barbershops);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (shop: Barbershop) => {
    setEditingId(shop.id);
    setForm({
      name: shop.name,
      slug: shop.slug,
      owner_name: shop.owner_name || '',
      email: shop.email || '',
      phone: shop.phone || '',
      subscription_status: shop.subscription_status || 'trial',
      trial_expires_at: shop.trial_expires_at
        ? new Date(shop.trial_expires_at).toISOString().split('T')[0]
        : '',
      seat_price: ((shop.seat_price_cents || 3500) / 100).toFixed(2),
      image_url: shop.image_url || '',
    });
    setFormError(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.slug) {
      setFormError('Nome e slug são obrigatórios');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        name: form.name,
        slug: form.slug,
        owner_name: form.owner_name || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        subscription_status: form.subscription_status,
        trial_expires_at: form.trial_expires_at
          ? new Date(form.trial_expires_at).toISOString()
          : undefined,
        seat_price_cents: form.seat_price ? Math.round(parseFloat(form.seat_price) * 100) : undefined,
        image_url: form.image_url || null,
      };
      if (editingId) {
        await api.patch(`/barbershops/${editingId}`, payload);
      } else {
        await api.post('/barbershops', payload);
      }
      setShowForm(false);
      await fetchData();
    } catch (err: any) {
      setFormError(err?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este estabelecimento? Todos os dados serão perdidos.')) return;
    setDeleting(id);
    try {
      await api.delete(`/barbershops/${id}`);
      await fetchData();
    } catch (err) {
      console.error('Failed to delete:', err);
    } finally {
      setDeleting(null);
    }
  };

  const statusBadge = (shop: Barbershop) => {
    const isTrialActive = shop.trial_expires_at && new Date(shop.trial_expires_at) > new Date();
    const daysLeft = shop.trial_expires_at
      ? Math.max(0, Math.ceil((new Date(shop.trial_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : null;

    if (shop.subscription_status === 'active') {
      return <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">Ativo</span>;
    }
    if (isTrialActive) {
      return <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">Trial: {daysLeft}d</span>;
    }
    if (shop.subscription_status === 'cancelled') {
      return <span className="text-xs font-semibold text-neutral-600 bg-neutral-100 px-2 py-1 rounded-full">Cancelado</span>;
    }
    return <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded-full">Expirado</span>;
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      <div className="flex-1 max-w-7xl mx-auto px-4 py-8 space-y-6 w-full">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <FilaLivreLogo className="w-10 h-10" />
            <div>
              <h1 className="text-3xl font-bold text-neutral-900">Painel da Plataforma</h1>
              <p className="text-neutral-500 text-sm">
                Bem-vindo, {user?.name} — Administrador da Plataforma
              </p>
            </div>
          </div>
          <Button onClick={handleLogout} variant="outline" className="gap-2">
            <LogOut className="w-4 h-4" />
            Sair
          </Button>
        </motion.div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Estabelecimentos', value: stats?.totalEstablishments ?? '...', icon: Building2, gradient: 'from-blue-500 to-cyan-500' },
            { label: 'Assinaturas ativas', value: stats?.activeSubscriptions ?? '...', icon: CreditCard, gradient: 'from-emerald-500 to-teal-500' },
            { label: 'Em trial', value: stats?.activeTrials ?? '...', icon: TrendingUp, gradient: 'from-orange-500 to-yellow-500' },
            { label: 'Atendimentos hoje', value: stats?.dailyServicesToday ?? '...', icon: Scissors, gradient: 'from-purple-500 to-pink-500' },
          ].map((kpi, i) => (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-2xl p-5 border border-neutral-200 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-neutral-500 font-medium">{kpi.label}</p>
                  <p className="text-3xl font-bold text-neutral-900 mt-1">{kpi.value}</p>
                </div>
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${kpi.gradient} flex items-center justify-center`}>
                  <kpi.icon className="w-4 h-4 text-white" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Barbershops Table */}
        <div className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-neutral-900">Estabelecimentos</h2>
            <Button onClick={openCreate} size="sm" className="gap-2 bg-neutral-900 hover:bg-neutral-800">
              <Plus className="w-4 h-4" /> Novo
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-neutral-400 mx-auto" />
            </div>
          ) : barbershops.length === 0 ? (
            <p className="text-center py-8 text-sm text-neutral-400">
              Nenhum estabelecimento cadastrado
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-neutral-500 border-b border-neutral-100">
                    <th className="pb-3 font-medium">Estabelecimento</th>
                    <th className="pb-3 font-medium">Dono</th>
                    <th className="pb-3 font-medium">Email</th>
                    <th className="pb-3 font-medium">Telefone</th>
                    <th className="pb-3 font-medium">Slug</th>
                    <th className="pb-3 font-medium">R$/Prof.</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {barbershops.map((shop) => (
                    <tr key={shop.id} className="border-b border-neutral-50 hover:bg-neutral-50/50">
                      <td className="py-3 font-semibold text-neutral-900">{shop.name}</td>
                      <td className="py-3 text-neutral-600">{shop.owner_name || '—'}</td>
                      <td className="py-3 text-neutral-600">{shop.email || '—'}</td>
                      <td className="py-3 text-neutral-600">{shop.phone || '—'}</td>
                      <td className="py-3 text-neutral-500">/{shop.slug}</td>
                      <td className="py-3 text-neutral-600 font-mono text-xs">R$ {((shop.seat_price_cents || 3500) / 100).toFixed(2)}</td>
                      <td className="py-3">{statusBadge(shop)}</td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(shop)}
                            className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 hover:text-neutral-700"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(shop.id)}
                            disabled={deleting === shop.id}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-neutral-400 hover:text-red-600"
                          >
                            {deleting === shop.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* CREATE / EDIT BARBERSHOP MODAL */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowForm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-neutral-900">
                  {editingId ? 'Editar estabelecimento' : 'Novo estabelecimento'}
                </h3>
                <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-neutral-100">
                  <X className="w-5 h-5 text-neutral-500" />
                </button>
              </div>

              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-4">
                  {formError}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <Label>Nome do estabelecimento *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Salão do João"
                  />
                </div>
                <div>
                  <Label>Slug *</Label>
                  <Input
                    value={form.slug}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        slug: e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9-]/g, '-')
                          .replace(/-+/g, '-'),
                      })
                    }
                    placeholder="salao-do-joao"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Nome do dono</Label>
                    <Input
                      value={form.owner_name}
                      onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
                      placeholder="João Silva"
                    />
                  </div>
                  <div>
                    <Label>Telefone</Label>
                    <Input
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="joao@email.com"
                    type="email"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Status da assinatura</Label>
                    <select
                      value={form.subscription_status}
                      onChange={(e) => setForm({ ...form, subscription_status: e.target.value as any })}
                      className="w-full h-10 rounded-md border border-neutral-200 px-3 text-sm"
                    >
                      <option value="trial">Trial</option>
                      <option value="active">Ativo</option>
                      <option value="cancelled">Cancelado</option>
                      <option value="expired">Expirado</option>
                    </select>
                  </div>
                  <div>
                    <Label>Expiração do trial</Label>
                    <Input
                      type="date"
                      value={form.trial_expires_at}
                      onChange={(e) => setForm({ ...form, trial_expires_at: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Valor por profissional (R$/mês)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.seat_price}
                    onChange={(e) => setForm({ ...form, seat_price: e.target.value })}
                    placeholder="35.00"
                  />
                  <p className="text-xs text-neutral-400 mt-1">Cobrança mensal = valor × profissionais ativos</p>
                </div>
                <div>
                  <Label>Imagem do estabelecimento (URL)</Label>
                  <Input
                    type="url"
                    value={form.image_url}
                    onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                    placeholder="https://..."
                  />
                  <p className="text-xs text-neutral-400 mt-1">Exibida no monitor e na tela do cliente</p>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={saving} className="gap-2 bg-neutral-900 hover:bg-neutral-800">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  {editingId ? 'Salvar' : 'Criar'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="py-6 bg-neutral-900 text-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm mb-1">FilaLivre &copy;</p>
          <p className="text-xs text-neutral-400">Sistema inteligente de fila de atendimento</p>
        </div>
      </footer>
    </div>
  );
}
