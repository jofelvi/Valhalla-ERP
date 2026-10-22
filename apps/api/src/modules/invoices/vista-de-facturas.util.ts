/**
 * Proyeccion para el LISTADO de facturas.
 *
 * Medido en PRE el 22/09/2026 sobre 2.000 facturas: **2.372.094 bytes, y
 * 1.339.095 de esos (56%) son el campo `items`** — las lineas de cada
 * factura. `/private/invoices` pinta una tabla de numero, cliente, total,
 * estado y fecha: no lee `items` ni una vez.
 *
 * Es el mismo recorte que `vista-de-menu.util.ts` hace con el catalogo, y
 * por la misma razon: la pantalla que manda el filtro sabe que campos
 * necesita; el servidor no tiene por que adivinarlo mandandolos todos.
 *
 * **Es opt-in a proposito.** Sin `?vista=lista` se responde la factura
 * completa, igual que siempre. Si el default fuera el recorte, cualquier
 * consumidor que hoy lee `items` —el generador de PDF, el bot, un APK viejo—
 * empezaria a recibir facturas sin lineas **sin un solo error**: el PDF
 * saldria con la tabla vacia y nadie se enteraria hasta que un cliente
 * reclame. Basura en `vista` manda de MAS, nunca de menos.
 */

/** Lo que la tabla del listado lee de verdad. Nada mas. */
export const CAMPOS_DEL_LISTADO = [
  '_id',
  'invoiceNumber',
  'orderId',
  'customerId',
  'customerName',
  'subtotal',
  'tax',
  'total',
  'currency',
  'status',
  'createdAt',
  'updatedAt',
] as const;

export function proyeccionDeListado(): Record<string, 1> {
  return Object.fromEntries(CAMPOS_DEL_LISTADO.map((c) => [c, 1])) as Record<
    string,
    1
  >;
}

/**
 * `null` significa "sin proyeccion": manda la factura entera.
 *
 * Cualquier valor que no sea exactamente `'lista'` cae aca, incluido un typo.
 * Mandar de mas es lento; mandar de menos rompe en silencio.
 */
export function proyeccionPedida(vista?: string): Record<string, 1> | null {
  return vista === 'lista' ? proyeccionDeListado() : null;
}
