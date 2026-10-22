import * as React from 'react';
import { cn } from '@/shared/utils/utils';
import { FieldError } from 'react-hook-form';
import FormFieldError from '@/components/shared/formFieldError/FormFieldError';
import { AlertCircle } from 'lucide-react';

export interface TextareaWithErrorProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: FieldError | string;
  label?: string;
  textHelper?: string;
  required?: boolean;
}

const TextareaWithError = React.forwardRef<
  HTMLTextAreaElement,
  TextareaWithErrorProps
>(
  (
    {
      className,
      error,
      label,
      textHelper,
      required = false,
      id,
      disabled,
      ...props
    },
    ref,
  ) => {
    const hasError = Boolean(error);

    // Generar ID único si no se proporciona
    const textareaId =
      id || `textarea-${Math.random().toString(36).substr(2, 9)}`;

    const baseClasses = cn(
      'flex min-h-[80px] w-full rounded-xl border bg-surface/90 backdrop-blur-sm px-3 py-2 text-sm shadow-sm',
      'placeholder:text-brand-light/60',
      'focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-brand focus:bg-surface',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'transition-all duration-200 ease-in-out',
      'border-line',
      hasError && 'border-danger focus:border-danger focus:ring-red-500/30',
      className,
    );

    const labelClasses = cn(
      'block text-sm font-semibold mb-2',
      hasError ? 'text-danger' : 'text-dim',
      disabled && 'text-dim',
    );

    return (
      <div className="space-y-1">
        {/* Label */}
        {label && (
          <label htmlFor={textareaId} className={labelClasses}>
            {label}
            {required && (
              <span className="text-danger ml-1" aria-label="Campo requerido">
                *
              </span>
            )}
          </label>
        )}

        {/* Textarea Container */}
        <div className="relative">
          {/* Textarea Field */}
          <textarea
            id={textareaId}
            className={baseClasses}
            ref={ref}
            disabled={disabled}
            aria-invalid={hasError}
            aria-describedby={cn(
              textHelper && `${textareaId}-helper`,
              error && `${textareaId}-error`,
            )}
            {...props}
          />

          {/* Error Icon */}
          {hasError && (
            <div className="absolute top-2 right-2 pointer-events-none">
              <AlertCircle className="w-4 h-4 text-danger" />
            </div>
          )}
        </div>

        {/* Helper Text */}
        {textHelper && !hasError && (
          <p id={`${textareaId}-helper`} className="text-xs text-dim leading-4">
            {textHelper}
          </p>
        )}

        {/* Error Message */}
        {hasError && (
          <div id={`${textareaId}-error`}>
            <FormFieldError error={error} />
          </div>
        )}
      </div>
    );
  },
);

TextareaWithError.displayName = 'TextareaWithError';

export { TextareaWithError };
