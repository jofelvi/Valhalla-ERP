/**
 * Helpers puros de compatibilidad de unidades de medida.
 *
 * Categoriza unidades según CÓMO SE COMPRA el insumo (peso, volumen, unidad)
 * sin depender de ProductPresentationEnum. Usa strings simples para ser compartible
 * con el APK (mobile/src/utils/unidades.ts).
 *
 * La lógica es la misma que `product-nature.util.ts` del servidor.
 */

import {
  baseDeUnidad,
  factorFaltante,
  type Equivalencias,
} from './costoDeLinea';

export type UnitCategory = 'PESO' | 'VOLUMEN' | 'UNIDAD';

/**
 * Categorías de unidades que se pueden comprar. Cada categoría agrupa las
 * variantes pequeña y grande de la misma medida.
 */
export const UNIT_CATEGORIES: Record<UnitCategory, string[]> = {
  PESO: ['Gramo', 'Kilogramo', 'Miligramo', 'gr', 'g', 'kg', 'mg'],
  VOLUMEN: ['Mililitro', 'Litro', 'ml', 'l', 'L'],
  UNIDAD: ['Unidad', 'Docena', 'und', 'docena'],
};

/**
 * Determina la categoría de una unidad de medida.
 *
 * @param unit - Presentación o unidad a clasificar (puede venir de `ProductPresentationEnum` o string puro)
 * @returns 'PESO' | 'VOLUMEN' | 'UNIDAD' si es reconocida, null si no se sabe
 */
export function categoriaDeUnidad(
  unit: string | null | undefined,
): UnitCategory | null {
  const u = String(unit ?? '')
    .trim()
    .toLowerCase();

  if (!u) return null;

  for (const [categoria, unidades] of Object.entries(UNIT_CATEGORIES)) {
    if (unidades.map((x) => x.toLowerCase()).includes(u)) {
      return categoria as UnitCategory;
    }
  }

  return null;
}

/**
 * Valida si una unidad de receta es compatible con cómo se compra el insumo.
 *
 * Dos unidades son compatibles si pertenecen a la misma categoría:
 * - Gramo y Kilogramo → ambas PESO → compatible
 * - Mililitro y Litro → ambas VOLUMEN → compatible
 * - Unidad y Docena → ambas UNIDAD → compatible
 *
 * @param recipeUnit - Unidad usada en la receta (ej: "Gramo")
 * @param purchaseUnit - Unidad con la que se compra el insumo (ej: "Kilogramo")
 * @returns true si son compatibles, false si no
 */
export function sonUnidadesCompatibles(
  recipeUnit: string | null | undefined,
  purchaseUnit: string | null | undefined,
  equivalencias?: Equivalencias | null,
): boolean {
  const catReceta = categoriaDeUnidad(recipeUnit);
  const catCompra = categoriaDeUnidad(purchaseUnit);

  // Si alguna no se reconoce, no son compatibles
  if (catReceta === null || catCompra === null) return false;

  if (catReceta === catCompra) return true;

  // Otra familia: solo si el insumo trae la equivalencia que la cruza
  return (
    factorFaltante(
      baseDeUnidad(recipeUnit),
      baseDeUnidad(purchaseUnit),
      equivalencias,
    ) === null
  );
}

/**
 * Retorna las unidades compatibles para una presentación de compra, agrupadas
 * por categoría. Sirve para renderizar selectores de medida.
 *
 * @param purchaseUnit - Presentación con la que se compra (ej: "Kilogramo")
 * @returns { categoria: UnitCategory | null; opciones: string[]; porDefecto: string }
 */
export function unidadesCompatibles(purchaseUnit: string | null | undefined): {
  categoria: UnitCategory | null;
  opciones: string[];
  porDefecto: string;
} {
  const cat = categoriaDeUnidad(purchaseUnit);

  if (cat === null) {
    // Sin categoría, ofrecer unidad por defecto
    return {
      categoria: null,
      opciones: ['Unidad'],
      porDefecto: 'Unidad',
    };
  }

  const opciones = UNIT_CATEGORIES[cat];
  // La por defecto es la pequeña: casi todas las recetas van en gramos o ml
  return {
    categoria: cat,
    opciones,
    porDefecto: opciones[0],
  };
}

/**
 * Etiqueta en español para mostrar la categoría de unidad al usuario.
 *
 * @param categoria - Categoría (PESO, VOLUMEN, UNIDAD)
 * @returns Texto para mostrar ("peso", "volumen", "unidad")
 */
export function etiquetaDeCategoria(categoria: UnitCategory | null): string {
  if (categoria === null) return 'unidad desconocida';
  return {
    PESO: 'peso',
    VOLUMEN: 'volumen',
    UNIDAD: 'unidad',
  }[categoria];
}

/**
 * Mensaje de error amigable cuando una unidad es incompatible.
 *
 * @param insumoNombre - Nombre del insumo (ej: "Carne Molida")
 * @param purchaseUnit - Cómo se compra (ej: "Kilogramo")
 * @returns Mensaje para mostrar al usuario
 */
export function mensajeUnidadIncompatible(
  insumoNombre: string,
  purchaseUnit: string | null | undefined,
): string {
  const cat = categoriaDeUnidad(purchaseUnit);
  if (cat === null)
    return `Se compra por ${purchaseUnit}: usa una unidad compatible.`;

  const opciones = UNIT_CATEGORIES[cat].join(' o ');
  return `${insumoNombre} se compra por ${purchaseUnit}: usa ${opciones}`;
}
