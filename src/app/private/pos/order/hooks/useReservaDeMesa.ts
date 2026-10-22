import { useEffect } from 'react';
import {
  heartbeatTable,
  getReleaseToken,
  releaseTableOnExit,
} from '@/hooks/useTables';
import { HEARTBEAT_INTERVAL_MS } from '../utils/constants';

/**
 * Gestiona la reserva de una mesa mediante heartbeat periódico.
 * Si el usuario sale sin crear orden, libera la mesa automáticamente.
 *
 * La liberación se manda con `keepalive` (no con la mutación de react-query)
 * porque al cerrar la pestaña o navegar duro, la mutación se cancela y la
 * mesa queda roja. `pagehide` cubre cerrar pestaña, recargar y móvil en background.
 *
 * @param tableId - ID de la mesa
 * @param orderId - ID de orden (si existe, no aplica reserva)
 * @param currentUserId - ID del usuario actual
 * @param orderCreatedRef - Ref para saber si la orden fue creada
 */
export function useReservaDeMesa(
  tableId: string | null,
  orderId: string | null,
  currentUserId: string | null,
  orderCreatedRef: React.MutableRefObject<boolean>,
) {
  useEffect(() => {
    if (!tableId || orderId) return;
    if (!currentUserId) return;

    let releaseToken: string | null = null;
    void getReleaseToken().then((t) => {
      releaseToken = t;
    });

    void heartbeatTable(tableId, currentUserId);
    const iv = setInterval(() => {
      void heartbeatTable(tableId, currentUserId);
    }, HEARTBEAT_INTERVAL_MS);

    const releaseIfUnused = () => {
      if (orderCreatedRef.current) return;
      releaseTableOnExit(tableId, currentUserId, releaseToken);
    };

    window.addEventListener('pagehide', releaseIfUnused);

    return () => {
      clearInterval(iv);
      window.removeEventListener('pagehide', releaseIfUnused);
      releaseIfUnused();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, orderId, currentUserId]);
}
