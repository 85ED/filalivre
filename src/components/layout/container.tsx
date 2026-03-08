import { cn } from '@/lib/utils';

interface ContainerProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
};

export function Container({ children, className, maxWidth = 'md' }: ContainerProps) {
  return (
    <div className={cn(maxWidthClasses[maxWidth], 'mx-auto px-4', className)}>
      {children}
    </div>
  );
}
