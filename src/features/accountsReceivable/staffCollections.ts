import { AccountReceivable } from '@/modelTypes/accountReceivable';
import { Employee } from '@/modelTypes/employee';
// Import directo al enum (no al barrel de @/shared) para que este modulo sea
// puro: sin dependencias de UI ni assets, y por tanto testeable en aislamiento.
import { InvoiceStatusEnum } from '@/shared/types/enumShared';

/**
 * Cobranza de consumos del personal.
 *
 * La nomina solo ve los consumos de la ficha de cliente enlazada en
 * `employee.customerId`. Si un trabajador tiene una segunda ficha (nombres
 * escritos distinto), esas cuentas quedan invisibles al liquidar y la deuda
 * nunca se cobra. Este modulo arma ambas vistas: lo que si esta enlazado y lo
 * que quedo suelto.
 */

export interface StaffDebtRow {
  employeeId: string;
  employeeName: string;
  customerId: string;
  openAccounts: number;
  billed: number;
  collected: number;
  pending: number;
  /** Dias desde la cuenta abierta mas antigua (null si no hay deuda) */
  oldestDebtDays: number | null;
  lastActivityAt: Date | null;
}

export interface UnlinkedDebtRow {
  customerId: string;
  customerName: string;
  openAccounts: number;
  pending: number;
  oldestDebtDays: number | null;
}

export interface StaffCollectionsReport {
  rows: StaffDebtRow[];
  unlinked: UnlinkedDebtRow[];
  totalPending: number;
  totalUnlinkedPending: number;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

const DAY_MS = 24 * 60 * 60 * 1000;

const daysSince = (date: Date | string, now: number): number =>
  Math.max(0, Math.floor((now - new Date(date).getTime()) / DAY_MS));

const employeeName = (employee: Employee): string =>
  `${employee.firstName ?? ''} ${employee.lastName ?? ''}`.trim() ||
  employee.email ||
  employee.id;

/** Cuentas vivas: ni absorbidas por una consolidada ni anuladas */
const isOpenAccount = (account: AccountReceivable): boolean =>
  !account.isMerged && account.status !== InvoiceStatusEnum.CANCELLED;

const pendingOf = (account: AccountReceivable): number =>
  Math.max(0, round2(account.amount - (account.paidAmount ?? 0)));

/**
 * Detecta cuentas que pertenecen a personal pero cuya ficha no esta enlazada a
 * ningun empleado. Se apoya en el marcador que el POS usa al crear la cuenta
 * (trabajador / mesonero / empleado en el nombre del cliente).
 */
const STAFF_NAME_PATTERN = /trabajador|mesoner|empleado|chef|bartender|pizzer/i;

export function buildStaffCollections(
  employees: Employee[],
  accounts: AccountReceivable[],
  now: number = Date.now(),
): StaffCollectionsReport {
  const openAccounts = accounts.filter(isOpenAccount);

  const byCustomer = new Map<string, AccountReceivable[]>();
  for (const account of openAccounts) {
    if (!account.customerId) continue;
    const list = byCustomer.get(account.customerId) ?? [];
    list.push(account);
    byCustomer.set(account.customerId, list);
  }

  const linkedCustomerIds = new Set<string>();
  const rows: StaffDebtRow[] = [];

  for (const employee of employees) {
    if (!employee.customerId) continue;
    linkedCustomerIds.add(employee.customerId);

    const employeeAccounts = byCustomer.get(employee.customerId) ?? [];
    if (employeeAccounts.length === 0) continue;

    const billed = round2(
      employeeAccounts.reduce((sum, account) => sum + account.amount, 0),
    );
    const collected = round2(
      employeeAccounts.reduce(
        (sum, account) => sum + (account.paidAmount ?? 0),
        0,
      ),
    );
    const pending = round2(
      employeeAccounts.reduce((sum, account) => sum + pendingOf(account), 0),
    );

    const withDebt = employeeAccounts.filter(
      (account) => pendingOf(account) > 0.01,
    );
    const oldestDebtDays =
      withDebt.length > 0
        ? Math.max(
            ...withDebt.map((account) => daysSince(account.createdAt, now)),
          )
        : null;

    const lastActivity = employeeAccounts
      .map((account) => new Date(account.updatedAt ?? account.createdAt))
      .sort((a, b) => b.getTime() - a.getTime())[0];

    rows.push({
      employeeId: employee.id,
      employeeName: employeeName(employee),
      customerId: employee.customerId,
      openAccounts: employeeAccounts.length,
      billed,
      collected,
      pending,
      oldestDebtDays,
      lastActivityAt: lastActivity ?? null,
    });
  }

  // Fichas de personal que ningun empleado tiene enlazada: la nomina no las ve
  const unlinked: UnlinkedDebtRow[] = [];
  for (const [customerId, customerAccounts] of byCustomer) {
    if (linkedCustomerIds.has(customerId)) continue;
    const looksLikeStaff = customerAccounts.some((account) =>
      STAFF_NAME_PATTERN.test(account.customerName ?? ''),
    );
    if (!looksLikeStaff) continue;

    const pending = round2(
      customerAccounts.reduce((sum, account) => sum + pendingOf(account), 0),
    );
    if (pending <= 0.01) continue;

    const withDebt = customerAccounts.filter(
      (account) => pendingOf(account) > 0.01,
    );

    unlinked.push({
      customerId,
      customerName: customerAccounts[0].customerName ?? customerId,
      openAccounts: customerAccounts.length,
      pending,
      oldestDebtDays:
        withDebt.length > 0
          ? Math.max(
              ...withDebt.map((account) => daysSince(account.createdAt, now)),
            )
          : null,
    });
  }

  return {
    rows: rows.sort((a, b) => b.pending - a.pending),
    unlinked: unlinked.sort((a, b) => b.pending - a.pending),
    totalPending: round2(rows.reduce((sum, row) => sum + row.pending, 0)),
    totalUnlinkedPending: round2(
      unlinked.reduce((sum, row) => sum + row.pending, 0),
    ),
  };
}
