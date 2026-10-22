'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/services/api/apiClient';
import { ModuloGuard } from '@/shared/ui/modulos/ModuloGuard';

const EVENT_SLUG = 'evento-principal';
const TOTAL_TABLES = 30;

type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';

interface EventReservation {
  _id: string;
  tableNumber: number;
  package: 'RON' | 'WHISKY';
  cedula: string;
  firstName: string;
  lastName: string;
  phone: string;
  paymentReference: string;
  amountUsd: number;
  amountBs: number;
  bcvRate: number;
  status: ReservationStatus;
  createdAt: string;
}

const STATUS_STYLES: Record<ReservationStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-ok text-ok',
  CANCELLED: 'bg-danger text-danger',
};

const STATUS_LABELS: Record<ReservationStatus, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  CANCELLED: 'Cancelada',
};

const PACKAGE_LABELS: Record<EventReservation['package'], string> = {
  RON: 'Ron ($50)',
  WHISKY: "Buchanan's 12 ($100)",
};

function EventReservationsPageContenido() {
  const [reservations, setReservations] = useState<EventReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | 'ALL'>(
    'ALL',
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<EventReservation[]>(
        '/api/event-reservations',
        { eventSlug: EVENT_SLUG },
      );
      setReservations(data ?? []);
    } catch (err: unknown) {
      setError(
        err instanceof ApiError ? err.message : 'Error cargando reservas',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const updateStatus = async (
    id: string,
    status: 'CONFIRMED' | 'CANCELLED',
  ) => {
    setUpdatingId(id);
    try {
      const updated = await api.patch<EventReservation>(
        `/api/event-reservations/${id}/status`,
        { status },
      );
      setReservations((prev) =>
        prev.map((r) => (r._id === id ? { ...r, status: updated.status } : r)),
      );
    } catch (err: unknown) {
      setError(
        err instanceof ApiError ? err.message : 'Error actualizando reserva',
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const visible =
    statusFilter === 'ALL'
      ? reservations
      : reservations.filter((r) => r.status === statusFilter);

  const confirmedCount = reservations.filter(
    (r) => r.status === 'CONFIRMED',
  ).length;
  const pendingCount = reservations.filter(
    (r) => r.status === 'PENDING',
  ).length;
  const freeTables =
    TOTAL_TABLES - reservations.filter((r) => r.status !== 'CANCELLED').length;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Reservas — El Golazo Llanero</h1>
          <p className="text-sm text-dim">
            {confirmedCount} confirmadas · {pendingCount} pendientes ·{' '}
            {freeTables} mesas libres
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as ReservationStatus | 'ALL')
            }
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="ALL">Todas</option>
            <option value="PENDING">Pendientes</option>
            <option value="CONFIRMED">Confirmadas</option>
            <option value="CANCELLED">Canceladas</option>
          </select>
          <button
            onClick={() => void load()}
            className="border rounded-lg px-3 py-2 text-sm hover:bg-page"
          >
            Refrescar
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-danger text-danger px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-dim py-10 text-center">Cargando reservas...</p>
      ) : visible.length === 0 ? (
        <p className="text-dim py-10 text-center">Sin reservas</p>
      ) : (
        <div className="overflow-x-auto border rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-page text-left text-dim">
              <tr>
                <th className="px-4 py-3">Mesa</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Teléfono</th>
                <th className="px-4 py-3">Paquete</th>
                <th className="px-4 py-3">Monto</th>
                <th className="px-4 py-3">Referencia</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visible.map((r) => (
                <tr key={r._id} className="hover:bg-page">
                  <td className="px-4 py-3 font-bold text-lg">
                    {r.tableNumber}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">
                      {r.firstName} {r.lastName}
                    </p>
                    <p className="text-dim text-xs">{r.cedula}</p>
                  </td>
                  <td className="px-4 py-3">{r.phone}</td>
                  <td className="px-4 py-3">{PACKAGE_LABELS[r.package]}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">${r.amountUsd}</p>
                    <p className="text-dim text-xs">
                      Bs {r.amountBs?.toLocaleString('es-VE')}
                    </p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {r.paymentReference}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[r.status]}`}
                    >
                      {STATUS_LABELS[r.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {r.status === 'PENDING' && (
                      <div className="flex gap-2">
                        <button
                          disabled={updatingId === r._id}
                          onClick={() => void updateStatus(r._id, 'CONFIRMED')}
                          className="px-3 py-1.5 rounded-lg bg-ok text-white text-xs font-medium hover:bg-ok disabled:opacity-50"
                        >
                          Confirmar
                        </button>
                        <button
                          disabled={updatingId === r._id}
                          onClick={() => void updateStatus(r._id, 'CANCELLED')}
                          className="px-3 py-1.5 rounded-lg bg-danger text-white text-xs font-medium hover:bg-danger disabled:opacity-50"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                    {r.status === 'CONFIRMED' && (
                      <button
                        disabled={updatingId === r._id}
                        onClick={() => void updateStatus(r._id, 'CANCELLED')}
                        className="px-3 py-1.5 rounded-lg border border-danger text-danger text-xs font-medium hover:bg-red-50 disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function EventReservationsPage() {
  return (
    <ModuloGuard modulo="reservations">
      <EventReservationsPageContenido />
    </ModuloGuard>
  );
}
