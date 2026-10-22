/**
 * Vistas de la orden: proyecciones con nombre para las pantallas que solo
 * necesitan una parte del documento.
 *
 * Medido el 08/09/2026 en modo usuario sobre `negocio_local`: abrir
 * `/private/payroll` descargaba **740 KB** de ordenes. De esos, `items` pesaba
 * 233 KB y `pendingPayments` 193 KB, y la tabla de nomina no mira ni uno ni
 * otro: solo suma comisiones y propinas. Los comprobantes si los abre el
 * detalle por mesonero, y por eso son dos vistas y no una.
 *
 * Por que vistas con nombre y no un `?fields=` libre: si el cliente elige los
 * campos, olvidarse de uno no da error — la pantalla recibe `undefined` y paga
 * de menos, en silencio. Con la vista aqui, el conjunto de campos vive junto a
 * la prueba que comprueba que cubre lo que la nomina lee de verdad.
 */

const PAYROLL_FIELDS = [
  'createdAt',
  'waiterId',
  'waiterName',
  'waiterShares',
  'serviceCharge',
  // Base de comision (sin cortesias ni socios): la nomina calcula la comision
  // sobre esto, no sobre serviceCharge. Ver payrollCalc.weekCommission.
  'comisionBase',
  'subtotal',
  'total',
  'tipAmount',
  'bcvRate',
  'sector',
  'tableName',
] as const;

/** Comprobantes del cotejo de propinas: 209 KB que solo usa el detalle. */
const PAYMENT_PROOF_FIELDS = ['pendingPayments', 'paymentProofUrls'] as const;

const asProjection = (fields: readonly string[]): Readonly<Record<string, 1>> =>
  Object.freeze(Object.fromEntries(fields.map((f) => [f, 1 as const])));

export const ORDER_VIEW_FIELDS = {
  /** Tabla semanal de nomina: dias, comisiones y propinas. */
  payroll: asProjection(PAYROLL_FIELDS),
  /** Detalle de un mesonero: lo anterior mas el cotejo de propinas. */
  'payroll-waiter': asProjection([...PAYROLL_FIELDS, ...PAYMENT_PROOF_FIELDS]),
} as const;

export type OrderView = keyof typeof ORDER_VIEW_FIELDS;

export const isOrderView = (view?: string): view is OrderView =>
  view !== undefined && view in ORDER_VIEW_FIELDS;

/**
 * Proyeccion de Mongo para la vista pedida, o `undefined` para responder la
 * orden completa. Un nombre desconocido devuelve `undefined` a proposito: mas
 * vale mandar de mas que mandar una orden incompleta.
 *
 * `_id` no hace falta declararlo: Mongo lo incluye siempre en una proyeccion
 * de inclusion, y de el sale el `id` que devuelve el servicio.
 */
export const projectionForOrderView = (
  view?: string,
): Readonly<Record<string, 1>> | undefined =>
  isOrderView(view) ? ORDER_VIEW_FIELDS[view] : undefined;
