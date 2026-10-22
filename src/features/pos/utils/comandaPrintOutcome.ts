/**
 * Que se anota (y si se avisa por correo) despues de mandar una comanda.
 *
 * Antes la pantalla de orden decidia ANTES de imprimir, con una consulta hecha
 * una sola vez al abrirla y que arrancaba en "no hay impresora". Si el
 * mesonero guardaba antes de que respondiera, la comanda ni se mandaba y
 * llegaba un correo de "servicio caido". Medido en produccion el 27/09/2026:
 * 13 de 19 alertas de ese tipo en 60 dias ocurrieron con el print-service
 * imprimiendo otras cosas en esos mismos minutos, y en las 19 la comanda nunca
 * llego a la cola.
 *
 * Ahora se manda siempre y se juzga el resultado real. La unica alarma de
 * "caido" que queda es la verdadera: la comanda quedo en la cola del servidor
 * y, en ese momento, no hay ningun print-service conectado para sacarla.
 */

export interface ComandaPrintResult {
  success: boolean;
  error?: string;
  via?: 'local' | 'queue';
}

export interface ComandaPrintOutcome {
  status: 'success' | 'queued' | 'http_500';
  errorMessage: string | null;
  /** Mandar el correo de alerta aunque el estado no sea de error. */
  alert: boolean;
}

export const COMANDA_EN_COLA_SIN_SERVICIO =
  'La comanda quedó en cola: el servicio de impresión no está conectado. Sale sola cuando vuelva.';

/**
 * @param remoteConnected si hay un print-service conectado al servidor en el
 *   momento de encolar. `null` = no se pudo saber: no se avisa, para no
 *   volver a mandar falsas alarmas.
 */
export const comandaPrintOutcome = (
  result: ComandaPrintResult,
  remoteConnected: boolean | null,
): ComandaPrintOutcome => {
  if (!result.success) {
    return {
      status: 'http_500',
      errorMessage: result.error ?? 'Error del print service',
      alert: true,
    };
  }
  if (result.via !== 'queue') {
    return { status: 'success', errorMessage: null, alert: false };
  }
  if (remoteConnected === false) {
    return {
      status: 'queued',
      errorMessage: COMANDA_EN_COLA_SIN_SERVICIO,
      alert: true,
    };
  }
  return { status: 'queued', errorMessage: null, alert: false };
};
