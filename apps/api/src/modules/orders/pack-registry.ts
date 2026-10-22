/**
 * Productos que se venden por PACK y se guardan expandidos a unidades.
 *
 * Un tobo de $11 con 12 cervezas se guarda como 12 unidades a $11/12 para que
 * la barra entregue de a una. Solo estos productos funcionan asi.
 *
 * ¿Por que una lista explicita y no el campo `presentationQuantity` del
 * catalogo? Porque ese campo NO sirve para distinguir packs:
 *
 *   - Es inconsistente en produccion: un tobo de 12 llego a tener
 *     presentationQuantity = 1.
 *   - Lo tienen 439 productos, la mayoria platos normales: "Tequeños de la
 *     Casa x8 UND" lo trae en 8, pero se vende como UN plato de $5.50, no como
 *     8 unidades. Tratarlo como pack le cambiaria la cantidad de 1 a 8 y
 *     romperia comandas y entregas.
 *
 * El registro NO vive en el código: es el documento `configs/packs` (interno de
 * la API, fuera de `CONFIG_IDS`). Cada negocio arma su lista con sus propios IDs
 * de producto. Sin documento, el registro es vacío y no se convierte nada.
 */
export interface PackConfig {
  /** Unidades individuales que trae el pack. */
  totalUnits: number;
  /** Solo para referencia humana al mantener la lista. */
  label: string;
}

export interface RegistroPacks {
  /** Packs por id de producto. */
  packs: Record<string, PackConfig>;
  /**
   * A qué packs puede convertirse cada producto suelto (solo IDs).
   *
   * Deliberadamente NO lleva ni el tamaño ni el precio del pack: el tamaño vive en
   * `packs[id].totalUnits` y el precio sale del catálogo (`products.price`). Un precio
   * cableado obliga a tocar el registro cada vez que el dueño cambia una cifra en la ficha.
   */
  individualAPacks: Record<string, string[]>;
}

/** Registro vacío: sin documento, o con el módulo `packsAndBuckets` apagado. */
export const REGISTRO_PACKS_VACIO: RegistroPacks = {
  packs: {},
  individualAPacks: {},
};

const MAX_PACKS = 200;
const MAX_UNIDADES = 1000;

/**
 * Normaliza el documento `configs/packs`. Lo que no cuadra se descarta en silencio: un
 * documento a medias nunca rompe una venta, solo deja de ofrecer ese pack.
 */
export function normalizarRegistroPacks(raw: unknown): RegistroPacks {
  const r =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const packs: Record<string, PackConfig> = {};
  const crudos =
    r.packs && typeof r.packs === 'object'
      ? (r.packs as Record<string, unknown>)
      : {};
  for (const [id, valor] of Object.entries(crudos).slice(0, MAX_PACKS)) {
    if (!valor || typeof valor !== 'object') continue;
    const v = valor as Record<string, unknown>;
    const totalUnits = Number(v.totalUnits);
    if (
      !Number.isInteger(totalUnits) ||
      totalUnits < 1 ||
      totalUnits > MAX_UNIDADES
    )
      continue;
    packs[id] = {
      totalUnits,
      label: typeof v.label === 'string' ? v.label.slice(0, 80) : id,
    };
  }

  const individualAPacks: Record<string, string[]> = {};
  const crudosIndividuales =
    r.individualAPacks && typeof r.individualAPacks === 'object'
      ? (r.individualAPacks as Record<string, unknown>)
      : {};
  for (const [individual, lista] of Object.entries(crudosIndividuales)) {
    if (!Array.isArray(lista)) continue;
    const ids = [
      ...new Set(lista.filter((x): x is string => typeof x === 'string')),
    ];
    // Solo se ofrecen packs que existen en el registro: un ID huérfano no da error, no aparece.
    const validos = ids.filter((id) =>
      Object.prototype.hasOwnProperty.call(packs, id),
    );
    if (validos.length > 0) individualAPacks[individual] = validos;
  }

  return { packs, individualAPacks };
}

export function getPackConfig(
  registro: RegistroPacks,
  productId: string,
): PackConfig | undefined {
  return Object.prototype.hasOwnProperty.call(registro.packs, productId)
    ? registro.packs[productId]
    : undefined;
}

/** A qué packs puede convertirse un producto suelto (vacío si no tiene ninguno). */
export function packsParaProducto(
  registro: RegistroPacks,
  productId: string,
): readonly string[] {
  return Object.prototype.hasOwnProperty.call(
    registro.individualAPacks,
    productId,
  )
    ? registro.individualAPacks[productId]
    : [];
}
