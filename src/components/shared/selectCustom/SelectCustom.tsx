import React, { forwardRef } from 'react';
import {
  FieldError,
  FieldValues,
  Path,
  UseFormRegister,
} from 'react-hook-form';
import FormFieldError from '@/components/shared/formFieldError/FormFieldError';
import { AlertCircle, ChevronDown } from 'lucide-react';
import { cn } from '@/shared/utils/utils';

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

interface CustomSelectProps<T extends FieldValues> {
  id: string;
  label?: string;
  options: SelectOption[];
  value?: string | number;
  onChange?: (value: string) => void;
  error?: FieldError | string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  labelClassName?: string;
  selectClassName?: string;
  register?: UseFormRegister<T>;
  name?: Path<T>;
}

const CustomSelectInner = <T extends FieldValues>(
  {
    id,
    label,
    options,
    value,
    onChange,
    error,
    required = false,
    disabled = false,
    placeholder = 'Seleccionar...',
    className = '',
    labelClassName,
    selectClassName = '',
    register,
    name,
    ...props
  }: CustomSelectProps<T>,
  ref: React.Ref<HTMLSelectElement>,
) => {
  const hasError = Boolean(error);
  const registerProps = register && name ? register(name) : null;

  // Generar ID único si no se proporciona
  const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value;

    // Si hay onChange manual, llamarlo
    onChange?.(newValue);

    // Si hay registerProps.onChange (de react-hook-form), llamarlo también
    if (registerProps?.onChange) {
      registerProps.onChange(e);
    }
  };

  const baseClasses = cn(
    // Base styling moderno con glassmorphism - igual al Input
    'h-11 w-full rounded-xl border bg-surface/90 backdrop-blur-sm px-3 py-2 text-sm shadow-sm',
    'transition-all duration-200 ease-in-out',
    'focus:outline-none focus:ring-2 focus:ring-offset-0',
    // Apariencia del select
    'appearance-none cursor-pointer',
    // Disabled state
    'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-elevated',
  );

  const stateClasses = cn(
    hasError
      ? ['border-danger focus:border-danger focus:ring-danger/30']
      : disabled
        ? ['border-line bg-elevated text-dim']
        : [
            'border-line focus:border-brand focus:ring-brand/30 focus:bg-surface',
          ],
  );

  const labelClasses = cn(
    'block text-sm font-semibold mb-2',
    hasError ? 'text-danger' : 'text-dim',
    disabled && 'text-dim',
    labelClassName,
  );

  return (
    <div className={cn('space-y-1', className)}>
      {/* Label */}
      {label && (
        <label htmlFor={selectId} className={labelClasses}>
          {label}
          {required && (
            <span className="text-danger ml-1" aria-label="Campo requerido">
              *
            </span>
          )}
        </label>
      )}

      {/* Select Container */}
      <div className="relative">
        <select
          id={selectId}
          ref={ref}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          className={cn(
            baseClasses,
            stateClasses,
            // Padding right para el icono
            'pr-10',
            selectClassName,
          )}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${selectId}-error` : undefined}
          {...(registerProps && {
            name: registerProps.name,
            onBlur: registerProps.onBlur,
            ref: registerProps.ref,
          })}
          {...props}
        >
          <option value="" disabled className="text-dim">
            {placeholder}
          </option>
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
              className={option.disabled ? 'text-dim' : ''}
            >
              {option.label}
            </option>
          ))}
        </select>

        {/* Chevron Icon */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          {hasError ? (
            <AlertCircle className="w-4 h-4 text-danger" />
          ) : (
            <ChevronDown
              className={cn(
                'w-4 h-4 transition-colors duration-200',
                disabled ? 'text-dim' : 'text-brand',
              )}
            />
          )}
        </div>
      </div>

      {/* Error Message */}
      {hasError && (
        <div id={`${selectId}-error`}>
          <FormFieldError error={error} />
        </div>
      )}
    </div>
  );
};

const SelectCustom = forwardRef(CustomSelectInner) as <T extends FieldValues>(
  props: CustomSelectProps<T> & { ref?: React.Ref<HTMLSelectElement> },
) => ReturnType<typeof CustomSelectInner>;

export default SelectCustom;
