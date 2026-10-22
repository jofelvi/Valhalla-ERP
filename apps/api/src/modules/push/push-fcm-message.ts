import type { PushPayload } from './push.service';

/**
 * Mensaje FCM HTTP v1 para AMBAS plataformas.
 *
 * Antes el emisor solo mandaba el bloque `android` — en iOS eso no presenta
 * sonido/agrupacion. Aqui se agrega el bloque `apns` para que el iPhone suene
 * y colapse por orden. Funcion pura (sin red) para poder probar el armado.
 */

export interface FcmMessage {
  message: {
    token: string;
    notification: { title: string; body: string };
    data: Record<string, string>;
    android: {
      priority: 'HIGH';
      ttl: string;
      notification: { channel_id: string; sound: string; tag: string };
    };
    apns: {
      headers: Record<string, string>;
      payload: { aps: { sound: string } };
    };
  };
}

export function buildFcmMessage(
  token: string,
  payload: PushPayload,
): FcmMessage {
  // Un aviso por orden: el nuevo reemplaza al anterior en la bandeja
  // (tag en Android, apns-collapse-id en iOS) en vez de apilar diez.
  const tag = payload.data?.orderId ?? 'kitchen';
  return {
    message: {
      token,
      notification: { title: payload.title, body: payload.body },
      data: payload.data ?? {},
      android: {
        priority: 'HIGH',
        // Una comanda lista deja de importar pasada la media hora.
        ttl: '1800s',
        notification: {
          channel_id: payload.channelId ?? 'kitchen',
          sound: 'default',
          tag,
        },
      },
      apns: {
        headers: { 'apns-priority': '10', 'apns-collapse-id': tag },
        payload: { aps: { sound: 'default' } },
      },
    },
  };
}
