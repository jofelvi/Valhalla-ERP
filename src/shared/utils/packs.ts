/**
 * Productos que se venden por PACK (tobos y cajas de cerveza).
 *
 * En la orden se guardan EXPANDIDOS a unidades individuales, para que la barra
 * entregue y descuente de a una cerveza:
 *
 *     1 Tobo de Cerveza (12 und), $11
 *       -> quantity: 12   unitPrice: 11/12 = 0.9167   total: $11
 *
 * Eso hace que la pantalla, si muestra `quantity` a secas, diga "12 Tobo de
 * Cerveza" — o sea 12 tobos, 144 cervezas. El mesonero cobra lo que ve, asi que
 * SIEMPRE hay que mostrar packs con `formatPackQuantity`.
 *
 * Debe mantenerse igual que:
 *   - `apps/api/src/modules/orders/pack-registry.ts`
 *   - `mobile/src/services/packPricing.ts`
 *
 * NO usar `product.presentationQuantity` del catalogo para detectar packs: lo
 * tienen 439 productos, casi todos platos normales ("Tequeños x8 UND" se vende
 * como UN plato), y ademas es inconsistente en produccion.
 */

export interface PackConfig {
  /** Unidades individuales que trae el pack. */
  totalUnits: number;
  /** Como se nombra una unidad suelta, para la etiqueta. */
  unitLabel: string;
}

/**
 * Registro de packs por productId. Nace VACÍO: cada negocio define los suyos (documento
 * `configs/packs` de la API, módulo `packsAndBuckets`). Mientras no se registre ninguno,
 * ningún producto se trata como pack.
 */
export const PACK_REGISTRY: Record<string, PackConfig> = {};

/** Reemplaza el registro (lo que cargue la configuración del negocio, o un fixture de prueba). */
export function registrarPacks(packs: Record<string, PackConfig>): void {
  for (const k of Object.keys(PACK_REGISTRY)) delete PACK_REGISTRY[k];
  Object.assign(PACK_REGISTRY, packs);
}

export function getPackConfig(
  productId?: string | null,
): PackConfig | undefined {
  return productId ? PACK_REGISTRY[productId] : undefined;
}

export function isPackProduct(productId?: string | null): boolean {
  return getPackConfig(productId) !== undefined;
}

/**
 * Unidades individuales por pack de esta linea. Prefiere el marcador guardado
 * en la orden y cae al registro: las lineas viejas no tienen `presentationQty`
 * porque el merge del APK lo borraba.
 */
export function packSizeOf(
  productId?: string | null,
  presentationQty?: number | null,
): number {
  if (presentationQty && presentationQty > 0) return presentationQty;
  return getPackConfig(productId)?.totalUnits ?? 0;
}

/** Cuantos packs representan estas unidades. */
export function packsOf(
  quantity: number,
  productId?: string | null,
  presentationQty?: number | null,
): number {
  const size = packSizeOf(productId, presentationQty);
  if (size <= 0) return quantity;
  return quantity / size;
}

/**
 * Como mostrar la cantidad de una linea.
 *
 * Un producto normal devuelve el numero tal cual. Un pack devuelve los packs y
 * aclara las unidades: "1 (12 cervezas)". Sin esto la pantalla muestra "12" y
 * se lee como 12 tobos.
 */
export function formatPackQuantity(
  quantity: number,
  productId?: string | null,
  presentationQty?: number | null,
): string {
  const size = packSizeOf(productId, presentationQty);
  if (size <= 0) return String(quantity);

  const packs = quantity / size;
  const cfg = getPackConfig(productId);
  const unidad = cfg?.unitLabel ?? 'und';

  // Cantidad que no es multiplo del pack: se muestra tal cual para que se vea
  // que algo esta mal, en vez de disimularlo con un redondeo.
  if (!Number.isInteger(packs)) {
    return `${quantity} ${unidad} (revisar: no completa ${size})`;
  }
  return `${packs} (${quantity} ${unidad})`;
}

/**
 * Texto corto para el contador que va entre los botones +/-, donde no cabe la
 * etiqueta completa. Muestra los packs; si la linea quedo con una cantidad que
 * no completa un pack, muestra las unidades marcadas con "u" para que se note.
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
 * Precio del PACK completo, que es lo que realmente se cobra. El unitario
 * guardado (11/12 = $0.92) al lado del nombre "Tobo" se lee como si el tobo
 * costara $0.92.
 */
export function packUnitPrice(
  unitPrice: number,
  productId?: string | null,
  presentationQty?: number | null,
): number {
  const size = packSizeOf(productId, presentationQty);
  if (size <= 0) return unitPrice;
  return Math.round(unitPrice * size * 100) / 100;
}

/**
 * Cuanto sumar o restar al tocar +/- en una linea. Para un pack es el pack
 * entero: tocar "+" en un tobo debe agregar un tobo, no una cerveza suelta.
 */
export function stepOf(
  productId?: string | null,
  presentationQty?: number | null,
): number {
  const size = packSizeOf(productId, presentationQty);
  return size > 0 ? size : 1;
}

/**
 * Cantidad que va en la COMANDA de la estacion.
 *
 * La barra entrega packs: el ticket decia "12x Tobo de Cerveza (12 und)" y eso
 * le pide al barman 12 tobos. El print-service imprime `qty` tal cual, asi que
 * la conversion se hace aca — no en la PC de la caja, que no se puede
 * actualizar tan seguido.
 */
export function printQty(
  units: number,
  productId?: string | null,
  presentationQty?: number | null,
): number {
  const size = packSizeOf(productId, presentationQty);
  if (size <= 0) return units;
  const packs = units / size;
  // Una linea rota igual tiene que salir como un numero que la estacion pueda
  // despachar; el servidor ya las normaliza, esto es el ultimo cinturon.
  return Number.isInteger(packs) ? packs : Math.max(1, Math.round(packs));
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** La plata y las unidades de una linea de la orden. */
export interface PackLine {
  quantity: number;
  unitPrice: number;
  total: number;
  presentationQty?: number;
}

/**
 * Linea nueva a partir del producto del catalogo. Un pack entra EXPANDIDO a
 * unidades: `1 Tobo de $11` se guarda como 12 unidades de $0.9167 con total $11.
 */
export function newLine(
  productId: string,
  productPrice: number,
  packs = 1,
): PackLine {
  const size = packSizeOf(productId);
  if (size <= 0) {
    return {
      quantity: packs,
      unitPrice: productPrice,
      total: round2(productPrice * packs),
    };
  }
  return {
    quantity: packs * size,
    unitPrice: productPrice / size,
    total: round2(productPrice * packs),
    presentationQty: size,
  };
}

/**
 * Suma UNO a una linea que ya existe: un pack entero si es tobo/caja, una
 * unidad si es un producto normal.
 *
 * Aca es donde se perdia la plata. La linea podia estar guardada de dos formas
 * distintas segun quien la creo:
 *
 *   - APK (expandida):  quantity 12, unitPrice 0.9167
 *   - POS web (vieja):  quantity 1,  unitPrice 11
 *
 * Sumar 1 a la expandida daba 13 x 0.9167 = $11.92 por dos tobos, y sumar 12 a
 * la vieja habria dado 13 x $11 = $143. Por eso no se asume el formato: se
 * deduce comparando el unitario guardado contra los dos precios posibles, y la
 * linea sale siempre en formato expandido.
 */
export function addOneToLine(
  existing: { quantity: number; unitPrice: number; presentationQty?: number },
  productId: string,
  productPrice: number,
): PackLine {
  const size = packSizeOf(productId, existing.presentationQty);
  if (size <= 0) {
    const quantity = existing.quantity + 1;
    return {
      quantity,
      unitPrice: existing.unitPrice,
      total: round2(quantity * existing.unitPrice),
    };
  }

  const perUnit = productPrice / size;
  // A cual de los dos precios se parece el unitario guardado.
  const isExpanded =
    Math.abs(existing.unitPrice - perUnit) <=
    Math.abs(existing.unitPrice - productPrice);
  const currentPacks = isExpanded
    ? existing.quantity / size
    : existing.quantity;

  // floor(): si la linea venia rota (13 unidades de un tobo de 12) queda en 2
  // tobos limpios. Se pierde la unidad suelta, pero el cobro vuelve a cuadrar
  // con lo que se entrega; una linea a medio pack no se puede cobrar bien.
  const packs = Math.floor(currentPacks) + 1;
  return {
    quantity: packs * size,
    unitPrice: perUnit,
    total: round2(productPrice * packs),
    presentationQty: size,
  };
}

/**
 * Total de una linea. Para packs sale del precio del PACK, nunca de
 * `unitPrice x quantity`: el unitario es una division periodica (11/12 =
 * 0.91666…) y 24 unidades darian $22.0008, que es el numero que se cobraria.
 */
export function lineTotal(
  unitPrice: number,
  quantity: number,
  productId?: string | null,
  presentationQty?: number | null,
): number {
  const raw = unitPrice * quantity;
  const size = packSizeOf(productId, presentationQty);
  return size > 0 ? Math.round(raw * 100) / 100 : raw;
}
