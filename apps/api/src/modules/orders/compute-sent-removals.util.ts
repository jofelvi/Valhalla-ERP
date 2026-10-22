import { packsParaProducto, RegistroPacks } from './pack-registry';

/** Baja de una linea ya comandada detectada al comparar items de un PATCH. */
export interface SentRemoval {
  productId: string;
  name: string;
  qty: number;
  unitPrice: number;
  station: string | null;
}

/**
 * Compara items antes/despues de un PATCH agregando cantidades por producto y
 * detecta unidades YA COMANDADAS (sentQty > 0) que este PATCH elimina o reduce.
 * Solo esas requieren PIN — quitar items aun no enviados a cocina/barra es
 * correccion normal del mesonero y queda libre. Funcion pura.
 *
 * ── El caso de los packs ──
 *
 * Convertir 12 Pilsen comandadas en un tobo hace desaparecer 12 unidades de
 * Pilsen. Por productId eso es identico a borrarlas, asi que el candado pedia
 * PIN por una operacion legitima. La compensacion se calcula por DELTA: solo
 * cuentan las unidades de pack que este PATCH AGREGA, no las que ya estaban.
 *
 * Esa distincion no es un detalle. La primera version compensaba con todos los
 * packs presentes en `newItems`, y eso abria un agujero real: si la orden ya
 * traia un tobo comandado de antes, un PATCH que borrara 12 Pilsen comandadas
 * sin convertir nada quedaba tapado por ese tobo preexistente y pasaba SIN PIN.
 * O sea, se podia dar de baja producto ya despachado sin autorizacion, que es
 * justo lo que este candado existe para impedir.
 */
export function computeSentRemovals(
  oldItems: Array<Record<string, unknown>>,
  newItems: Array<Record<string, unknown>>,
  registro: RegistroPacks,
): SentRemoval[] {
  const after = new Map<string, number>();
  for (const item of newItems) {
    const pid = String(item.productId ?? '');
    if (!pid) continue;
    after.set(pid, (after.get(pid) ?? 0) + (Number(item.quantity) || 0));
  }

  const before = new Map<
    string,
    { qty: number; sent: number; sample: Record<string, unknown> }
  >();
  for (const item of oldItems) {
    const pid = String(item.productId ?? '');
    if (!pid) continue;
    const prev = before.get(pid);
    before.set(pid, {
      qty: (prev?.qty ?? 0) + (Number(item.quantity) || 0),
      sent: (prev?.sent ?? 0) + (Number(item.sentQty) || 0),
      sample: prev?.sample ?? item,
    });
  }

  /** Unidades de pack que este PATCH agrega para el producto dado (nunca < 0). */
  const unidadesDePackAgregadas = (productId: string): number => {
    const packs = packsParaProducto(registro, productId);
    if (packs.length === 0) return 0;

    let agregadas = 0;
    for (const packId of packs) {
      const despues = after.get(packId) ?? 0;
      const antes = before.get(packId)?.qty ?? 0;
      agregadas += Math.max(0, despues - antes);
    }
    return agregadas;
  };

  const removals: SentRemoval[] = [];
  for (const [productId, b] of before) {
    const sentBefore = Math.min(b.sent, b.qty);
    const qtyAfter = after.get(productId) ?? 0;
    if (qtyAfter >= sentBefore) continue;

    // Recien aca se mira si la baja la explica una conversion a pack: si no
    // falta nada, no hay por que consultar el registro.
    const compensado = qtyAfter + unidadesDePackAgregadas(productId);
    if (compensado >= sentBefore) continue;

    removals.push({
      productId,
      name: String(b.sample.name ?? b.sample.productName ?? productId),
      qty: sentBefore - compensado,
      unitPrice: Number(b.sample.unitPrice) || 0,
      station: b.sample.station ? String(b.sample.station) : null,
    });
  }
  return removals;
}
