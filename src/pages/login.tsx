import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BackgroundPaths } from '@/components/ui/background-paths';
import { LogIn } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

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
              <div className="w-16 h-16 rounded-full bg-neutral-900 flex items-center justify-center mx-auto mb-4">
                <LogIn className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-neutral-900 mb-2">
                Login
              </h1>
              <p className="text-neutral-600">
                Acesse sua conta
              </p>
            </div>

            <form className="space-y-6">
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
                className="w-full h-12 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-base font-semibold"
              >
                Entrar
              </Button>
            </form>

            <div className="mt-6 text-center">
              <Link to="/" className="text-neutral-600 hover:text-neutral-900 text-sm">
                Voltar para o início
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
