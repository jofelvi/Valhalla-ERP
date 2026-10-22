/**
 * Parametros que entiende el backend en `/api/orders` pero que NO existen como
 * campo dentro de la orden.
 *
 * La suscripcion en vivo replica los parametros de la consulta contra cada
 * orden que llega por WebSocket, para no mostrarle a un mesonero pedidos
 * ajenos. Eso funciona con `waiterId` o `customerId`, que si son campos del
 * documento; con `active` no: la comparacion daba siempre falso y cada evento
 * sacaba la orden del cache. Cocina, barra, pizza y despacho se vaciaban solas
 * y decian "todo despachado" con pedidos en la calle.
 *
 * Vive aparte de `orderService` a proposito: asi las pruebas pueden cargarlo
 * sin arrastrar el cliente HTTP ni el socket de React Native.
 */
export const FILTROS_DE_SERVIDOR: readonly string[] = [
  'active',
  // Cuantas y desde donde: son paginacion, no una propiedad de la orden.
  // Compararlos contra el documento seria el mismo error que `active`.
  'limit',
  'page',
];

/**
 * Si una orden que llego por WebSocket sigue perteneciendo a la consulta.
 *
 * El parametro puede traer VARIOS valores separados por coma, desde que la API
 * los acepta (`status=PENDING,IN_PROGRESS,READY,DELIVERED,CREDIT`). Eso es lo
 * que permite pedirle al servidor solo las ordenes vivas en vez de bajarse las
 * 4.766 del historico y filtrar en el telefono.
 *
 * Pero la comparacion tenia que aprenderlo. Antes era:
 *
 *     String(field ?? '') !== String(value)
 *
 * o sea `'PENDING' === 'PENDING,IN_PROGRESS,READY,DELIVERED,CREDIT'`, que es
 * falso SIEMPRE. Con eso, cada evento del socket habria sacado la orden del
 * cache: exactamente el bug que ya costo que cocina, barra y pizza dijeran
 * "todo despachado" con pedidos en la calle.
 */
export function coincideConElFiltro(
  valorDelCampo: unknown,
  valorDelParametro: string,
): boolean {
  const actual = String(valorDelCampo ?? '');
  if (!valorDelParametro.includes(',')) return actual === valorDelParametro;
  return valorDelParametro
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
    .includes(actual);
}
