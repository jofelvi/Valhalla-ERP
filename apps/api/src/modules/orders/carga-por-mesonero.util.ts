import type { PipelineStage } from 'mongoose';

/**
 * Cuantas ordenes lleva cada mesonero en la jornada, para el reparto
 * round-robin de mesas.
 *
 * Antes esto lo hacia el TELEFONO: `waiterAssignmentService.assignWaiter()`
 * pedia `GET /api/orders` SIN filtros —medido el 21/09/2026: **4.766 ordenes,
 * 1.565.064 bytes comprimidos, 2,65 segundos**— y despues contaba en memoria
 * cuantas eran de hoy. Bajaba cuatro anios de historia para obtener una lista
 * de media docena de numeros, y lo hacia cada vez que se asignaba un mesonero.
 *
 * Y ademas contaba mal. El telefono usaba la MEDIANOCHE LOCAL:
 *
 *     d.getFullYear() === now.getFullYear() && d.getMonth() === ... && d.getDate() === ...
 *
 * pero la jornada del restaurante va de 06:00 a 06:00 (`panel-rango.util.ts`),
 * porque se cobra pasada la medianoche. Con el corte a las 00:00, todas las
 * ordenes tomadas despues de medianoche contaban para el dia siguiente: a la
 * 1 AM de un sabado la carga de todos volvia a cero y el reparto se rompia
 * justo en la hora de mas movimiento.
 *
 * Aqui no hay fetch: es la forma del pipeline de agregacion, pura y probada.
 */

export interface CargaDeMesonero {
  waiterId: string;
  ordenes: number;
}

/**
 * Pipeline que cuenta ordenes por `waiterId` dentro de [desde, hasta).
 *
 * `hasta` es EXCLUSIVO, igual que en el resto del panel: con `$lte` una orden
 * creada exactamente a las 06:00:00.000 caeria en las dos jornadas.
 */
/**
 * `PipelineStage` viene por `import type`: es solo tipo, asi que se borra al
 * compilar y este util sigue sin depender de Mongoose en runtime. Devolver
 * `Record<string, unknown>[]` compilaba con `nest build` pero lo rechaza el
 * tsc estricto del despliegue, que es el que manda.
 */
export function pipelineDeCargaPorMesonero(
  desde: Date,
  hasta: Date,
): PipelineStage[] {
  return [
    {
      $match: {
        createdAt: { $gte: desde, $lt: hasta },
        isDeleted: { $ne: true },
        // Sin mesonero no hay a quien contarle la carga. Se descarta aca y no
        // en el $group para que no aparezca una fila con _id null.
        waiterId: { $nin: [null, ''] },
      },
    },
    { $group: { _id: '$waiterId', ordenes: { $sum: 1 } } },
    { $project: { _id: 0, waiterId: '$_id', ordenes: 1 } },
  ];
}

/**
 * Completa con 0 los mesoneros que todavia no tomaron ninguna orden.
 *
 * Sin esto el round-robin no puede elegirlos: una agregacion solo devuelve
 * filas de lo que existe, asi que el que arranca el turno sin ordenes no
 * aparece, y el reparto le seguiria dando mesas al que ya tiene.
 */
export function completarConCeros(
  filas: CargaDeMesonero[],
  waiterIds: string[],
): CargaDeMesonero[] {
  const porId = new Map(filas.map((f) => [f.waiterId, f.ordenes]));
  return waiterIds.map((waiterId) => ({
    waiterId,
    ordenes: porId.get(waiterId) ?? 0,
  }));
}
