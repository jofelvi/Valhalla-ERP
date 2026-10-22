import type { PushPayload } from './push.service';

/**
 * Cuerpo de una notificacion APNs (HTTP/2).
 *
 * `aps.alert` da titulo+texto y sonido; los datos propios (type, orderId) van
 * al mismo nivel para que la app los lea al tocar el aviso. El `collapseId`
 * agrupa por orden: un aviso nuevo reemplaza al anterior en la bandeja.
 * Funcion pura (sin red) para poder probar el armado.
 */

export interface ApnsPayload {
  body: {
    aps: {
      alert: { title: string; body: string };
      sound: string;
    };
  } & Record<string, unknown>;
  collapseId: string;
}

export function buildApnsPayload(payload: PushPayload): ApnsPayload {
  const collapseId = payload.data?.orderId ?? 'kitchen';
  return {
    body: {
      aps: {
        alert: { title: payload.title, body: payload.body },
        sound: 'default',
      },
      ...(payload.data ?? {}),
    },
    collapseId,
  };
}
