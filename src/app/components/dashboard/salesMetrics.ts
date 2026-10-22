import { Order } from '@odin6/types';
import { Payment } from '@odin6/types';
import {
  OrderStatusEnum,
  PaymentMethodEnum,
  PaymentStatusEnum,
} from '@/shared/types/enumShared';
import { aFecha } from '@/shared/utils/dateHelpers';
import { DateRange } from './intervalUtils';

export interface SalesSummary {
  /** Todo lo facturado en el periodo, se haya cobrado o no. La venta real. */
  billed: number;
  /**
   * Venta que de verdad se cobro, calculada desde los PAGOS registrados y no
   * desde el estado de la orden.
   *
   * Antes salia de `paymentStatus === 'paid'` sumando el total completo: una
   * orden mal cerrada aportaba su total entero al ingreso aunque el dinero no
   * existiera. Con eso el panel nunca cuadraba contra el arqueo y las ordenes
   * cobradas de menos quedaban escondidas adentro del numero.
   */
  collected: number;
  /** Facturado que sigue sin cobrarse (credito, parciales, por verificar). */
  pending: number;
  /**
   * Propinas del periodo. Van SEPARADAS del facturado a proposito: no son
   * venta del restaurante, son del mesonero. Pero se muestran porque el
   * cliente las paga junto con la cuenta y sin verlas no cuadra la caja.
   */
  tips: number;
  /**
   * Propina que entro con esos pagos, prorrateada igual que en las tarjetas
   * de cobro para que los dos numeros aten.
   *
   * Existe aparte de `tips` porque una orden a credito arrastra su propina sin
   * que nadie la haya cobrado todavia. Sumar `tips` completo a lo cobrado
   * inflaria la caja con plata que aun no llego.
   */
  tipsCollected: number;
  orders: number;
  /** Consumo de socios apartado del facturado y del por cobrar. */
  excluded: number;
  excludedOrders: number;
}

/**
 * Una orden cuenta como venta salvo que este anulada. Las canceladas y
 * reembolsadas se excluyen; las soft-deleted no llegan al cliente (el backend
 * ya las filtra con `isDeleted: { $ne: true }`).
 */
export function isCountableSale(order: Order): boolean {
  return (
    order.status !== OrderStatusEnum.CANCELLED &&
    order.paymentStatus !== PaymentStatusEnum.CANCELLED &&
    order.paymentStatus !== PaymentStatusEnum.REFUNDED
  );
}

/**
 * Resume la venta de un periodo.
 *
 * OJO: cuenta por fecha de la ORDEN, que es cuando se consume. El dinero entra
 * despues — la mediana entre crear la orden y registrar el pago es 5.5h y el
 * promedio 10.9h — asi que `billed` NUNCA va a igualar lo cobrado en caja ese
 * mismo dia. Son dos cifras distintas a proposito: `billed` es la venta,
 * `pending` es lo que quedo a credito y nunca entro a caja.
 */
export function summarizeSales(
  orders: Order[],
  { start, end }: DateRange,
  /**
   * Clientes cuyo consumo no cuenta como venta ni como por cobrar: los socios
   * directivos acordaron no cobrarse entre ellos. Ver `configs/socios_excluidos`.
   */
  excluirCustomerIds: string[] = [],
  /**
   * Pagos registrados. Son la fuente de `collected`: sin ellos no se puede
   * saber cuanto entro de verdad, solo cuanto se DECLARO cobrado.
   */
  payments: Payment[] = [],
): SalesSummary {
  let billed = 0;
  let collected = 0;
  let tips = 0;
  let tipsCollected = 0;
  let count = 0;
  let excluded = 0;
  let excludedOrders = 0;
  const excluidos = new Set(excluirCustomerIds);
  // id de orden -> propina, para prorratearla sobre sus pagos despues.
  const delPeriodo = new Map<string, number>();

  for (const order of orders) {
    if (!order.createdAt || !isCountableSale(order)) continue;
    const date = aFecha(order.createdAt);
    if (date < start || date > end) continue;

    const total = order.total || 0;

    // El consumo de los socios se aparta, pero se contabiliza para poder
    // mostrarlo: un numero que desaparece sin rastro no se puede auditar.
    if (order.customerId && excluidos.has(order.customerId)) {
      excluded += total;
      excludedOrders += 1;
      continue;
    }

    const tip = order.tipAmount || 0;
    billed += total;
    tips += tip;
    delPeriodo.set(order.id, tip);
    count += 1;
  }

  // El dinero que entro sale de los PAGOS de esas ordenes, no de su estado.
  // Se descarta el descuento de nomina: es un descuento contra el sueldo, no
  // plata que llego al cajon.
  const pagosPorOrden = new Map<string, number>();
  for (const p of payments) {
    if (!delPeriodo.has(p.orderId)) continue;
    if (p.method === PaymentMethodEnum.PAYROLL_DEDUCTION) continue;
    pagosPorOrden.set(
      p.orderId,
      (pagosPorOrden.get(p.orderId) ?? 0) + (p.amount ?? 0),
    );
  }

  for (const [orderId, cobradoDeLaOrden] of pagosPorOrden) {
    const tip = delPeriodo.get(orderId) ?? 0;
    // La propina viaja dentro de los pagos: se prorratea igual que en las
    // tarjetas de cobro, y nunca por encima de lo que realmente entro.
    const propina = Math.min(tip, cobradoDeLaOrden);
    tipsCollected += propina;
    collected += cobradoDeLaOrden - propina;
  }

  return {
    billed,
    collected,
    pending: billed - collected,
    tips,
    tipsCollected,
    orders: count,
    excluded,
    excludedOrders,
  };
}
