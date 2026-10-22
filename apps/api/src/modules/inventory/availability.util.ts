/**
 * DISPONIBILIDAD PARA VENDER — avisar, no bloquear.
 *
 * Regla del dueño (03/09/2026): si falta un ingrediente hay que AVISAR, porque
 * lo más probable es que no se haya cargado el inventario, no que falte de
 * verdad. Bloquear con los datos de hoy pararía el negocio: Cocina nunca tuvo
 * conteo inicial y lleva la Papa en −13.776 g.
 *
 * Por eso el "Agotado" fuerte se reserva a insumos que el dueño marcó como
 * críticos, y un almacén sin línea base nunca dice "agotado" — dice
 * "inventario no cargado", que es la verdad.
 *
 * Puro: recibe el catálogo y el stock ya cargados, para poder probar la
 * aritmética sin base de datos.
 */

export type EstadoDisponibilidad =
  | 'OK'
  | 'AVISO'
  | 'AGOTADO'
  | 'SIN_LINEA_BASE'
  | 'SIN_CONTROL';

export interface Faltante {
  productId: string;
  name: string;
  criticality?: string | null;
  /** Cuánto hace falta para UNA unidad, en unidad base. */
  necesario: number;
  hay: number;
}

export interface Disponibilidad {
  productId: string;
  estado: EstadoDisponibilidad;
  faltantes: Faltante[];
  /** Cuántas unidades salen con el stock de hoy. Solo para gerencia. */
  maxPorciones?: number;
}

/** Solo lo marcado explícitamente como ALTA o MEDIA frena la venta con aviso fuerte. */
export function esCritico(criticality?: string | null): boolean {
  return criticality === 'ALTA' || criticality === 'MEDIA';
}

export interface InsumoConStock {
  _id: string;
  name: string;
  criticality?: string | null;
  /** Stock actual en unidad base, en el almacén que corresponde. */
  stock: number;
  /**
   * ESTE insumo se ha contado alguna vez en su almacén.
   *
   * Es por PRODUCTO, no por almacén: Cocina tiene un conteo inicial del 25/08
   * que cubrió unos pocos insumos, y 86 de sus 87 filas siguen en negativo.
   * Con la marca por almacén, esos 86 salían "agotados" — y un aviso que sale
   * en todo deja de ser un aviso.
   */
  contadoAlgunaVez: boolean;
}

/** Lo que hace falta de cada insumo para vender UNA unidad, ya en unidad base. */
export interface NecesidadPorUnidad {
  insumoId: string;
  qtyBase: number;
}

/**
 * Estado de un producto vendible.
 *
 * `necesidades` vacío significa que el producto no descuenta nada:
 *  - si es un servicio, está bien y devuelve OK;
 *  - si nadie decidió qué es, es SIN_CONTROL y solo lo ve gerencia (el
 *    mesonero no puede hacer nada con esa información en mitad del servicio).
 */
export function evaluarDisponibilidad(
  producto: {
    _id: string;
    esServicio?: boolean;
    naturalezaPendiente?: boolean;
  },
  necesidades: NecesidadPorUnidad[],
  insumos: Map<string, InsumoConStock>,
): Disponibilidad {
  const base: Disponibilidad = {
    productId: String(producto._id),
    estado: 'OK',
    faltantes: [],
  };

  if (producto.esServicio) return base;
  if (necesidades.length === 0) {
    return producto.naturalezaPendiente
      ? { ...base, estado: 'SIN_CONTROL' }
      : base;
  }

  const faltantes: Faltante[] = [];
  let algunSinLineaBase = false;
  let porciones = Number.POSITIVE_INFINITY;
  let hayCritico = false;

  for (const n of necesidades) {
    const insumo = insumos.get(String(n.insumoId));
    if (!insumo) {
      // Ingrediente roto: la receta no descuenta y no se puede saber si hay.
      // Es un aviso, no un "agotado": el problema es la receta, no el stock.
      faltantes.push({
        productId: String(n.insumoId),
        name: 'ingrediente desconocido',
        necesario: n.qtyBase,
        hay: 0,
      });
      continue;
    }

    // Un stock NEGATIVO no dice que falte: dice que se vendió sin cargar la
    // compra. Mandar al mesonero a buscar algo por un número que arrastra
    // meses de consumo sin reponer no le sirve de nada.
    if (!insumo.contadoAlgunaVez || insumo.stock < 0) {
      algunSinLineaBase = true;
      continue;
    }

    if (n.qtyBase > 0) {
      porciones = Math.min(porciones, Math.floor(insumo.stock / n.qtyBase));
    }

    if (insumo.stock < n.qtyBase) {
      faltantes.push({
        productId: String(insumo._id),
        name: insumo.name,
        criticality: insumo.criticality ?? null,
        necesario: n.qtyBase,
        hay: insumo.stock,
      });
      if (esCritico(insumo.criticality)) hayCritico = true;
    }
  }

  // Sin línea base no se puede afirmar nada del stock: decir "agotado" ahí
  // sería mentirle al mesonero en cada plato.
  if (algunSinLineaBase) {
    return { ...base, estado: 'SIN_LINEA_BASE', faltantes };
  }

  if (faltantes.length === 0) {
    return {
      ...base,
      maxPorciones: Number.isFinite(porciones) ? porciones : undefined,
    };
  }

  return {
    ...base,
    estado: hayCritico ? 'AGOTADO' : 'AVISO',
    faltantes,
    maxPorciones: 0,
  };
}
