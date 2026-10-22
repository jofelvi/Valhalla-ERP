'use client';
import Modal from '@/components/shared/modal';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ImageOff,
  Loader2,
  ReceiptText,
} from 'lucide-react';
import {
  fetchCobrosIncompletos,
  type OrdenSinCubrir,
  type ResumenCobrosIncompletos,
} from '@/features/reports/services/cobrosIncompletos';
import { tokenDeSesion } from '@/services/api/apiClient';
import { formatearUsdConMiles } from '@/shared/utils/dinero';

const fecha = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString('es-VE', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

/** yyyy-mm-dd de hace `dias` días, para los inputs de fecha. */
const haceDias = (dias: number) =>
  new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);

/**
 * Órdenes cobradas de menos: se cerraron como pagadas pero los pagos
 * registrados no cubren la cuenta.
 *
 * La pantalla solo muestra. No cobra, no ajusta y no descuenta: mover dinero
 * desde acá seria otra decisión y merece su propio candado.
 */
export default function CobrosIncompletosPage() {
  const [desde, setDesde] = useState(haceDias(30));
  const [hasta, setHasta] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<ResumenCobrosIncompletos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [mesonero, setMesonero] = useState<string | null>(null);
  const [foto, setFoto] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const token = await tokenDeSesion();
      // `hasta` incluye el día completo: si no, lo de hoy nunca aparece.
      setData(await fetchCobrosIncompletos(desde, `${hasta}T23:59:59`, token));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error cargando');
    } finally {
      setCargando(false);
    }
  }, [desde, hasta]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const filas = useMemo(
    () =>
      !data
        ? []
        : mesonero
          ? data.detalle.filter((d) => d.waiterName === mesonero)
          : data.detalle,
    [data, mesonero],
  );

  const totalFiltrado = useMemo(
    () => filas.reduce((s, f) => s + f.faltante, 0),
    [filas],
  );

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-content">Cobros incompletos</h1>
        <p className="text-sm text-dim">
          Órdenes cerradas como pagadas cuyos pagos registrados no cubren la
          cuenta. No incluye las que quedaron a crédito.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-dim">
          Desde
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="block mt-1 px-3 py-2 rounded-lg bg-surface border border-line text-content"
          />
        </label>
        <label className="text-xs text-dim">
          Hasta
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="block mt-1 px-3 py-2 rounded-lg bg-surface border border-line text-content"
          />
        </label>
        {mesonero && (
          <button
            type="button"
            onClick={() => setMesonero(null)}
            className="px-3 py-2 rounded-lg border border-brand/40 text-brand text-sm"
          >
            Quitar filtro: {mesonero} ✕
          </button>
        )}
      </div>

      {cargando && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-dim" />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-danger text-sm">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {data && !cargando && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-surface border border-line">
              <p className="text-xs text-dim">Faltante</p>
              <p className="text-2xl font-bold text-danger">
                {formatearUsdConMiles(
                  mesonero ? totalFiltrado : data.totalFaltante,
                )}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-surface border border-line">
              <p className="text-xs text-dim">Órdenes</p>
              <p className="text-2xl font-bold text-content">{filas.length}</p>
            </div>
            <div className="p-4 rounded-xl bg-surface border border-line">
              <p className="text-xs text-dim">Sin ningún pago</p>
              <p className="text-2xl font-bold text-content">
                {filas.filter((f) => f.pagos.length === 0).length}
              </p>
            </div>
          </div>

          {data.porMesonero.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {data.porMesonero.map((m) => (
                <button
                  key={m.waiterName}
                  type="button"
                  onClick={() =>
                    setMesonero(mesonero === m.waiterName ? null : m.waiterName)
                  }
                  className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                    mesonero === m.waiterName
                      ? 'border-brand bg-brand/10 text-brand'
                      : 'border-line text-content hover:bg-elevated'
                  }`}
                >
                  {m.waiterName}{' '}
                  <span className="text-danger font-semibold">
                    {formatearUsdConMiles(m.faltante)}
                  </span>{' '}
                  <span className="text-dim">({m.ordenes})</span>
                </button>
              ))}
            </div>
          )}

          {filas.length === 0 ? (
            <p className="text-sm text-dim py-10 text-center">
              Sin cobros incompletos en este rango. Todo lo cerrado como pagado
              tiene sus pagos.
            </p>
          ) : (
            <div className="rounded-xl border border-line overflow-hidden">
              {filas.map((o) => (
                <FilaOrden
                  key={o.id}
                  orden={o}
                  abierta={abierta === o.id}
                  onToggle={() => setAbierta(abierta === o.id ? null : o.id)}
                  onFoto={setFoto}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Comprobante en grande: es la prueba que se le muestra al mesonero. */}
      {foto && (
        <Modal
          isOpen
          estiloPropio
          onClose={() => setFoto(null)}
          classNameFondo="bg-black/80"
          classNameWrap="p-4"
          className="bg-transparent border-0 shadow-none backdrop-blur-none min-h-0 max-w-fit mx-0"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={foto}
            alt="Comprobante de pago"
            className="max-h-[90vh] max-w-full rounded-lg"
          />
        </Modal>
      )}
    </div>
  );
}

function FilaOrden({
  orden,
  abierta,
  onToggle,
  onFoto,
}: {
  orden: OrdenSinCubrir;
  abierta: boolean;
  onToggle: () => void;
  onFoto: (url: string) => void;
}) {
  return (
    <div className="border-b border-line last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-elevated text-left"
      >
        {abierta ? (
          <ChevronDown className="w-4 h-4 text-dim shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-dim shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm text-content truncate">
            {fecha(orden.createdAt)} · {orden.tableName || orden.sector || '—'}{' '}
            · <span className="font-medium">{orden.waiterName}</span>
          </p>
          <p className="text-xs text-dim truncate">
            {orden.customerName || 'Sin cliente'}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-dim">
            Debía {formatearUsdConMiles(orden.debido)} · declaró{' '}
            {formatearUsdConMiles(orden.declarado)}
          </p>
          <p className="text-sm font-bold text-danger">
            Falta {formatearUsdConMiles(orden.faltante)}
          </p>
        </div>
      </button>

      {abierta && (
        <div className="px-4 pb-4 pl-11 grid md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-semibold text-dim mb-1">Consumo</p>
            <div className="space-y-0.5">
              {orden.items.map((i, idx) => (
                <p key={idx} className="text-xs text-content">
                  {i.cantidad} × {i.nombre}{' '}
                  <span className="text-dim">
                    {formatearUsdConMiles(i.total)}
                  </span>
                </p>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-dim mb-1">
              Pagos registrados
            </p>
            {orden.pagos.length === 0 ? (
              <p className="text-xs text-danger">
                Ninguno. Se cerró como pagada sin registrar un solo pago.
              </p>
            ) : (
              <div className="space-y-2">
                {orden.pagos.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 text-xs text-content"
                  >
                    {p.proofImageUrl ? (
                      <button
                        type="button"
                        onClick={() => onFoto(p.proofImageUrl as string)}
                        className="shrink-0"
                        title="Ver comprobante"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.proofImageUrl}
                          alt="Comprobante"
                          className="w-10 h-10 rounded object-cover border border-line"
                        />
                      </button>
                    ) : (
                      <span
                        className="w-10 h-10 rounded border border-line flex items-center justify-center text-dim shrink-0"
                        title="Sin comprobante"
                      >
                        <ImageOff className="w-4 h-4" />
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="font-medium">
                        {formatearUsdConMiles(p.amount)}
                      </span>{' '}
                      {p.method}
                      {p.transactionId ? ` · ref ${p.transactionId}` : ''}
                      <br />
                      <span className="text-dim">{fecha(p.createdAt)}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] text-dim mt-2 flex items-center gap-1">
              <ReceiptText className="w-3 h-3" />
              Orden {orden.orderNumber || orden.id.slice(-8).toUpperCase()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
