'use client';
import { useEffect, useState } from 'react';
import { api } from '@/services/api/apiClient';
import { Payroll } from '@odin6/types';
import { PagoComision } from '@odin6/types';
import { useEmployees } from '@/hooks/useEmployees';
import { Receipt } from 'lucide-react';
import { PayrollReceiptModal } from './PayrollReceipt';

interface Row {
  id: string;
  nombre: string;
  fecha: Date | null;
  neto: number;
  origen: 'Nómina' | 'Comisión';
  detalle: string;
  payroll?: Payroll;
}

function fmtDate(d: Date | null): string {
  if (!d || isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function PayrollHistory() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [receiptRow, setReceiptRow] = useState<Row | null>(null);
  const { data: employees = [] } = useEmployees();

  useEffect(() => {
    let active = true;
    (async () => {
      const empMap = new Map(
        employees.map((e) => [
          e.id,
          `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim(),
        ]),
      );
      const [payrolls, comisiones] = await Promise.all([
        api.get<Payroll[]>('/api/payroll').catch(() => [] as Payroll[]),
        api
          .get<PagoComision[]>('/api/comisiones/historial')
          .catch(() => [] as PagoComision[]),
      ]);

      const a: Row[] = (payrolls ?? []).map((p) => ({
        id: `pay-${p.id}`,
        nombre: empMap.get(p.employeeId) ?? p.employeeId,
        fecha: p.paymentDate
          ? new Date(p.paymentDate)
          : p.createdAt
            ? new Date(p.createdAt)
            : null,
        neto: p.netPay ?? 0,
        origen: 'Nómina' as const,
        detalle: [
          p.daysWorked != null
            ? `${p.daysWorked}d×$${(p.dailyRate ?? 0).toFixed(2)}`
            : null,
          (p.salary?.commissions ?? 0) > 0
            ? `com $${(p.salary?.commissions ?? 0).toFixed(2)} (${(p.paidOrderIds ?? []).length} ord)`
            : null,
          (p.tips ?? 0) > 0 ? `prop $${(p.tips ?? 0).toFixed(2)}` : null,
          (p.deductions?.other ?? 0) > 0
            ? `−deducciones $${(p.deductions?.other ?? 0).toFixed(2)}`
            : null,
          // Ajustes manuales: prestamo, propina por fuera, etc.
          ...(p.adjustments ?? []).map(
            (a) =>
              `${a.type === 'ADDITION' ? '+' : '−'}${a.concept} $${a.amountUsd.toFixed(2)}${a.currency === 'BS' ? ` (Bs ${a.amount.toLocaleString('es-VE')})` : ''}`,
          ),
          // Consumos propios y cuentas de otros clientes asumidas
          ...(p.expenseDeductions ?? []).map(
            (d) => `−${d.description} $${d.amount.toFixed(2)}`,
          ),
        ]
          .filter(Boolean)
          .join(' · '),
        payroll: p,
      }));

      const b: Row[] = (comisiones ?? []).map((c) => ({
        id: `com-${c.id}`,
        nombre: c.waiterName ?? '—',
        fecha: c.fechaPago
          ? new Date(c.fechaPago)
          : c.createdAt
            ? new Date(c.createdAt)
            : null,
        neto: c.montoNeto ?? c.montoTotal ?? 0,
        origen: 'Comisión' as const,
        detalle: 'pago de comisiones (histórico)',
      }));

      const all = [...a, ...b].sort(
        (x, y) => (y.fecha?.getTime() ?? 0) - (x.fecha?.getTime() ?? 0),
      );
      if (active) {
        setRows(all);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [employees]);

  if (loading)
    return (
      <p className="text-dim py-10 text-center text-sm">
        Cargando historial...
      </p>
    );
  if (rows.length === 0)
    return (
      <p className="text-dim py-10 text-center text-sm">
        Sin pagos registrados
      </p>
    );

  const totalNomina = rows
    .filter((r) => r.origen === 'Nómina')
    .reduce((s, r) => s + r.neto, 0);
  const totalComision = rows
    .filter((r) => r.origen === 'Comisión')
    .reduce((s, r) => s + r.neto, 0);
  const totalGeneral = totalNomina + totalComision;

  return (
    <div className="space-y-3">
      {/* Resumen de totales pagados */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-surface rounded-xl border border-line p-3.5">
          <p className="text-xs text-dim">Total pagado (histórico)</p>
          <p className="text-xl font-bold text-content mt-0.5">
            ${totalGeneral.toFixed(2)}
          </p>
          <p className="text-[11px] text-dim">{rows.length} pagos</p>
        </div>
        <div className="bg-surface rounded-xl border border-line p-3.5">
          <p className="text-xs text-dim">En Nómina</p>
          <p className="text-lg font-bold text-accent mt-0.5">
            ${totalNomina.toFixed(2)}
          </p>
        </div>
        <div className="bg-surface rounded-xl border border-line p-3.5">
          <p className="text-xs text-dim">En Comisiones (sección antigua)</p>
          <p className="text-lg font-bold text-ok mt-0.5">
            ${totalComision.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto border border-line rounded-xl">
        <table className="w-full text-sm">
          <thead className="bg-elevated/50 text-left text-dim">
            <tr>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">
                Empleado
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">
                Fecha de pago
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">
                Origen
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">
                Detalle
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide">
                Neto
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide">
                Recibo
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/30">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-elevated/40">
                <td className="px-4 py-3 font-medium text-content">
                  {r.nombre}
                </td>
                <td className="px-4 py-3 text-dim">{fmtDate(r.fecha)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      r.origen === 'Nómina'
                        ? 'bg-accent/15 text-accent'
                        : 'bg-ok/15 text-ok'
                    }`}
                  >
                    {r.origen}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-dim">{r.detalle}</td>
                <td className="px-4 py-3 text-right font-semibold text-content">
                  ${r.neto.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right">
                  {r.payroll && (
                    <button
                      onClick={() => setReceiptRow(r)}
                      className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent/80 transition-colors"
                      title="Ver recibo de pago"
                    >
                      <Receipt className="h-3.5 w-3.5" />
                      Recibo
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ─── Modal Recibo de pago ─── */}
      {receiptRow?.payroll && (
        <PayrollReceiptModal
          payroll={receiptRow.payroll}
          nombre={receiptRow.nombre}
          onClose={() => setReceiptRow(null)}
        />
      )}
    </div>
  );
}
