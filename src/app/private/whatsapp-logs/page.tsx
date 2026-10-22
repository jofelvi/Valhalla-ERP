'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useBusqueda } from '@/shared/hooks/useBusqueda';
import {
  Check,
  CheckCheck,
  Eye,
  AlertTriangle,
  Clock,
  RefreshCcw,
  MessageCircle,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/shared/button/Button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/shared/card/card';
import { api } from '@/services/api/apiClient';

type Status = 'sent' | 'delivered' | 'read' | 'failed' | 'unknown';

interface Log {
  _id: string;
  messageId: string;
  status: Status;
  to?: string;
  customerName?: string;
  orderCode?: string;
  amount?: string;
  template?: string;
  accountReceivableId?: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  failedAt?: string;
  errorCode?: number;
  errorMessage?: string;
  createdAt?: string;
}

interface Resp {
  items: Log[];
  stats: Record<Status, number>;
}

const labelMap: Record<Status, string> = {
  sent: 'Enviado',
  delivered: 'Entregado',
  read: 'Leido',
  failed: 'Fallido',
  unknown: '—',
};

const colorMap: Record<Status, string> = {
  sent: 'bg-blue-100 text-blue-700 border-blue-200',
  delivered: 'bg-ok text-ok border-emerald-200',
  read: 'bg-violet-100 text-violet-700 border-violet-200',
  failed: 'bg-danger text-danger border-danger',
  unknown: 'bg-page text-dim border-line',
};

function StatusIcon({ status }: { status: Status }) {
  const cls = 'w-3.5 h-3.5';
  if (status === 'sent') return <Check className={cls} />;
  if (status === 'delivered') return <CheckCheck className={cls} />;
  if (status === 'read') return <Eye className={cls} />;
  if (status === 'failed') return <AlertTriangle className={cls} />;
  return <Clock className={cls} />;
}

function StatusPill({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${colorMap[status]}`}
    >
      <StatusIcon status={status} />
      {labelMap[status]}
    </span>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-dim">{label}</p>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function fmtDateTime(ts?: string) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function WhatsappLogsPage() {
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | Status>('all');
  const [q, setQ] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<Resp>(
        '/api/whatsapp-logs?limit=200' +
          (filter !== 'all' ? `&status=${filter}` : ''),
      );
      setData(res);
    } catch {
      setData({
        items: [],
        stats: { sent: 0, delivered: 0, read: 0, failed: 0, unknown: 0 },
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const filtered = useBusqueda(data?.items ?? [], q, [
    'to',
    'customerName',
    'orderCode',
    'messageId',
  ]);

  const stats = data?.stats ?? {
    sent: 0,
    delivered: 0,
    read: 0,
    failed: 0,
    unknown: 0,
  };
  const total =
    stats.sent + stats.delivered + stats.read + stats.failed + stats.unknown;
  const deliveredPct =
    total > 0 ? Math.round(((stats.delivered + stats.read) / total) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-page via-surface to-elevated">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand/20 rounded-xl flex items-center justify-center shadow-lg shadow-brand/20">
              <MessageCircle className="h-5 w-5 text-brand" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-brand to-brand-light bg-clip-text text-transparent">
                Mensajes WhatsApp
              </h1>
              <p className="text-xs text-dim">
                Seguimiento de envios y entregas (template pago_pendiente)
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCcw
              className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`}
            />
            Refrescar
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <StatCard label="Enviados" value={stats.sent} color="text-blue-600" />
          <StatCard
            label="Entregados"
            value={stats.delivered}
            color="text-ok"
          />
          <StatCard label="Leidos" value={stats.read} color="text-violet-600" />
          <StatCard label="Fallidos" value={stats.failed} color="text-danger" />
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-dim">
                % Entregados
              </p>
              <p className="text-2xl font-bold text-gray-800">
                {deliveredPct}%
              </p>
              <p className="text-[11px] text-dim">{total} envios totales</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-4">
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Filtros</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-4 flex flex-wrap gap-2 items-center">
            <div className="flex gap-1 flex-wrap">
              {(['all', 'sent', 'delivered', 'read', 'failed'] as const).map(
                (s) => (
                  <button
                    key={s}
                    onClick={() => setFilter(s)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                      filter === s
                        ? 'bg-brand text-on-brand border-brand'
                        : 'bg-white text-dim border-line hover:border-brand/50'
                    }`}
                  >
                    {s === 'all' ? 'Todos' : labelMap[s as Status]}
                  </button>
                ),
              )}
            </div>
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por telefono, cliente, orden o wamid"
              className="flex-1 min-w-[240px] px-3 py-1.5 rounded-md border border-line text-sm focus:outline-none focus:border-brand"
            />
          </CardContent>
        </Card>

        {/* List */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">
              Mensajes ({filtered.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            {loading && (
              <p className="text-sm text-dim italic py-4">Cargando…</p>
            )}
            {!loading && filtered.length === 0 && (
              <p className="text-sm text-dim italic py-4">
                Sin mensajes registrados.
              </p>
            )}
            {!loading && filtered.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-dim border-b border-line">
                      <th className="py-2 px-2">Estado</th>
                      <th className="py-2 px-2">Cliente</th>
                      <th className="py-2 px-2">Telefono</th>
                      <th className="py-2 px-2">Orden</th>
                      <th className="py-2 px-2">Enviado</th>
                      <th className="py-2 px-2">Entregado</th>
                      <th className="py-2 px-2">Leido</th>
                      <th className="py-2 px-2">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((l) => (
                      <tr
                        key={l._id}
                        className="border-b border-line hover:bg-page"
                      >
                        <td className="py-2 px-2">
                          <StatusPill status={l.status} />
                          {l.status === 'failed' && l.errorMessage && (
                            <p className="text-[10px] text-danger mt-0.5 max-w-[180px] truncate">
                              {l.errorCode ? `${l.errorCode}: ` : ''}
                              {l.errorMessage}
                            </p>
                          )}
                        </td>
                        <td className="py-2 px-2 text-dim">
                          {l.customerName ?? '—'}
                        </td>
                        <td className="py-2 px-2 text-dim font-mono text-xs">
                          {l.to ?? '—'}
                        </td>
                        <td className="py-2 px-2 text-dim text-xs">
                          {l.orderCode ?? '—'}
                          {l.amount && (
                            <span className="text-dim ml-1">· {l.amount}</span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-dim text-xs">
                          {fmtDateTime(l.sentAt ?? l.createdAt)}
                        </td>
                        <td className="py-2 px-2 text-dim text-xs">
                          {fmtDateTime(l.deliveredAt)}
                        </td>
                        <td className="py-2 px-2 text-dim text-xs">
                          {fmtDateTime(l.readAt)}
                        </td>
                        <td className="py-2 px-2">
                          {l.accountReceivableId && (
                            <Link
                              href={`/private/accounts-receivable/${l.accountReceivableId}`}
                            >
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs"
                              >
                                <FileText className="w-3 h-3 mr-1" />
                                Cuenta
                              </Button>
                            </Link>
                          )}
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
