import type { OrderStatusEnum, PaymentStatusEnum } from '../types/enums';

/**
 * Los estados van como literales, NO importando el enum en runtime.
 *
 * `npm test` del movil corre con `node --experimental-strip-types`, que borra
 * los tipos sin compilar y revienta con ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX ante
 * cualquier `enum`. Importarlo aca dejaria este archivo sin poder probarse, y
 * es justo el que decide cuanto viaja por la red.
 *
 * El `satisfies` los ata al enum en tiempo de compilacion: es sintaxis de
 * tipos, asi que tsc la mira y el runner la borra. Si alguien renombra un
 * estado, esto no compila.
 */

/**
 * Los parametros que se le mandan a `GET /api/orders` para cada pantalla.
 *
 * Puro y probado a proposito: es la pieza que decide cuanto viaja por la red,
 * y equivocarse aca no se nota mirando la pantalla — se nota en la factura de
 * datos y los dias de corte.
 *
 * Lo que habia antes: la caja pedia `/api/orders` SIN NINGUN PARAMETRO y
 * filtraba en el telefono. Medido en produccion el 21/09/2026: **4.766
 * ordenes, 1.565.064 bytes comprimidos, 2,65 segundos** por llamada, para
 * quedarse con un punado de ordenes pendientes de cobro. Y como ademas se
 * resuscribia cada 5 segundos por un efecto mal dependido, eran ~18,7 MB por
 * minuto: unos 9 GB en un turno de 8 horas, sobre la conexion de un local que
 * ya se cae 28 veces al mes.
 *
 * El mismo endpoint con `?active=true` devuelve 1.366 bytes. La diferencia no
 * era el endpoint: era no pedirle nada.
 */

/** Ordenes que todavia no se cerraron: ni anuladas ni pagadas. */
const ESTADOS_VIVOS = [
  'PENDING',
  'IN_PROGRESS',
  'READY',
  'DELIVERED',
  'CREDIT',
] as const satisfies readonly `${OrderStatusEnum}`[];

/** Lo que la caja considera "falta cobrar". */
const COBROS_ABIERTOS = [
  'pending',
  'pending_verification',
  'partial',
] as const satisfies readonly `${PaymentStatusEnum}`[];

/**
 * Techo del cliente: el tope DURO del servidor, que son 2.000.
 *
 * La primera version pedia 200, con el argumento de que una caja con mas de
 * 200 cuentas abiertas es un problema de operacion y no una pantalla. Medido
 * contra la base, ese argumento era falso: **485 de las que entran en este
 * filtro estan en CREDIT**, o sea cuentas por cobrar viejas que nunca se
 * cerraron. Con tope 200 el cajero dejaba de ver las mas antiguas.
 *
 * La segunda version decia "el mismo que el tope duro del servidor" y pedia
 * **500**, que es el tope POR DEFECTO, no el duro
 * (`LIMITE_POR_DEFECTO_DE_ORDENES` vs `LIMITE_DURO_DE_ORDENES = 2000`). El
 * comentario declaraba la intencion correcta y el numero hacia otra cosa.
 *
 * Medido en PRE el 23/09/2026: con `limit=500` el filtro devuelve 500 ordenes;
 * con `limit=2000` devuelve **531**. O sea que **31 cuentas con pago pendiente
 * eran invisibles para el cajero** — no aparecian en la lista y por lo tanto no
 * se podian cobrar. Y no fallaba nada: la pantalla mostraba 500 filas y se veia
 * perfectamente normal.
 *
 * Es exactamente el error que este archivo dice evitar dos parrafos mas arriba:
 * un arreglo de rendimiento no puede cambiar lo que alguien ve. Pedir el tope
 * duro sigue siendo un orden de magnitud menos que bajarse las 4.766 ordenes
 * del historico, y no desaparece ni una fila.
 *
 * (Que esas cuentas viejas vivan en la pantalla de cobro en vez de en cuentas
 * por cobrar es una decision del dueno, no algo que se cambia de paso.)
 */
const TOPE = '2000';

export type ParamsDeOrdenes = Record<string, string | undefined>;

/**
 * Pendientes de cobro (pantalla de caja).
 *
 * Se piden los dos ejes al servidor: estado de pago abierto Y estado de orden
 * vivo. Sin el segundo entrarian las anuladas, que la pantalla vieja descartaba
 * en el telefono despues de haberlas descargado.
 */
export function paramsPendientesDeCobro(): ParamsDeOrdenes {
  return {
    paymentStatus: COBROS_ABIERTOS.join(','),
    status: ESTADOS_VIVOS.join(','),
    limit: TOPE,
  };
}

/** Ordenes activas de un mesonero. */
export function paramsDeMesonero(waiterId: string): ParamsDeOrdenes {
  return { waiterId, status: ESTADOS_VIVOS.join(','), limit: TOPE };
}

/** Ordenes activas de cualquier zona (las que ve el cajero de zonas). */
export function paramsDeZonas(): ParamsDeOrdenes {
  return { status: ESTADOS_VIVOS.join(','), limit: TOPE };
}
