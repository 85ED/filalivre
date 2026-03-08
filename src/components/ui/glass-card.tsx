import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;
}

export function GlassCard({ children, className, hover = true, glow = false }: GlassCardProps) {
  return (
    <motion.div
      whileHover={hover ? { scale: 1.02, y: -4 } : undefined}
      className={cn(
        'backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6',
        'shadow-lg shadow-black/20',
        glow && 'shadow-blue-500/20',
        className
      )}
    >
      {children}
    </motion.div>
  );
}
