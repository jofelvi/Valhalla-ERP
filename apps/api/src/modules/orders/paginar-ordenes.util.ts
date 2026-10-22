/**
 * Cuantas ordenes traer y desde donde, a partir de lo que pidio el cliente.
 *
 * `GET /api/orders` no tenia paginacion NI tope: `findAll` hacia
 * `.find(query).lean().sort(...)` y devolvia lo que hubiera. Medido en
 * produccion el 21/09/2026: **4.766 ordenes, 1.565.064 bytes comprimidos, 2,65
 * segundos** por llamada. `?limit=20` y `?page=1&limit=20` devolvian esos
 * mismos 1,57 MB, porque los parametros no existian y se ignoraban en silencio.
 *
 * La app movil lo pedia SIN filtros desde tres sitios, y uno de ellos
 * (`waiterAssignmentService`) se bajaba las 4.766 ordenes solo para contar
 * cuantas llevaba hoy cada mesonero.
 *
 * Por eso el tope es DURO y no opcional: no alcanza con que los clientes
 * nuevos pidan menos, porque los APK viejos siguen semanas en la calle pidiendo
 * todo. El servidor tiene que negarse a mandarlo.
 */

/**
 * Techo absoluto. Ningun cliente, pida lo que pida, se lleva mas que esto.
 *
 * El numero sale de medir que necesitan los que YA llaman, no de una intuicion.
 * La primera version puso 500 y habria roto una pantalla: `/private/orders-by-waiter`
 * con un rango de un mes pide **1.220 ordenes** (medido en produccion el
 * 21/09/2026; tres semanas son 702). Con 500 se habrian perdido 720 filas sin
 * un error, sin un aviso y sin que nadie lo notara hasta cuadrar mal.
 *
 * 2.000 deja pasar el peor caso legitimo medido con margen, y sigue frenando el
 * caso patologico que motivo todo esto: bajarse las 4.766 ordenes del historico
 * por no pedir filtros.
 */
import { paginar } from '../../common/paginacion.util';

export const LIMITE_DURO_DE_ORDENES = 2000;

/**
 * Cuanto se manda cuando el cliente no pide `limit`.
 *
 * Mas bajo que el techo: quien no pide nada casi siempre es un cliente que no
 * sabe cuanto necesita, y 500 ya es mas de lo que cabe en cualquier pantalla.
 * Quien de verdad necesita mas —un reporte por rango de fechas— lo pide
 * explicitamente y se lo lleva hasta el techo.
 *
 * OJO al agregar un consumidor nuevo: si tu consulta puede superar 500, manda
 * `limit`. Cuando una respuesta llega justo al limite, la API deja un WARN
 * `[ordenes] respuesta truncada` en los logs — ese aviso existe porque el
 * truncamiento silencioso es exactamente como se rompen los reportes.
 */
export const LIMITE_POR_DEFECTO_DE_ORDENES = 500;

export interface Paginado {
  limit: number;
  skip: number;
}

export function paginarOrdenes(limit?: number, page?: number): Paginado {
  // La aritmetica vive en `common/paginacion.util.ts`. Estaba copiada aca y
  // en facturas, letra por letra.
  return paginar(limit, page, {
    defecto: LIMITE_POR_DEFECTO_DE_ORDENES,
    duro: LIMITE_DURO_DE_ORDENES,
  });
}
