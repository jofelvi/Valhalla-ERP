import { BaseUnit } from '../inventory/units';

/**
 * TOPE DE CORDURA DE LAS RECETAS.
 *
 * La receta no tenia ningun maximo: se podia guardar "999.999.999 kg de carne
 * por plato" y el sistema lo aceptaba. Eso no es teorico — el descuento al
 * entregar multiplica esa cantidad por lo vendido, asi que un dedazo de un cero
 * de mas vacia el inventario de un insumo en una sola venta y el faltante
 * aparece despues en el conteo como si fuera robo del personal.
 *
 * Los limites NO son inventados: salen del catalogo real (03/09/2026, 1001
 * ingredientes en 158 recetas).
 *
 *   GR   maximo real 30.000 (Salsa de Pizza, receta de tanda) · 2o 3.200 · p99 1.600
 *   ML   maximo real    800 (Broaster Familiar x16)           · p99 800
 *   UND  maximo real     36 (Caja de Cerveza Azul: 36 botellas, correcto) · p99 24
 *   ingredientes en una receta: maximo real 21
 *
 * De ahi dos niveles, porque un solo numero no sirve: cortar donde termina lo
 * normal bloquearia los combos de verdad (35 platos, 100 tequenos), y cortar
 * solo en lo absurdo dejaria pasar el dedazo de un cero.
 *
 *   RECHAZA lo que no puede ser cierto de ninguna manera.
 *   AVISA de lo inusualmente grande, sin frenar: puede ser un combo legitimo,
 *   y quien carga la receta es quien sabe.
 */

/** Por encima de esto no se guarda: en unidad base, por UNA unidad vendida. */
export const TOPE_DURO: Record<BaseUnit, number> = {
  GR: 50_000, // 50 kg — por encima del maximo real (30 kg)
  ML: 50_000, // 50 L
  UND: 500, // 500 unidades — el mayor real es una caja de 36
};

/** Por encima de esto se avisa, pero se guarda. */
export const UMBRAL_AVISO: Record<BaseUnit, number> = {
  GR: 5_000, // 5 kg
  ML: 3_000, // 3 L
  UND: 48, // el doble de la caja mas grande
};

/** Ninguna receta real pasa de 21 ingredientes. */
export const MAX_INGREDIENTES = 40;

const NOMBRE_BASE: Record<BaseUnit, string> = {
  GR: 'gramos',
  ML: 'mililitros',
  UND: 'unidades',
};

/** Lo mismo en la unidad grande, para que el mensaje se lea (separadores del locale del negocio). */
function legible(cantidadBase: number, base: BaseUnit, locale: string): string {
  if (base === 'GR' && cantidadBase >= 1000) {
    return `${(cantidadBase / 1000).toLocaleString(locale)} kg`;
  }
  if (base === 'ML' && cantidadBase >= 1000) {
    return `${(cantidadBase / 1000).toLocaleString(locale)} L`;
  }
  return `${cantidadBase.toLocaleString(locale)} ${NOMBRE_BASE[base]}`;
}

export interface IngredienteMedido {
  /** Nombre del insumo, para que el mensaje diga cual es. */
  nombre: string;
  /** Cantidad ya convertida a unidad base (GR/ML/UND). */
  cantidadBase: number;
  base: BaseUnit;
}

export interface ResultadoCordura {
  /** Motivos por los que NO se puede guardar. Vacio = adelante. */
  errores: string[];
  /** Cosas raras que si se guardan, para que la pantalla las muestre. */
  avisos: string[];
}

/**
 * Revisa una receta entera contra los topes.
 *
 * Puro: recibe los ingredientes ya convertidos a unidad base para poder
 * probarlo sin base de datos.
 */
export function revisarCordura(
  ingredientes: IngredienteMedido[],
  locale: string,
): ResultadoCordura {
  const errores: string[] = [];
  const avisos: string[] = [];

  if (ingredientes.length > MAX_INGREDIENTES) {
    errores.push(
      `La receta tiene ${ingredientes.length} ingredientes y el maximo son ${MAX_INGREDIENTES}. La receta mas larga del catalogo tiene 21: revisa si se duplicaron lineas.`,
    );
  }

  for (const ing of ingredientes) {
    const { cantidadBase, base, nombre } = ing;

    if (!Number.isFinite(cantidadBase)) {
      errores.push(`La cantidad de "${nombre}" no es un numero valido.`);
      continue;
    }
    if (cantidadBase <= 0) {
      errores.push(
        `"${nombre}" esta en ${cantidadBase}: una receta no puede llevar cantidad cero o negativa.`,
      );
      continue;
    }

    if (cantidadBase > TOPE_DURO[base]) {
      errores.push(
        `"${nombre}": ${legible(cantidadBase, base, locale)} por unidad vendida. El maximo son ${legible(TOPE_DURO[base], base, locale)} — revisa si sobra un cero.`,
      );
      continue;
    }

    if (cantidadBase > UMBRAL_AVISO[base]) {
      avisos.push(
        `"${nombre}": ${legible(cantidadBase, base, locale)} por unidad vendida es mucho. Si es un combo o una tanda esta bien; si no, revisa la cantidad.`,
      );
    }
  }

  return { errores, avisos };
}
