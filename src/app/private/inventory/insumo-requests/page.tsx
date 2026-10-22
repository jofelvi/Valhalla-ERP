'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { ChevronLeft, Check, X, PackageOpen } from 'lucide-react';
import { api } from '@/services/api/apiClient';
import Loader from '@/components/shared/Loader/Loader';

interface InsumoRequestItem {
  productId: string;
  productName: string;
  qty: number;
  unit: string;
}

interface InsumoRequest {
  _id: string;
  station: string;
  /** Ausente en las solicitudes viejas: aquellas eran todas TRASLADO. */
  type?: 'TRASLADO' | 'PRODUCCION' | 'ALTA_INSUMO';
  items: InsumoRequestItem[];
  /** Solo en ALTA_INSUMO: lo que la estación propone crear. */
  proposedProduct?: { name: string; unit?: string; purpose?: string };
  note?: string;
  status: string;
  requestedByName?: string;
  createdAt?: string;
}

const TYPE_LABEL: Record<string, string> = {
  TRASLADO: 'Reposición',
  PRODUCCION: 'Producción',
  ALTA_INSUMO: 'Insumo nuevo',
};

const TYPE_STYLE: Record<string, string> = {
  TRASLADO: 'bg-sky-100 text-sky-700',
  PRODUCCION: 'bg-ok text-ok',
  ALTA_INSUMO: 'bg-violet-100 text-violet-700',
};

const STATION_LABEL: Record<string, string> = {
  BAR: 'Barra',
  KITCHEN: 'Cocina',
  PIZZA: 'Pizza',
};

export default function InsumoRequestsPage() {
  const qc = useQueryClient();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['insumo-requests', 'PENDING'],
    queryFn: () =>
      api.get<InsumoRequest[]>('/api/insumo-requests', { status: 'PENDING' }),
    refetchInterval: 15000,
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ['insumo-requests'] });

  const approve = useMutation({
    mutationFn: (id: string) =>
      api.patch(`/api/insumo-requests/${id}/approve`, {}),
    onSuccess: invalidate,
    onError: (e: unknown) =>
      alert(e instanceof Error ? e.message : 'No se pudo aprobar'),
  });

  const reject = useMutation({
    mutationFn: (id: string) =>
      api.patch(`/api/insumo-requests/${id}/reject`, {}),
    onSuccess: invalidate,
    onError: (e: unknown) =>
      alert(e instanceof Error ? e.message : 'No se pudo rechazar'),
  });

  const busyId = approve.isPending
    ? approve.variables
    : reject.isPending
      ? reject.variables
      : null;

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <Link
        href="/private/inventory"
        className="mb-4 inline-flex items-center gap-1 text-sm text-dim hover:text-dim"
      >
        <ChevronLeft className="h-4 w-4" /> Inventario
      </Link>

      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-xl bg-amber-100 p-2 text-brand">
          <PackageOpen className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Solicitudes de insumos
          </h1>
          <p className="text-sm text-dim">
            Pedidos de reposición de las estaciones. Al aprobar se transfiere el
            stock del depósito a la estación.
          </p>
        </div>
      </div>

      {isLoading ? (
        <Loader />
      ) : requests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line py-16 text-center text-dim">
          No hay solicitudes pendientes.
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <div
              key={req._id}
              className="rounded-xl border border-line bg-white p-4 shadow-sm"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-brand">
                    {STATION_LABEL[req.station] ?? req.station}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      TYPE_STYLE[req.type ?? 'TRASLADO']
                    }`}
                  >
                    {TYPE_LABEL[req.type ?? 'TRASLADO']}
                  </span>
                </span>
                <span className="text-xs text-dim">
                  {req.requestedByName ?? 'Estación'}
                  {req.createdAt
                    ? ` · ${new Date(req.createdAt).toLocaleString('es-VE', {
                        hour: '2-digit',
                        minute: '2-digit',
                        day: '2-digit',
                        month: '2-digit',
                      })}`
                    : ''}
                </span>
              </div>

              {req.type === 'ALTA_INSUMO' && req.proposedProduct ? (
                <div className="mb-3 rounded-lg bg-violet-50 p-3">
                  <p className="text-sm font-semibold text-violet-900">
                    {req.proposedProduct.name}
                    {req.proposedProduct.unit
                      ? ` · se mide en ${req.proposedProduct.unit}`
                      : ''}
                  </p>
                  {req.proposedProduct.purpose ? (
                    <p className="mt-0.5 text-sm text-violet-700">
                      Para: {req.proposedProduct.purpose}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs text-violet-600">
                    Créalo en Productos con su costo, criticidad y receta (si se
                    elabora); luego rechaza esta solicitud para cerrarla.
                  </p>
                </div>
              ) : (
                <ul className="mb-3 divide-y divide-gray-100">
                  {req.items.map((it) => (
                    <li
                      key={it.productId}
                      className="flex items-center justify-between py-1.5 text-sm"
                    >
                      <span className="text-dim">
                        {req.type === 'PRODUCCION' ? 'Elaboró: ' : ''}
                        {it.productName}
                      </span>
                      <span className="font-semibold text-gray-900 tabular-nums">
                        {it.qty} {it.unit}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {req.type === 'PRODUCCION' ? (
                <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-ok">
                  Al aprobar entra lo elaborado al almacén de la estación y sale
                  el crudo según la receta.
                </p>
              ) : null}

              {req.note ? (
                <p className="mb-3 text-sm italic text-dim">“{req.note}”</p>
              ) : null}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('¿Rechazar esta solicitud?'))
                      reject.mutate(req._id);
                  }}
                  disabled={busyId === req._id}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-line py-2 text-sm font-medium text-dim hover:bg-page disabled:opacity-50"
                >
                  <X className="h-4 w-4" /> Rechazar
                </button>
                <button
                  type="button"
                  disabled={busyId === req._id || req.type === 'ALTA_INSUMO'}
                  title={
                    req.type === 'ALTA_INSUMO'
                      ? 'Un insumo nuevo se crea desde Productos, no desde aquí'
                      : undefined
                  }
                  onClick={() => {
                    const estacion = STATION_LABEL[req.station] ?? req.station;
                    const mensaje =
                      req.type === 'PRODUCCION'
                        ? `Entrará lo elaborado al almacén de ${estacion} y saldrá el crudo de su receta. ¿Confirmar?`
                        : `Se transferirá el stock del depósito a ${estacion}. ¿Confirmar?`;
                    if (confirm(mensaje)) approve.mutate(req._id);
                  }}
                  className="flex flex-[2] items-center justify-center gap-1 rounded-lg bg-brand py-2 text-sm font-bold text-white hover:bg-brand disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  {req.type === 'PRODUCCION'
                    ? 'Aprobar producción'
                    : 'Aprobar y transferir'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
