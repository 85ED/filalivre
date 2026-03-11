import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BackgroundPaths } from '@/components/ui/background-paths';
import { LogIn, Loader2, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks';
import { FilaLivreLogo } from '@/components/ui/filalivre-logo';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { login, getRedirectPath } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'FilaLivre — Login';
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Preencha email e senha');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const user = await login({ email, password });
      const path = getRedirectPath(user.role);
      navigate(path);
    } catch (err: any) {
      if (err?.status === 0) {
        setError('Não foi possível conectar ao servidor. Tente novamente em instantes.');
      } else if (err?.status === 401) {
        setError('Email ou senha incorretos. Verifique seus dados e tente novamente.');
      } else {
        setError(err?.data?.error || err?.message || 'Algo deu errado. Tente novamente.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white relative">
      <BackgroundPaths />

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="bg-white rounded-2xl shadow-2xl p-8 border border-neutral-100">
            <div className="text-center mb-8">
              <FilaLivreLogo className="w-16 h-16 mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-neutral-900 mb-2">
                FilaLivre
              </h1>
              <p className="text-neutral-600">
                Acesse sua conta
              </p>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800">{error}</p>
                  {error.includes('servidor') && (
                    <p className="text-xs text-red-600 mt-1">Se o problema persistir, entre em contato com o suporte.</p>
                  )}
                </div>
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-neutral-900">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 rounded-xl border-neutral-200 focus:border-neutral-900"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-neutral-900">
                  Senha
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 rounded-xl border-neutral-200 focus:border-neutral-900"
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-base font-semibold"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Entrar'
                )}
              </Button>
            </form>

            <div className="mt-6 flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/esqueci-senha')}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Esqueci minha senha
              </button>
              <Link to="/" className="text-neutral-600 hover:text-neutral-900 text-sm">
                Voltar para o início
              </Link>
            </div>
          </div>
        </motion.div>
      </div>

      <footer className="relative z-10 py-6 text-center">
        <p className="text-sm text-neutral-400">FilaLivre &copy; Sistema inteligente de fila de atendimento</p>
      </footer>
    </div>
  );
}
