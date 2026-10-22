'use client';
import { CreditCard, ShieldCheck } from 'lucide-react';
import { cn } from '@/shared/utils/utils';

export type Pestana = 'pagos' | 'creditos';

interface Props {
  activa: Pestana;
  onCambiar: (pestana: Pestana) => void;
  pagos: number;
  creditos: number;
}

/**
 * Las dos colas de esta pantalla, cada una en su pestaña.
 *
 * Antes iban apiladas: 25 tarjetas de credito arriba y los pagos por
 * verificar (la razon de ser de la pantalla) al fondo, despues de 1.300 px.
 */
export function PestanasDeVerificacion({
  activa,
  onCambiar,
  pagos,
  creditos,
}: Props) {
  const pestanas: Array<{
    id: Pestana;
    texto: string;
    n: number;
    Icono: typeof ShieldCheck;
  }> = [
    { id: 'pagos', texto: 'Pagos por verificar', n: pagos, Icono: ShieldCheck },
    {
      id: 'creditos',
      texto: 'Créditos por decidir',
      n: creditos,
      Icono: CreditCard,
    },
  ];

  return (
    <div
      role="tablist"
      aria-label="Qué verificar"
      className="mb-4 flex gap-1 border-b border-line"
    >
      {pestanas.map(({ id, texto, n, Icono }) => {
        const seleccionada = activa === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            id={`pestana-${id}`}
            aria-selected={seleccionada}
            aria-controls={`panel-${id}`}
            onClick={() => onCambiar(id)}
            className={cn(
              '-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors',
              seleccionada
                ? 'border-brand text-content'
                : 'border-transparent text-dim hover:text-content',
            )}
          >
            <Icono className="h-4 w-4" aria-hidden />
            {texto}
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs tabular-nums',
                seleccionada
                  ? 'bg-brand/20 text-brand'
                  : 'bg-elevated text-dim',
              )}
            >
              {n}
            </span>
          </button>
        );
      })}
    </div>
  );
}
