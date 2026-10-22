import { ProductTypeEnum } from '@/shared';
import { Product } from '@odin6/types';
import {
  medidasDisponibles,
  type Equivalencias,
} from '@/shared/utils/costoDeLinea';

/**
 * NATURALEZA DEL PRODUCTO — la misma pregunta en toda la aplicación.
 *
 * Debe dar EXACTAMENTE lo mismo que `product-nature.util.ts` del servidor: si
 * la ficha, Recetas y la lista clasifican distinto, el dueño ve tres verdades
 * y no sabe cuál creer. El servidor manda; esto solo pinta.
 *
 *   Insumo    se compra y se descuenta a sí mismo (ketchup, cerveza, lata)
 *   Preparado lleva receta: salen sus ingredientes con su merma, nunca él
 *   Servicio  no toca inventario a propósito (alquiler, animador, entrada)
 *   Pendiente nadie ha decidido qué es: se vende y no descuenta nada
 *
 * Regla del dueño: si al venderlo algo sale de la nevera o del depósito, no es
 * servicio. Un "servicio de whisky" que incluye la botella es un Preparado.
 */
export type Naturaleza = 'insumo' | 'preparado' | 'servicio' | 'pendiente';

/** Lo mínimo para clasificar; sirve tanto para `Product` como para parciales. */
export interface ProductoClasificable {
  type?: string | null;
  isForInventory?: boolean | null;
  ingredients?: Array<{ productId?: string } | null | undefined> | null;
}

/** Ingredientes de verdad: el array llega sucio desde clientes viejos. */
export function ingredientesValidos(
  p: ProductoClasificable,
): Array<{ productId?: string }> {
  return (p.ingredients ?? []).filter(
    (i): i is { productId?: string } => !!i && !!i.productId,
  );
}

/**
 * El orden importa: la receta manda sobre `type` (hubo 21 productos con receta
 * marcados BASE). Y `isForInventory: false` NO es servicio — era el valor por
 * defecto del formulario viejo, así que sin `type` SERVICIO explícito eso es
 * "pendiente".
 */
export function naturalezaDe(p: ProductoClasificable): Naturaleza {
  if (String(p.type ?? '') === ProductTypeEnum.SERVICE) return 'servicio';
  if (ingredientesValidos(p).length > 0) return 'preparado';
  if (
    String(p.type ?? '') === ProductTypeEnum.BASE &&
    p.isForInventory === true
  ) {
    return 'insumo';
  }
  return 'pendiente';
}

export interface EtiquetaNaturaleza {
  titulo: string;
  descripcion: string;
  /** Qué sale del almacén al vender uno. */
  queDescuenta: string;
  color: string;
}

export const NATURALEZA: Record<Naturaleza, EtiquetaNaturaleza> = {
  insumo: {
    titulo: 'Insumo',
    descripcion: 'Se compra y se vende tal cual',
    queDescuenta: 'Descuenta una unidad de sí mismo',
    color: 'text-brand bg-brand/10 border-brand/30',
  },
  preparado: {
    titulo: 'Preparado',
    descripcion: 'Se elabora con una receta',
    queDescuenta: 'Descuenta sus ingredientes, con su merma',
    color: 'text-accent bg-accent/10 border-accent/30',
  },
  servicio: {
    titulo: 'Servicio',
    descripcion: 'No sale nada del almacén',
    queDescuenta: 'No toca el inventario, a propósito',
    color: 'text-dim bg-elevated border-line',
  },
  pendiente: {
    titulo: 'Sin definir',
    descripcion: 'Nadie ha dicho qué es',
    queDescuenta: 'Se vende y NO descuenta nada',
    color: 'text-danger bg-danger/10 border-danger/30',
  },
};

/**
 * Costo de UNA unidad vendida.
 *
 * En un INSUMO, `cost` es lo que cuesta la unidad de COMPRA completa (el saco
 * de harina de 45 kg = $42,44), no lo que cuesta un kilo. Comparar ese número
 * contra el precio daba disparates: la harina salía con −4367 % de margen
 * cuando gana un 1 %. En un PREPARADO no se divide: su costo ya es por unidad
 * y muchos platos traen `presentationQuantity` sin ser packs ("Tequeños x8
 * UND" lo tiene en 8 y se vende como UN plato).
 *
 * Debe dar lo mismo que `costoPorUnidadVendida` del servidor.
 */
export function costoPorUnidadVendida(p: {
  cost?: number | null;
  presentationQuantity?: number | null;
  ingredients?: unknown[] | null;
  type?: string | null;
}): number {
  const cost = Number(p.cost ?? 0);
  const esPreparado =
    (p.ingredients ?? []).length > 0 || p.type === ProductTypeEnum.MIXED;
  if (esPreparado) return cost;
  const contenido = Number(p.presentationQuantity ?? 1);
  return contenido > 1 ? cost / contenido : cost;
}

/**
 * Margen de venta en % del precio. Igual que el del servidor.
 *
 * Acepta el producto entero (recomendado) o precio+costo sueltos. Con los
 * sueltos no puede saber si hay que dividir por el contenido de la unidad de
 * compra, así que los llamadores nuevos deberían pasar el producto.
 */
export function margenPct(
  priceOrProduct?: number | null | ProductoParaMargen,
  cost?: number | null,
): number | null {
  if (typeof priceOrProduct === 'object' && priceOrProduct !== null) {
    const p = Number(priceOrProduct.price ?? 0);
    const c = costoPorUnidadVendida(priceOrProduct);
    if (p <= 0 || c <= 0) return null;
    return ((p - c) / p) * 100;
  }
  const p = Number(priceOrProduct ?? 0);
  const c = Number(cost ?? 0);
  if (p <= 0 || c <= 0) return null;
  return ((p - c) / p) * 100;
}

export interface ProductoParaMargen {
  price?: number | null;
  cost?: number | null;
  presentationQuantity?: number | null;
  ingredients?: unknown[] | null;
  type?: string | null;
}

export type NivelMargen = 'negativo' | 'nulo' | 'bajo' | 'sano' | 'sin-costo';

/**
 * Clasifica el margen contra el mínimo del negocio. Un producto SIN costo
 * cargado no es "malo": es desconocido, y mezclarlo con los malos taparía los
 * que de verdad pierden plata.
 */
export function nivelDeMargen(
  priceOrProduct?: number | null | ProductoParaMargen,
  cost?: number | null,
  umbral = 30,
): NivelMargen {
  const m = margenPct(priceOrProduct as never, cost);
  if (m === null) return 'sin-costo';
  if (m < 0) return 'negativo';
  if (m === 0) return 'nulo';
  return m < umbral ? 'bajo' : 'sano';
}

export const COLOR_MARGEN: Record<NivelMargen, string> = {
  negativo: 'text-danger',
  nulo: 'text-danger',
  bajo: 'text-warn',
  sano: 'text-ok',
  'sin-costo': 'text-dim',
};

/**
 * Medidas que se pueden usar para un ingrediente según CÓMO SE COMPRA el
 * insumo. Antes se ofrecían las 18 presentaciones para cualquier cosa y se
 * podían guardar recetas en mililitros de algo comprado por Unidad: se
 * guardaban igual y NUNCA descontaban (12 recetas así el 03/09).
 *
 * Los nombres coinciden con los que entiende `units.ts` del servidor.
 */
export const MEDIDAS_COMPATIBLES: Record<string, string[]> = {
  GR: ['Gramo', 'Kilogramo'],
  ML: ['Mililitro', 'Litro'],
  UND: ['Unidad', 'Docena'],
};

/** Unidad base de una presentación, con el mismo mapa que el servidor. */
export function baseDePresentacion(
  presentation?: string | null,
): 'GR' | 'ML' | 'UND' {
  const p = String(presentation ?? '')
    .trim()
    .toLowerCase();
  if (['kilogramo', 'kg', 'gramo', 'gr', 'g'].includes(p)) return 'GR';
  if (['litro', 'l', 'mililitro', 'ml', 'galon', 'galón'].includes(p))
    return 'ML';
  return 'UND';
}

/** Medidas ofrecibles para un ingrediente de este insumo, y la de por defecto. */
export function medidasPara(
  presentation?: string | null,
  equivalencias?: Equivalencias | null,
): {
  opciones: string[];
  porDefecto: string;
} {
  const opciones = medidasDisponibles(presentation, equivalencias);
  // La natural es la pequeña: casi todas las recetas van en gramos o ml.
  return { opciones, porDefecto: opciones[0] };
}

/** Un insumo envasado no se derrama al servirlo: la merma ahí no tiene sentido. */
export function esEnvasado(presentation?: string | null): boolean {
  return ['unidad', 'botella', 'lata'].includes(
    String(presentation ?? '')
      .trim()
      .toLowerCase(),
  );
}

/** Naturaleza de un `Product` completo (azúcar para las pantallas). */
export function naturalezaDeProducto(p: Product): Naturaleza {
  return naturalezaDe(p as unknown as ProductoClasificable);
}
