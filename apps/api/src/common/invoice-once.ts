/**
 * Una orden, una factura. UNA sola puerta para todo el backend.
 *
 * ─── Por que existe ───────────────────────────────────────────────────────
 * Habia CUATRO caminos creando facturas —el POST del API, orders.service,
 * el auto-cobro de Pago Movil y la web POS— y solo uno tenia control, ademas
 * debil (consultaba y despues insertaba, sin nada que impidiera que dos
 * peticiones pasaran a la vez).
 *
 * Resultado medido en produccion el 19/08/2026: 5.533 facturas para 3.724
 * ordenes. El 47,56% de las ordenes tenia factura repetida, algunas con
 * cuatro. Un reporte armado sobre `invoices` mostraba $115.147 cuando la
 * venta real eran $75.524: exageraba 1,52 veces.
 *
 * Y no paraba: en agosto se seguian creando ~940 facturas de mas por mes.
 *
 * ─── La regla ─────────────────────────────────────────────────────────────
 * La factura se pide, no se crea. Si la orden ya tiene una, se devuelve esa.
 * El indice unico de `invoice.schema.ts` respalda esto a nivel de Mongo, que
 * es lo unico que aguanta dos peticiones simultaneas.
 */
import { Model } from 'mongoose';

/**
 * Filtro para buscar LA factura de una orden, usando el indice unico.
 *
 * El indice `uniq_factura_por_orden` es PARCIAL (`orderId: {$type: 'string'}`)
 * y Mongo solo lo usa si la consulta repite esa condicion: `{ orderId }` a
 * secas recorria la coleccion entera. Medido con explain en produccion el
 * 27/09/2026: COLLSCAN de 4.897 facturas contra IXSCAN de 1. Era una de las
 * consultas mas lentas del log (205 ms de media en `GET /api/invoices?orderId`).
 */
export const facturaDeLaOrden = (
  orderId: string,
): { orderId: { $eq: string; $type: 'string' } } => ({
  orderId: { $eq: orderId, $type: 'string' },
});

/** Lo minimo que necesitamos del modelo; evita atarnos al tipo del documento. */
export interface InvoiceModelLike {
  findOne(filter: Record<string, unknown>): {
    lean(): { exec(): Promise<Record<string, unknown> | null> };
  };
  create(doc: Record<string, unknown>): Promise<{
    toObject(): Record<string, unknown>;
  }>;
}

export interface InvoiceOnceResult {
  invoice: Record<string, unknown>;
  /** true si ya existia: el llamador puede loguearlo o evitar efectos extra. */
  yaExistia: boolean;
}

export async function createInvoiceOnce(
  model: InvoiceModelLike,
  doc: Record<string, unknown>,
): Promise<InvoiceOnceResult> {
  const orderId = doc.orderId != null ? String(doc.orderId) : '';

  // Sin orden no hay clave de unicidad posible (hay 3 facturas historicas
  // asi). Se crea y punto: son casos sueltos, no la via normal.
  if (!orderId) {
    const creada = await model.create(doc);
    return { invoice: creada.toObject(), yaExistia: false };
  }

  const existente = await model
    .findOne(facturaDeLaOrden(orderId))
    .lean()
    .exec();
  if (existente) return { invoice: existente, yaExistia: true };

  try {
    const creada = await model.create({ ...doc, orderId });
    return { invoice: creada.toObject(), yaExistia: false };
  } catch (error) {
    // E11000: otra peticion gano la carrera. No es un error para el llamador,
    // la factura existe que es lo que pedia.
    if ((error as { code?: number }).code !== 11000) throw error;
    const ganadora = await model
      .findOne(facturaDeLaOrden(orderId))
      .lean()
      .exec();
    if (!ganadora) throw error;
    return { invoice: ganadora, yaExistia: true };
  }
}
