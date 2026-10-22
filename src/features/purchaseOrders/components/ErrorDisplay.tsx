// Componente para mostrar errores de validación
'use client';

interface ErrorDisplayProps {
  errors: Record<string, unknown>;
}

/**
 * Componente para mostrar errores de validación del formulario
 */
export function ErrorDisplay({ errors }: ErrorDisplayProps) {
  const errorCount = Object.keys(errors).length;
  if (errorCount === 0) return null;

  return (
    <div className="bg-gradient-to-r from-danger/10 to-danger/5 border border-danger text-danger px-4 py-3 rounded-xl shadow-sm">
      <div className="flex items-start gap-3">
        <div className="w-5 h-5 bg-danger rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
          <svg
            className="w-3 h-3 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>
        <div>
          <h4 className="font-semibold text-danger mb-2">
            Se encontraron los siguientes errores:
          </h4>
          <ul className="list-disc pl-5 space-y-1">
            {Object.entries(errors).map(([key, err]) => {
              let message = (err as { message: string }).message;
              // Mejorar mensajes de error específicos
              if (key === 'items' && message.includes('al menos un item')) {
                message = 'Debe agregar al menos un producto a la orden';
              }
              return (
                <li key={key} className="text-sm">
                  {message}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
