'use client';

import { useEffect } from 'react';

/** Frontera de error de /customer/*. Ver el comentario de private/error.tsx. */
export default function CustomerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[customer] error de ruta:', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-line bg-surface p-6 text-center">
        <h2 className="text-lg font-semibold text-content">
          No pudimos cargar esta pantalla
        </h2>
        <p className="mt-2 text-sm text-dim">Probá de nuevo.</p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-on-brand hover:bg-brand-dark"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
