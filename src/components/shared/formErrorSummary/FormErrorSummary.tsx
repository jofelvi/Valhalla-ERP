import React from 'react';
import { FieldErrors } from 'react-hook-form';

interface FormErrorSummaryProps {
  errors: FieldErrors;
}

export const FormErrorSummary: React.FC<FormErrorSummaryProps> = ({
  errors,
}) => {
  if (!errors || Object.keys(errors).length === 0) return null;

  return (
    <div className="bg-red-50 border border-danger text-danger px-4 py-3 rounded">
      <ul className="list-disc pl-5">
        {Object.entries(errors).map(([key, err]) => {
          const message = (err as { message?: string })?.message;
          return message ? <li key={key}>{message}</li> : null;
        })}
      </ul>
    </div>
  );
};
