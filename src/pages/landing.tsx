import { motion, AnimatePresence } from 'framer-motion';
import { BackgroundPaths } from '@/components/ui/background-paths';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowRight, Smartphone, Eye, Bell, CircleCheck as CheckCircle, User, LogIn, X, Loader2, AlertCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { FilaLivreLogo } from '@/components/ui/filalivre-logo';
import { useAuth } from '@/hooks';

export function LandingPage() {
  const title = 'Fila Inteligente de Atendimento';
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

  useEffect(() => {
    document.title = 'FilaLivre — Sistema de fila inteligente';
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
                    placeholder="Ex: Barbearia do João"
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
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FilaLivreLogo className="w-10 h-10" />
              <span className="text-xl font-bold text-neutral-900">FilaLivre</span>
            </div>
            <Link to="/login">
              <Button variant="outline" size="sm" className="gap-2">
                <LogIn className="w-4 h-4" />
                Login
              </Button>
            </Link>
          </div>

          <div className="max-w-7xl mx-auto px-4 py-20 sm:py-32">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 2 }}
              className="text-center space-y-8"
            >
              <motion.h1 className="text-5xl sm:text-7xl md:text-8xl font-bold mb-8 tracking-tighter">
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
                Seus clientes acompanham a fila pelo celular enquanto você trabalha.
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
                >
                  Experimentar grátis
                  <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
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

      <section className="py-24 bg-neutral-50">
        <div className="max-w-7xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl sm:text-5xl font-bold text-neutral-900 mb-4">
              Como funciona
            </h2>
            <p className="text-xl text-neutral-600">Simples, rápido e eficiente</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Smartphone,
                title: 'Cliente entra na fila pelo celular',
                description: 'Acesso rápido e simples pelo navegador, sem necessidade de instalação',
                color: 'from-blue-500 to-cyan-500',
              },
              {
                icon: Eye,
                title: 'Acompanha posição em tempo real',
                description: 'Visualização clara da posição e tempo estimado de espera',
                color: 'from-purple-500 to-pink-500',
              },
              {
                icon: Bell,
                title: 'É chamado quando chega sua vez',
                description: 'Notificação automática para não perder o momento do atendimento',
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

      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl sm:text-5xl font-bold text-neutral-900 mb-4">
              Benefícios
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: 'Acabe com a confusão de fila',
                description: 'Elimine filas físicas e organize o fluxo de clientes automaticamente',
              },
              {
                title: 'Clientes acompanham a vez pelo celular',
                description: 'Liberdade para o cliente fazer outras atividades enquanto espera',
              },
              {
                title: 'Mais organização no atendimento',
                description: 'Gerencie melhor seu tempo e ofereça uma experiência premium',
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

      <section className="py-24 bg-neutral-50">
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
            <div className="bg-white rounded-2xl p-12 shadow-lg">
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

      <footer className="py-8 bg-neutral-900 text-white">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-lg mb-2">FilaLivre &copy;</p>
          <p className="text-neutral-400">Sistema inteligente de fila de atendimento</p>
        </div>
      </footer>
    </div>
  );
}
