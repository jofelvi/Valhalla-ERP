import type { DraftLine } from './draft';
import { INPUT_UNIT_FACTORS, toBaseQty } from '../../inventory/units';

/** Como lleva el inventario un producto: su presentacion y cuanto trae. */
export interface UnidadDeInventario {
  /** "Kilogramo", "Litro", "Unidad", "Lata"... tal cual el catalogo. */
  presentation: string;
  /** Cuanto trae la unidad de compra por defecto (30 huevos, 25 kg de sal). */
  presentationQuantity: number;
  base: 'GR' | 'ML' | 'UND';
}

const NOMBRE_BASE = { GR: 'kg', ML: 'L', UND: 'und' } as const;
const EJEMPLO_BASE = { GR: 'kg', ML: 'l', UND: 'und' } as const;

const num = (n: number): string => String(Math.round(n * 1000) / 1000).replace('.', ',');

export type EntradaAlInventario =
  | { ok: true; texto: string }
  | { ok: false; texto: string };

/**
 * Lo que un renglon mete al inventario, en la unidad del producto. Replica la
 * cuenta de `PurchasesService.create` para que el socio la vea ANTES de
 * confirmar: en la prueba real con Viveluso (18/09/2026) la compra entera se
 * rechazo al final porque "15 und" de papas no entran en un producto que se
 * lleva en kilos, y 0,201 cajas de aceite iban a entrar como 0,2 litros.
 */
export function entradaAlInventario(l: DraftLine, u: UnidadDeInventario | undefined): EntradaAlInventario | null {
  if (!u || l.quantity === null || !l.unit) return null;
  const enBase = (cantidadBase: number): string =>
    u.base === 'UND' ? `${num(cantidadBase)} und` : `${num(cantidadBase / 1000)} ${NOMBRE_BASE[u.base]}`;

  if (l.unit === 'unidad-compra') {
    const contenido = l.unitsPerPack && l.unitsPerPack > 0 ? l.unitsPerPack : u.presentationQuantity;
    if (!contenido || contenido <= 0) {
      return { ok: false, texto: `⚠️ No sé cuánto trae cada caja: toca ✏️ y escríbelo suelto (ej: 3 ${EJEMPLO_BASE[u.base]} 9,80)` };
    }
    // Misma cuenta que la compra: cajas × contenido, en la unidad del catalogo.
    return { ok: true, texto: `→ inventario: ${enBase(toBaseQty(l.quantity * contenido, u.presentation, u.base))}` };
  }
  const suelta = INPUT_UNIT_FACTORS[l.unit];
  if (!suelta || suelta.base !== u.base) {
    return {
      ok: false,
      texto: `⚠️ Este producto se lleva en ${NOMBRE_BASE[u.base]}: toca ✏️ y escríbelo así (ej: 15 ${EJEMPLO_BASE[u.base]} 5,90)`,
    };
  }
  return { ok: true, texto: `→ inventario: ${enBase(l.quantity * suelta.factor)}` };
}
