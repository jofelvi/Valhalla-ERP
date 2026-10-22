import { cn } from '@/shared/utils/utils';
import { forwardRef, HTMLAttributes } from 'react';

/**
 * La superficie sobre la que se apoya casi todo el POS.
 *
 * Estas cinco clases —`bg-surface/90 backdrop-blur-sm rounded-xl border
 * border-line/50 shadow-sm`— estaban copiadas a mano en 50 sitios. Cambiar el
 * aspecto de la aplicación significaba encontrarlos todos, y bastaba con que
 * a uno le faltara `border-line/50` para que se notara.
 *
 * El relleno y el margen NO van aquí a propósito: cada pantalla usa el suyo
 * (`p-3`, `p-3.5`, `p-8 text-center`…) y se pasan por `className`.
 */
export const Panel = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'bg-surface/90 backdrop-blur-sm rounded-xl border border-line/50 shadow-sm',
        className,
      )}
      {...props}
    />
  ),
);
Panel.displayName = 'Panel';
