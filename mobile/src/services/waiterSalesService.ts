import { api } from './api/apiClient';
import { toSafeDate } from './dateUtils';
import {
  Order,
  OrderItem,
  OrderStatusEnum,
  PaymentStatusEnum,
  PaymentMethodEnum,
} from '../types';

/** Respuesta normalizada de pagos desde /api/payments/by-waiter */
export interface WaiterPayment {
  id: string;
  orderId: string;
  amount: number; // USD
  method: PaymentMethodEnum;
  reference?: string | null;
  bcvRate?: number;
  expectedAmountBS?: number;
  notes?: string | null;
  userId?: string;
  createdAt: Date | null;
  order?: {
    id: string;
    orderNumber?: string;
    tableName?: string;
    total: number;
    tipAmount?: number;
    serviceCharge?: number;
    paymentStatus: PaymentStatusEnum;
    createdAt?: Date | null;
  };
}

/** Resumen de ventas del día */
export interface DailySalesResume {
  totalSales: number; // USD
  orderCount: number;
  tips: number; // USD
  serviceCharge: number; // USD
  collected: number; // USD (órdenes pagadas)
  pending: number; // USD (órdenes sin pagar)
  collectedCount: number;
  pendingCount: number;
  paymentsByMethod: Array<{
    method: PaymentMethodEnum;
    label: string;
    amount: number; // USD
    count: number;
  }>;
}

interface RawOrder {
  id?: string;
  _id?: string;
  orderNumber?: string | null;
  customerId?: string;
  customerName?: string;
  userId?: string;
  items?: Array<{
    productId?: string;
    productName?: string;
    name?: string;
    quantity?: number;
    unitPrice?: number;
    price?: number;
    totalPrice?: number;
    total?: number;
    noCharge?: boolean;
    notes?: string | null;
  }>;
  status: OrderStatusEnum;
  paymentStatus: PaymentStatusEnum;
  paymentMethod?: PaymentMethodEnum;
  subtotal?: number;
  tax?: number;
  serviceCharge?: number;
  tipAmount?: number;
  total?: number;
  tableId?: string | null;
  tableName?: string | null;
  sector?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  isDeleted?: boolean;
  paymentAmountBs?: number;
  bcvRate?: number;
  paymentReference?: string | null;
}

interface RawPayment {
  id?: string;
  _id?: string;
  orderId: string;
  amount: number;
  method: PaymentMethodEnum;
  reference?: string | null;
  bcvRate?: number;
  expectedAmountBS?: number;
  notes?: string | null;
  userId?: string;
  createdAt?: string;
  order?: {
    id?: string;
    _id?: string;
    orderNumber?: string;
    tableName?: string;
    total: number;
    tipAmount?: number;
    serviceCharge?: number;
    paymentStatus: PaymentStatusEnum;
    createdAt?: string;
  };
}

function normalizeOrderItem(
  item: NonNullable<RawOrder['items']>[number],
): OrderItem {
  const quantity = item?.quantity ?? 1;
  const unitPrice = item?.unitPrice ?? item?.price ?? 0;
  return {
    productId: item?.productId ?? '',
    productName: item?.productName ?? item?.name ?? '',
    quantity,
    unitPrice,
    totalPrice: item?.totalPrice ?? item?.total ?? unitPrice * quantity,
    notes: item?.notes ?? null,
  };
}

function normalizeOrder(raw: RawOrder): Order {
  const normalized: Order = {
    id: String(raw.id ?? raw._id ?? ''),
    orderNumber: raw.orderNumber ?? undefined,
    customerId: raw.customerId ?? '',
    customerName: raw.customerName,
    userId: raw.userId,
    items: (raw.items ?? []).map(normalizeOrderItem),
    status: raw.status,
    paymentStatus: raw.paymentStatus,
    paymentMethod: raw.paymentMethod,
    subtotal: raw.subtotal ?? 0,
    tax: raw.tax,
    serviceCharge: raw.serviceCharge,
    tipAmount: raw.tipAmount,
    total: raw.total ?? 0,
    tableId: raw.tableId ?? null,
    tableName: raw.tableName ?? null,
    notes: raw.notes ?? null,
    isDeleted: raw.isDeleted ?? false,
    createdAt: toSafeDate(raw.createdAt),
    bcvRate: raw.bcvRate,
    paymentReference: raw.paymentReference ?? null,
  };
  // sector es un string en RawOrder pero Order espera ZoneSectorEnum | null
  // lo asignamos al final para evitar conflicto de tipos
  (normalized as unknown as { sector: string | null }).sector =
    raw.sector ?? null;
  return normalized;
}

function normalizePayment(raw: RawPayment): WaiterPayment {
  const order = raw.order
    ? {
        id: String(raw.order.id ?? raw.order._id ?? ''),
        orderNumber: raw.order.orderNumber,
        tableName: raw.order.tableName,
        total: raw.order.total,
        tipAmount: raw.order.tipAmount,
        serviceCharge: raw.order.serviceCharge,
        paymentStatus: raw.order.paymentStatus,
        createdAt: toSafeDate(raw.order.createdAt),
      }
    : undefined;

  return {
    id: String(raw.id ?? raw._id ?? ''),
    orderId: raw.orderId,
    amount: raw.amount,
    method: raw.method,
    reference: raw.reference ?? null,
    bcvRate: raw.bcvRate,
    expectedAmountBS: raw.expectedAmountBS,
    notes: raw.notes ?? null,
    userId: raw.userId,
    createdAt: toSafeDate(raw.createdAt),
    order,
  };
}

function getPaymentMethodLabel(method: PaymentMethodEnum): string {
  const labels: Record<PaymentMethodEnum, string> = {
    [PaymentMethodEnum.CASH_USD]: 'Efectivo USD',
    [PaymentMethodEnum.CASH_BS]: 'Efectivo Bs',
    [PaymentMethodEnum.CARD]: 'Tarjeta',
    [PaymentMethodEnum.TRANSFER]: 'Transferencia',
    [PaymentMethodEnum.PAGO_MOVIL]: 'Pago Móvil',
    [PaymentMethodEnum.MIXED]: 'Mixto',
    [PaymentMethodEnum.PENDING]: 'Pendiente',
  };
  return labels[method] ?? method;
}

export const waiterSalesService = {
  /**
   * Obtiene órdenes del mesonero en un rango de fechas
   */
  async getOrdersByWaiter(
    waiterId: string,
    from?: string,
    to?: string,
  ): Promise<Order[]> {
    const params: Record<string, string | undefined> = { waiterId, from, to };
    const list = await api.get<RawOrder[]>('/api/orders', params);
    return list.map(normalizeOrder);
  },

  /**
   * Obtiene pagos del mesonero en un rango de fechas
   */
  async getPaymentsByWaiter(
    waiterId: string,
    from?: string,
    to?: string,
  ): Promise<WaiterPayment[]> {
    const params: Record<string, string | undefined> = { waiterId, from, to };
    const list = await api.get<RawPayment[]>('/api/payments/by-waiter', params);
    return list.map(normalizePayment);
  },

  /**
   * Obtiene una orden por ID
   */
  async getOrderById(orderId: string): Promise<Order> {
    const raw = await api.get<RawOrder>(
      `/api/orders/${encodeURIComponent(orderId)}`,
    );
    return normalizeOrder(raw);
  },

  /**
   * Obtiene pagos de una orden específica
   */
  async getPaymentsByOrderId(orderId: string): Promise<WaiterPayment[]> {
    const list = await api.get<RawPayment[]>('/api/payments', { orderId });
    return list.map(normalizePayment);
  },

  /**
   * Calcula resumen de ventas del día
   */
  async calculateDailySalesResume(
    orders: Order[],
    payments: WaiterPayment[],
  ): Promise<DailySalesResume> {
    // Filtrar órdenes no canceladas
    const activeOrders = orders.filter(
      (o) => o.status !== OrderStatusEnum.CANCELLED,
    );

    const totalSales = activeOrders.reduce((sum, o) => sum + o.total, 0);
    const orderCount = activeOrders.length;
    const tips = activeOrders.reduce((sum, o) => sum + (o.tipAmount ?? 0), 0);
    const serviceCharge = activeOrders.reduce(
      (sum, o) => sum + (o.serviceCharge ?? 0),
      0,
    );

    // Órdenes pagadas vs pendientes
    const paidOrders = activeOrders.filter(
      (o) => (o.paymentStatus ?? '').toLowerCase() === 'paid',
    );
    const pendingOrders = activeOrders.filter(
      (o) => (o.paymentStatus ?? '').toLowerCase() !== 'paid',
    );

    const collected = paidOrders.reduce((sum, o) => sum + o.total, 0);
    const pending = pendingOrders.reduce((sum, o) => sum + o.total, 0);

    // Desglosar pagos por método
    const paymentsByMethodMap = new Map<
      PaymentMethodEnum,
      { amount: number; count: number }
    >();
    payments.forEach((p) => {
      const existing = paymentsByMethodMap.get(p.method) ?? {
        amount: 0,
        count: 0,
      };
      paymentsByMethodMap.set(p.method, {
        amount: existing.amount + p.amount,
        count: existing.count + 1,
      });
    });

    const paymentsByMethod = Array.from(paymentsByMethodMap.entries()).map(
      ([method, data]) => ({
        method,
        label: getPaymentMethodLabel(method),
        amount: data.amount,
        count: data.count,
      }),
    );

    return {
      totalSales,
      orderCount,
      tips,
      serviceCharge,
      collected,
      pending,
      collectedCount: paidOrders.length,
      pendingCount: pendingOrders.length,
      paymentsByMethod,
    };
  },
};
