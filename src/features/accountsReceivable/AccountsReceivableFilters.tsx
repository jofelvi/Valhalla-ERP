'use client';

import { Input } from '@/components/shared/input/input';
import SelectCustom from '@/components/shared/selectCustom/SelectCustom';
import { InvoiceStatusEnum } from '@/shared';
import { Calendar, Loader2, Search, X } from 'lucide-react';
import type {
  FiltrosDeCartera,
  PestanaDeCartera,
} from './hooks/useFiltrosDeCartera';

const statusOptions = [
  { value: '', label: 'Todos los estados' },
  { value: InvoiceStatusEnum.PENDING, label: 'Pendiente' },
  { value: InvoiceStatusEnum.PARTIALLY_PAID, label: 'Parcialmente Pagado' },
  { value: InvoiceStatusEnum.OVERDUE, label: 'Vencido' },
];

interface Props {
  filtros: FiltrosDeCartera;
  cambiar: <K extends keyof FiltrosDeCartera>(
    campo: K,
    valor: FiltrosDeCartera[K],
  ) => void;
  limpiarFechas: () => void;
  /** Cuántas filas se están mostrando ahora mismo. */
  resultados?: number;
  /** El servidor todavía está respondiendo a lo que se escribió. */
  buscando: boolean;
}

/**
 * Los filtros de la cartera.
 *
 * Ya no navega: antes cada tecla del buscador hacía un `router.push` sobre una
 * página `force-dynamic` —una vuelta al servidor por letra—. Ahora todo es
 * estado controlado y la URL la sincroniza `useFiltrosDeCartera` sin navegar.
 */
export default function AccountsReceivableFilters({
  filtros,
  cambiar,
  limpiarFechas,
  resultados,
  buscando,
}: Props) {
  const enPendientes = filtros.tab === 'pending';
  const hayFechas = Boolean(filtros.desde || filtros.hasta);

  const pestana = (valor: PestanaDeCartera, etiqueta: string) => {
    const activa = filtros.tab === valor;
    return (
      <button
        type="button"
        role="tab"
        aria-selected={activa}
        onClick={() => cambiar('tab', valor)}
        className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
          activa
            ? valor === 'history'
              ? 'bg-ok text-on-brand shadow-md'
              : 'bg-brand text-on-brand shadow-md'
            : 'text-brand hover:bg-elevated'
        }`}
      >
        {etiqueta}
      </button>
    );
  };

  return (
    <div className="mb-4 space-y-3">
      <div
        role="tablist"
        aria-label="Estado de las cuentas"
        className="flex gap-1 rounded-xl border border-line/50 bg-surface/60 p-1 backdrop-blur-sm"
      >
        {pestana('pending', 'Por cobrar')}
        {pestana('history', 'Ya pagadas')}
      </div>

      <div className="flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1">
          <Input
            type="search"
            icon={Search}
            aria-label="Buscar cuentas"
            placeholder="Buscar por cliente, N° de acción, factura o descripción…"
            value={filtros.q}
            onChange={(e) => cambiar('q', e.target.value)}
            className="pr-14"
          />
          {filtros.q && (
            <span className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1.5 text-xs text-dim">
              {buscando ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <span className="tabular-nums">{resultados ?? 0}</span>
              )}
            </span>
          )}
        </div>
        {enPendientes && (
          <div className="md:w-52">
            <SelectCustom
              id="status-filter"
              options={statusOptions}
              value={filtros.status}
              placeholder="Filtrar por estado"
              onChange={(v) => cambiar('status', v)}
            />
          </div>
        )}
      </div>

      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
        <div className="flex items-center gap-1.5 text-sm text-dim">
          <Calendar className="h-4 w-4 text-brand" />
          <span className="font-medium">Rango de fecha:</span>
        </div>
        <div className="mt-2 flex w-full flex-1 flex-col items-stretch gap-2 sm:mt-0 sm:w-auto sm:flex-row sm:items-center">
          <input
            type="date"
            aria-label="Desde"
            value={filtros.desde}
            max={filtros.hasta || undefined}
            onChange={(e) => cambiar('desde', e.target.value)}
            className="w-full rounded-lg border border-line px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 sm:w-auto"
          />
          <span className="hidden text-center text-sm text-dim sm:block">
            —
          </span>
          <input
            type="date"
            aria-label="Hasta"
            value={filtros.hasta}
            min={filtros.desde || undefined}
            onChange={(e) => cambiar('hasta', e.target.value)}
            className="w-full rounded-lg border border-line px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 sm:w-auto"
          />
          {hayFechas && (
            <button
              type="button"
              onClick={limpiarFechas}
              className="rounded-lg p-1.5 text-dim transition-colors hover:bg-danger/10 hover:text-danger"
              title="Limpiar fechas"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
