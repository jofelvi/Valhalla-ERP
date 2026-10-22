'use client';

import { useEffect, useState } from 'react';
import { Check, CheckCheck, Clock, Eye, AlertTriangle } from 'lucide-react';
import { api } from '@/services/api/apiClient';

interface WhatsappLog {
  _id: string;
  messageId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed' | 'unknown';
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  failedAt?: string;
  errorMessage?: string;
  errorCode?: number;
  to?: string;
  customerName?: string;
  orderCode?: string;
}

interface Props {
  accountId: string;
  refreshKey?: number;
}

const labelMap: Record<WhatsappLog['status'], string> = {
  sent: 'Enviado',
  delivered: 'Entregado',
  read: 'Leido',
  failed: 'Fallido',
  unknown: 'Desconocido',
};

const colorMap: Record<WhatsappLog['status'], string> = {
  sent: 'bg-blue-100 text-blue-700 border-blue-200',
  delivered: 'bg-ok text-ok border-emerald-200',
  read: 'bg-violet-100 text-violet-700 border-violet-200',
  failed: 'bg-danger text-danger border-danger',
  unknown: 'bg-page text-dim border-line',
};

function Icon({ status }: { status: WhatsappLog['status'] }) {
  const cls = 'w-3.5 h-3.5';
  if (status === 'sent') return <Check className={cls} />;
  if (status === 'delivered') return <CheckCheck className={cls} />;
  if (status === 'read') return <Eye className={cls} />;
  if (status === 'failed') return <AlertTriangle className={cls} />;
  return <Clock className={cls} />;
}

function formatShort(ts?: string) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function WhatsappStatusBadge({ accountId, refreshKey }: Props) {
  const [logs, setLogs] = useState<WhatsappLog[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get<{ items: WhatsappLog[] }>(
        `/api/whatsapp-logs?accountId=${accountId}&limit=10`,
      )
      .then((res) => {
        if (!cancelled) setLogs(res.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setLogs([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, refreshKey]);

  if (loading) {
    return (
      <div className="text-xs text-dim italic">Cargando estado WhatsApp…</div>
    );
  }
  if (!logs || logs.length === 0) return null;

  const latest = logs[0];
  return (
    <div className="rounded-md border border-line bg-white p-3 text-xs space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-dim">WhatsApp</span>
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border font-medium ${colorMap[latest.status]}`}
        >
          <Icon status={latest.status} />
          {labelMap[latest.status]}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-dim">
        <div>
          <span className="text-dim">Enviado:</span>{' '}
          {formatShort(latest.sentAt)}
        </div>
        <div>
          <span className="text-dim">Entregado:</span>{' '}
          {formatShort(latest.deliveredAt)}
        </div>
        <div>
          <span className="text-dim">Leido:</span> {formatShort(latest.readAt)}
        </div>
        {latest.status === 'failed' && (
          <div className="col-span-2 text-danger">
            Error {latest.errorCode ?? ''}:{' '}
            {latest.errorMessage ?? 'sin detalle'}
          </div>
        )}
      </div>
      {logs.length > 1 && (
        <div className="pt-1 border-t border-line text-[11px] text-dim">
          {logs.length} envios registrados para esta cuenta
        </div>
      )}
    </div>
  );
}
