/**
 * Decision pura: ¿esta mesa debe liberarse sola?
 *
 * Una mesa se marca ocupada ANTES de que exista la orden (claim del mesonero
 * mientras arma el pedido). Si el cliente se va sin crear nada y la liberacion
 * no llega (cerro la pestaña, se cayo la red, el movil paso a background), la
 * mesa queda roja bloqueando a los demas. Este modulo decide cuando soltarla.
 *
 * Vive aparte del service para poder testear cada caso sin Mongo. La regla de
 * oro: una mesa con orden REAL nunca se toca.
 */

/** Placeholder que la creacion de orden deja mientras inserta la orden. */
export const PENDING_ORDER_PLACEHOLDER = 'PENDING_ORDER_CREATION';

/** Sin heartbeat en este lapso = ya nadie esta en la mesa (late cada 60s). */
export const INACTIVITY_MS = 2 * 60 * 1000;

/** Tope absoluto: pestaña abandonada pero abierta (sigue latiendo). */
export const ABSOLUTE_CLAIM_MS = 30 * 60 * 1000;

/**
 * Gracia para estados corruptos (ocupada sin claim, o creacion de orden
 * atascada). Solo se sueltan si llevan asi mas de este lapso, para no pisar
 * una operacion legitima en curso.
 */
export const ORPHAN_GRACE_MS = 2 * 60 * 1000;

export interface TableSweepState {
  _id: string;
  name?: string;
  status?: string;
  isAvailable?: boolean;
  orderId?: string | null;
  claimedBy?: string | null;
  claimedByName?: string | null;
  claimedAt?: Date | string | null;
  lastHeartbeatAt?: Date | string | null;
  updatedAt?: Date | string | null;
}

export type ReleaseReason =
  | 'claim-inactivo'
  | 'claim-tope-absoluto'
  | 'huerfana-sin-claim'
  | 'creacion-orden-atascada'
  | 'orden-inexistente';

const ms = (value: Date | string | null | undefined): number | null => {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
};

/** La mesa esta bloqueada para otros (roja en el POS). */
function isBlocked(table: TableSweepState): boolean {
  return (
    table.isAvailable === false ||
    table.status === 'OCCUPIED' ||
    !!table.orderId
  );
}

/**
 * Devuelve el motivo por el que la mesa debe liberarse, o null si debe
 * quedarse como esta.
 *
 * @param hasRealOrder true si `table.orderId` apunta a una orden que existe
 *                     y sigue activa. Si es true NUNCA se libera.
 */
export function decideAutoRelease(
  table: TableSweepState,
  opts: { hasRealOrder: boolean; now: number },
): ReleaseReason | null {
  const { hasRealOrder, now } = opts;

  // Mesa libre: nada que hacer.
  if (!isBlocked(table)) return null;

  // Blindaje: una mesa con orden real es intocable.
  if (hasRealOrder) return null;

  const orderId = table.orderId ?? null;

  // Creacion de orden atascada: el placeholder deberia durar milisegundos.
  if (orderId === PENDING_ORDER_PLACEHOLDER) {
    const since = ms(table.updatedAt);
    if (since === null) return 'creacion-orden-atascada';
    return now - since >= ORPHAN_GRACE_MS ? 'creacion-orden-atascada' : null;
  }

  // Apunta a una orden que ya no existe (se borro/cancelo y quedo la mesa).
  if (orderId) return 'orden-inexistente';

  // Sin orden: es un claim (reserva mientras arma el pedido).
  if (table.claimedBy) {
    const claimedAt = ms(table.claimedAt);
    // Claim sin fecha = corrupto, se suelta.
    if (claimedAt === null) return 'claim-inactivo';

    if (now - claimedAt >= ABSOLUTE_CLAIM_MS) return 'claim-tope-absoluto';

    // Sin heartbeat reciente = ya nadie esta en la mesa.
    const lastSignal = ms(table.lastHeartbeatAt) ?? claimedAt;
    return now - lastSignal >= INACTIVITY_MS ? 'claim-inactivo' : null;
  }

  // Ocupada, sin orden y sin nadie que la haya reclamado: estado imposible
  // de forma legitima (el barrido viejo no la veia y quedaba pegada).
  const since = ms(table.updatedAt);
  if (since === null) return 'huerfana-sin-claim';
  return now - since >= ORPHAN_GRACE_MS ? 'huerfana-sin-claim' : null;
}
