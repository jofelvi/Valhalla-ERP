// shared/formFieldError.tsx

import { FieldError } from 'react-hook-form';
import React from 'react';
import { AlertCircle } from 'lucide-react';

interface FormFieldErrorProps {
  error?: FieldError | string;
  className?: string;
}

const FormFieldError: React.FC<FormFieldErrorProps> = ({
  error,
  className = 'text-danger text-xs mt-1',
}) => {
  // Si 'error' es un string, lo mostramos directamente
  if (typeof error === 'string') {
    if (!error) return null; // Para manejar casos donde el string esté vacío
    return <p className={className}>{error}</p>;
  }

  // Si 'error' es un FieldError (o undefined/null), procedemos como antes
  if (!error?.message) return null;

  return (
    <p className={className}>
      {' '}
      <AlertCircle className="w-4 h-4 text-danger" /> {error.message}{' '}
    </p>
  );
};

export default FormFieldError;
