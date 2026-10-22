/**
 * Cuanto debe un cliente EN TOTAL, para incluirlo en los avisos.
 *
 * Reglas, todas nacidas de casos reales de la base:
 *
 *  1. Una cuenta NO se cuenta si esta representada por una consolidada VIVA.
 *     Sumarla ademas de su madre contaria la misma deuda dos veces.
 *  2. Se descartan las saldadas (`paid`) y las anuladas (`cancelled`).
 *  3. El saldo de cada cuenta es `amount - paidAmount`, NO `amount`. Asi una
 *     consolidada con abono parcial aporta unicamente lo que falta: hay varias
 *     en produccion, p.ej. una de $96.39 con $80.24 abonados debe aportar
 *     $16.15, no $96.39.
 *  4. Los saldos negativos o de centavos se ignoran (tolerancia de $0.01) para
 *     que un redondeo no genere una deuda fantasma.
 *
 * ─── Por que NO se confia en la marca `isMerged` ───
 * Se confiaba, y se perdieron $656 de deuda real: al anular una consolidada
 * sus hijas quedaban marcadas como fusionadas apuntando a una madre que ya no
 * cobraba nada, y esa deuda desaparecia de todos lados aunque la orden
 * siguiera sin pagar. Aqui la marca es solo una PISTA: lo que decide es si la
 * madre existe y sigue viva. Asi, aunque alguna escritura vuelva a dejar la
 * marca mal puesta, el dinero no se hace invisible.
 */

export interface DebtAccount {
  _id?: unknown;
  amount?: number | null;
  paidAmount?: number | null;
  status?: string | null;
  isMerged?: boolean | null;
  /** Puede venir como id o, en datos viejos, como el documento entero. */
  mergedIntoId?: unknown;
}

/** Estado de una consolidada madre, para saber si sigue cobrando. */
export interface ParentStatus {
  id: string;
  status?: string | null;
}

export interface CustomerDebt {
  /** Cuentas que siguen debiendo algo. */
  count: number;
  /** Suma de los saldos pendientes, redondeada a centavos. */
  total: number;
  /**
   * Cuentas que decian estar fusionadas pero cuya madre no cobra (anulada o
   * inexistente). Se cuentan igual; esto solo sirve para detectarlas.
   */
  orphanCount: number;
}

/** Tolerancia: por debajo de un centavo la cuenta se considera saldada. */
const EPSILON = 0.01;

/**
 * Saca el id de la madre soportando el formato viejo.
 *
 * En los datos de feb-may 2026 `mergedIntoId` guardo el documento completo de
 * la consolidada en vez de su id; el id verdadero viene anidado adentro.
 */
export function resolveParentId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value.trim() || null;

  if (typeof value === 'object') {
    const doc = value as { id?: unknown; _id?: unknown };
    const nested = doc.id ?? doc._id;
    if (nested) return String(nested);
  }
  return null;
}

/** Una madre "cobra" mientras no este anulada. */
function parentIsCollecting(parent?: ParentStatus): boolean {
  if (!parent) return false;
  return (parent.status ?? '').toLowerCase() !== 'cancelled';
}

export function computeCustomerDebt(
  accounts: DebtAccount[],
  parents: ParentStatus[] = [],
): CustomerDebt {
  const parentById = new Map(parents.map((p) => [String(p.id), p]));

  let count = 0;
  let total = 0;
  let orphanCount = 0;

  for (const account of accounts) {
    const status = (account.status ?? '').toLowerCase();
    if (status === 'paid' || status === 'cancelled') continue;

    if (account.isMerged === true) {
      const parentId = resolveParentId(account.mergedIntoId);
      const parent = parentId ? parentById.get(parentId) : undefined;

      // Madre viva: su deuda ya la representa ella.
      if (parentIsCollecting(parent)) continue;

      // Madre anulada o inexistente: la marca miente, la deuda es de esta
      // cuenta y hay que verla.
      orphanCount++;
    }

    const balance = (account.amount ?? 0) - (account.paidAmount ?? 0);
    if (balance > EPSILON) {
      count++;
      total += balance;
    }
  }

  return { count, total: Math.round(total * 100) / 100, orphanCount };
}

/** Ids de las madres a consultar para poder decidir. */
export function parentIdsOf(accounts: DebtAccount[]): string[] {
  const ids = new Set<string>();
  for (const account of accounts) {
    if (account.isMerged !== true) continue;
    const id = resolveParentId(account.mergedIntoId);
    if (id) ids.add(id);
  }
  return [...ids];
}
