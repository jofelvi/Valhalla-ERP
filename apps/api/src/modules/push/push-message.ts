/**
 * Armado del texto de la notificacion de cocina. Funciones puras: aqui no se
 * toca Mongo ni FCM, para poder probar el truncado y la agrupacion sin red.
 */

/** Item entregado tal como lo reporta OrdersService. */
export interface DeliveredItem {
  name: string;
  qty: number;
}

export interface OrderContext {
  tableName?: string | null;
  sector?: string | null;
  customerAlias?: string | null;
  customerName?: string | null;
  orderNumber?: string | null;
  orderId: string;
}

export interface PushMessage {
  title: string;
  body: string;
}

/** Android recorta el cuerpo colapsado ~ahi; mas texto no aporta nada. */
const BODY_MAX = 110;

const SECTOR_LABELS: Record<string, string> = {
  piscina: 'Piscina',
  tenis: 'Tenis',
  futbol: 'Futbol',
  beisbol: 'Beisbol',
  salon_principal: 'Salon',
  canchas: 'Canchas',
};

/**
 * Suma las cantidades del mismo producto: si cocina escanea tres veces el mismo
 * plato en la ventana de agrupacion, se muestra "3x Tequenos", no tres lineas.
 * Conserva el orden en que se entregaron.
 */
export function mergeDelivered(items: DeliveredItem[]): DeliveredItem[] {
  const byName = new Map<string, DeliveredItem>();
  for (const it of items) {
    const name = (it.name || 'Producto').trim();
    const qty = Math.max(1, Math.floor(it.qty || 1));
    const found = byName.get(name);
    if (found) {
      found.qty += qty;
    } else {
      byName.set(name, { name, qty });
    }
  }
  return [...byName.values()];
}

/** "Mesa 4" · "Piscina" · "Para llevar" — donde tiene que ir el mesonero. */
function locationLabel(order: OrderContext): string {
  if (order.tableName) return order.tableName;
  if (order.sector) {
    return SECTOR_LABELS[order.sector] ?? order.sector.replace(/_/g, ' ');
  }
  return 'Para llevar';
}

/**
 * Cuerpo: cliente + productos, recortando por producto entero (nunca a media
 * palabra) y cerrando con "+N mas" para que el mesonero sepa que hay mas.
 */
function buildBody(order: OrderContext, items: DeliveredItem[]): string {
  const client = (order.customerAlias || order.customerName || '').trim();
  const prefix = client ? `${client} · ` : '';
  const merged = mergeDelivered(items);

  const parts: string[] = [];
  let used = prefix.length;

  for (let i = 0; i < merged.length; i++) {
    const piece = `${merged[i].qty}x ${merged[i].name}`;
    const restantes = merged.length - i;
    const sufijo = restantes > 0 ? ` +${restantes} mas` : '';
    const separador = parts.length ? ', ' : '';

    // Cabe este producto Y (si hubiera mas) el aviso de los que faltan?
    if (used + separador.length + piece.length + sufijo.length > BODY_MAX) {
      parts.push(`+${restantes} mas`);
      break;
    }
    parts.push(piece);
    used += separador.length + piece.length;
  }

  return `${prefix}${parts.join(', ')}`;
}

/**
 * Mensaje final. `title` lleva la ubicacion porque es lo primero que el
 * mesonero necesita: a donde ir.
 */
export function buildDeliveryMessage(
  order: OrderContext,
  items: DeliveredItem[],
): PushMessage {
  return {
    title: `Listo · ${locationLabel(order)}`,
    body: buildBody(order, items),
  };
}
