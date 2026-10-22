import { cn } from '@/shared/utils/utils';
import { Search, X } from 'lucide-react';
import type { ComponentType } from 'react';

/** Cualquier icono que acepte `className`: sirven los de lucide y los de react-icons. */
type IconoDeCampo = ComponentType<{ className?: string }>;

interface CampoDeBusquedaProps {
  valor: string;
  onCambio: (valor: string) => void;
  placeholder?: string;
  className?: string;
  /** Para el `aria-label` cuando no hay etiqueta visible. */
  etiqueta?: string;
  /** La lupa. Por defecto la de lucide; las pantallas que ya usaban react-icons pasan la suya. */
  Icono?: IconoDeCampo;
  /** La equis de limpiar. Misma idea. */
  IconoLimpiar?: IconoDeCampo;
  classNameLimpiar?: string;
  classNameIconoLimpiar?: string;
}

/**
 * El buscador de las pantallas de listado: lupa a la izquierda, caja de texto
 * y una equis para limpiar que solo aparece cuando hay algo escrito.
 *
 * Estaba copiado con las MISMAS clases —las 16 del input incluidas— en seis
 * pantallas: categorías, facturas, órdenes, productos, proveedores y órdenes
 * de compra. Lo que cambiaba era el placeholder y, en dos de ellas, que la
 * lupa venía de `react-icons` en vez de `lucide`; de ahí los props de icono,
 * que existen para no mover un solo píxel al unificar.
 */
export const CampoDeBusqueda = ({
  valor,
  onCambio,
  placeholder,
  className,
  etiqueta,
  Icono = Search,
  IconoLimpiar = X,
  classNameLimpiar,
  classNameIconoLimpiar,
}: CampoDeBusquedaProps) => (
  <div className={cn('relative', className)}>
    <Icono className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dim" />
    <input
      type="text"
      placeholder={placeholder}
      aria-label={etiqueta ?? placeholder}
      value={valor}
      onChange={(e) => onCambio(e.target.value)}
      className="w-full pl-9 pr-8 py-1.5 text-sm border border-line rounded-lg bg-page text-content placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
    />
    {valor && (
      <button
        type="button"
        aria-label="Limpiar la busqueda"
        onClick={() => onCambio('')}
        className={cn(
          'absolute right-2.5 top-1/2 -translate-y-1/2 text-dim hover:text-content',
          classNameLimpiar,
        )}
      >
        <IconoLimpiar className={cn('w-3.5 h-3.5', classNameIconoLimpiar)} />
      </button>
    )}
  </div>
);
