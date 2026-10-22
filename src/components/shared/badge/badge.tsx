import { cn } from '@/shared/utils/utils';

export type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'
  | 'success'
  | 'warning' // Para estados como 'preparing' o 'cleaning'
  | 'info';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: React.ReactNode;
}

export function Badge({
  variant = 'default',
  className,
  children,
  ...props
}: BadgeProps) {
  const baseClasses =
    'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-sm';

  const variantClasses: Record<BadgeVariant, string> = {
    default: 'bg-brand/15 text-brand hover:bg-brand/25 focus:ring-brand/30',
    secondary: 'bg-elevated text-dim hover:bg-elevated/80 focus:ring-line',
    destructive:
      'bg-danger/15 text-danger hover:bg-danger/25 focus:ring-danger/30',
    outline:
      'border-2 border-line text-dim hover:bg-elevated hover:border-brand/50 focus:ring-brand/30',
    success: 'bg-ok/15 text-ok hover:bg-ok/25 focus:ring-ok/30',
    warning: 'bg-accent/15 text-accent hover:bg-accent/25 focus:ring-accent/30',
    info: 'bg-brand/10 text-brand-light hover:bg-brand/20 focus:ring-brand/30',
  };

  return (
    <span
      className={cn(baseClasses, variantClasses[variant], className)}
      {...props}
    >
      {children}
    </span>
  );
}
