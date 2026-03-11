import { motion, AnimatePresence } from 'framer-motion';
import { BackgroundPaths } from '@/components/ui/background-paths';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowRight, Smartphone, Eye, Bell, CircleCheck as CheckCircle, User, LogIn, X, Loader2, AlertCircle, ChevronDown, DollarSign, Shield, Zap, Users, BarChart3, MessageCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { FilaLivreLogo } from '@/components/ui/filalivre-logo';
import { useAuth } from '@/hooks';

export function LandingPage() {
  const title = 'Sistema de Gestão de Filas para Atendimento Presencial';
  const words = title.split(' ');
  const [showSignup, setShowSignup] = useState(false);
  const [signupData, setSignupData] = useState({
    establishmentName: '',
    name: '',
    email: '',
    password: '',
    phone: '',
  });
  const [signupError, setSignupError] = useState<string | null>(null);
  const [signupLoading, setSignupLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [publicPrice, setPublicPrice] = useState(35);
  const [priceLoading, setPriceLoading] = useState(true);

  useEffect(() => {
    document.title = 'FilaLivre — Sistema de Gestão de Filas | Fila Virtual pelo Celular';
    // Fetch public price from backend
    fetch('/api/barbershops/public-price')
      .then(res => res.json())
      .then(data => setPublicPrice(Math.round(data.priceCents / 100)))
      .catch(() => setPublicPrice(35)) // fallback to 35
      .finally(() => setPriceLoading(false));
  }, []);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupData.establishmentName || !signupData.name || !signupData.email || !signupData.password) {
      setSignupError('Preencha todos os campos obrigatórios');
      return;
    }
    setSignupError(null);
    setSignupLoading(true);
    try {
      await signup(signupData);
      navigate('/admin');
    } catch (err: any) {
      setSignupError(err?.data?.error || err?.message || 'Erro ao criar conta');
    } finally {
      setSignupLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Signup Modal */}
      <AnimatePresence>
        {showSignup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
            role="dialog"
            aria-modal="true"
            aria-label="Criar conta grátis"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <FilaLivreLogo className="w-10 h-10" />
                  <div>
                    <h2 className="text-xl font-bold text-neutral-900">Experimentar grátis</h2>
                    <p className="text-sm text-neutral-500">7 dias grátis, sem compromisso</p>
                  </div>
                </div>
                <button onClick={() => setShowSignup(false)} className="p-2 hover:bg-neutral-100 rounded-lg">
                  <X className="w-5 h-5 text-neutral-500" />
                </button>
              </div>

              {signupError && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <p className="text-sm text-red-700">{signupError}</p>
                </div>
              )}

              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-neutral-900">Nome do estabelecimento *</Label>
                  <Input
                    placeholder="Ex: Salão do João"
                    value={signupData.establishmentName}
                    onChange={(e) => setSignupData({ ...signupData, establishmentName: e.target.value })}
                    className="h-12 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-neutral-900">Seu nome *</Label>
                  <Input
                    placeholder="Seu nome completo"
                    value={signupData.name}
                    onChange={(e) => setSignupData({ ...signupData, name: e.target.value })}
                    className="h-12 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-neutral-900">Email *</Label>
                  <Input
                    type="email"
                    placeholder="seu@email.com"
                    value={signupData.email}
                    onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                    className="h-12 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-neutral-900">Senha *</Label>
                  <Input
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={signupData.password}
                    onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                    className="h-12 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-neutral-900">Telefone <span className="text-neutral-400 text-sm font-normal">(opcional)</span></Label>
                  <Input
                    type="tel"
                    placeholder="(11) 99999-9999"
                    value={signupData.phone}
                    onChange={(e) => setSignupData({ ...signupData, phone: e.target.value })}
                    className="h-12 rounded-xl"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={signupLoading}
                  className="w-full h-12 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-base font-semibold"
                >
                  {signupLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    'Criar conta e começar'
                  )}
                </Button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative overflow-hidden bg-white">
        <BackgroundPaths />

        <div className="relative z-10">
          {/* Navbar */}
          <header>
            <nav className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between" aria-label="Navegação principal">
              <div className="flex items-center gap-2">
                <FilaLivreLogo className="w-10 h-10" />
                <span className="text-xl font-bold text-neutral-900">FilaLivre</span>
              </div>
              <Link to="/login">
                <Button variant="outline" size="sm" className="gap-2" aria-label="Fazer login">
                  <LogIn className="w-4 h-4" />
                  Login
                </Button>
              </Link>
            </nav>
          </header>

          <div className="max-w-7xl mx-auto px-4 py-20 sm:py-32">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 2 }}
              className="text-center space-y-8"
            >
              <motion.h1 className="text-4xl sm:text-6xl md:text-7xl font-bold mb-8 tracking-tighter">
                {words.map((word, wordIndex) => (
                  <span key={wordIndex} className="inline-block mr-4 last:mr-0">
                    {word.split('').map((letter, letterIndex) => (
                      <motion.span
                        key={`${wordIndex}-${letterIndex}`}
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{
                          delay: wordIndex * 0.1 + letterIndex * 0.03,
                          type: 'spring',
                          stiffness: 150,
                          damping: 25,
                        }}
                        className="inline-block text-transparent bg-clip-text bg-gradient-to-r from-neutral-900 to-neutral-700/80"
                      >
                        {letter}
                      </motion.span>
                    ))}
                  </span>
                ))}
              </motion.h1>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-xl sm:text-2xl text-neutral-600 max-w-3xl mx-auto leading-relaxed"
              >
                Seus clientes entram na fila pelo celular, acompanham a posição em tempo real e recebem aviso quando a vez chega. Funciona para qualquer tipo de estabelecimento.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8"
              >
                <Button
                  size="lg"
                  onClick={() => setShowSignup(true)}
                  className="group relative bg-neutral-900 hover:bg-neutral-800 text-white border-0 shadow-lg px-8 py-6 text-lg rounded-xl"
                  aria-label="Experimentar FilaLivre grátis por 7 dias"
                >
                  Experimentar grátis
                  <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                </Button>

                <Link to="/login">
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-neutral-200 hover:bg-neutral-50 text-neutral-900 px-8 py-6 text-lg rounded-xl"
                  >
                    <LogIn className="mr-2 w-5 h-5" />
                    Login
                  </Button>
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>

      <main>
      <section className="py-24 bg-neutral-50" aria-labelledby="como-funciona">
        <div className="max-w-7xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 id="como-funciona" className="text-4xl sm:text-5xl font-bold text-neutral-900 mb-4">
              Como funciona a fila virtual
            </h2>
            <p className="text-xl text-neutral-600">Três passos para eliminar filas de espera no seu estabelecimento</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Smartphone,
                title: 'Cliente entra na fila pelo celular',
                description: 'Sem instalar aplicativo. O cliente acessa o link do seu estabelecimento e entra na fila em segundos.',
                color: 'from-blue-500 to-cyan-500',
              },
              {
                icon: Eye,
                title: 'Acompanha a posição em tempo real',
                description: 'O cliente vê exatamente onde está na fila e o tempo estimado de espera, na tela do celular.',
                color: 'from-purple-500 to-pink-500',
              },
              {
                icon: Bell,
                title: 'Recebe alerta quando chega a vez',
                description: 'Notificação automática por WhatsApp ou na tela. O cliente não precisa ficar esperando no local.',
                color: 'from-emerald-500 to-teal-500',
              },
            ].map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2 }}
                className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow"
                role="article"
              >
                <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center mb-6`}>
                  <step.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-neutral-900 mb-4">
                  {step.title}
                </h3>
                <p className="text-neutral-600 leading-relaxed">
                  {step.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Preço */}
      <section className="py-24 bg-white" aria-labelledby="preco">
        <div className="max-w-7xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 id="preco" className="text-4xl sm:text-5xl font-bold text-neutral-900 mb-4">
              Preço simples e transparente
            </h2>
            <p className="text-xl text-neutral-600">Pague apenas pelo que usa. Sem planos confusos, sem surpresa na fatura.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-lg mx-auto"
          >
            <div className="bg-white rounded-2xl p-8 sm:p-10 shadow-xl border-2 border-neutral-900 relative">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-neutral-900 text-white text-sm font-bold px-4 py-1 rounded-full">
                7 dias grátis
              </div>
              <div className="text-center mb-8">
                <div className="flex items-baseline justify-center gap-1 mb-2">
                  <span className="text-lg text-neutral-500">R$</span>
                  <span className="text-6xl font-black text-neutral-900">{priceLoading ? '...' : publicPrice}</span>
                  <span className="text-neutral-500">/mês</span>
                </div>
                <p className="text-neutral-600 text-lg">por profissional ativo</p>
              </div>
              <div className="space-y-3 mb-8">
                {[
                  'Fila digital em tempo real',
                  'Painel administrativo completo',
                  'Relatórios e estatísticas de atendimento',
                  'Alertas automáticos por WhatsApp',
                  'Link público exclusivo do seu estabelecimento',
                  'Monitor TV para exibir a fila no local',
                  'Cobrança proporcional — cresce com você',
                  'Sem taxa de setup, sem contrato de fidelidade',
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    <span className="text-neutral-700">{item}</span>
                  </div>
                ))}
              </div>
              <Button
                size="lg"
                onClick={() => setShowSignup(true)}
                className="w-full bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-lg h-14 font-semibold"
                aria-label="Criar conta e experimentar grátis por 7 dias"
              >
                Criar minha conta grátis
                <ArrowRight className="ml-2 w-5 h-5" aria-hidden="true" />
              </Button>
              <p className="text-center text-sm text-neutral-400 mt-3">Sem cartão de crédito • Cancele quando quiser</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Benefícios */}
      <section className="py-24 bg-neutral-50" aria-labelledby="beneficios">
        <div className="max-w-7xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 id="beneficios" className="text-4xl sm:text-5xl font-bold text-neutral-900 mb-4">
              Por que usar o FilaLivre?
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: 'Elimine filas físicas de vez',
                description: 'Seus clientes não precisam mais esperar em pé. A fila é digital e organizada automaticamente.',
              },
              {
                title: 'Clientes livres enquanto esperam',
                description: 'Com a fila virtual no celular, seu cliente pode tomar um café, passear ou resolver outras coisas enquanto aguarda.',
              },
              {
                title: 'Atendimento mais profissional',
                description: 'Gerencie melhor o fluxo de atendimento e transforme a experiência do seu cliente em algo organizado e moderno.',
              },
            ].map((benefit, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2 }}
                className="text-center"
              >
                <div className="w-12 h-12 rounded-full bg-neutral-900 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-neutral-900 mb-4">
                  {benefit.title}
                </h3>
                <p className="text-neutral-600 leading-relaxed">
                  {benefit.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Sobre a Plataforma */}
      <section className="py-24 bg-white" aria-labelledby="plataforma">
        <div className="max-w-7xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 id="plataforma" className="text-4xl sm:text-5xl font-bold text-neutral-900 mb-4">
              Tudo que seu estabelecimento precisa
            </h2>
            <p className="text-xl text-neutral-600">Controle de fila completo: do celular do cliente ao painel do gestor</p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Users,
                title: 'Fila digital',
                description: 'Seus clientes entram na fila pelo celular, sem instalar nada. Basta acessar o link do seu estabelecimento.',
                color: 'from-blue-500 to-cyan-500',
              },
              {
                icon: BarChart3,
                title: 'Painel do administrador',
                description: 'Visão geral em tempo real: fila, atendimentos, profissionais ativos e relatórios detalhados.',
                color: 'from-purple-500 to-pink-500',
              },
              {
                icon: Smartphone,
                title: 'Tela do profissional',
                description: 'Cada profissional controla seus atendimentos pelo celular: chamar, finalizar e acompanhar a fila.',
                color: 'from-emerald-500 to-teal-500',
              },
              {
                icon: Eye,
                title: 'Monitor TV',
                description: 'Exiba a fila no monitor do estabelecimento. Seus clientes veem quem está sendo atendido e qual a posição.',
                color: 'from-orange-500 to-amber-500',
              },
              {
                icon: MessageCircle,
                title: 'Alertas por WhatsApp',
                description: 'Quando chegar perto da vez, o cliente recebe um aviso automático no WhatsApp. Sem spam.',
                color: 'from-green-500 to-emerald-500',
              },
              {
                icon: Shield,
                title: 'Seguro e confiável',
                description: 'Dados protegidos, sistema em nuvem com alta disponibilidade. Funciona 24h sem interrupção.',
                color: 'from-indigo-500 to-violet-500',
              },
            ].map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-neutral-50 rounded-2xl p-6 hover:shadow-md transition-shadow"
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-neutral-900 mb-2">{feature.title}</h3>
                  <p className="text-neutral-600 text-sm leading-relaxed">{feature.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 bg-neutral-50" aria-labelledby="faq">
        <div className="max-w-3xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 id="faq" className="text-4xl sm:text-5xl font-bold text-neutral-900 mb-4">
              Perguntas frequentes
            </h2>
          </motion.div>

          <div className="space-y-3">
            {[
              {
                q: 'Preciso instalar algum aplicativo?',
                a: 'Não. O FilaLivre funciona 100% pelo navegador. Seus clientes acessam pelo link do estabelecimento, sem baixar nada.',
              },
              {
                q: 'Como funciona o período de teste?',
                a: 'Ao criar sua conta, você tem 7 dias gratuitos com acesso completo a todas as funcionalidades. Não pedimos cartão de crédito para começar.',
              },
              {
                q: 'Quanto custa após o período de teste?',
                a: `R$${publicPrice} por mês por profissional ativo. Se você tem 3 profissionais, paga R$${publicPrice * 3}/mês. Simples assim. Sem taxa de setup, sem contrato de fidelidade.`,
              },
              {
                q: 'Posso cancelar a qualquer momento?',
                a: 'Sim. Sem multa, sem burocracia. Você cancela direto pelo painel e o sistema para de cobrar no próximo ciclo.',
              },
              {
                q: 'Funciona para qualquer tipo de estabelecimento?',
                a: 'Sim! Barbearias, salões de beleza, clínicas, consultórios, restaurantes, cartórios, laboratórios, serviços públicos — qualquer lugar que trabalhe com fila de atendimento presencial.',
              },
              {
                q: 'Como funciona o alerta por WhatsApp?',
                a: 'Quando o cliente entra na fila e informa o telefone, o sistema envia um aviso automático quando faltam poucos atendimentos para a vez dele. Cada cliente recebe no máximo um alerta.',
              },
              {
                q: 'Meus dados estão seguros?',
                a: 'Sim. Usamos criptografia, servidores em nuvem com alta disponibilidade e seguimos as melhores práticas de segurança. Seus dados e os dos seus clientes estão protegidos.',
              },
              {
                q: 'Preciso de equipamento especial?',
                a: 'Não. Basta um celular ou computador com acesso à internet. Para o monitor TV, qualquer tela com navegador serve (Smart TV, tablet, etc).',
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="bg-white rounded-xl border border-neutral-200 overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full flex items-center justify-between p-5 text-left"
                  aria-expanded={openFaq === index}
                  aria-controls={`faq-answer-${index}`}
                >
                  <span className="font-semibold text-neutral-900 pr-4">{item.q}</span>
                  <ChevronDown className={`w-5 h-5 text-neutral-400 flex-shrink-0 transition-transform ${openFaq === index ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>
                <AnimatePresence>
                  {openFaq === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <p id={`faq-answer-${index}`} className="px-5 pb-5 text-neutral-600 leading-relaxed">{item.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Sobre o criador */}
      <section className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <h2 className="text-4xl sm:text-5xl font-bold text-neutral-900 mb-8">
              Sobre
            </h2>
            <div className="bg-neutral-50 rounded-2xl p-12 shadow-lg">
              <div className="w-20 h-20 rounded-full bg-neutral-900 flex items-center justify-center mx-auto mb-6">
                <User className="w-10 h-10 text-white" />
              </div>
              <p className="text-lg text-neutral-700 leading-relaxed mb-4">
                Criado por <span className="font-bold text-neutral-900">Edson Felix</span>.
              </p>
              <p className="text-lg text-neutral-700 leading-relaxed mb-4">
                Desenvolvedor em transição de carreira que decidiu resolver um problema real de atendimento presencial: a confusão nas filas.
              </p>
              <p className="text-lg text-neutral-700 leading-relaxed">
                O projeto nasceu com a ideia de transformar filas em uma experiência simples, visual e organizada.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-20 bg-neutral-900" aria-labelledby="cta-final">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 id="cta-final" className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Pronto para acabar com as filas de espera?
          </h2>
          <p className="text-neutral-400 text-lg mb-8">
            Crie sua conta em menos de 2 minutos e teste grátis por 7 dias. Sem cartão, sem compromisso.
          </p>
          <Button
            size="lg"
            onClick={() => setShowSignup(true)}
            className="bg-white hover:bg-neutral-100 text-neutral-900 rounded-xl text-lg h-14 px-10 font-semibold"
            aria-label="Criar conta grátis no FilaLivre"
          >
            Criar minha conta grátis
            <ArrowRight className="ml-2 w-5 h-5" aria-hidden="true" />
          </Button>
          <p className="text-neutral-500 text-sm mt-4">Mais de 7 dias não é suficiente? Fale conosco.</p>
        </div>
      </section>

      </main>

      <footer className="py-8 bg-neutral-900 text-white" role="contentinfo">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-lg mb-2">FilaLivre &copy; {new Date().getFullYear()}</p>
          <p className="text-neutral-400">Sistema de gestão de filas para atendimento presencial</p>
        </div>
      </footer>
    </div>
  );
}
