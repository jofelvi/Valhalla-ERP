import { Order } from '@/modelTypes/order';
import { Payment } from '@/modelTypes/payment';
import type { DatosDeImpresion } from './thermalPrintService';
import { Invoice } from '@/modelTypes/invoice';
import {
  PaymentMethodEnum,
  PaymentStatusEnum,
  PaymentTypeEnum,
  InvoiceStatusEnum,
  CurrencyEnum,
  OrderStatusEnum,
  TableStatusEnum,
} from '@/shared/types/enumShared';

/**
 * Aprueba un pago "Por Verificar" en bloque, replicando el flujo del page actual
 * /private/pos/payment/[orderId] cuando el cajero confirma los pagos pre-cargados
 * por el mesonero (order.pendingPayments).
 *
 * - Crea un Payment por cada pendingPayment con su comprobante/referencia.
 * - Crea Tip si la orden tiene tipAmount + waiterId (alimenta comisiones).
 * - Marca la orden PAID si hay cobertura del total, PARTIAL si no.
 * - Libera la mesa si quedo PAID.
 * - Crea Invoice asociada (estado segun cobertura).
 * - Dispara print termico fire-and-forget si la cola lo soporta.
 *
 * Diseñado para que pueda llamarse en bucle desde la pagina de verificación
 * masiva sin bloquear la UI: cada error queda aislado en el await individual.
 */

export interface ApproveOrderPaymentMutations {
  createPayment: { mutateAsync: (p: Omit<Payment, 'id'>) => Promise<Payment> };
  createTip: {
    mutateAsync: (t: {
      orderId: string;
      waiterId: string;
      waiterName: string;
      amount: number;
      createdAt: Date;
      userId: string;
    }) => Promise<unknown>;
  };
  updateOrder: {
    mutateAsync: (args: {
      id: string;
      data: Partial<Order>;
    }) => Promise<unknown>;
  };
  updateTable: {
    mutateAsync: (args: {
      id: string;
      data: { orderId: null; status: TableStatusEnum; isAvailable: true };
    }) => Promise<unknown>;
  };
  createInvoice: {
    mutateAsync: (data: Omit<Invoice, 'id'>) => Promise<Invoice>;
  };
}

export interface ApproveOrderPaymentInput {
  order: Order;
  cashierUserId: string;
  waiterName?: string;
  bcvRate: number;
  mutations: ApproveOrderPaymentMutations;
  // Imprimir el ticket termico al aprobar. Por defecto NO imprime: el cajero
  // decide al aprobar (evita que se impriman todas las facturas en automatico).
  shouldPrint?: boolean;
  // Datos del negocio para el ticket (useDatosDeImpresion). Sin ellos el ticket sale neutro.
  datos?: DatosDeImpresion;
}

export interface ApproveOrderPaymentResult {
  orderId: string;
  invoice: Invoice | null;
  newStatus: PaymentStatusEnum;
  paymentsCreated: number;
}

const bsToUsd = (amountBs: number, rate: number): number =>
  rate > 0 ? amountBs / rate : amountBs;

export async function approveOrderPayment(
  input: ApproveOrderPaymentInput,
): Promise<ApproveOrderPaymentResult> {
  const { order, cashierUserId, waiterName, bcvRate, mutations } = input;
  const shouldPrint = input.shouldPrint ?? false;
  const tipAmount = order.tipAmount ?? 0;
  const orderTotalWithTip = order.total + tipAmount;
  const pendingPayments = order.pendingPayments ?? [];

  // 1) Crear un Payment por cada pendingPayment
  let totalPaidUsd = 0;
  let paymentsCreated = 0;

  for (const pp of pendingPayments) {
    // pp.amount es USD canonico. pp.amountBs es el monto que el mesonero
    // ingreso en Bs (cuando aplica). Si por alguna razon falta amount, lo
    // derivamos de amountBs / bcvRate como respaldo.
    // Defensa contra APKs viejos: mandaban amount con el MISMO valor que
    // amountBs (o sea, en Bs) para Pago Movil/efectivo Bs — sin esto se
    // registraria un pago de $2.665 en una cuenta de $3.58.
    const amountLooksLikeBs =
      (pp.amountBs ?? 0) > 0 &&
      (pp.amount ?? 0) > 0 &&
      Math.abs((pp.amount ?? 0) - (pp.amountBs ?? 0)) < 0.01;
    const amountUsd = amountLooksLikeBs
      ? bsToUsd(pp.amountBs ?? 0, bcvRate)
      : pp.amount && pp.amount > 0
        ? pp.amount
        : bsToUsd(pp.amountBs ?? 0, bcvRate);
    const isBs = pp.method === PaymentMethodEnum.CASH_BS;
    const proofImageUrl = pp.proofUrls?.[0];

    const paymentData: Omit<Payment, 'id'> = {
      orderId: order.id,
      amount: amountUsd,
      method: pp.method,
      userId: cashierUserId,
      createdAt: new Date(),
      ...(isBs &&
        bcvRate > 0 && {
          bcvRate,
          expectedAmountBS: pp.amountBs ?? 0,
        }),
      ...(pp.reference && {
        transactionId: pp.reference,
        reference: pp.reference,
      }),
      ...(proofImageUrl && { proofImageUrl }),
    };

    await mutations.createPayment.mutateAsync(paymentData);
    totalPaidUsd += amountUsd;
    paymentsCreated += 1;
  }

  // 2) Tip → comisiones
  if (tipAmount > 0 && order.waiterId) {
    try {
      await mutations.createTip.mutateAsync({
        orderId: order.id,
        waiterId: order.waiterId,
        waiterName: waiterName ?? 'Desconocido',
        amount: tipAmount,
        createdAt: new Date(),
        userId: cashierUserId,
      });
    } catch (err) {
      // No bloqueante: igual que en el page actual
      console.warn('[approveOrderPayment] tip falló (no bloqueante):', err);
    }
  }

  // 3) Calcular nuevo estado (mismo criterio que handlePayment del page actual:
  //     PAID con tolerancia de $0.50 de redondeo, PARTIAL si no llega).
  const previousPaid = order.paymentAmount ?? 0;
  const allTimePaid = previousPaid + totalPaidUsd;
  const isFullyPaid = allTimePaid >= orderTotalWithTip - 0.5;
  const newStatus = isFullyPaid
    ? PaymentStatusEnum.PAID
    : PaymentStatusEnum.PARTIAL;

  // 4) Update orden
  await mutations.updateOrder.mutateAsync({
    id: order.id,
    data: {
      paymentStatus: newStatus,
      status:
        newStatus === PaymentStatusEnum.PAID
          ? OrderStatusEnum.PAID
          : order.status,
      tipAmount: tipAmount > 0 ? tipAmount : undefined,
      updatedAt: new Date(),
    },
  });

  // 5) Liberar mesa si quedo PAID
  if (newStatus === PaymentStatusEnum.PAID && order.tableId) {
    try {
      await mutations.updateTable.mutateAsync({
        id: order.tableId,
        data: {
          orderId: null,
          status: TableStatusEnum.ISAVAILABLE,
          isAvailable: true,
        },
      });
    } catch (err) {
      console.warn('[approveOrderPayment] liberar mesa falló:', err);
    }
  }

  // 6) Crear factura
  const invoice = await createInvoiceFor(
    order,
    newStatus,
    pendingPayments,
    tipAmount,
    bcvRate,
    mutations.createInvoice,
  );

  // 7) Print termico fire-and-forget — solo si el cajero pidio imprimir
  if (newStatus === PaymentStatusEnum.PAID && shouldPrint) {
    void firePrintReceipt(
      order,
      pendingPayments,
      tipAmount,
      bcvRate,
      input.datos,
    );
  }

  return {
    orderId: order.id,
    invoice,
    newStatus,
    paymentsCreated,
  };
}

async function createInvoiceFor(
  order: Order,
  paymentStatus: PaymentStatusEnum,
  pendingPayments: NonNullable<Order['pendingPayments']>,
  tipAmount: number,
  bcvRate: number,
  createInvoice: ApproveOrderPaymentMutations['createInvoice'],
): Promise<Invoice | null> {
  try {
    // Determinar tipo de pago dominante
    const methods = pendingPayments.map((p) => p.method);
    let paymentType: PaymentTypeEnum = PaymentTypeEnum.CASH;
    if (methods.includes(PaymentMethodEnum.CARD))
      paymentType = PaymentTypeEnum.CARD;
    else if (methods.includes(PaymentMethodEnum.TRANSFER))
      paymentType = PaymentTypeEnum.TRANSFER;
    else if (methods.includes(PaymentMethodEnum.PAGO_MOVIL))
      paymentType = PaymentTypeEnum.PAYMOBIL;

    let invoiceStatus: InvoiceStatusEnum;
    let paidAt: Date | undefined;
    switch (paymentStatus) {
      case PaymentStatusEnum.PAID:
        invoiceStatus = InvoiceStatusEnum.PAID;
        paidAt = new Date();
        break;
      case PaymentStatusEnum.PARTIAL:
        invoiceStatus = InvoiceStatusEnum.PARTIALLY_PAID;
        break;
      default:
        invoiceStatus = InvoiceStatusEnum.PENDING;
    }

    const invoiceNumber = `FAC-${Date.now().toString().slice(-8)}-${order.id.slice(-4).toUpperCase()}`;

    const invoiceItems =
      order.items?.map((item) => ({
        productId: item.productId,
        name: item.name,
        description: item.notes || item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.quantity * item.unitPrice,
        notes: item.notes || undefined,
      })) ?? [];

    const pagoMovilPending = pendingPayments.find(
      (pp) => pp.method === PaymentMethodEnum.PAGO_MOVIL,
    );
    const allProofUrls = [
      ...(order.paymentProofUrls ?? []),
      ...pendingPayments.flatMap((pp) => pp.proofUrls ?? []),
    ].filter(Boolean);

    const invoiceData: Omit<Invoice, 'id'> = {
      invoiceNumber,
      orderId: order.id,
      customerId: order.customerId || '',
      // El nombre viene con la orden desde el movil. Grabarlo aqui evita que
      // la factura nazca sin cliente cuando la aprueba el POS web.
      customerName: order.customerName || 'Cliente no especificado',
      subtotal: order.subtotal || 0,
      serviceCharge: order.serviceCharge || 0,
      tax: order.tax || 0,
      total: order.total + tipAmount,
      tip: tipAmount > 0 ? tipAmount : undefined,
      totalAmount: order.total + tipAmount,
      paymentType,
      currency: CurrencyEnum.USD,
      status: invoiceStatus,
      createdAt: new Date(),
      updatedAt: new Date(),
      paidAt,
      notes: tipAmount > 0 ? `Propina: $${tipAmount.toFixed(2)}` : undefined,
      items: invoiceItems,
      ...(order.paymentReference && {
        paymentReference: order.paymentReference,
      }),
      ...(bcvRate > 0 && { bcvRate }),
      ...(allProofUrls.length > 0 && { paymentProofUrls: allProofUrls }),
      ...((order.pagoMovilPhone || pagoMovilPending?.pagoMovilPhone) && {
        pagoMovilPhone:
          order.pagoMovilPhone ?? pagoMovilPending?.pagoMovilPhone ?? undefined,
      }),
      ...((order.pagoMovilCedula || pagoMovilPending?.pagoMovilCedula) && {
        pagoMovilCedula:
          order.pagoMovilCedula ??
          pagoMovilPending?.pagoMovilCedula ??
          undefined,
      }),
      ...((order.pagoMovilBanco || pagoMovilPending?.pagoMovilBanco) && {
        pagoMovilBanco:
          order.pagoMovilBanco ?? pagoMovilPending?.pagoMovilBanco ?? undefined,
      }),
    };

    return await createInvoice.mutateAsync(invoiceData);
  } catch (err) {
    console.error('[approveOrderPayment] crear invoice falló:', err);
    return null;
  }
}

async function firePrintReceipt(
  order: Order,
  pendingPayments: NonNullable<Order['pendingPayments']>,
  tipAmount: number,
  bcvRate: number,
  datos?: DatosDeImpresion,
): Promise<void> {
  try {
    const { printThermalReceipt } = await import('./thermalPrintService');
    // Convertir pendingPayments al shape que espera el print service
    type PrintPayment = Pick<Payment, 'method' | 'amount'>;
    const payments: PrintPayment[] = pendingPayments.map((pp) => ({
      method: pp.method,
      amount:
        pp.amount && pp.amount > 0
          ? pp.amount
          : bcvRate > 0
            ? (pp.amountBs ?? 0) / bcvRate
            : (pp.amountBs ?? 0),
    }));
    await printThermalReceipt(
      { ...order, tipAmount: tipAmount > 0 ? tipAmount : undefined },
      payments as Payment[],
      { datos },
    );
  } catch (err) {
    console.warn('[approveOrderPayment] print térmico falló:', err);
  }
}
