import { motion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { Chrome as Home, User, Monitor, Scissors, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DockItem {
  icon: React.ElementType;
  label: string;
  href: string;
}

const dockItems: DockItem[] = [
  { icon: Home, label: 'Início', href: '/' },
  { icon: User, label: 'Cliente', href: '/cliente' },
  { icon: Monitor, label: 'Monitor', href: '/monitor' },
  { icon: Scissors, label: 'Barbeiro', href: '/barbeiro' },
  { icon: Settings, label: 'Admin', href: '/admin' },
];

export function Dock() {
  const location = useLocation();

  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[1000]"
    >
      <div className="backdrop-blur-xl bg-slate-900/60 border border-slate-700/50 rounded-2xl px-3 py-3 shadow-2xl shadow-blue-500/10">
        <div className="flex items-center gap-2">
          {dockItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;

            return (
              <Link key={item.href} to={item.href}>
                <motion.div
                  whileHover={{ scale: 1.2, y: -8 }}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    'relative p-3 rounded-xl transition-colors',
                    isActive
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  )}
                >
                  <Icon className="w-5 h-5" />
                  {isActive && (
                    <motion.div
                      layoutId="dock-indicator"
                      className="absolute inset-0 bg-gradient-to-br from-blue-500/30 to-purple-500/30 rounded-xl"
                      style={{ zIndex: -1 }}
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <span className="sr-only">{item.label}</span>
                </motion.div>
              </Link>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
