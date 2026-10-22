'use client';
export const dynamic = 'force-dynamic';

import { Fragment, useMemo, useState } from 'react';
import { api, ApiError } from '@/services/api/apiClient';
import { Order } from '@/modelTypes/order';
import { useWaiters } from '@/hooks/useUsers';
import { formatCurrency } from '@/shared/utils/currencyHelpers';
import { calcularComision } from '@odin6/types';
import { useNominaConfig } from '@/features/payroll/hooks/useNominaConfig';
import { useTarifas } from '@/shared/config';
import { getDisplayOrderNumber } from '@/shared/utils/orderNumber';
import { Clock, Search, ChevronDown, ChevronRight } from 'lucide-react';
import {
  IconoEnCuadro,
  TituloDePantalla,
} from '@/components/shared/cabecera/CabeceraDePantalla';

// datetime-local con hora local (VE). value: 'YYYY-MM-DDTHH:mm'
function toLocalInput(d: Date): string {
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

function fmtDateTime(d?: Date | string | null): string {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const PAY_LABEL: Record<string, string> = {
  paid: 'Pagado',
  pending_verification: 'En verificación',
  pending: 'A crédito',
};
const PAY_STYLE: Record<string, string> = {
  paid: 'bg-ok/10 text-ok',
  pending_verification: 'bg-warn/10 text-warn',
  pending: 'bg-accent/10 text-accent',
};

export default function OrdersByWaiterPage() {
  const nomina = useNominaConfig();
  const tarifas = useTarifas();
  const { data: users = [] } = useWaiters();
  // `useWaiters()` ya devuelve solo los mesoneros activos; aqui solo se ordenan.
  const waiters = useMemo(
    () => [...users].sort((a, b) => a.name.localeCompare(b.name)),
    [users],
  );
  const userById = useMemo(
    () => new Map(users.map((u) => [u.id, u.name])),
    [users],
  );

  // Defaults: hoy 00:00 → ahora
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const [waiterId, setWaiterId] = useState<string>('');
  const [from, setFrom] = useState<string>(toLocalInput(startOfDay));
  const [to, setTo] = useState<string>(toLocalInput(now));
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const buscar = async () => {
    setError(null);
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      setError('Elige fecha/hora de inicio y fin.');
      return;
    }
    // "Hasta" inclusivo hasta el final del minuto (00:15 incluye 00:15:59),
    // para no perder órdenes que cierran a los pocos segundos del minuto.
    toDate.setSeconds(59, 999);
    if (toDate.getTime() < fromDate.getTime()) {
      setError('La fecha "Hasta" no puede ser anterior a "Desde".');
      return;
    }
    setLoading(true);
    try {
      // `limit` explicito: esta pantalla pide rangos largos y un mes son 1.220
      // ordenes (medido en produccion el 21/09/2026). Sin pedirlo, la API
      // aplica su default de 500 y la tabla mostraria 500 de 1.220 filas sin
      // un error a la vista. 2.000 es el techo duro del servidor.
      const data = await api.get<Order[]>('/api/orders', {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        limit: '2000',
        ...(waiterId ? { waiterId } : {}),
      });
      const sorted = [...(data ?? [])].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      setOrders(sorted);
    } catch (err: unknown) {
      setError(
        err instanceof ApiError ? err.message : 'Error al buscar pedidos',
      );
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Resumen
  const resumen = useMemo(() => {
    const list = orders ?? [];
    const total = list.reduce((s, o) => s + (o.total ?? 0), 0);
    const service = list.reduce((s, o) => s + (o.serviceCharge ?? 0), 0);
    const tips = list.reduce((s, o) => s + (o.tipAmount ?? 0), 0);
    const commission = calcularComision(
      list.reduce((s, o) => s + (o.comisionBase ?? 0), 0),
      nomina,
    );
    const byPay: Record<string, { n: number; monto: number }> = {};
    for (const o of list) {
      const k = String(o.paymentStatus ?? 'pending');
      byPay[k] = byPay[k] ?? { n: 0, monto: 0 };
      byPay[k].n += 1;
      byPay[k].monto += o.total ?? 0;
    }
    return { total, service, tips, commission, byPay, count: list.length };
  }, [orders, nomina]);

  const waiterName = (o: Order) =>
    (o.waiterId && userById.get(o.waiterId)) ||
    (o as Order & { waiterName?: string }).waiterName ||
    '—';

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <IconoEnCuadro>
          <Clock className="w-5 h-5 text-brand" />
        </IconoEnCuadro>
        <TituloDePantalla
          titulo="Pedidos por Mesonero"
          classNameTitulo="text-2xl"
          subtitulo="Pedidos creados o cerrados dentro del intervalo elegido."
          classNameSubtitulo="text-sm text-dim"
        />
      </div>

      {/* Filtros */}
      <div className="bg-surface border border-line rounded-xl p-4 mb-5 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-dim">Mesonero</label>
          <select
            value={waiterId}
            onChange={(e) => setWaiterId(e.target.value)}
            className="border border-line rounded-lg px-3 py-2 text-sm min-w-[180px] bg-elevated text-content"
          >
            <option value="" className="bg-elevated text-content">
              Todos
            </option>
            {waiters.map((w) => (
              <option
                key={w.id}
                value={w.id}
                className="bg-elevated text-content"
              >
                {w.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-dim">Desde</label>
          <input
            type="datetime-local"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border border-line rounded-lg px-3 py-2 text-sm bg-elevated text-content"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-dim">Hasta</label>
          <input
            type="datetime-local"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border border-line rounded-lg px-3 py-2 text-sm bg-elevated text-content"
          />
        </div>
        <button
          onClick={() => void buscar()}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand text-on-brand text-sm font-medium hover:bg-brand/90 disabled:opacity-50"
        >
          <Search className="h-4 w-4" />
          {loading ? 'Buscando…' : 'Buscar'}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-danger/10 border border-danger/20 text-danger px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {orders !== null && !loading && (
        <>
          {/* Resumen */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
            <Stat label="Pedidos" value={String(resumen.count)} />
            <Stat label="Total vendido" value={formatCurrency(resumen.total)} />
            <Stat
              label={`Servicio${tarifas.serviceMode === 'included' ? ' incluido' : ''} (${Math.round(tarifas.serviceRate * 1000) / 10}%)`}
              value={formatCurrency(resumen.service)}
            />
            <Stat
              label={`Comisión (${Math.round(nomina.commissionRate * 1000) / 10}%)`}
              value={formatCurrency(resumen.commission)}
            />
            <Stat label="Propinas" value={formatCurrency(resumen.tips)} />
          </div>

          {/* Desglose por estado de pago */}
          {resumen.count > 0 && (
            <div className="flex flex-wrap gap-2 mb-5">
              {Object.entries(resumen.byPay).map(([k, v]) => (
                <span
                  key={k}
                  className={`text-xs px-3 py-1.5 rounded-full ${PAY_STYLE[k] ?? 'bg-surface text-content'}`}
                >
                  {PAY_LABEL[k] ?? k}: {v.n} · {formatCurrency(v.monto)}
                </span>
              ))}
            </div>
          )}

          {/* Tabla */}
          {resumen.count === 0 ? (
            <p className="text-dim py-10 text-center">
              Sin pedidos en el rango.
            </p>
          ) : (
            <div className="overflow-x-auto border border-line rounded-xl">
              <table className="w-full text-sm">
                <thead className="bg-elevated/50 text-left text-dim">
                  <tr>
                    <th className="px-3 py-3 w-8"></th>
                    <th className="px-3 py-3">Pedido</th>
                    <th className="px-3 py-3">Mesonero</th>
                    <th className="px-3 py-3">Creado</th>
                    <th className="px-3 py-3">Cerrado</th>
                    <th className="px-3 py-3">Estado</th>
                    <th className="px-3 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/30">
                  {(orders ?? []).map((o) => {
                    const isOpen = expanded.has(o.id);
                    const pk = String(o.paymentStatus ?? 'pending');
                    return (
                      <Fragment key={o.id}>
                        <tr
                          className="hover:bg-elevated/40 cursor-pointer"
                          onClick={() => toggle(o.id)}
                        >
                          <td className="px-3 py-2.5 text-dim">
                            {isOpen ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-xs">
                            #{getDisplayOrderNumber(o)}
                          </td>
                          <td className="px-3 py-2.5">{waiterName(o)}</td>
                          <td className="px-3 py-2.5 text-dim">
                            {fmtDateTime(o.createdAt)}
                          </td>
                          <td className="px-3 py-2.5 text-dim">
                            {fmtDateTime(o.updatedAt)}
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${PAY_STYLE[pk] ?? 'bg-surface text-content'}`}
                            >
                              {PAY_LABEL[pk] ?? pk}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold">
                            {formatCurrency(o.total ?? 0)}
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-elevated/20">
                            <td />
                            <td colSpan={6} className="px-3 py-2">
                              <div className="space-y-0.5">
                                {(o.items ?? []).map((it, idx) => (
                                  <div
                                    key={idx}
                                    className="flex justify-between text-xs text-content"
                                  >
                                    <span>
                                      {it.quantity}× {it.name}
                                    </span>
                                    <span className="text-dim">
                                      {formatCurrency(it.total ?? 0)}
                                    </span>
                                  </div>
                                ))}
                                {(o.items ?? []).length === 0 && (
                                  <span className="text-xs text-dim">
                                    Sin ítems
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface border border-line rounded-xl p-3.5">
      <p className="text-xs text-dim">{label}</p>
      <p className="text-lg font-bold text-content mt-0.5">{value}</p>
    </div>
  );
}
