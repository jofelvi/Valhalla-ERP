// features/ui/input.tsx
import * as React from 'react';
import { cn } from '@/shared/utils/utils';
import { FieldError } from 'react-hook-form';
import FormFieldError from '@/components/shared/formFieldError/FormFieldError';
import { AlertCircle, Search } from 'lucide-react';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: FieldError | string;
  variant?: 'default' | 'search' | 'numeric';
  label?: string;
  textHelper?: string;
  required?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      error,
      variant = 'default',
      label,
      textHelper,
      required = false,
      id,
      disabled,
      icon: Icon,
      ...props
    },
    ref,
  ) => {
    const hasError = Boolean(error);
    const hasIcon = Boolean(Icon) || variant === 'search';

    // Generar ID único si no se proporciona
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

    const baseClasses = cn(
      // Base styling moderno con glassmorphism
      'flex h-11 w-full rounded-xl border bg-elevated/50 backdrop-blur-sm py-2 text-sm text-content shadow-sm',
      'transition-all duration-200 ease-in-out',
      'placeholder:text-dim/70',
      'focus:outline-none focus:ring-2 focus:ring-offset-0',
      // File input styling
      'file:border-0 file:bg-transparent file:text-sm file:font-medium',
      // Disabled state
      'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-elevated',
      // Padding dinámico basado en iconos
      hasIcon ? 'pl-10' : 'px-3',
      hasError && variant !== 'search' && !Icon ? 'pr-10' : 'pr-3',
    );

    const variantClasses = {
      default: cn(
        'border-line',
        'focus:border-brand focus:ring-brand/30 focus:bg-surface',
        hasError && 'border-danger focus:border-danger focus:ring-danger/30',
      ),
      search: cn(
        'border-line bg-elevated/80',
        'focus:border-brand focus:ring-brand/30 focus:bg-surface',
        hasError && 'border-danger focus:border-danger focus:ring-danger/30',
      ),
      numeric: cn(
        'text-right border-line',
        'focus:border-brand focus:ring-brand/30 focus:bg-surface',
        hasError && 'border-danger focus:border-danger focus:ring-danger/30',
      ),
    };

    const labelClasses = cn(
      'block text-sm font-semibold mb-2',
      hasError ? 'text-danger' : 'text-dim',
      disabled && 'text-dim',
    );

    const iconClasses = cn(
      'w-4 h-4 transition-colors duration-200',
      hasError ? 'text-danger' : 'text-brand',
      disabled && 'text-content',
    );

    return (
      <div className="space-y-1">
        {/* Label */}
        {label && (
          <label htmlFor={inputId} className={labelClasses}>
            {label}
            {required && (
              <span className="text-danger ml-1" aria-label="Campo requerido">
                *
              </span>
            )}
          </label>
        )}

        {/* Input Container */}
        <div className="relative">
          {/* Custom Icon or Search Icon */}
          {(Icon || variant === 'search') && (
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              {Icon ? (
                <Icon className={iconClasses} />
              ) : (
                <Search className={iconClasses} />
              )}
            </div>
          )}

          {/* Input Field */}
          <input
            id={inputId}
            type={type}
            className={cn(baseClasses, variantClasses[variant], className)}
            ref={ref}
            disabled={disabled}
            aria-invalid={hasError}
            aria-describedby={cn(
              textHelper && `${inputId}-helper`,
              error && `${inputId}-error`,
            )}
            {...props}
          />

          {/* Error Icon - Solo se muestra si no hay icono personalizado */}
          {hasError && variant !== 'search' && !Icon && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <AlertCircle className="w-4 h-4 text-danger" />
            </div>
          )}
        </div>

        {/* Helper Text */}
        {textHelper && !hasError && (
          <p id={`${inputId}-helper`} className="text-xs text-dim leading-4">
            {textHelper}
          </p>
        )}

        {/* Error Message */}
        {hasError && (
          <div id={`${inputId}-error`}>
            <FormFieldError error={error} />
          </div>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';

export { Input };
