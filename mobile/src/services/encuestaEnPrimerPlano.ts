/**
 * Un sondeo que se DUERME cuando el telefono no esta en pantalla.
 *
 * Tres servicios tenian el mismo bloque copiado —chat cada 3 s, sesion de caja
 * cada 5 s, asistencia cada 10 s— y ninguno miraba si la aplicacion estaba en
 * primer plano. O sea que un mesonero con el APK abierto en el bolsillo
 * durante un turno de 8 horas pegaba **9.600 peticiones de chat** sin que nadie
 * mirara la pantalla. Multiplicado por el personal en sala, y sobre los datos
 * moviles que se usan cuando se cae el internet del local (ver los 28 cortes
 * medidos), eso es consumo puro.
 *
 * El arreglo de fondo es que la API empuje por socket en vez de que el
 * telefono pregunte; esto no lo reemplaza. Lo que hace es que el sondeo cueste
 * solo mientras alguien esta mirando, que es cuando sirve.
 *
 * Al volver a primer plano se consulta **de inmediato**, sin esperar al
 * proximo intervalo: si no, el cajero desbloquearia el telefono y veria datos
 * viejos hasta 10 s, que es peor que el sondeo que se quiso ahorrar.
 */

/** Lo justo de `AppState` de react-native, para poder probarlo sin el modulo. */
export interface EstadoDeAplicacion {
  currentState: string;
  addEventListener: (
    tipo: 'change',
    handler: (estado: string) => void,
  ) => { remove: () => void };
}

export interface OpcionesDeEncuesta {
  /** Cada cuanto se consulta mientras la pantalla esta encendida, en ms. */
  cadaMs: number;
  /** Se inyecta para poder probar; por defecto el `AppState` real. */
  appState?: EstadoDeAplicacion;
}

/** Corta el sondeo. */
export type Cancelar = () => void;

const estaActivo = (estado: string) => estado === 'active';

/**
 * Llama a `tick` ya mismo y despues cada `cadaMs`, **solo** mientras la
 * aplicacion este en primer plano.
 *
 * `tick` nunca se solapa consigo mismo: si una consulta tarda mas que el
 * intervalo, la siguiente espera. Con `setInterval` sobre una promesa —que es
 * lo que habia— una red lenta encolaba llamadas una encima de otra.
 */
export function encuestarEnPrimerPlano(
  tick: () => Promise<void> | void,
  { cadaMs, appState }: OpcionesDeEncuesta,
): Cancelar {
  let cancelado = false;
  let temporizador: ReturnType<typeof setTimeout> | null = null;
  let corriendo = false;

  const parar = () => {
    if (temporizador !== null) {
      clearTimeout(temporizador);
      temporizador = null;
    }
  };

  const programar = () => {
    parar();
    if (cancelado) return;
    temporizador = setTimeout(() => void ciclo(), cadaMs);
  };

  const ciclo = async () => {
    // Sin este candado, una consulta mas lenta que el intervalo se apilaba
    // sobre la anterior: justo en la red mala donde menos hay que insistir.
    if (cancelado || corriendo) return;
    corriendo = true;
    try {
      await tick();
    } catch {
      // Se traga a proposito: cada servicio ya reporta lo suyo dentro de su
      // `tick`. Lo que NO puede pasar es que una caida de red deje la pantalla
      // congelada para siempre porque el sondeo murio con la excepcion.
    } finally {
      corriendo = false;
      programar();
    }
  };

  const alCambiarDeEstado = (estado: string) => {
    if (cancelado) return;
    if (estaActivo(estado)) {
      // De inmediato: el que acaba de desbloquear el telefono no tiene por que
      // mirar datos viejos hasta el proximo intervalo.
      void ciclo();
    } else {
      parar();
    }
  };

  const suscripcion = appState?.addEventListener('change', alCambiarDeEstado);

  // Sin `appState` se comporta como siempre: util en pruebas y en web, donde
  // no hay segundo plano que valga.
  if (!appState || estaActivo(appState.currentState)) {
    void ciclo();
  }

  return () => {
    cancelado = true;
    parar();
    suscripcion?.remove();
  };
}
