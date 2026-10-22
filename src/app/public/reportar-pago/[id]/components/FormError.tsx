import { AlertCircle } from 'lucide-react';

interface FormErrorProps {
  message: string;
}

export function FormError({ message }: FormErrorProps) {
  return (
    <div className="bg-red-50 border border-danger rounded-lg p-3 flex items-start gap-2">
      <AlertCircle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
      <p className="text-sm text-danger">{message}</p>
    </div>
  );
}
