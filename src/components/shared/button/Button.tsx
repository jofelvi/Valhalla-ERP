import { cn } from '@/shared/utils/utils';
import { forwardRef } from 'react';
import { FiLoader } from 'react-icons/fi';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
};

const baseClasses =
  'inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none transform hover:scale-[1.02] active:scale-[0.98]';

// Estilo actualizado con paleta cyan/blue-green
const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  default:
    'bg-gradient-to-r from-brand to-brand-light text-on-brand hover:from-brand-light hover:to-brand shadow-lg shadow-brand/30 hover:shadow-xl hover:shadow-brand/40 focus-visible:ring-brand',
  outline:
    'border border-brand text-brand hover:bg-brand/5 hover:border-brand-dark focus-visible:ring-brand',
  ghost: 'text-dim hover:bg-brand/5 hover:text-brand focus-visible:ring-brand',
  destructive:
    'bg-gradient-to-r from-danger to-danger/90 text-on-brand hover:opacity-90 shadow-lg shadow-danger/30 hover:shadow-xl hover:shadow-danger/40 focus-visible:ring-danger',
};

// Ajustes de tamaño modernos
const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-11 px-6 py-2.5 text-base',
  lg: 'h-13 px-8 py-3 text-lg',
};

// Clases para iconos según tamaño
const iconSizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'default',
      size = 'md',
      isLoading = false,
      startIcon,
      endIcon,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    // Determinar si debemos mostrar iconos
    const showStartIcon = !isLoading && startIcon;
    const showEndIcon = !isLoading && endIcon;

    return (
      <button
        ref={ref}
        className={cn(
          baseClasses,
          variantClasses[variant],
          sizeClasses[size],
          // Efectos ya incluidos en baseClasses
          className,
        )}
        disabled={isLoading || disabled}
        {...props}
      >
        {isLoading && (
          <FiLoader
            className={cn('animate-spin mr-2', iconSizeClasses[size])}
          />
        )}

        {showStartIcon && (
          <span className={cn('mr-2', iconSizeClasses[size])}>{startIcon}</span>
        )}

        {children}

        {showEndIcon && (
          <span className={cn('ml-2', iconSizeClasses[size])}>{endIcon}</span>
        )}
      </button>
    );
  },
);

Button.displayName = 'Button';
