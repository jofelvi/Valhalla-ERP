/**
 * Precio de los productos que se venden por pack (tobos, cajas de cerveza).
 *
 * En el carrito un tobo es UN pack. Al guardar la orden se expande a unidades
 * individuales para que la barra pueda entregar y descontar de a una cerveza:
 *
 *     Tobo de Cerveza (12 und), $11
 *       -> quantity: 12   unitPrice: 11/12 = 0.9167   total: $11
 *
 * El total SIEMPRE sale del precio del pack, nunca de `unitario x unidades`:
 * 11/12 es periodico y el arrastre de redondeo se paga en plata.
 *
 * Esta logica vive aparte del servicio de ordenes porque se usa en los dos
 * caminos —crear la orden y agregarle items despues— y tenerla duplicada fue
 * exactamente el origen del bug del 30/07: el camino de "agregar" no expandia,
 * un tobo de $11 entraba como 1 unidad, se fusionaba con la linea ya expandida
 * (unitPrice 0.9167) y terminaba cobrando $0.92 por un tobo.
 */

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Unidades que trae cada pack, por productId. Es la fuente de verdad de los
 * tamaños: `constants/toboRegistry.ts` los toma de aca para armar su config de
 * variantes, en vez de repetirlos.
 *
 * Este archivo NO importa nada a proposito: asi lo puede correr `node --test`
 * directo, que es lo unico que evita que este bug vuelva.
 *
 * Debe mantenerse igual que:
 *   - `apps/api/src/modules/orders/pack-registry.ts`
 *   - `src/shared/utils/packs.ts` (POS web)
 *
 * NO usar `product.presentationQuantity` del catalogo: lo tienen 439 productos
 * que no son packs (los "Tequeños x8 UND" se venden como UN plato).
 */
export const PACK_SIZES: Record<string, number> = {};

/**
 * Reemplaza los tamaños de pack (lo que cargue la configuración del negocio, o un fixture de
 * prueba). Nace VACÍO: cada negocio define los suyos y, sin ellos, ningún producto es pack.
 */
export function registrarPackSizes(tamanos: Record<string, number>): void {
  for (const k of Object.keys(PACK_SIZES)) delete PACK_SIZES[k];
  Object.assign(PACK_SIZES, tamanos);
}

export interface ExpandedLine {
  /** Unidades individuales que ve la barra. */
  quantity: number;
  /** Precio por unidad individual. */
  unitPrice: number;
  /** Lo que se cobra por la linea. */
  total: number;
  /** Unidades por pack. Ausente si el producto no es pack. */
  presentationQty?: number;
}

/**
 * Expande un item del carrito a la forma que se guarda en la orden.
 *
 * @param price precio del producto (el del PACK completo si es pack)
 * @param quantity cantidad en el carrito (cantidad de PACKS si es pack)
 * @param presentationQty unidades por pack; 0 o undefined = producto normal
 */
export function expandPack(
  price: number,
  quantity: number,
  presentationQty?: number,
): ExpandedLine {
  const packSize = presentationQty ?? 0;
  if (packSize <= 0) {
    return { quantity, unitPrice: price, total: round2(price * quantity) };
  }
  return {
    quantity: quantity * packSize,
    unitPrice: price / packSize,
    // Del precio del pack: 2 tobos son $22 exactos, no 24 x 0.9167 = $22.0008
    total: round2(price * quantity),
    presentationQty: packSize,
  };
}

/**
 * Total de una linea ya guardada, a partir de sus unidades individuales.
 * Se usa al recalcular tras agregar items a una orden existente.
 */
export function lineTotal(
  unitPrice: number,
  quantity: number,
  presentationQty?: number,
): number {
  const raw = unitPrice * quantity;
  // Con packs el unitario arrastra decimales periodicos: redondear a centavos
  // evita que la linea quede en 22.0008 y que el mesonero cobre ese numero.
  return presentationQty && presentationQty > 0 ? round2(raw) : raw;
}

/**
 * Cuantos packs representan estas unidades. Sirve para mostrar "2 tobos (24
 * cervezas)" en vez de "24" a secas.
 */
export function packsOf(quantity: number, presentationQty?: number): number {
  if (!presentationQty || presentationQty <= 0) return quantity;
  return quantity / presentationQty;
}

// ─── Como se MUESTRA un pack ──────────────────────────────────────────────
// La orden guarda unidades (1 tobo = 12), asi que pintar `quantity` a secas
// dice "12 Tobo de Cerveza" — 12 tobos, 144 cervezas. El mesonero cobra lo que
// ve, asi que toda pantalla que muestre cantidades tiene que pasar por aca.
//
// El texto debe quedar IGUAL que el del POS web (`src/shared/utils/packs.ts`):
// el mesonero mira la tablet y el cajero la pantalla, y si cada una dice una
// cosa distinta vuelven a discutir por el mismo numero.

/**
 * Unidades por pack de esta linea. Prefiere el marcador guardado en la orden y
 * cae al registro: las lineas viejas no tienen `presentationQty` porque el
 * merge del APK lo borraba.
 */
export function packSizeOf(
  productId?: string | null,
  presentationQty?: number | null,
): number {
  if (presentationQty && presentationQty > 0) return presentationQty;
  return productId ? (PACK_SIZES[productId] ?? 0) : 0;
}

/** Si el producto se vende por pack (tobo, caja). */
export function isPackProduct(productId?: string | null): boolean {
  return productId ? PACK_SIZES[productId] !== undefined : false;
}

/**
 * Cantidad para mostrar. Un producto normal devuelve el numero; un pack
 * devuelve los packs y aclara las unidades: "1 (12 cervezas)".
 */
export function formatPackQuantity(
  quantity: number,
  productId?: string | null,
  presentationQty?: number | null,
): string {
  const size = packSizeOf(productId, presentationQty);
  if (size <= 0) return String(quantity);

  const packs = quantity / size;
  // Cantidad que no completa un pack: se muestra tal cual y avisa, en vez de
  // redondear y esconder que la linea quedo mal.
  if (!Number.isInteger(packs)) {
    return `${quantity} cervezas (revisar: no completa ${size})`;
  }
  return `${packs} (${quantity} cervezas)`;
}

/**
 * Version corta para los resumenes de cobro, donde el nombre del producto ya
 * dice "(12 und)" y solo hace falta el numero: "1x Tobo de Cerveza (12 und)".
 * Una linea rota se marca con "u" para que no pase por buena.
 */
export function packCountLabel(
  quantity: number,
  productId?: string | null,
  presentationQty?: number | null,
): string {
  const size = packSizeOf(productId, presentationQty);
  if (size <= 0) return String(quantity);
  const packs = quantity / size;
  return Number.isInteger(packs) ? String(packs) : `${quantity}u`;
}

/**
 * Cantidad que va IMPRESA, en comandas y recibos.
 *
 * La barra entrega packs: el ticket decia "12x Tobo de Cerveza (12 und)" y eso
 * le pide al barman 12 tobos. El print-service imprime `quantity` tal cual, asi
 * que la conversion se hace aca — la PC de la caja no se puede actualizar cada
 * vez que sale un APK.
 */
export function printQty(
  units: number,
  productId?: string | null,
  presentationQty?: number | null,
): number {
  const size = packSizeOf(productId, presentationQty);
  if (size <= 0) return units;
  const packs = units / size;
  // Una linea rota igual tiene que salir como algo despachable; el servidor ya
  // las normaliza, esto es el ultimo cinturon.
  return Number.isInteger(packs) ? packs : Math.max(1, Math.round(packs));
}

/**
 * Precio que se imprime al lado del nombre: el del PACK. El unitario guardado
 * ($0.92) junto a "Tobo de Cerveza" se lee como si el tobo costara eso.
 */
export function packUnitPrice(
  unitPrice: number,
  productId?: string | null,
  presentationQty?: number | null,
): number {
  const size = packSizeOf(productId, presentationQty);
  if (size <= 0) return unitPrice;
  return round2(unitPrice * size);
}

/** Cuanto suma o resta el boton +/-: un pack entero, no una unidad suelta. */
export function stepOf(
  productId?: string | null,
  presentationQty?: number | null,
): number {
  const size = packSizeOf(productId, presentationQty);
  return size > 0 ? size : 1;
}
