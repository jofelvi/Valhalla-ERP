'use client';

import { ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  cargando: boolean;
  error: unknown;
  /** Qué hacer al pulsar "Reintentar". */
  reintentar: () => void;
  /** Qué se pinta mientras carga. Por defecto, barras grises. */
  esqueleto?: ReactNode;
  /** Nombre de lo que fallo, para que el aviso diga QUE no cargo. */
  que: string;
  /**
   * Lo que el recuadro vacío NO significa. Cambia por pantalla: en el panel
   * es "no porque no haya ventas"; en la cartera, "no porque no haya deuda".
   */
  motivoVacio?: string;
  children: ReactNode;
}

/**
 * Los tres estados de un bloque que pide datos: cargando, roto y con datos.
 *
 * Existe por un defecto concreto del panel viejo: todos los hooks caian a
 * `= []` por defecto, asi que cuando la API fallaba las tarjetas mostraban
 * "USD 0,00" con total normalidad. No habia forma de distinguir "hoy no se ha
 * vendido" de "la API esta caida" — en una pantalla que reporta dinero, eso es
 * peor que no mostrar nada.
 *
 * Aqui un fallo se ve como un fallo, dice que fallo, y ofrece reintentar ese
 * bloque solo sin recargar la pagina.
 *
 * Vive en compartidos desde el 20/09/2026: cuentas por cobrar tenia el mismo
 * problema (tarjetas en cero cuando la consulta fallaba) y no tenia sentido
 * escribirlo dos veces.
 */
export default function EstadoDeBloque({
  cargando,
  error,
  reintentar,
  esqueleto,
  que,
  motivoVacio = 'no porque no haya datos',
  children,
}: Props) {
  if (error) {
    const detalle = error instanceof Error ? error.message : null;
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-lg border border-danger/40 bg-danger/5 p-4"
      >
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
          <div>
            <p className="text-sm font-semibold text-content">
              No se pudo cargar {que}
            </p>
            <p className="mt-0.5 text-xs text-dim">
              {detalle ?? 'La conexión con el servidor falló.'}
            </p>
            <p className="mt-1 text-xs text-dim">
              Este recuadro está vacío porque falló la consulta,{' '}
              <span className="font-medium text-content">{motivoVacio}</span>.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={reintentar}
          className="inline-flex items-center gap-1.5 rounded-md border border-line bg-elevated px-2.5 py-1.5 text-xs font-semibold text-content transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Reintentar
        </button>
      </div>
    );
  }

  if (cargando) {
    return (
      <div aria-busy="true" aria-live="polite">
        <span className="sr-only">Cargando {que}…</span>
        {esqueleto ?? <Esqueleto lineas={3} />}
      </div>
    );
  }

  return <>{children}</>;
}

/** Barras grises del alto del contenido real, para que nada salte al llegar. */
export function Esqueleto({
  lineas = 3,
  className = '',
}: {
  lineas?: number;
  className?: string;
}) {
  return (
    <div className={`animate-pulse space-y-2.5 ${className}`}>
      {Array.from({ length: lineas }).map((_, i) => (
        <div
          key={i}
          className="h-3 rounded bg-elevated"
          style={{ width: `${100 - i * 12}%` }}
        />
      ))}
    </div>
  );
}
