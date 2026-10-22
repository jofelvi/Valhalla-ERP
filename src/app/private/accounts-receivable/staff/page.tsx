'use client';
export const dynamic = 'force-dynamic';

import { useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/shared/button/Button';
import { Badge } from '@/components/shared/badge/badge';
import { Card, CardContent } from '@/components/shared/card/card';
import { useAccountsReceivable } from '@/hooks/useAccountsReceivable';
import { useEmployees } from '@/hooks/useEmployees';
import { buildStaffCollections } from '@/features/accountsReceivable/staffCollections';
import {
  AlertTriangle,
  ArrowLeft,
  CircleDollarSign,
  Clock,
  Users,
  Wallet,
} from 'lucide-react';

const formatUSD = (value: number): string =>
  new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: 'USD',
  }).format(value);

/** Colorea la antigüedad: al mes ya es cobranza atrasada */
const agingTone = (days: number | null): string => {
  if (days === null) return 'text-dim';
  if (days >= 60) return 'text-danger font-semibold';
  if (days >= 30) return 'text-accent font-medium';
  return 'text-dim';
};

export default function StaffCollectionsPage() {
  const { data: accounts = [], isLoading: loadingAccounts } =
    useAccountsReceivable();
  const { data: employees = [], isLoading: loadingEmployees } = useEmployees();

  const report = useMemo(
    () => buildStaffCollections(employees, accounts),
    [employees, accounts],
  );

  const isLoading = loadingAccounts || loadingEmployees;

  const oldestDebtDays = report.rows.reduce(
    (max, row) => Math.max(max, row.oldestDebtDays ?? 0),
    0,
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-page via-surface to-elevated">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Header */}
        <div className="bg-surface/90 backdrop-blur-sm rounded-2xl border border-line/50 shadow-lg p-4 sm:p-5 mb-6">
          <div className="flex items-center gap-3">
            <Link href="/private/accounts-receivable">
              <Button variant="ghost" size="sm" className="shrink-0 px-2">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div className="w-10 h-10 bg-brand/20 rounded-xl flex items-center justify-center shrink-0">
              <Users className="h-5 w-5 text-brand" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-brand to-brand-light bg-clip-text text-transparent">
                Consumos del personal
              </h1>
              <p className="text-brand/80 text-xs">
                Lo que cada trabajador debe y desde cuándo
              </p>
            </div>
          </div>
        </div>

        {/* Resumen */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <div className="bg-surface/80 backdrop-blur-sm rounded-xl border border-danger/20 p-4 shadow-md">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-danger/20 rounded-lg flex items-center justify-center">
                <CircleDollarSign className="h-4 w-4 text-danger" />
              </div>
              <span className="text-xs font-medium text-danger">
                Pendiente total
              </span>
            </div>
            <p className="text-xl font-bold text-danger truncate">
              {formatUSD(report.totalPending)}
            </p>
          </div>

          <div className="bg-surface/80 backdrop-blur-sm rounded-xl border border-line/50 p-4 shadow-md">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-brand/20 rounded-lg flex items-center justify-center">
                <Wallet className="h-4 w-4 text-brand" />
              </div>
              <span className="text-xs font-medium text-brand">
                Trabajadores con deuda
              </span>
            </div>
            <p className="text-xl font-bold text-content">
              {report.rows.filter((row) => row.pending > 0.01).length}
            </p>
          </div>

          <div className="bg-surface/80 backdrop-blur-sm rounded-xl border border-accent/20 p-4 shadow-md">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-accent/20 rounded-lg flex items-center justify-center">
                <Clock className="h-4 w-4 text-accent" />
              </div>
              <span className="text-xs font-medium text-accent">
                Deuda más antigua
              </span>
            </div>
            <p className="text-xl font-bold text-content">
              {oldestDebtDays > 0 ? `${oldestDebtDays} días` : '—'}
            </p>
          </div>
        </div>

        {/* Fichas que la nómina no ve */}
        {report.unlinked.length > 0 && (
          <Card className="bg-surface/90 backdrop-blur-sm border border-accent/30 shadow-lg mb-6">
            <CardContent className="p-5">
              <div className="flex items-start gap-3 mb-3">
                <AlertTriangle className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-sm font-bold text-content">
                    Cuentas de personal que la nómina no ve (
                    {formatUSD(report.totalUnlinkedPending)})
                  </h2>
                  <p className="text-xs text-dim mt-0.5">
                    Estas fichas de cliente no están enlazadas a ningún
                    empleado, así que sus consumos nunca aparecen al liquidar la
                    semana. Enlaza la ficha en el empleado o unifícala con la
                    que sí usa.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                {report.unlinked.map((row) => (
                  <div
                    key={row.customerId}
                    className="flex items-center justify-between gap-3 p-3 bg-accent/10 rounded-xl border border-accent/20"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-content truncate">
                        {row.customerName}
                      </p>
                      <p className="text-[11px] text-dim">
                        {row.openAccounts} cuenta(s)
                        {row.oldestDebtDays !== null
                          ? ` · más antigua: ${row.oldestDebtDays} días`
                          : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-bold text-danger">
                        {formatUSD(row.pending)}
                      </span>
                      <Link
                        href={`/private/accounts-receivable?customerId=${row.customerId}`}
                      >
                        <Button variant="outline" size="sm">
                          Ver cuentas
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabla por trabajador */}
        <Card className="bg-surface/90 backdrop-blur-sm border-line/50 shadow-lg">
          <CardContent className="p-0">
            {isLoading ? (
              <p className="p-6 text-sm text-dim">Cargando…</p>
            ) : report.rows.length === 0 ? (
              <p className="p-6 text-sm text-dim">
                Ningún trabajador tiene consumos registrados.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line/50 text-left">
                      <th className="px-4 py-3 text-xs font-semibold text-dim">
                        Trabajador
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold text-dim">
                        Cuentas
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold text-dim">
                        Facturado
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold text-dim">
                        Cobrado
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold text-dim">
                        Pendiente
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold text-dim">
                        Antigüedad
                      </th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((row) => (
                      <tr
                        key={row.employeeId}
                        className="border-b border-line/30 hover:bg-elevated/40 transition-colors"
                      >
                        <td className="px-4 py-3 font-medium text-content">
                          {row.employeeName}
                        </td>
                        <td className="px-4 py-3 text-dim">
                          {row.openAccounts}
                        </td>
                        <td className="px-4 py-3 text-dim">
                          {formatUSD(row.billed)}
                        </td>
                        <td className="px-4 py-3 text-ok">
                          {formatUSD(row.collected)}
                        </td>
                        <td className="px-4 py-3">
                          {row.pending > 0.01 ? (
                            <span className="font-bold text-danger">
                              {formatUSD(row.pending)}
                            </span>
                          ) : (
                            <Badge variant="success">Al día</Badge>
                          )}
                        </td>
                        <td
                          className={`px-4 py-3 text-xs ${agingTone(row.oldestDebtDays)}`}
                        >
                          {row.oldestDebtDays !== null
                            ? `${row.oldestDebtDays} días`
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/private/accounts-receivable?customerId=${row.customerId}`}
                          >
                            <Button variant="outline" size="sm">
                              Ver cuentas
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
