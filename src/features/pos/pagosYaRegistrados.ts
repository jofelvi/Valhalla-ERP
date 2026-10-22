import type { PaymentStatusEnum } from '@/shared/types/enumShared';

/**
 * Si la pantalla de cobro debe CONTAR lo que ya se cobró de esta orden.
 *
 * El 21/09/2026 el dueño no podía cerrar la orden 180926-0004 ($73,45). El
 * mesonero ya había cobrado $73,48 en tres pagos (efectivo $, efectivo Bs y
 * tarjeta), la factura estaba emitida, y aun así el botón grande decía
 * "Ingrese un monto" y estaba deshabilitado. Medido con Playwright contra
 * producción: 61 botones en pantalla y ninguno era "Procesar Pago".
 *
 * La causa era este filtro, que solo miraba `PARTIAL`:
 *
 *     order?.paymentStatus === PaymentStatusEnum.PARTIAL ? pagos : []
 *
 * Esa orden estaba en `CREDIT/pending` (se pidió crédito de socio y quedó
 * parada ahí), no en `partial`. Entonces los pagos previos sumaban 0, el
 * restante daba los $73,45 completos en vez de $0, y por eso no se dibujaba
 * la salida "Finalizar — esta cuenta ya está pagada", que existe desde el
 * 29/08 justo para este caso.
 *
 * Lo caro no era la pantalla trabada: era que los $73,48 ya cobrados no se
 * restaban. Si el admin volvía a teclear los montos para poder cerrar,
 * cobraba dos veces.
 *
 * La regla correcta es la de abajo y se lee sola: **mientras la orden no esté
 * cerrada, lo que ya se cobró cuenta**, sea cual sea el estado intermedio. Una
 * orden pendiente sin pagos devuelve la lista vacía igual que antes, así que
 * el caso normal no cambia.
 *
 * Cerrada son dos estados, no uno:
 * - `PAID`: ya se cobró todo; la pantalla de cobro no se usa.
 * - `REFUNDED`: el dinero se devolvió. Contar esos pagos pondría el restante
 *   en $0 y dibujaría "Finalizar — esta cuenta ya está pagada" sobre una
 *   orden reembolsada, que es exactamente lo contrario de lo que pasó.
 *
 * `CANCELLED` NO entra: hoy una anulada en `partial` sí muestra sus abonos, y
 * sacárselos sería una regresión sobre un caso que ya funciona.
 *
 * Medido en producción: 39 órdenes no pagadas tienen abonos; 37 ya estaban en
 * `partial` y no cambian, y 2 estaban trabadas por esto.
 */

/**
 * Los dos estados en que la orden ya está cerrada, como literales.
 *
 * No se importa `PaymentStatusEnum` a propósito: `test:unit` corre con
 * `node --experimental-strip-types`, que borra los tipos sin compilar y
 * revienta con `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` ante cualquier `enum`.
 * Importar el enum aquí dejaría este archivo sin poder probarse. Los valores
 * son los mismos de `PaymentStatusEnum.PAID` y `.REFUNDED`.
 *
 * Para que no se desincronicen en silencio, el `satisfies` de abajo los ata al
 * enum en tiempo de compilación: es sintaxis de tipos, así que `tsc` la mira y
 * el runner la borra. Si alguien renombra un valor del enum, esto no compila.
 */
const CERRADAS = [
  'paid',
  'refunded',
] as const satisfies readonly `${PaymentStatusEnum}`[];

export function debenContarsePagosPrevios(
  paymentStatus: string | null | undefined,
): boolean {
  return !CERRADAS.includes(paymentStatus as (typeof CERRADAS)[number]);
}
