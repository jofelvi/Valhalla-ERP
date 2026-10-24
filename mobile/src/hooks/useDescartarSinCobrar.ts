import { useCallback, useEffect, useRef } from 'react';
import { orderService } from '../services/orderService';
import { ApiError } from '../services/api/apiClient';
import { showAlert } from '../utils/alert';

/** Lo minimo de `navigation` que usa el hook (sirve para el mesonero y para el cajero). */
interface NavegacionConSalida {
  addListener: (
    evento: 'beforeRemove',
    callback: (e: {
      preventDefault: () => void;
      data: { action: unknown };
    }) => void,
  ) => () => void;
  dispatch: (accion: never) => void;
}

/**
 * Atras en la pantalla de cobro de un pedido RECIEN creado: con la comanda al cobrar, ese
 * pedido todavia no imprimio nada, asi que salir sin cobrar lo descarta en vez de dejarlo
 * "pendiente" en la lista. Pregunta antes, porque el carrito ya no esta.
 *
 * `marcarCobrado()` se llama cuando el cobro quedo registrado: desde ahi salir de la pantalla
 * es normal y no pregunta nada. Si el servidor dice 409 (la orden ya tiene cobro o productos
 * despachados), no se puede descartar y simplemente se sale dejandola como esta.
 */
export function useDescartarSinCobrar(
  navigation: NavegacionConSalida,
  orderId: string,
  activo: boolean,
): { marcarCobrado: () => void } {
  const cobrado = useRef(false);
  const saliendo = useRef(false);
  const preguntando = useRef(false);

  useEffect(() => {
    if (!activo) return;
    return navigation.addListener('beforeRemove', (e) => {
      if (cobrado.current || saliendo.current) return;
      e.preventDefault();
      if (preguntando.current) return;
      preguntando.current = true;

      const salir = () => {
        saliendo.current = true;
        navigation.dispatch(e.data.action as never);
      };

      showAlert(
        '¿Salir sin cobrar?',
        'El pedido se cancela y no sale ninguna comanda.',
        [
          {
            text: 'Seguir cobrando',
            style: 'cancel',
            onPress: () => {
              preguntando.current = false;
            },
          },
          {
            text: 'Cancelar pedido',
            style: 'destructive',
            onPress: () => {
              orderService
                .descartarSinCobrar(orderId)
                .then(salir)
                .catch((error: unknown) => {
                  if (error instanceof ApiError && error.status === 409) {
                    salir();
                    return;
                  }
                  preguntando.current = false;
                  const msg =
                    error instanceof Error ? error.message : String(error);
                  showAlert(
                    'No se pudo cancelar el pedido',
                    `${msg.slice(0, 160)}\nRevisa la conexion y vuelve a intentar.`,
                  );
                });
            },
          },
        ],
      );
    });
  }, [navigation, orderId, activo]);

  const marcarCobrado = useCallback(() => {
    cobrado.current = true;
  }, []);

  return { marcarCobrado };
}
