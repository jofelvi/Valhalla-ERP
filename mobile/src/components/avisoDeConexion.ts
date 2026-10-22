/**
 * Que aviso de conexion corresponde mostrar. Puro, para poder probarlo:
 * el componente `OfflineBanner` solo lo pinta.
 *
 * La distincion importa porque para el que esta atendiendo una mesa son
 * dos problemas distintos con dos soluciones distintas: "se cayo el WiFi"
 * (revisar el router, o esperar) y "el WiFi anda pero el servidor no
 * contesta" (no hay nada que revisar en el local). Hasta ahora las dos
 * salian como "Network request failed".
 *
 * `hayRed === null` significa que NetInfo todavia no reporto, que NO es lo
 * mismo que no haber red: si ahi dijeramos "sin conexion" mandariamos a la
 * gente a revisar el router sin motivo.
 */

export type TipoDeAviso = 'ninguno' | 'sin_red' | 'servidor_mudo';

export interface EstadoDeConexion {
  /**
   * El authStore no logro hablar con la API.
   *
   * OJO: hoy esto SOLO se pone en true dentro de `initialize()`, o sea al
   * abrir la app. Si la red se cae mientras alguien trabaja, este campo se
   * queda en false para siempre. Por eso NO puede ser el unico disparador
   * del aviso — la primera version lo era y el aviso practicamente no podia
   * aparecer: se probo en la PWA cortando la red de verdad y no salio.
   */
  isOffline: boolean;
  /** Sin sesion no se muestra nada: la pantalla de login ya avisa sola. */
  isAuthenticated: boolean;
  /** Lo que reporta NetInfo. `null` = todavia no dijo nada. */
  hayRed: boolean | null;
}

export function decidirAviso(estado: EstadoDeConexion): TipoDeAviso {
  if (!estado.isAuthenticated) return 'ninguno';
  // NetInfo se entera al instante de que no hay red, sin esperar a que algo
  // falle. Ese es el caso que le pasa al mesonero: estaba trabajando y se
  // corto el WiFi.
  if (estado.hayRed === false) return 'sin_red';
  // Hay red (o todavia no se sabe) pero la API no contesta.
  if (estado.isOffline) return 'servidor_mudo';
  return 'ninguno';
}

export const MENSAJES: Record<Exclude<TipoDeAviso, 'ninguno'>, string> = {
  sin_red: 'Sin conexion. Reintentando...',
  servidor_mudo: 'El servidor no responde. Reintentando...',
};
