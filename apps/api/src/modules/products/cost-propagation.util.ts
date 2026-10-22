import {
  ProductForRecipeCost,
  RecipeLineIssue,
  computeTheoreticalUnitCost,
  expandRecipeIngredients,
} from '../inventory/recipe-cost.helper';

/**
 * PROPAGACIÓN DE COSTO — cuando sube un insumo, sube el costo de lo que lo lleva.
 *
 * Hasta ahora el costo de un preparado solo se recalculaba al guardar su receta,
 * y el recálculo masivo vivía en el navegador (`recalculateDependentMixedProducts`,
 * disparado por un cambio de PRECIO, no de costo). Resultado: se compraba la
 * carne más cara y la hamburguesa seguía mostrando el margen viejo.
 *
 * Este helper es puro para poder probar la aritmética sin base de datos: recibe
 * el catálogo ya cargado y devuelve qué productos cambian y a cuánto.
 */

/** Un producto del catálogo con lo que hace falta para costear y medir margen. */
export interface ProductoCosteable extends ProductForRecipeCost {
  price?: number;
  isForSale?: boolean;
  isActive?: boolean;
}

export type MotivoSospecha = 'baja-fuerte' | 'sube-fuerte';

export interface CambioDeCosto {
  productId: string;
  name: string;
  costoAnterior: number;
  costoNuevo: number;
  /** Cambio tan grande que más parece un dato roto que un precio nuevo. */
  sospechoso?: MotivoSospecha;
}

/** Un plato que NO se pudo costear, con las líneas que lo impiden. */
export interface OmitidoDeCosto {
  productId: string;
  name: string;
  issues: RecipeLineIssue[];
}

/** Qué se hace con los cambios sospechosos y dónde se reportan. */
export interface OpcionesPropagacion {
  /** Si es true, un cambio sospechoso NO se aplica (queda en `retenidos`). */
  retenerSospechosos?: boolean;
  retenidos?: CambioDeCosto[];
  /** Recibe los platos que no se pudieron costear (antes se saltaban en silencio). */
  omitidos?: OmitidoDeCosto[];
}

/** Baja de más de 40 % o sube más de 3 veces: no es una compra normal. */
const BAJA_MAXIMA = 0.6;
const SUBE_MAXIMA = 3;

/**
 * El 8/10/2026 se midió que "Recalcular" pisaría ~70 platos con costos 3–10×
 * más bajos porque 54 insumos traían el precio dividido entre 1000. Un costo no
 * baja a la mitad ni se triplica de un día para otro: si pasa, el dato está mal
 * y hay que mirarlo antes de guardarlo.
 */
export function esCambioSospechoso(
  anterior: number,
  nuevo: number,
): MotivoSospecha | null {
  if (!(anterior > 0)) return null; // sin costo previo no hay con qué comparar
  if (nuevo < anterior * BAJA_MAXIMA) return 'baja-fuerte';
  if (nuevo > anterior * SUBE_MAXIMA) return 'sube-fuerte';
  return null;
}

/** Redondeo a 4 decimales, igual que `updateRecipe` al guardar el costo. */
const r4 = (n: number): number => Math.round(n * 10000) / 10000;

/**
 * Productos cuyo costo cambia porque cambió el de `insumoIds`.
 *
 * Recorre en CASCADA: si sube la harina cambia la Masa de Pizza, y si cambia la
 * masa cambian todas las pizzas que la llevan. El límite de profundidad evita
 * que una receta circular mal cargada cuelgue el servidor (la expansión del
 * consumo es de un solo nivel, pero el costo sí se encadena).
 */
export function calcularPropagacion(
  insumoIds: string[],
  catalogo: Map<string, ProductoCosteable>,
  maxProfundidad = 5,
  opciones: OpcionesPropagacion = {},
): CambioDeCosto[] {
  const cambios = new Map<string, CambioDeCosto>();
  const omitidosVistos = new Set<string>();
  const retenidosVistos = new Set<string>();
  let frente = new Set(insumoIds.map(String));
  let profundidad = 0;

  while (frente.size > 0 && profundidad < maxProfundidad) {
    const siguiente = new Set<string>();

    for (const producto of catalogo.values()) {
      const id = String(producto._id);
      if (frente.has(id)) continue; // el propio insumo no se recalcula
      const usaAlguno = (producto.ingredients ?? []).some(
        (i) => i && frente.has(String(i.productId)),
      );
      if (!usaAlguno) continue;

      const costo = computeTheoreticalUnitCost(producto, 1, catalogo);
      // null = la receta no se puede costear (ingrediente roto o unidad
      // incompatible). No se pisa el costo con 0: eso fingiría margen perfecto.
      if (costo === null || !Number.isFinite(costo)) {
        if (opciones.omitidos && !omitidosVistos.has(id)) {
          omitidosVistos.add(id);
          const { issues } = expandRecipeIngredients(producto, catalogo);
          opciones.omitidos.push({
            productId: id,
            name: producto.name,
            issues: issues.filter((i) => i.kind !== 'sin-costo'),
          });
        }
        continue;
      }

      const nuevo = r4(costo);
      const anterior = r4(Number(producto.cost ?? 0));
      if (Math.abs(nuevo - anterior) < 0.0001) continue;

      const sospechoso = esCambioSospechoso(anterior, nuevo);
      const cambio: CambioDeCosto = {
        productId: id,
        name: producto.name,
        costoAnterior: anterior,
        costoNuevo: nuevo,
        ...(sospechoso ? { sospechoso } : {}),
      };
      if (sospechoso && opciones.retenerSospechosos) {
        // No se aplica ni se cuenta en el catálogo: lo de arriba debe costearse
        // con el valor que hoy está guardado, no con uno dudoso.
        if (!retenidosVistos.has(id)) {
          retenidosVistos.add(id);
          opciones.retenidos?.push(cambio);
        }
        continue;
      }

      cambios.set(id, cambio);
      // El catálogo en memoria se actualiza para que el siguiente nivel
      // (las pizzas que llevan esta masa) cueste con el valor nuevo.
      producto.cost = nuevo;
      siguiente.add(id);
    }

    frente = siguiente;
    profundidad += 1;
  }

  return Array.from(cambios.values());
}

export type NivelMargen = 'NEGATIVO' | 'NULO' | 'BAJO';

export interface AlertaMargen {
  productId: string;
  name: string;
  price: number;
  cost: number;
  marginPct: number;
  nivel: NivelMargen;
}

/**
 * Margen de venta en porcentaje del precio: lo que queda después de la materia
 * prima. Es el mismo cálculo que ya mostraba la tabla de productos, para que el
 * número de la alerta y el de la pantalla no se contradigan.
 */
export function margenPct(price: number, cost: number): number {
  if (!price || price <= 0) return 0;
  return ((price - cost) / price) * 100;
}

/**
 * Costo de UNA unidad vendida.
 *
 * En un INSUMO, `cost` es lo que cuesta la unidad de COMPRA completa (el saco
 * de harina de 45 kg = $42,44), no lo que cuesta un kilo. Comparar ese número
 * contra el precio de venta daba disparates: la harina aparecía con −4367 % de
 * margen cuando en realidad gana un 1 % (visto el 04/09 en la tabla de
 * productos). Es el mismo encoding que usa `costPerBaseUnit`.
 *
 * En un PREPARADO no se divide: su `cost` ya es el de una unidad, calculado
 * desde la receta. Y ojo, muchos platos traen `presentationQuantity` sin ser
 * packs ("Tequeños de la Casa x8 UND" lo tiene en 8 pero se vende como UN
 * plato): dividir ahí sería el error contrario.
 */
export function costoPorUnidadVendida(producto: {
  cost?: number;
  presentationQuantity?: number;
  ingredients?: unknown[] | null;
  type?: string;
}): number {
  const cost = Number(producto.cost ?? 0);
  const esPreparado =
    (producto.ingredients ?? []).length > 0 || producto.type === 'COMPUESTO';
  if (esPreparado) return cost;
  const contenido = Number(producto.presentationQuantity ?? 1);
  return contenido > 1 ? cost / contenido : cost;
}

/**
 * Clasifica el margen contra el umbral del negocio.
 *
 * NEGATIVO: se pierde plata en cada venta. NULO: se vende al costo.
 * BAJO: por debajo del mínimo que el dueño considera sano (configurable).
 * Un producto sin costo cargado NO genera alerta: no se sabe su margen, y
 * gritar por eso taparía las alertas de verdad.
 */
export function evaluarMargen(
  producto: {
    _id?: string;
    name?: string;
    price?: number;
    cost?: number;
    presentationQuantity?: number;
    ingredients?: unknown[] | null;
    type?: string;
  },
  umbralPct: number,
): AlertaMargen | null {
  const price = Number(producto.price ?? 0);
  const cost = costoPorUnidadVendida(producto);
  if (price <= 0 || cost <= 0) return null;

  const pct = margenPct(price, cost);
  let nivel: NivelMargen | null = null;
  if (pct < 0) nivel = 'NEGATIVO';
  else if (pct === 0) nivel = 'NULO';
  else if (pct < umbralPct) nivel = 'BAJO';
  if (!nivel) return null;

  return {
    productId: String(producto._id ?? ''),
    name: String(producto.name ?? ''),
    price: Math.round(price * 100) / 100,
    cost: Math.round(cost * 100) / 100,
    marginPct: Math.round(pct * 10) / 10,
    nivel,
  };
}
