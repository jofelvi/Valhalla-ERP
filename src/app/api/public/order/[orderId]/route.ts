import { NextRequest, NextResponse } from 'next/server';

/**
 * Endpoint publico para obtener una orden como precuenta.
 * Usado por el link de WhatsApp que se envia al cliente.
 *
 * El parametro puede ser:
 * - orderId (ID directo de la orden)
 * - invoiceNumber (INV-T7CK8O8L, FAC-12345678-XRWV o CONS-* — cuenta consolidada)
 *
 * Para CONS-* (cuentas consolidadas) agrega los items de todas las ordenes
 * fusionadas en una unica respuesta para mostrar la precuenta combinada.
 *
 * Proxy al NestJS API (no Firebase). Solo retorna campos necesarios.
 */
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface NestOrder {
  id?: string;
  _id?: string;
  tableId?: string;
  sector?: string | null;
  customerAlias?: string | null;
  items?: Array<{
    name?: string;
    productName?: string;
    quantity: number;
    unitPrice: number;
    total?: number;
    totalPrice?: number;
    notes?: string | null;
  }>;
  subtotal?: number;
  serviceCharge?: number;
  tax?: number;
  tipAmount?: number;
  total?: number;
  status?: string;
  paymentStatus?: string;
  createdAt?: string;
}

interface NestAccount {
  id?: string;
  _id?: string;
  invoiceNumber?: string;
  customerName?: string;
  amount?: number;
  paidAmount?: number;
  status?: string;
  dueDate?: string;
  isConsolidated?: boolean;
  mergedOrderIds?: string[];
}

const sectorLabels: Record<string, string> = {
  evento: 'Evento',
  piscina: 'Piscina',
  tenis: 'Tenis',
  futbol: 'Futbol',
  beisbol: 'Beisbol',
  salon_principal: 'Salon Principal',
  canchas: 'Canchas',
};

function normalizeOrderForResponse(order: NestOrder) {
  const id = String(order.id ?? order._id ?? '');
  return {
    id,
    orderNumber: id.slice(-8).toUpperCase(),
    tableName: null as string | null,
    sector: order.sector ? (sectorLabels[order.sector] ?? order.sector) : null,
    customerAlias: order.customerAlias ?? null,
    items: (order.items ?? []).map((item) => ({
      name: item.name || item.productName || 'Producto',
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total ?? item.totalPrice ?? 0,
      notes: item.notes ?? null,
    })),
    subtotal: order.subtotal ?? 0,
    serviceCharge: order.serviceCharge ?? 0,
    tax: order.tax ?? 0,
    tipAmount: order.tipAmount ?? 0,
    total: order.total ?? 0,
    status: order.status ?? '',
    paymentStatus: order.paymentStatus ?? '',
    createdAt: order.createdAt ?? new Date().toISOString(),
  };
}

function buildConsolidatedOrder(account: NestAccount, orders: NestOrder[]) {
  if (!orders.length) return null;
  const sorted = [...orders].sort(
    (a, b) =>
      new Date(a.createdAt ?? 0).getTime() -
      new Date(b.createdAt ?? 0).getTime(),
  );
  const aggregatedItems = sorted.flatMap((o) =>
    (o.items ?? []).map((item) => ({
      name: item.name || item.productName || 'Producto',
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total ?? item.totalPrice ?? 0,
      notes: item.notes ?? null,
    })),
  );
  const sum = (key: keyof NestOrder) =>
    sorted.reduce((s, o) => s + (Number(o[key]) || 0), 0);
  const first = sorted[0];
  const firstId = String(first.id ?? first._id ?? '');
  return {
    id: firstId,
    orderNumber: account.invoiceNumber ?? firstId.slice(-8).toUpperCase(),
    tableName: null,
    sector: null,
    customerAlias: null,
    items: aggregatedItems,
    subtotal: sum('subtotal'),
    serviceCharge: sum('serviceCharge'),
    tax: sum('tax'),
    tipAmount: sum('tipAmount'),
    total: account.amount ?? sum('total'),
    status: 'consolidated',
    paymentStatus: account.status === 'paid' ? 'paid' : 'pending',
    createdAt: first.createdAt ?? new Date().toISOString(),
  };
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId: rawId } = await params;

    if (!rawId || rawId.length < 3) {
      return NextResponse.json(
        { success: false, error: 'ID invalido' },
        { status: 400 },
      );
    }

    const isInvoiceNumber = /^(INV|FAC|CONS|UNI)-/i.test(rawId);

    if (isInvoiceNumber) {
      const data = await fetchJson<{
        account: NestAccount;
        orders: NestOrder[];
        customer: { name?: string; phone?: string } | null;
      }>(
        `${API_BASE}/api/public/accounts-receivable/by-number/${encodeURIComponent(rawId)}`,
      );

      if (!data || !data.account) {
        return NextResponse.json(
          { success: false, error: 'Cuenta no encontrada' },
          { status: 404 },
        );
      }

      const { account, orders } = data;
      const isConsolidated = !!account.isConsolidated && orders.length > 1;

      const responseOrder = isConsolidated
        ? buildConsolidatedOrder(account, orders)
        : orders[0]
          ? normalizeOrderForResponse(orders[0])
          : null;

      return NextResponse.json({
        success: true,
        order: responseOrder,
        account: {
          id: String(account.id ?? account._id ?? ''),
          invoiceNumber: account.invoiceNumber ?? rawId,
          customerName: account.customerName ?? '',
          amount: account.amount ?? 0,
          paidAmount: account.paidAmount ?? 0,
          pending: (account.amount ?? 0) - (account.paidAmount ?? 0),
          status: account.status ?? 'pending',
          dueDate:
            account.dueDate ?? new Date().toISOString(),
        },
        invoiceNumber: account.invoiceNumber ?? rawId,
      });
    }

    // orderId directo
    const order = await fetchJson<NestOrder>(
      `${API_BASE}/api/public/orders/${encodeURIComponent(rawId)}`,
    );
    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Orden no encontrada' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      order: normalizeOrderForResponse(order),
      account: null,
      invoiceNumber: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    console.error('[public order GET]', message);
    return NextResponse.json(
      { success: false, error: 'Error al cargar la orden' },
      { status: 500 },
    );
  }
}
