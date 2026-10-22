'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Frontera de error para TODO /private/*.
 *
 * Por que hace falta: sin `error.tsx`, si una ruta revienta durante una
 * transicion el App Router se queda con la transicion a medias y los clicks
 * SIGUIENTES del menu tampoco responden. El fallo original se ve como "el
 * sistema se trabo", sin nada en pantalla que lo explique.
 *
 * `reset()` reintenta renderizar solo este segmento: el sidebar, la sesion y
 * el cache de React Query se conservan. Recargar la pagina entera es el ultimo
 * recurso, no el primero — en la caja significa perder lo que se estaba
 * haciendo.
 */
export default function PrivateError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[private] error de ruta:', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-line bg-surface p-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-danger/10">
          <AlertTriangle className="h-6 w-6 text-danger" />
        </div>

        <h2 className="text-lg font-semibold text-content">
          Esta pantalla no se pudo cargar
        </h2>
        <p className="mt-2 text-sm text-dim">
          El resto del sistema sigue funcionando. Podés reintentar sin perder la
          sesión.
        </p>

        {error.digest && (
          <p className="mt-3 font-mono text-[11px] text-dim/70">
            ref: {error.digest}
          </p>
        )}

        <button
          type="button"
          onClick={reset}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-on-brand hover:bg-brand-dark"
        >
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </button>
      </div>
    </div>
  );
}
