'use client';

import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/hooks';
import { cn } from '@/shared/utils/utils';

/**
 * Aviso de que el navegador se quedo sin conexion.
 *
 * Por que existe: se midieron 28 cortes de internet en 30 dias, 13 de mas de
 * media hora y el peor de 1h56m, varios en hora pico. Hasta ahora la caja
 * solo veia toasts de error sueltos y no sabia si el problema era la red o
 * el sistema.
 *
 * LO QUE DICE IMPORTA, y por eso no dice lo que decia la primera version:
 * "los cambios se sincronizaran cuando vuelva la conexion". Eso es MENTIRA
 * hoy — la web no tiene cola de escrituras (el plan lo llama O3 y esta a
 * medias: las ordenes y los pagos llevan `clientRequestId`, pero nadie
 * reintenta solo). Prometerle a la cajera que su cobro se va a guardar
 * cuando no se va a guardar es peor que no avisar nada: se va tranquila y el
 * dinero no quedo registrado.
 *
 * Mientras no exista la cola, el aviso dice la verdad: se puede LEER lo que
 * ya estaba en pantalla, y lo que se guarde hay que repetirlo.
 */
export function OfflineAlert() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      className={cn(
        'fixed bottom-4 left-4 right-4 z-50 max-w-md',
        'flex items-start gap-3 rounded-lg px-4 py-3 shadow-lg',
        // Fondo solido, no un tinte: esto se lee de parado, en una caja, con
        // la fila esperando.
        'bg-danger text-on-brand',
      )}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <WifiOff className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Sin conexion</p>
        <p className="text-xs opacity-90">
          Podes seguir viendo lo que ya estaba en pantalla, pero lo que guardes
          ahora <strong>no se va a registrar</strong>. Esperá a que vuelva la
          conexion y repetilo.
        </p>
      </div>
    </div>
  );
}
