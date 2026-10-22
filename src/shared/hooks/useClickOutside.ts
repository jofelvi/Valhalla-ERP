import { type RefObject, useEffect } from 'react';

/**
 * Cierra/ejecuta `handler` cuando se hace clic fuera del elemento referenciado.
 *
 * Genérico y reutilizable: el ref lo aporta quien lo consume. `enabled` permite
 * montar el listener solo cuando hace falta (p. ej. un dropdown abierto), para
 * no escuchar el `mousedown` del documento de forma permanente.
 */
export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  handler: () => void,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        handler();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [ref, handler, enabled]);
}
