/**
 * Arma, en el servidor, la comanda de un pedido cobrado. La usa la reposicion de comandas del
 * prepago: las APKs anteriores a la 0.1.11 mandan la comanda al CREAR el pedido (el servidor la
 * rechaza por no estar cobrado) y no la vuelven a mandar al cobrar, asi que cocina y barra se
 * quedaban sin papel. Misma forma que `enqueuePrintComanda` de la app.
 */
export interface PedidoParaReponer {
  _id: unknown;
  items?: unknown;
  tableId?: unknown;
  tableName?: unknown;
  sector?: unknown;
  orderType?: unknown;
  waiterName?: unknown;
  notes?: unknown;
}

interface ItemDelPedido {
  productName?: unknown;
  name?: unknown;
  quantity?: unknown;
  presentationQty?: unknown;
  notes?: unknown;
  station?: unknown;
  cancelledAt?: unknown;
  customizations?: { removedIngredients?: unknown } | null;
}

const texto = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v : undefined;

/** Paquetes enteros (2 docenas = 2), como `printQty` de la app; si no, las unidades. */
function cantidadImpresa(it: ItemDelPedido): number {
  const cantidad = Number(it.quantity) || 0;
  const tamano = Number(it.presentationQty) || 0;
  if (tamano > 0 && Number.isInteger(cantidad / tamano))
    return cantidad / tamano;
  return cantidad;
}

export function comandaDesdePedido(
  pedido: PedidoParaReponer,
  fecha: string,
  hora: string,
): Record<string, unknown> | null {
  const items = (
    Array.isArray(pedido.items) ? (pedido.items as ItemDelPedido[]) : []
  )
    .filter((it) => !it.cancelledAt && (Number(it.quantity) || 0) > 0)
    .map((it) => {
      const quitados = it.customizations?.removedIngredients;
      return {
        quantity: cantidadImpresa(it),
        name: texto(it.productName) ?? texto(it.name) ?? 'Producto',
        notes: texto(it.notes),
        station: texto(it.station),
        customizations: Array.isArray(quitados)
          ? { removedIngredients: quitados }
          : undefined,
      };
    });
  if (items.length === 0) return null;

  const sector = texto(pedido.sector);
  const paraLlevar = pedido.orderType === 'takeaway';
  let tipo = pedido.tableId ? 'En mesa' : 'Para llevar';
  if (paraLlevar) tipo = 'PARA LLEVAR';
  if (sector)
    tipo = paraLlevar ? `PARA LLEVAR - Zona: ${sector}` : `Zona: ${sector}`;

  return {
    orderNumber: String(pedido._id).slice(-8).toUpperCase(),
    date: fecha,
    time: hora,
    table: texto(pedido.tableName),
    waiter: texto(pedido.waiterName),
    orderType: tipo,
    items,
    comment: texto(pedido.notes),
    cajaSummary: true,
  };
}
