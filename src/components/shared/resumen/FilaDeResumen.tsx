import { cn } from '@/shared/utils/utils';
import type { ReactNode } from 'react';

interface FilaDeResumenProps {
  /** Lo que va a la izquierda: "Subtotal:", "IVA (16%)", "Pagado". */
  etiqueta: ReactNode;
  /** Lo que va a la derecha, normalmente una cifra. */
  valor: ReactNode;
  /** Ajustes de la fila (separador, color, tamano). */
  className?: string;
  classNameEtiqueta?: string;
  classNameValor?: string;
}

/**
 * La fila de "etiqueta a la izquierda, cifra a la derecha" de los bloques de
 * totales: recibo, precuenta, factura, orden, nomina, recepcion de compra.
 *
 * Eran 52 divs `flex justify-between` con dos `<span>` dentro, repartidos por
 * 20 archivos. Cada bloque de totales los reescribia enteros.
 */
export const FilaDeResumen = ({
  etiqueta,
  valor,
  className,
  classNameEtiqueta,
  classNameValor,
}: FilaDeResumenProps) => (
  <div className={cn('flex justify-between', className)}>
    <span className={classNameEtiqueta}>{etiqueta}</span>
    <span className={classNameValor}>{valor}</span>
  </div>
);
