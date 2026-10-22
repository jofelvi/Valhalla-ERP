'use client';

import { useEffect } from 'react';

/**
 * Ultimo recurso: captura errores del propio layout raiz, que es lo unico que
 * `private/error.tsx` y `customer/error.tsx` no pueden cubrir.
 *
 * Reemplaza al layout raiz, asi que tiene que traer su propio <html>/<body> y
 * NO hereda los estilos de la app — por eso va con estilos en linea y no con
 * clases de Tailwind: si esto se renderiza, el CSS puede ser justamente lo que
 * fallo.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[global] error fatal:', error);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0C0A09',
          color: '#FAFAF9',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
            El sistema no pudo iniciar
          </h1>
          <p style={{ fontSize: 14, opacity: 0.7, marginTop: 8 }}>
            Reintentá. Si vuelve a pasar, avisá y pasá el código de abajo.
          </p>
          {error.digest && (
            <p
              style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: 11,
                opacity: 0.5,
                marginTop: 12,
              }}
            >
              ref: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 20,
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 500,
              color: '#fff',
              background: '#F59E0B',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
