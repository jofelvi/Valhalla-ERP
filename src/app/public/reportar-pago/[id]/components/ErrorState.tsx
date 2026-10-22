import { AlertCircle } from 'lucide-react';

interface ErrorStateProps {
  message?: string | null;
}

export function ErrorState({ message }: ErrorStateProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-rose-50 to-pink-50 flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-danger rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-danger" />
        </div>
        <h1 className="text-xl font-bold text-content mb-2">
          Cuenta no encontrada
        </h1>
        <p className="text-dim text-sm">
          {message ||
            'No pudimos cargar la cuenta por cobrar. Verifica el enlace e intenta nuevamente.'}
        </p>
      </div>
    </div>
  );
}
