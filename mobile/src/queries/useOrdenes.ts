import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { orderService } from '../services/orderService';
import { on as onSocket } from '../services/api/socketClient';
import { claves } from './claves';
import type { Order } from '../types';

/**
 * Las ordenes, por React Query en vez de por suscripciones a mano.
 *
 * Lo que habia antes, medido en produccion el 21/09/2026 sobre la PWA:
 *
 * - La pantalla de caja hacia **24 peticiones por minuto en reposo**, sin que
 *   nadie tocara nada. Doce eran `/api/orders` SIN filtros: 1.565.064 bytes
 *   comprimidos y 2,65 s cada una. Unos 18,7 MB por minuto, ~9 GB en un turno
 *   de 8 horas, sobre la conexion de un local que se cae 28 veces al mes.
 *
 * - Doce de esas peticiones no eran un intervalo: eran RE-SUSCRIPCIONES. El
 *   efecto que escuchaba ordenes dependia de `[session]`, y `session` era un
 *   objeto nuevo cada 5 segundos (lo parseaba el poll de la caja). React veia
 *   una referencia distinta, desmontaba la suscripcion y la volvia a montar.
 *
 * - Y eso dejaba a la caja SORDA. En `subscribeOrdersFiltered` los listeners
 *   del socket se enganchan DESPUES del fetch inicial; como el fetch tardaba
 *   3,6 s y el ciclo era de 5 s, habia 3,6 segundos de cada 5 sin escuchar
 *   `order:created`. Una orden que entrara ahi no aparecia hasta el siguiente
 *   ciclo. Eso no es lentitud: es una orden que no se ve.
 *
 * El arreglo no es "pollear menos". Es separar las dos cosas que estaban
 * enredadas:
 *
 *   1. **Traer los datos** es una query, con su clave y su cache. Si dos
 *      pantallas piden lo mismo, React Query hace UNA peticion.
 *   2. **Enterarse de los cambios** es el socket, montado UNA vez y por fuera
 *      del ciclo de vida de las pantallas. No vuelve a desmontarse al
 *      re-renderizar, asi que no hay ventana ciega.
 */

/** Pendientes de cobro (pantalla de caja). Filtradas por el servidor. */
export function useOrdenesPendientesDeCobro(habilitada = true) {
  return useQuery({
    queryKey: claves.ordenes.lista({ pendientesDeCobro: true }),
    queryFn: () => orderService.listarPendientesDeCobro(),
    enabled: habilitada,
    // El socket avisa de los cambios, asi que no hace falta reconsultar sola.
    // Si el socket se cae, el refetch al reconectar la red la pone al dia.
    staleTime: 60_000,
  });
}

/**
 * Mantiene la cache de ordenes al dia con lo que llega por WebSocket.
 *
 * Se monta UNA vez, arriba de todo (ver `AppNavigator`). No vive dentro de una
 * pantalla a proposito: si viviera ahi, cada re-render que cambiara sus
 * dependencias volveria a montar los listeners y reaparecia la ventana ciega
 * de 3,6 segundos que este archivo explica arriba.
 *
 * No invalida: ESCRIBE en la cache. Invalidar dispararia un refetch por cada
 * evento —y en hora pico llegan varios por segundo—, que es justo el trafico
 * que se esta sacando.
 */
export function useSincronizarOrdenesPorSocket(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelado = false;
    const apagar: Array<() => void> = [];

    const aplicar = (transformar: (previas: Order[]) => Order[]) => {
      queryClient.setQueriesData<Order[]>(
        { queryKey: claves.ordenes.listas() },
        (previas) => (previas ? transformar(previas) : previas),
      );
    };

    void (async () => {
      const alCambiar = (raw: unknown) => {
        const id = idDe(raw);
        if (!id) return;
        // El evento trae la orden cruda del servidor; se pide la normalizada
        // para no duplicar aca el normalizeOrder (que vive en orderService y
        // ya sabe de los campos que `normalize()` descartaba).
        void orderService.getOrderById(id).then((orden) => {
          if (cancelado || !orden) return;
          aplicar((previas) => {
            const resto = previas.filter((o) => o.id !== orden.id);
            // Una orden que ya no pertenece a la lista (se pago, se anulo) sale
            // de la cache en vez de quedarse pegada en pantalla.
            return perteneceAPendientesDeCobro(orden)
              ? [orden, ...resto]
              : resto;
          });
          queryClient.setQueryData(claves.ordenes.una(orden.id), orden);
        });
      };

      const alBorrar = (payload: unknown) => {
        const id = idDe(payload);
        if (!id) return;
        aplicar((previas) => previas.filter((o) => o.id !== id));
      };

      try {
        apagar.push(await onSocket('order:created', alCambiar));
        apagar.push(await onSocket('order:updated', alCambiar));
        apagar.push(await onSocket('order:deleted', alBorrar));
      } catch (error) {
        console.error('No se pudo escuchar ordenes por socket:', error);
      }
    })();

    return () => {
      cancelado = true;
      apagar.forEach((off) => off());
    };
  }, [queryClient]);
}

function idDe(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as { id?: unknown; _id?: unknown };
  const id = String(p.id ?? p._id ?? '');
  return id.length > 0 ? id : null;
}

/**
 * Mismos dos ejes que `paramsPendientesDeCobro`, aplicados a una orden suelta.
 *
 * Hace falta porque el servidor filtro la lista UNA vez, pero despues llegan
 * eventos de cualquier orden: sin esto, una orden recien pagada entraria a la
 * lista de pendientes de cobro por el solo hecho de haber cambiado.
 */
function perteneceAPendientesDeCobro(orden: Order): boolean {
  const cobroAbierto = ['pending', 'pending_verification', 'partial'].includes(
    String(orden.paymentStatus),
  );
  const viva = !['CANCELLED', 'PAID'].includes(String(orden.status));
  return cobroAbierto && viva;
}
