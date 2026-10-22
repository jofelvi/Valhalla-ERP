import type { PipelineStage } from 'mongoose';

/**
 * El resumen del cierre de caja, calculado en el servidor.
 *
 * Antes lo calculaba el telefono, y para hacerlo se bajaba la coleccion entera
 * de pagos: `CashierCloseScreen` hacia `GET /api/payments` **sin un solo
 * filtro**. Medido en produccion el 22/09/2026: **4.336 pagos, 247.325 bytes
 * comprimidos, 1,40 s**, para despues descartar en el telefono todos los que no
 * caian dentro de la sesion. El cajero cerraba caja bajandose el historial
 * completo del negocio para calcular una suma.
 *
 * Y ademas lo calculaba MAL. La pantalla leia `pay.paymentMethod`, pero el
 * esquema guarda el campo como `method`: de los 4.336 pagos de produccion,
 * **4.294 tienen `method` y solo 42 tienen `paymentMethod`** (esos 42 son
 * legacy, del 05/03 al 05/04/2026; desde entonces no se escribio ni uno mas).
 * Como `pay.paymentMethod ?? 'PENDING'` caia siempre al default, el desglose
 * por metodo del cierre metia el 99% del dinero en un solo renglon llamado
 * "PENDING". El total en dolares si estaba bien —ese sale de `amount`—, pero
 * "cuanto entro en efectivo" y "cuanto por punto" no significaban nada.
 *
 * Por eso el `$ifNull`: se leen los DOS campos. Arreglar solo el nombre nuevo
 * habria dejado los 42 pagos viejos sin clasificar, y esos tambien salen en el
 * historial de sesiones.
 */

/** Una fila del agrupado por metodo, tal como sale de Mongo. */
export interface FilaPorMetodo {
  method: string;
  count: number;
  amount: number;
  /** Ids de orden distintos que aportaron a esta fila. */
  ordenes: string[];
}

/** Lo que se le devuelve al cliente. La etiqueta la pone la pantalla. */
export interface ResumenDeCaja {
  totalOrders: number;
  totalAmount: number;
  byPaymentMethod: Array<{ method: string; count: number; amount: number }>;
  /** La ventana que se sumo, para que la pantalla pueda mostrarla. */
  desde: string;
  hasta: string;
}

/**
 * Los pagos de la ventana de la sesion, agrupados por metodo.
 *
 * `hasta` es exclusivo a proposito: una sesion abierta se cierra "hasta ahora",
 * y si fuera inclusivo un pago que entra en el mismo milisegundo del cierre
 * podria contarse en las dos sesiones.
 */
export function pipelineDeResumenDeCaja(
  desde: Date,
  hasta: Date,
): PipelineStage[] {
  return [
    { $match: { createdAt: { $gte: desde, $lt: hasta } } },
    {
      $group: {
        // Los 42 pagos viejos guardan el metodo en `paymentMethod`. Sin este
        // ifNull volverian a caer todos en un mismo renglon sin nombre.
        _id: { $ifNull: ['$method', '$paymentMethod'] },
        count: { $sum: 1 },
        amount: { $sum: '$amount' },
        ordenes: { $addToSet: '$orderId' },
      },
    },
    {
      $project: {
        _id: 0,
        method: { $ifNull: ['$_id', 'DESCONOCIDO'] },
        count: 1,
        amount: 1,
        ordenes: 1,
      },
    },
  ];
}

/**
 * Arma el resumen a partir de las filas agrupadas.
 *
 * `totalOrders` es la cantidad de ordenes DISTINTAS, no la suma de los `count`:
 * una orden pagada mitad en efectivo y mitad por punto aparece en dos filas y
 * es una sola orden. Por eso cada fila trae sus ids y aca se unen en un Set.
 */
export function armarResumenDeCaja(
  filas: FilaPorMetodo[],
  desde: Date,
  hasta: Date,
): ResumenDeCaja {
  const ordenes = new Set<string>();
  let totalAmount = 0;

  for (const fila of filas) {
    totalAmount += fila.amount;
    for (const id of fila.ordenes ?? []) {
      if (id) ordenes.add(id);
    }
  }

  const byPaymentMethod = filas
    .map((f) => ({
      method: f.method,
      count: f.count,
      // Tambien a centavos, no solo el total: este desglose se PERSISTE en la
      // sesion al cerrar. Medido en PRE, CARD daba 9724.970326391925 — eso
      // queda guardado en la base y sale impreso en el arqueo.
      amount: aCentavos(f.amount),
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    totalOrders: ordenes.size,
    totalAmount: aCentavos(totalAmount),
    byPaymentMethod,
    desde: desde.toISOString(),
    hasta: hasta.toISOString(),
  };
}

/** Sumar flotantes da 1234.5600000000002, y eso lo firma una persona. */
function aCentavos(n: number): number {
  return Math.round(n * 100) / 100;
}
