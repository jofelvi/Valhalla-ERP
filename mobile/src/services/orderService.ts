import { api } from './api/apiClient';
import { paramsPendientesDeCobro } from '../queries/filtrosDeOrdenes';
import { COMANDA_AL_PAGAR } from '../config/funciones';
import { pedidoCobrado } from './pedidoCobrado';
import {
  FILTROS_DE_SERVIDOR,
  coincideConElFiltro,
} from './ordersSubscriptionFilters';
import { on as onSocket } from './api/socketClient';
import { toSafeDate } from './dateUtils';
import {
  Order,
  OrderItem,
  CartItem,
  OrderStatusEnum,
  OrderTypeEnum,
  PaymentMethodEnum,
  PaymentStatusEnum,
  ZoneSectorEnum,
  GpsCoordinates,
  TransferRequest,
  WaiterShare,
  CustomerRequest,
  CustomerRequestType,
  CustomerRequestStatus,
} from '../types';
import { waiterAssignmentService } from './waiterAssignmentService';
import { chatService } from './chatService';
import { expandPack, lineTotal } from './packPricing';
import { toApiOrderItem } from './orderItemPayload';
import { configActual } from '../config/configStore';
import { tarifasDeOrden } from '../config/tarifasDeOrden';
import { totalesDeOrden } from '../config/totalesDeOrden';

type Unsubscribe = () => void;

interface RawOrderItem {
  // El id de linea que usa TODO el flujo de estacion: sin el, la pantalla de
  // cocina/barra/pizza descarta el item y muestra "todo despachado".
  _id?: string;
  productId?: string;
  productName?: string;
  name?: string;
  quantity?: number;
  unitPrice?: number;
  price?: number;
  totalPrice?: number;
  total?: number;
  notes?: string | null;
  deliveredQty?: number;
  sentQty?: number;
  station?: 'KITCHEN' | 'BAR' | 'PIZZA' | null;
  cancelledAt?: string | null;
  addedAt?: string;
  presentationQty?: number;
}

interface RawTransferRequest {
  status?: 'REQUESTED' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
  fromWaiterId?: string;
  fromWaiterName?: string;
  toWaiterId?: string;
  toWaiterName?: string;
  fromPct?: number;
  toPct?: number;
  requestedAt?: string | Date;
  resolvedAt?: string | Date;
}

interface RawWaiterShare {
  waiterId?: string;
  waiterName?: string;
  pct?: number;
  comisionPagada?: boolean;
}

interface RawOrder {
  id?: string;
  _id?: string;
  customerId?: string;
  customerName?: string;
  userId?: string;
  orderType?: OrderTypeEnum;
  items?: RawOrderItem[];
  status: OrderStatusEnum;
  paymentStatus: PaymentStatusEnum;
  paymentMethod?: PaymentMethodEnum;
  subtotal?: number;
  /** Tarifas con las que se creó la orden (ver `tarifasDeOrden`). */
  tasaServicio?: number | null;
  modoServicio?: string | null;
  tasaIva?: number | null;
  ivaIncluido?: boolean | null;
  tax?: number;
  serviceCharge?: number;
  tipAmount?: number;
  total?: number;
  tableId?: string | null;
  tableName?: string | null;
  notes?: string | null;
  waiterId?: string | null;
  waiterName?: string | null;
  sector?: ZoneSectorEnum | null;
  customerLocation?: GpsCoordinates | null;
  creditRequest?: Record<string, unknown> | null;
  paymentProofUrls?: string[] | null;
  transferRequest?: RawTransferRequest | null;
  waiterShares?: RawWaiterShare[] | null;
  linkNonce?: string | null;
  customerRequests?: RawCustomerRequest[] | null;
  billRequested?: boolean;
  billRequestedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface RawCustomerRequest {
  id?: string;
  type?: CustomerRequestType;
  productId?: string | null;
  productName?: string | null;
  quantity?: number | null;
  note?: string | null;
  status?: CustomerRequestStatus;
  createdByCustomerId?: string;
  createdAt?: string | null;
  resolvedByUserId?: string | null;
  resolvedAt?: string | null;
  rejectReason?: string | null;
}

function normalizeItem(item: RawOrderItem): OrderItem {
  const quantity = item.quantity ?? 1;
  const unitPrice = item.unitPrice ?? item.price ?? 0;
  return {
    productId: item.productId ?? '',
    productName: item.productName ?? item.name ?? '',
    quantity,
    unitPrice,
    totalPrice: item.totalPrice ?? item.total ?? unitPrice * quantity,
    notes: item.notes ?? null,
    deliveredQty: item.deliveredQty ?? 0,
    sentQty: item.sentQty,
    station: item.station ?? null,
    // Estos cuatro los usa `flattenPendingItems` para armar la vista de las
    // estaciones. Sin `_id` descartaba TODOS los items y cocina, barra y pizza
    // decian "todo despachado" con pedidos sin entregar; sin `cancelledAt` un
    // item anulado reaparecia como pendiente.
    _id: item._id,
    cancelledAt: item.cancelledAt ?? null,
    addedAt: item.addedAt,
    presentationQty: item.presentationQty,
  };
}

function normalizeOrder(raw: RawOrder): Order {
  const creditRequest = (raw as { creditRequest?: unknown }).creditRequest as
    | Order['creditRequest']
    | null
    | undefined;

  let transferRequest: TransferRequest | null | undefined;
  if (raw.transferRequest) {
    transferRequest = {
      status: raw.transferRequest.status ?? 'REQUESTED',
      fromWaiterId: raw.transferRequest.fromWaiterId ?? '',
      fromWaiterName: raw.transferRequest.fromWaiterName,
      toWaiterId: raw.transferRequest.toWaiterId ?? '',
      toWaiterName: raw.transferRequest.toWaiterName,
      fromPct: raw.transferRequest.fromPct ?? 50,
      toPct: raw.transferRequest.toPct ?? 50,
      requestedAt: toSafeDate(raw.transferRequest.requestedAt) ?? new Date(),
      resolvedAt: toSafeDate(raw.transferRequest.resolvedAt) ?? undefined,
    };
  }

  const waiterShares: WaiterShare[] | null =
    raw.waiterShares?.map((ws) => ({
      waiterId: ws.waiterId ?? '',
      waiterName: ws.waiterName,
      pct: ws.pct ?? 0,
      comisionPagada: ws.comisionPagada ?? false,
    })) ?? null;

  return {
    id: String(raw.id ?? raw._id ?? ''),
    customerId: raw.customerId ?? '',
    customerName: raw.customerName,
    userId: raw.userId,
    orderType: raw.orderType,
    items: (raw.items ?? []).map(normalizeItem),
    status: raw.status,
    paymentStatus: raw.paymentStatus,
    paymentMethod: raw.paymentMethod,
    subtotal: raw.subtotal ?? 0,
    tax: raw.tax,
    serviceCharge: raw.serviceCharge,
    // Tarifas con las que se creó la orden: sin ellas no se puede mostrar el cobro original.
    tasaServicio: raw.tasaServicio,
    modoServicio: raw.modoServicio,
    tasaIva: raw.tasaIva,
    ivaIncluido: raw.ivaIncluido,
    tipAmount: raw.tipAmount,
    total: raw.total ?? 0,
    tableId: raw.tableId ?? null,
    tableName: raw.tableName ?? null,
    notes: raw.notes ?? null,
    additionalNotes:
      ((raw as { additionalNotes?: unknown[] })
        .additionalNotes as Order['additionalNotes']) ?? null,
    isDeleted: (raw as { isDeleted?: boolean }).isDeleted ?? false,
    waiterId: raw.waiterId ?? null,
    waiterName: raw.waiterName ?? null,
    sector: raw.sector ?? null,
    customerLocation: raw.customerLocation ?? null,
    creditRequest: creditRequest ?? undefined,
    // El cajero necesita ver el comprobante de pago y la propina acumulada
    // para cuadrar el pendiente; el schema del back los tiene (`tipAmount`,
    // `paymentProofUrls` en order.schema.ts) pero normalize no los copiaba.
    paymentProofUrls: raw.paymentProofUrls ?? null,
    transferRequest: transferRequest ?? undefined,
    waiterShares,
    linkNonce: raw.linkNonce ?? null,
    customerRequests: (raw.customerRequests ?? []).map(
      normalizeCustomerRequest,
    ),
    billRequested: raw.billRequested ?? false,
    billRequestedAt: toSafeDate(raw.billRequestedAt),
    createdAt: toSafeDate(raw.createdAt),
    updatedAt: toSafeDate(raw.updatedAt),
  };
}

function normalizeCustomerRequest(raw: RawCustomerRequest): CustomerRequest {
  return {
    id: String(raw.id ?? ''),
    type: raw.type ?? CustomerRequestType.MISC,
    productId: raw.productId ?? null,
    productName: raw.productName ?? null,
    quantity: raw.quantity ?? null,
    note: raw.note ?? null,
    status: raw.status ?? CustomerRequestStatus.PENDING,
    createdByCustomerId: raw.createdByCustomerId ?? '',
    createdAt: toSafeDate(raw.createdAt),
    resolvedByUserId: raw.resolvedByUserId ?? null,
    resolvedAt: toSafeDate(raw.resolvedAt),
    rejectReason: raw.rejectReason ?? null,
  };
}

/**
 * Se suscribe a los eventos de WebSocket para órdenes y filtra según un predicado.
 * Devuelve cleanup fn.
 */
function subscribeOrdersFiltered(
  filterPath: string,
  params: Record<string, string | undefined>,
  predicate: (order: Order) => boolean,
  callback: (orders: Order[]) => void,
  sortDescByCreatedAt = true,
): Unsubscribe {
  let cache = new Map<string, Order>();
  let cancelled = false;
  const offs: Unsubscribe[] = [];

  // Los eventos WebSocket (`order:created`/`order:updated`) son broadcast
  // a todos los clientes sin filtro. Si no replicamos los `params` del
  // lado cliente, un mesonero puede ver ordenes ajenas cuyo evento llegue
  // al socket. Tambien maneja el caso de traspaso: si una orden cambia
  // y ya no coincide con los params, hay que sacarla del cache.
  const matchesParams = (order: Order): boolean => {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) continue;
      // `active` (y cualquier filtro de este tipo) es un parametro de consulta
      // para el servidor, NO un campo de la orden. Compararlo contra el
      // documento daba siempre falso: cada evento del socket sacaba la orden
      // del cache y las pantallas de cocina, barra, pizza y despacho se
      // vaciaban solas — decian "todo despachado" con pedidos en la calle.
      if (FILTROS_DE_SERVIDOR.includes(key)) continue;
      const field = (order as unknown as Record<string, unknown>)[key];
      // Entiende listas: el parametro puede traer varios valores separados por
      // coma desde que la API los acepta. Ver `coincideConElFiltro`.
      if (!coincideConElFiltro(field, String(value))) return false;
    }
    return true;
  };

  const emit = () => {
    if (cancelled) return;
    let list = Array.from(cache.values()).filter(predicate);
    if (sortDescByCreatedAt) {
      list = list.sort(
        (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
      );
    }
    callback(list);
  };

  void (async () => {
    // snapshot inicial
    try {
      const list = await api.get<RawOrder[]>(filterPath, params);
      cache = new Map(list.map(normalizeOrder).map((o) => [o.id, o]));
      emit();
    } catch (err) {
      console.error('subscribeOrdersFiltered initial fetch error:', err);
    }

    if (cancelled) return;

    const upsert = (raw: RawOrder) => {
      const o = normalizeOrder(raw);
      if (!matchesParams(o)) {
        // Orden no pertenece al scope actual: si estaba en cache (p. ej.
        // por un traspaso previo) hay que retirarla para que desaparezca
        // de la UI del mesonero que ya no la tiene asignada.
        if (cache.delete(o.id)) emit();
        return;
      }
      cache.set(o.id, o);
      emit();
    };

    try {
      offs.push(await onSocket<RawOrder>('order:created', upsert));
      offs.push(await onSocket<RawOrder>('order:updated', upsert));
      offs.push(
        await onSocket<{ id: string }>('order:deleted', (payload) => {
          if (cache.delete(payload.id)) emit();
        }),
      );
    } catch (err) {
      console.error('subscribeOrdersFiltered socket error:', err);
    }
  })();

  return () => {
    cancelled = true;
    offs.forEach((off) => off());
  };
}

const ACTIVE_STATUSES: OrderStatusEnum[] = [
  OrderStatusEnum.PENDING,
  OrderStatusEnum.IN_PROGRESS,
  OrderStatusEnum.READY,
];

const WAITER_STATUSES: OrderStatusEnum[] = [
  ...ACTIVE_STATUSES,
  OrderStatusEnum.DELIVERED,
];

// El filtro de estado viaja al servidor. "Mis pedidos" y "Zonas" del mesonero
// pedian `?waiterId=` a secas: todo el historico del mesonero (hasta 500
// ordenes completas) para quedarse con las abiertas. En produccion era la
// consulta mas lenta del telefono: 212 ms de media, 665 veces en 5 dias
// (log de la API, 23-27/09/2026). Los predicados de abajo siguen igual: el
// servidor solo deja de mandar lo que el telefono ya descartaba.
const ESTADOS_DEL_MESONERO = WAITER_STATUSES.join(',');
const ESTADOS_ACTIVOS = ACTIVE_STATUSES.join(',');

// Id de idempotencia por intento de checkout. La pantalla lo genera UNA vez y
// lo reusa si el mesonero reintenta por timeout/mala red — el backend devuelve
// la orden ya creada en vez de duplicarla (caso real 19/07: 3 ordenes iguales).
export const genClientRequestId = (): string =>
  `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// Item de orden ya listo para el payload (una línea).
interface BuiltOrderItem {
  productId: string;
  productName: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  total: number;
  notes: string | null;
  station: string | null;
  sentQty: number;
  addedAt: string;
  quantityLog: { qty: number; at: string }[];
  presentationQty?: number;
  composition?: {
    variantProductId: string;
    variantName: string;
    qty: number;
    deliveredQty: number;
    returnedQty: number;
  }[];
}

// Convierte un item del carrito en una o varias líneas de orden.
// - Combo multi-estación (product.stationParts): una línea por parte, cada una
//   en su estación; el precio va en la primera parte, 0 en las demás.
// - Pack (tobo/caja): expande a unidades individuales.
// - Tobo mixto: pasa la composición por variante.
// - Normal: una línea.
function buildOrderItemsFromCart(
  cartItem: CartItem,
  now: string,
): BuiltOrderItem[] {
  const parts = cartItem.product.stationParts;
  if (parts && parts.length) {
    const totalPrice = cartItem.product.price * cartItem.quantity;
    return parts.map((part, idx) => ({
      productId: cartItem.product.id,
      productName: part.label,
      name: part.label,
      quantity: cartItem.quantity,
      unitPrice: idx === 0 ? cartItem.product.price : 0,
      totalPrice: idx === 0 ? totalPrice : 0,
      total: idx === 0 ? totalPrice : 0,
      notes: cartItem.notes ?? null,
      station: part.station,
      sentQty: cartItem.quantity,
      addedAt: now,
      quantityLog: [{ qty: cartItem.quantity, at: now }],
    }));
  }

  const packSize = cartItem.presentationQty ?? 0;
  const isPack = packSize > 0;
  const expandedQty = isPack ? cartItem.quantity * packSize : cartItem.quantity;
  const unitPrice = isPack
    ? cartItem.product.price / packSize
    : cartItem.product.price;
  const totalPrice = cartItem.product.price * cartItem.quantity;
  return [
    {
      productId: cartItem.product.id,
      productName: cartItem.product.name,
      name: cartItem.product.name,
      quantity: expandedQty,
      unitPrice,
      totalPrice,
      total: totalPrice,
      notes: cartItem.notes ?? null,
      station: cartItem.product.station ?? null,
      sentQty: expandedQty,
      addedAt: now,
      quantityLog: [{ qty: expandedQty, at: now }],
      ...(isPack ? { presentationQty: packSize } : {}),
      ...(cartItem.composition
        ? {
            composition: cartItem.composition.map((c) => ({
              variantProductId: c.variantProductId,
              variantName: c.variantName,
              qty: c.qty,
              deliveredQty: 0,
              returnedQty: 0,
            })),
          }
        : {}),
    },
  ];
}

export const orderService = {
  async createOrder(
    customerId: string,
    customerName: string,
    items: OrderItem[],
    paymentMethod: PaymentMethodEnum,
    tableId?: string,
    tableName?: string,
    notes?: string,
    sector?: ZoneSectorEnum,
    customerLocation?: GpsCoordinates,
  ): Promise<{
    orderId: string;
    waiterId: string | null;
    waiterName: string | null;
  }> {
    let waiterId: string | null = null;
    let waiterName: string | null = null;
    let tieneMesonero = false;

    try {
      const assignment = await waiterAssignmentService.assignWaiter();
      if (assignment) {
        waiterId = assignment.waiterId;
        waiterName = assignment.waiterName;
        tieneMesonero = true;
      }
    } catch (error) {
      console.error('Error asignando mesonero:', error);
    }

    // Servicio e impuesto con la configuración vigente. El servidor recalcula con la suya.
    const { subtotal, serviceCharge, total } = totalesDeOrden(
      items,
      tieneMesonero,
      configActual().tarifas,
    );

    const payload = {
      // El backend exige `userId` (quien crea la orden) y lo valida con
      // @IsNotEmpty. El pedido del CLIENTE no lo mandaba: cada intento moria
      // con 400 "userId should not be empty" y ningun cliente pudo pedir jamas.
      // Aqui quien crea es el propio cliente.
      userId: customerId,
      customerId,
      customerName,
      items,
      status: OrderStatusEnum.PENDING,
      paymentStatus: PaymentStatusEnum.PENDING,
      paymentMethod,
      orderType: sector ? OrderTypeEnum.Zone : undefined,
      subtotal,
      serviceCharge: serviceCharge > 0 ? serviceCharge : null,
      total,
      tableId: tableId ?? null,
      tableName: tableName ?? null,
      notes: notes ?? null,
      waiterId,
      waiterName,
      sector: sector ?? null,
      customerLocation: customerLocation ?? null,
    };

    const created = await api.post<RawOrder>('/api/orders', payload);
    const orderId = String(created.id ?? created._id ?? '');

    if (waiterId && waiterName) {
      try {
        await chatService.createChat(
          orderId,
          customerId,
          customerName,
          waiterId,
          waiterName,
        );
      } catch (error) {
        console.error('Error creando chat:', error);
      }
    }

    return { orderId, waiterId, waiterName };
  },

  async createWaiterOrder(
    userId: string,
    items: CartItem[],
    tableId?: string,
    tableName?: string,
    notes?: string,
    sector?: ZoneSectorEnum,
    isTakeaway?: boolean,
    waiterName?: string,
    customerAlias?: string,
    associateNumber?: string,
    customer?: { id: string; name: string } | null,
    clientRequestId?: string,
  ): Promise<string> {
    const now = new Date().toISOString();
    const orderItems = items.flatMap((cartItem) =>
      buildOrderItemsFromCart(cartItem, now),
    );

    // Esta orden siempre tiene mesonero (quien la toma): lleva servicio.
    const { subtotal, serviceCharge, total } = totalesDeOrden(
      orderItems,
      true,
      configActual().tarifas,
    );

    const payload = {
      customerId: customer?.id ?? userId,
      customerName: customer?.name ?? configActual().vocabulario.waiter,
      userId,
      waiterId: userId,
      waiterName: waiterName ?? null,
      orderType: isTakeaway
        ? OrderTypeEnum.Takeaway
        : sector
          ? OrderTypeEnum.Zone
          : OrderTypeEnum.DineIn,
      items: orderItems,
      status: OrderStatusEnum.PENDING,
      paymentStatus: PaymentStatusEnum.PENDING,
      paymentMethod: PaymentMethodEnum.PENDING,
      subtotal,
      serviceCharge,
      total,
      tableId: tableId ?? null,
      tableName: tableName ?? null,
      sector: sector ?? null,
      customerAlias: customer?.name ?? customerAlias ?? null,
      associateNumber: associateNumber ?? null,
      notes: notes ?? null,
      clientRequestId: clientRequestId ?? null,
    };

    const created = await api.post<RawOrder>('/api/orders', payload);
    return String(created.id ?? created._id ?? '');
  },

  async createCashierOrder(
    cashierUserId: string,
    items: CartItem[],
    options: {
      tableId?: string;
      tableName?: string;
      notes?: string;
      sector?: ZoneSectorEnum;
      waiterId?: string;
      waiterName?: string;
      isTakeaway?: boolean;
      clientRequestId?: string;
    },
  ): Promise<string> {
    const now = new Date().toISOString();
    const orderItems = items.map((cartItem) => {
      const line = expandPack(
        cartItem.product.price,
        cartItem.quantity,
        cartItem.presentationQty,
      );
      const packSize = cartItem.presentationQty ?? 0;
      const isPack = packSize > 0;
      const expandedQty = line.quantity;
      const unitPrice = line.unitPrice;
      const totalPrice = line.total;
      return {
        productId: cartItem.product.id,
        productName: cartItem.product.name,
        name: cartItem.product.name,
        quantity: expandedQty,
        unitPrice,
        totalPrice,
        total: totalPrice,
        notes: cartItem.notes ?? null,
        station: cartItem.product.station ?? null,
        sentQty: expandedQty,
        addedAt: now,
        quantityLog: [{ qty: expandedQty, at: now }],
        ...(isPack ? { presentationQty: packSize } : {}),
        ...(cartItem.composition
          ? {
              composition: cartItem.composition.map((c) => ({
                variantProductId: c.variantProductId,
                variantName: c.variantName,
                qty: c.qty,
                deliveredQty: 0,
                returnedQty: 0,
              })),
            }
          : {}),
      };
    });

    // El servicio solo existe si la orden tiene mesonero (lo decide la configuración).
    const { subtotal, serviceCharge, total } = totalesDeOrden(
      orderItems,
      !!options.waiterId,
      configActual().tarifas,
    );

    const payload = {
      customerId: cashierUserId,
      customerName: configActual().vocabulario.cashier,
      userId: cashierUserId,
      waiterId: options.waiterId ?? cashierUserId,
      waiterName: options.waiterName ?? null,
      orderType: options.isTakeaway
        ? OrderTypeEnum.Takeaway
        : options.sector
          ? OrderTypeEnum.Zone
          : OrderTypeEnum.DineIn,
      items: orderItems,
      status: OrderStatusEnum.PENDING,
      paymentStatus: PaymentStatusEnum.PENDING,
      paymentMethod: PaymentMethodEnum.PENDING,
      subtotal,
      serviceCharge: serviceCharge > 0 ? serviceCharge : null,
      total,
      tableId: options.tableId ?? null,
      tableName: options.tableName ?? null,
      sector: options.sector ?? null,
      notes: options.notes ?? null,
      clientRequestId: options.clientRequestId ?? null,
    };

    const created = await api.post<RawOrder>('/api/orders', payload);
    return String(created.id ?? created._id ?? '');
  },

  async getCustomerOrders(customerId: string): Promise<Order[]> {
    const list = await api.get<RawOrder[]>('/api/orders', { customerId });
    return list
      .map(normalizeOrder)
      .sort(
        (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
      );
  },

  async getWaiterOrders(userId: string): Promise<Order[]> {
    const list = await api.get<RawOrder[]>('/api/orders', {
      waiterId: userId,
      status: ESTADOS_DEL_MESONERO,
    });
    return list
      .map(normalizeOrder)
      .filter((o) => WAITER_STATUSES.includes(o.status))
      .sort(
        (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
      );
  },

  /**
   * Devuelve las ordenes activas (PENDING/IN_PROGRESS/READY) de una mesa.
   * Se usa para detectar colision al intentar crear orden en mesa ocupada
   * por otro mesonero (abrir la existente en vez de fallar).
   */
  async getActiveOrdersByTable(tableId: string): Promise<Order[]> {
    const list = await api.get<RawOrder[]>('/api/orders', {
      tableId,
      active: 'true',
    });
    return list.map(normalizeOrder);
  },

  subscribeToOrder(
    orderId: string,
    callback: (order: Order | null) => void,
  ): Unsubscribe {
    let cancelled = false;
    const offs: Unsubscribe[] = [];
    let previousWaiterId: string | null | undefined = undefined;

    const handleUpdate = async (raw: RawOrder) => {
      if (cancelled) return;
      const id = String(raw.id ?? raw._id ?? '');
      if (id !== orderId) return;
      const order = normalizeOrder(raw);

      if (order.waiterId && previousWaiterId === null && order.customerName) {
        try {
          await chatService.createChat(
            orderId,
            order.customerId,
            order.customerName ?? 'Cliente',
            order.waiterId,
            order.waiterName ?? configActual().vocabulario.waiter,
          );
        } catch {
          // Chat ya existe o error — no bloquear
        }
      }
      previousWaiterId = order.waiterId ?? null;
      callback(order);
    };

    void (async () => {
      // snapshot inicial
      try {
        const raw = await api.get<RawOrder>(`/api/orders/${orderId}`);
        await handleUpdate(raw);
      } catch {
        callback(null);
      }

      if (cancelled) return;

      try {
        offs.push(await onSocket<RawOrder>('order:created', handleUpdate));
        offs.push(await onSocket<RawOrder>('order:updated', handleUpdate));
        offs.push(
          await onSocket<{ id: string }>('order:deleted', (payload) => {
            if (payload.id === orderId) callback(null);
          }),
        );
      } catch (err) {
        console.error('subscribeToOrder socket error:', err);
      }
    })();

    return () => {
      cancelled = true;
      offs.forEach((off) => off());
    };
  },

  subscribeToActiveOrders(
    customerId: string,
    callback: (orders: Order[]) => void,
  ): Unsubscribe {
    return subscribeOrdersFiltered(
      '/api/orders',
      { customerId },
      (o) => ACTIVE_STATUSES.includes(o.status),
      callback,
    );
  },

  subscribeToWaiterActiveOrders(
    userId: string,
    callback: (orders: Order[]) => void,
  ): Unsubscribe {
    return subscribeOrdersFiltered(
      '/api/orders',
      { waiterId: userId, status: ESTADOS_DEL_MESONERO },
      (o) => WAITER_STATUSES.includes(o.status),
      callback,
    );
  },

  subscribeToZoneOrders(
    userId: string,
    callback: (orders: Order[]) => void,
  ): Unsubscribe {
    return subscribeOrdersFiltered(
      '/api/orders',
      // La pantalla de zonas solo muestra las activas (ACTIVE_STATUSES).
      { waiterId: userId, status: ESTADOS_ACTIVOS },
      (o) => !!o.sector,
      callback,
    );
  },

  subscribeToAllZoneOrders(callback: (orders: Order[]) => void): Unsubscribe {
    return subscribeOrdersFiltered(
      '/api/orders',
      {},
      (o) => !!o.sector,
      callback,
    );
  },

  // Para las pantallas de Cocina y Barra: ordenes activas (no pagadas, no
  // canceladas) sin filtrar por mesonero. La pantalla luego filtra los items
  // por estacion (KITCHEN o BAR) y deliveredQty < quantity.
  subscribeToActiveOrdersForStation(
    callback: (orders: Order[]) => void,
  ): Unsubscribe {
    return subscribeOrdersFiltered(
      '/api/orders',
      { active: 'true' },
      (o) =>
        (ACTIVE_STATUSES.includes(o.status) ||
          o.status === OrderStatusEnum.DELIVERED) &&
        // Con la comanda al cobrar, la estacion solo ve pedidos ya cobrados.
        (!COMANDA_AL_PAGAR || pedidoCobrado(o.paymentStatus)),
      callback,
    );
  },

  async addItemsToOrder(
    orderId: string,
    _existingItems: OrderItem[],
    newCartItems: CartItem[],
    additionalNotes?: string,
  ): Promise<void> {
    const nowAdd = new Date().toISOString();
    // Los packs (tobos, cajas) se expanden a unidades IGUAL que al crear la
    // orden. Sin esto un tobo de $11 entraba como 1 unidad y, al fusionarse con
    // la linea ya expandida (unitPrice = 11/12), se cobraba $0.92 en vez de $11.
    const newOrderItems = newCartItems.map((cartItem) => {
      const line = expandPack(
        cartItem.product.price,
        cartItem.quantity,
        cartItem.presentationQty,
      );
      const packSize = cartItem.presentationQty ?? 0;
      const isPack = packSize > 0;
      const expandedQty = line.quantity;
      const unitPrice = line.unitPrice;
      const totalPrice = line.total;
      return {
        productId: cartItem.product.id,
        productName: cartItem.product.name,
        name: cartItem.product.name,
        quantity: expandedQty,
        unitPrice,
        price: unitPrice,
        totalPrice,
        total: totalPrice,
        notes: cartItem.notes ?? null,
        deliveredQty: 0,
        sentQty: expandedQty,
        station: cartItem.product.station ?? null,
        addedAt: nowAdd,
        quantityLog: [{ qty: expandedQty, at: nowAdd }],
        ...(isPack ? { presentationQty: packSize } : {}),
      };
    });

    // CRITICO: leer SIEMPRE los items actuales del backend, no del parametro.
    // Si el caller pasa una version stale (route params congelados al entrar a
    // la pantalla, estado local desactualizado, etc.) y mergeamos sobre eso,
    // los items que se agregaron desde otros caminos se pierden al guardar
    // (PATCH replace del array). Bug Mesa 16 1-may-2026.
    const current = await api.get<RawOrder>(`/api/orders/${orderId}`);
    const freshExistingItems = (current.items ?? []) as OrderItem[];

    const deliveredLines: Record<string, unknown>[] = [];
    const pendingLines: { key: string; entry: Record<string, unknown> }[] = [];

    for (const item of freshExistingItems) {
      const delivered = item.deliveredQty ?? 0;
      // El backend persiste el campo como `name` (schema OrderItem). El cliente
      // viejo enviaba `productName` y el web POS usaba ambos. Al leer fresh del
      // backend, debemos usar `name` como fuente principal con fallback a
      // `productName` por si llega de un cache mixto.
      const itemAny = item as unknown as {
        name?: string;
        productName?: string;
      };
      const itemName = itemAny.name ?? itemAny.productName ?? '';
      // presentationQty marca que la linea es un pack. El merge lo descartaba
      // y la linea quedaba sin forma de volver a calcularse bien.
      const itemPack = (item as unknown as { presentationQty?: number })
        .presentationQty;
      const entry: Record<string, unknown> = {
        productId: item.productId,
        productName: itemName,
        name: itemName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        price: item.unitPrice,
        totalPrice: lineTotal(item.unitPrice, item.quantity, itemPack),
        total: lineTotal(item.unitPrice, item.quantity, itemPack),
        notes: item.notes ?? null,
        deliveredQty: delivered,
        sentQty: item.sentQty ?? item.quantity,
        station: item.station ?? null,
        ...(itemPack ? { presentationQty: itemPack } : {}),
      };
      if (delivered > 0) deliveredLines.push(entry);
      else pendingLines.push({ key: item.productId, entry });
    }

    for (const item of newOrderItems) {
      const matchIdx = pendingLines.findIndex((p) => p.key === item.productId);
      if (matchIdx !== -1) {
        const existing = pendingLines[matchIdx].entry;
        const newQty = (existing.quantity as number) + item.quantity;
        const unitPrice = existing.unitPrice as number;
        const existingNotes = existing.notes as string | null;
        const newNotes = item.notes as string | null;
        const existingLog =
          (existing.quantityLog as Array<{ qty: number; at: string }>) || [];
        existingLog.push({ qty: newQty, at: nowAdd });
        const packSize = existing.presentationQty as number | undefined;
        pendingLines[matchIdx].entry = {
          ...existing,
          quantity: newQty,
          totalPrice: lineTotal(unitPrice, newQty, packSize),
          total: lineTotal(unitPrice, newQty, packSize),
          deliveredQty: 0,
          // Las unidades agregadas se imprimen en la comanda que sigue a este
          // merge — sumarlas a sentQty. Dejarlo viejo creaba "fantasmas"
          // (quantity > sentQty) que la web reimprimia horas despues (bug 19/07
          // de comandas duplicadas).
          sentQty: ((existing.sentQty as number) ?? 0) + item.quantity,
          notes:
            existingNotes && newNotes
              ? `${existingNotes} | ${newNotes}`
              : newNotes || existingNotes,
          quantityLog: existingLog,
        };
      } else {
        pendingLines.push({ key: item.productId, entry: item });
      }
    }

    const mergedItems = [
      ...deliveredLines,
      ...pendingLines.map((p) => p.entry),
    ];

    // Reutilizamos el `current` ya leido arriba — preserva serviceCharge y notas
    // y evita un segundo round-trip al backend.
    const currentServiceCharge = current.serviceCharge ?? null;
    const currentNotes = current.notes ?? null;

    // Se conserva el servicio solo si la orden lo tenía; con las tarifas con que se creó.
    const { subtotal, serviceCharge, total } = totalesDeOrden(
      mergedItems,
      currentServiceCharge != null && currentServiceCharge > 0,
      tarifasDeOrden(current, configActual().tarifas),
    );

    const updateData: Record<string, unknown> = {
      items: mergedItems,
      subtotal,
      serviceCharge: serviceCharge > 0 ? serviceCharge : null,
      total,
    };

    if (additionalNotes) {
      updateData.notes = currentNotes
        ? `${currentNotes} | ${additionalNotes}`
        : additionalNotes;
    }

    await this.updateOrder(orderId, updateData);
  },

  async updateOrderItems(orderId: string, items: OrderItem[]): Promise<void> {
    await this.updateOrder(orderId, { items: items.map(toApiOrderItem) });
  },

  async updateOrder(
    orderId: string,
    data: Partial<Record<string, unknown>>,
  ): Promise<void> {
    await api.patch(`/api/orders/${orderId}`, data);
  },

  async addAdditionalNote(
    orderId: string,
    text: string,
    authorId?: string,
    authorName?: string,
  ): Promise<void> {
    await api.post(`/api/orders/${orderId}/additional-notes`, {
      text,
      authorId,
      authorName,
    });
  },

  /**
   * Borra el pedido recien creado cuando se sale del cobro sin cobrar. El servidor
   * solo lo acepta si es un borrador (sin cobro ni nada impreso o entregado): si no,
   * responde 409 y la orden queda como esta.
   */
  async descartarSinCobrar(orderId: string): Promise<void> {
    await api.post(`/api/orders/${orderId}/descartar-sin-cobrar`, {});
  },

  async cancelOrderWithPin(
    orderId: string,
    pin: string,
    reason: string | undefined,
    userId: string | undefined,
    userName: string | undefined,
  ): Promise<{ success: boolean; validatedBy?: string }> {
    return api.patch(`/api/orders/${orderId}/cancel`, {
      pin,
      reason,
      userId,
      userName,
    });
  },

  /**
   * Pendientes de cobro, FILTRADAS POR EL SERVIDOR.
   *
   * Reemplaza al `subscribeOrdersFiltered('/api/orders', {}, ...)` de abajo,
   * que se bajaba el historico completo —4.766 ordenes, 1.565.064 bytes
   * comprimidos, 2,65 s medidos el 21/09/2026— para quedarse con un punado de
   * cuentas abiertas. Los dos ejes (estado de pago y estado de orden) ahora
   * viajan como filtro, y la API los entiende desde que acepta varios valores.
   */
  async listarPendientesDeCobro(): Promise<Order[]> {
    const list = await api.get<RawOrder[]>(
      '/api/orders',
      paramsPendientesDeCobro(),
    );
    return list.map(normalizeOrder);
  },

  /**
   * Ordenes por mesonero en la jornada, para el reparto round-robin.
   *
   * Lo cuenta el servidor con una agregacion. Antes el telefono se bajaba las
   * 4.766 ordenes y contaba a mano, ademas por medianoche local en vez de por
   * jornada 06:00-06:00: pasada la medianoche la carga de todos volvia a cero
   * y el reparto se rompia en plena hora pico.
   */
  async cargaPorMesonero(
    waiterIds: string[],
  ): Promise<Array<{ waiterId: string; ordenes: number }>> {
    if (waiterIds.length === 0) return [];
    return api.get<Array<{ waiterId: string; ordenes: number }>>(
      '/api/orders/carga-por-mesonero',
      { waiterIds: waiterIds.join(',') },
    );
  },

  subscribeToOrdersPendingPayment(
    callback: (orders: Order[]) => void,
  ): Unsubscribe {
    return subscribeOrdersFiltered(
      '/api/orders',
      {},
      (o) =>
        (o.paymentStatus === PaymentStatusEnum.PENDING_VERIFICATION ||
          o.paymentStatus === PaymentStatusEnum.PENDING ||
          o.paymentStatus === PaymentStatusEnum.PARTIAL) &&
        o.status !== OrderStatusEnum.CANCELLED &&
        o.status !== OrderStatusEnum.PAID,
      callback,
    );
  },

  async getOrderById(orderId: string): Promise<Order | null> {
    try {
      const raw = await api.get<RawOrder>(`/api/orders/${orderId}`);
      return normalizeOrder(raw);
    } catch {
      return null;
    }
  },

  async requestCredit(orderId: string, note?: string): Promise<RawOrder> {
    return api.post<RawOrder>(`/api/orders/${orderId}/credit-request`, {
      note: note ?? undefined,
    });
  },

  // ─── Mesa Conectada ───

  /** Mesonero: obtiene (o crea) el token QR de la orden para que el cliente se vincule. */
  async getLinkToken(orderId: string): Promise<string> {
    const res = await api.get<{ token: string }>(
      `/api/orders/${orderId}/link-token`,
    );
    return res.token;
  },

  /** Mesonero: rota el token QR (invalida el anterior). */
  async rotateLinkToken(orderId: string): Promise<string> {
    const res = await api.post<{ token: string }>(
      `/api/orders/${orderId}/link-token/rotate`,
      {},
    );
    return res.token;
  },

  /** Cliente: se vincula a la orden escaneando el QR. Requiere sesion (JWT). */
  async linkByToken(token: string): Promise<Order> {
    const raw = await api.post<RawOrder>(
      `/api/orders/link/${encodeURIComponent(token)}`,
      {},
    );
    return normalizeOrder(raw);
  },

  /** Cliente: solicita un producto / llama al mesonero / pide algo. */
  async createCustomerRequest(
    orderId: string,
    input: {
      type: CustomerRequestType;
      productId?: string;
      quantity?: number;
      note?: string;
    },
  ): Promise<Order> {
    const raw = await api.post<RawOrder>(
      `/api/orders/${orderId}/customer-request`,
      {
        type: input.type,
        productId: input.productId ?? undefined,
        quantity: input.quantity ?? undefined,
        note: input.note ?? undefined,
      },
    );
    return normalizeOrder(raw);
  },

  /** Mesonero: acepta / rechaza / marca vista una solicitud del cliente. */
  async resolveCustomerRequest(
    orderId: string,
    requestId: string,
    action: 'ACCEPT' | 'REJECT' | 'ACK',
    rejectReason?: string,
  ): Promise<Order> {
    if (!orderId || orderId.trim() === '') {
      throw new Error('orderId is required and cannot be empty');
    }
    if (!requestId || requestId.trim() === '') {
      throw new Error('requestId is required and cannot be empty');
    }

    const raw = await api.patch<RawOrder>(
      `/api/orders/${orderId}/customer-request/${requestId}/resolve`,
      { action, rejectReason: rejectReason ?? undefined },
    );
    return normalizeOrder(raw);
  },

  /** Cliente: pide la cuenta. Marca billRequested y avisa al mesonero. */
  async requestBill(orderId: string): Promise<Order> {
    const raw = await api.post<RawOrder>(
      `/api/orders/${orderId}/request-bill`,
      {},
    );
    return normalizeOrder(raw);
  },

  async cancelCreditRequest(orderId: string): Promise<RawOrder> {
    return api.post<RawOrder>(
      `/api/orders/${orderId}/credit-request/cancel`,
      {},
    );
  },

  async createTransferRequest(
    orderId: string,
    toWaiterId: string,
    toWaiterName: string | undefined,
    fromPct: number,
    toPct: number,
  ): Promise<RawOrder> {
    return api.post<RawOrder>(`/api/orders/${orderId}/transfer-request`, {
      toWaiterId,
      toWaiterName,
      fromPct,
      toPct,
    });
  },

  async acceptTransferRequest(orderId: string): Promise<RawOrder> {
    return api.post<RawOrder>(
      `/api/orders/${orderId}/transfer-request/accept`,
      {},
    );
  },

  async rejectTransferRequest(orderId: string): Promise<RawOrder> {
    return api.post<RawOrder>(
      `/api/orders/${orderId}/transfer-request/reject`,
      {},
    );
  },

  async cancelTransferRequest(orderId: string): Promise<RawOrder> {
    return api.post<RawOrder>(
      `/api/orders/${orderId}/transfer-request/cancel`,
      {},
    );
  },

  async getIncomingTransferRequests(waiterId: string): Promise<Order[]> {
    try {
      const list = await api.get<RawOrder[]>('/api/orders', {
        transferPendingFor: waiterId,
      });
      return list.map(normalizeOrder);
    } catch {
      return [];
    }
  },
};
