import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api/apiClient';
import { claves } from './claves';

/**
 * El resumen del cierre de caja, calculado por el servidor.
 *
 * Lo que habia antes, medido en produccion el 22/09/2026:
 *
 * - `CashierCloseScreen` hacia `GET /api/payments` **sin un solo filtro** para
 *   sumar los pagos de UNA sesion: **4.336 pagos, 247.325 bytes comprimidos,
 *   1,40 s**. El resto lo descartaba en el telefono con un `.filter()`. El
 *   cajero cerraba caja bajandose el historial completo del negocio.
 *
 * - Y el desglose por metodo estaba MAL. La pantalla leia `pay.paymentMethod`,
 *   pero el esquema guarda el campo como `method`: de los 4.336 pagos, **4.294
 *   tienen `method` y solo 42 tienen `paymentMethod`** (legacy, del 05/03 al
 *   05/04/2026). Como `pay.paymentMethod ?? 'PENDING'` caia siempre al
 *   default, **el 99% del dinero aparecia en un solo renglon llamado
 *   "PENDING"**. El total en dolares si estaba bien —ese sale de `amount`—
 *   pero "cuanto entro en efectivo" y "cuanto por punto" no significaban nada.
 *   Y como `closeSession` **persiste** ese resumen, las sesiones ya cerradas
 *   lo tienen guardado asi.
 *
 * Ahora el agregado lo hace Mongo con un `$group` y viaja el resultado: unos
 * cientos de bytes. Ver `apps/api/src/modules/cash-register/resumen-de-caja.util.ts`.
 */

export interface TotalPorMetodo {
  method: string;
  count: number;
  amount: number;
}

export interface ResumenDeCaja {
  totalOrders: number;
  totalAmount: number;
  byPaymentMethod: TotalPorMetodo[];
  /** La ventana que se sumo. La pantalla la muestra: antes era invisible. */
  desde: string;
  hasta: string;
}

export function useResumenDeCaja(sessionId: string | null | undefined) {
  return useQuery({
    queryKey: claves.caja.resumen(String(sessionId ?? '')),
    queryFn: () =>
      api.get<ResumenDeCaja>(
        `/api/cash-register/sessions/${String(sessionId)}/resumen`,
      ),
    enabled: Boolean(sessionId),
    // Una caja abierta sigue cobrando: el resumen envejece rapido. Pero no se
    // pone un intervalo — el cajero tira a refrescar cuando quiere cuadrar, y
    // un arqueo que se mueve solo debajo de la mano es peor que uno viejo.
    staleTime: 15_000,
  });
}
