'use client';
import { use, useMemo } from 'react';
import Link from 'next/link';
import { useOrder } from '@/hooks/useOrders';
import { useUsers } from '@/hooks/useUsers';
import { usePrintLogs } from '@/hooks/usePrintLogs';
import { PrintAttempt, PrintAttemptStatus } from '@/modelTypes/orderItem';
import { PrintLog } from '@/modelTypes/printLog';
import { User } from '@/modelTypes/user';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/shared/card/card';
import { Badge } from '@/components/shared/badge/badge';
import { Button } from '@/components/shared/button/Button';
import Loader from '@/components/shared/Loader/Loader';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileText,
  History,
  MapPin,
  Package,
  Printer,
  ShieldCheck,
  ShieldAlert,
  User as UserIcon,
  XCircle,
} from 'lucide-react';
import { aFecha, formatDateTime } from '@/shared/utils/dateHelpers';
import { getDisplayOrderNumber } from '@/shared/utils/orderNumber';

const STATUS_LABELS: Record<
  PrintAttemptStatus,
  { label: string; color: string }
> = {
  success: { label: 'OK', color: 'bg-ok/10 text-ok border-ok/20' },
  skipped: { label: 'Omitido', color: 'bg-elevated text-dim border-line' },
  queued: {
    label: 'Encolado',
    color: 'bg-brand/10 text-brand border-brand/20',
  },
  service_down: {
    label: 'Servicio caído',
    color: 'bg-danger/10 text-danger border-danger/20',
  },
  network_error: {
    label: 'Error de red',
    color: 'bg-danger/10 text-danger border-danger/20',
  },
  http_500: {
    label: 'Error HTTP 500',
    color: 'bg-danger/10 text-danger border-danger/20',
  },
  printer_offline: {
    label: 'Impresora offline',
    color: 'bg-danger/10 text-danger border-danger/20',
  },
  printer_paper_out: {
    label: 'Sin papel',
    color: 'bg-accent/10 text-accent border-accent/20',
  },
  printer_error: {
    label: 'Error de impresora',
    color: 'bg-danger/10 text-danger border-danger/20',
  },
  exception: {
    label: 'Exception',
    color: 'bg-danger/10 text-danger border-danger/20',
  },
};

export default function OrderDetailsAuditPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = use(params);

  // React Query hooks
  const { data: orderData, isLoading: orderLoading } = useOrder(orderId);
  const { data: usersData = [], isLoading: usersLoading } = useUsers();

  const {
    data: printLogsRaw = [],
    isLoading: logsLoading,
    refetch: refetchLogs,
  } = usePrintLogs(orderId);

  const loading = orderLoading || usersLoading || logsLoading;
  const error = !loading && !orderData ? 'Orden no encontrada' : null;

  const printLogs = useMemo(
    () =>
      [...printLogsRaw].sort((a: PrintLog, b: PrintLog) => {
        const dateA = aFecha(a.createdAt).getTime();
        const dateB = aFecha(b.createdAt).getTime();
        return dateB - dateA;
      }),
    [printLogsRaw],
  );

  const usersById = useMemo(() => {
    const userMap = new Map<string, User>();
    for (const u of usersData) userMap.set(u.id, u);
    return userMap;
  }, [usersData]);

  if (loading) {
    return <Loader fullScreen text="Cargando auditoria..." size="lg" />;
  }

  if (error || !orderData) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-16 h-16 text-danger mx-auto mb-4" />
            <p className="text-lg font-semibold text-content mb-2">
              {error || 'Orden no encontrada'}
            </p>
            <Link href="/private/orders">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver a órdenes
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calcular estadisticas
  const items = orderData.items || [];
  const itemsWithFullPrint = items.filter(
    (i) => (i.printedQty ?? 0) >= i.quantity,
  );
  const itemsPartialOrNoPrint = items.filter(
    (i) => (i.printedQty ?? 0) < i.quantity,
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-page via-surface to-elevated p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Link href="/private/orders">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-content flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-brand" />
                Auditoría de orden
              </h1>
              <p className="text-sm text-dim font-mono">
                {getDisplayOrderNumber(orderData)} ·{' '}
                {orderData.tableName ?? orderData.sector ?? 'Sin ubicación'}
              </p>
            </div>
          </div>
          <Button
            onClick={() => void refetchLogs()}
            variant="outline"
            size="sm"
          >
            <History className="w-4 h-4 mr-1.5" />
            Refrescar
          </Button>
        </div>

        {/* Resumen */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card>
            <CardContent className="p-4">
              <p className="text-[10px] text-dim uppercase font-semibold">
                Total items
              </p>
              <p className="text-2xl font-bold text-content">{items.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-[10px] text-ok uppercase font-semibold">
                Impresos OK
              </p>
              <p className="text-2xl font-bold text-ok">
                {itemsWithFullPrint.length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-[10px] text-danger uppercase font-semibold">
                Sin confirmar
              </p>
              <p className="text-2xl font-bold text-danger">
                {itemsPartialOrNoPrint.length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-[10px] text-brand uppercase font-semibold">
                Intentos
              </p>
              <p className="text-2xl font-bold text-dim">{printLogs.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Items con tracking */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="w-5 h-5 text-brand" />
              Items de la orden
              <Badge variant="secondary" className="ml-auto">
                {items.length} items
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-elevated border-y border-line">
                  <tr>
                    <th className="text-left px-4 py-2 font-semibold text-dim">
                      Producto
                    </th>
                    <th className="text-center px-3 py-2 font-semibold text-dim">
                      Cant
                    </th>
                    <th className="text-center px-3 py-2 font-semibold text-dim">
                      Enviado
                    </th>
                    <th className="text-center px-3 py-2 font-semibold text-dim">
                      Impreso ✓
                    </th>
                    <th className="text-left px-3 py-2 font-semibold text-dim">
                      Estado
                    </th>
                    <th className="text-left px-3 py-2 font-semibold text-dim">
                      Agregado por
                    </th>
                    <th className="text-left px-3 py-2 font-semibold text-dim">
                      Última impresión
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const sentQty = item.sentQty ?? 0;
                    const printedQty = item.printedQty ?? 0;
                    const isFullyPrinted = printedQty >= item.quantity;
                    const hasMismatch = sentQty > printedQty;
                    const addedByUser = item.addedBy
                      ? usersById.get(item.addedBy)
                      : undefined;

                    return (
                      <tr
                        key={`${item.productId}-${idx}`}
                        className={`border-b border-line ${
                          hasMismatch ? 'bg-danger/5' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-content">
                            {item.name}
                          </div>
                          {item.station && (
                            <div className="text-[10px] text-dim uppercase">
                              {item.station}
                            </div>
                          )}
                        </td>
                        <td className="text-center px-3 py-3 font-semibold text-content">
                          {item.quantity}
                        </td>
                        <td className="text-center px-3 py-3 text-dim">
                          {sentQty}
                        </td>
                        <td
                          className={`text-center px-3 py-3 font-bold ${
                            isFullyPrinted ? 'text-ok' : 'text-danger'
                          }`}
                        >
                          {printedQty}
                        </td>
                        <td className="px-3 py-3">
                          {isFullyPrinted ? (
                            <Badge variant="success" className="text-[10px]">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Confirmado
                            </Badge>
                          ) : hasMismatch ? (
                            <Badge
                              variant="destructive"
                              className="text-[10px]"
                            >
                              <ShieldAlert className="w-3 h-3 mr-1" />
                              No confirmado
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">
                              Sin enviar
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {addedByUser ? (
                            <div className="flex items-center gap-1 text-dim">
                              <UserIcon className="w-3 h-3 text-dim" />
                              <span className="text-xs">
                                {addedByUser.name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-dim">—</span>
                          )}
                          {item.addedAt && (
                            <div className="text-[10px] text-dim mt-0.5">
                              {formatDateTime(item.addedAt)}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {item.printedAt ? (
                            <div className="text-xs text-dim">
                              {formatDateTime(item.printedAt)}
                            </div>
                          ) : (
                            <span className="text-xs text-dim">Nunca</span>
                          )}
                          {item.printAttempts &&
                            item.printAttempts.length > 0 && (
                              <div className="text-[10px] text-dim mt-0.5">
                                {item.printAttempts.length} intento
                                {item.printAttempts.length === 1 ? '' : 's'}
                              </div>
                            )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Timeline de print attempts por item */}
        {items.some((i) => i.printAttempts && i.printAttempts.length > 0) && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <History className="w-5 h-5 text-brand" />
                Historial de impresión por item
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {items
                  .filter((i) => i.printAttempts && i.printAttempts.length > 0)
                  .map((item, idx) => (
                    <div
                      key={`audit-${idx}`}
                      className="border-l-4 border-line pl-4"
                    >
                      <p className="font-semibold text-sm text-content mb-1">
                        {item.quantity}× {item.name}
                      </p>
                      <div className="space-y-1.5">
                        {(item.printAttempts ?? []).map((attempt, aIdx) => (
                          <PrintAttemptRow key={aIdx} attempt={attempt} />
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Print logs (audit trail permanente) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="w-5 h-5 text-brand" />
              Audit trail (printLogs)
              <Badge variant="secondary" className="ml-auto">
                {printLogs.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {printLogs.length === 0 ? (
              <p className="text-center text-sm text-dim py-6">
                No hay logs de impresión registrados para esta orden
              </p>
            ) : (
              <div className="space-y-3">
                {printLogs.map((log) => (
                  <PrintLogCard key={log.id} log={log} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────

function PrintAttemptRow({ attempt }: { attempt: PrintAttempt }) {
  const status = STATUS_LABELS[attempt.status];
  const isError =
    attempt.status !== 'success' &&
    attempt.status !== 'skipped' &&
    attempt.status !== 'queued';

  return (
    <div className="flex items-start gap-2 text-xs">
      <div className="flex-shrink-0 mt-0.5">
        {attempt.status === 'success' ? (
          <CheckCircle2 className="w-4 h-4 text-ok" />
        ) : isError ? (
          <XCircle className="w-4 h-4 text-danger" />
        ) : (
          <Clock className="w-4 h-4 text-dim" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${status.color}`}
          >
            {status.label}
          </span>
          <span className="text-dim">
            {attempt.qty}× → {attempt.station}
          </span>
          {attempt.via && (
            <span className="text-[10px] text-dim">via {attempt.via}</span>
          )}
        </div>
        {attempt.errorMessage && (
          <p className="text-danger text-[11px] mt-0.5 font-mono">
            {attempt.errorMessage}
          </p>
        )}
        <p className="text-[10px] text-dim mt-0.5">
          {formatDateTime(attempt.at)} · ID: {attempt.attemptId.slice(0, 8)}
        </p>
      </div>
    </div>
  );
}

function PrintLogCard({ log }: { log: PrintLog }) {
  const status = STATUS_LABELS[log.status];
  const isError =
    log.status !== 'success' &&
    log.status !== 'skipped' &&
    log.status !== 'queued';

  return (
    <div
      className={`border rounded-lg p-3 ${
        isError ? 'border-danger/20 bg-danger/5' : 'border-line bg-surface'
      }`}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Printer className="w-4 h-4 text-dim" />
          <Badge variant="secondary" className="text-[10px] uppercase">
            {log.type}
          </Badge>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${status.color}`}
          >
            {status.label}
          </span>
          {log.via && (
            <span className="text-[10px] text-dim">via {log.via}</span>
          )}
        </div>
        <span className="text-[10px] text-dim font-mono">
          {formatDateTime(log.requestAt)}
        </span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-dim mb-2">
        {log.waiterName && (
          <span className="flex items-center gap-1">
            <UserIcon className="w-3 h-3" />
            {log.waiterName}
          </span>
        )}
        {log.tableName && (
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {log.tableName}
          </span>
        )}
        {log.durationMs != null && <span>{log.durationMs}ms</span>}
        {log.httpStatus != null && <span>HTTP {log.httpStatus}</span>}
      </div>

      <div className="text-[11px] text-dim mb-2">
        <strong>{log.itemsCount}</strong> item{log.itemsCount === 1 ? '' : 's'}:{' '}
        {log.items.map((i, idx) => (
          <span key={idx}>
            {idx > 0 && ', '}
            <strong>{i.qty}×</strong> {i.name}
            {i.station && <span className="text-dim"> ({i.station})</span>}
          </span>
        ))}
      </div>

      {log.errorMessage && (
        <div className="bg-danger/10 border border-danger/20 rounded px-2 py-1 mb-2">
          <p className="text-[11px] text-danger font-mono">
            {log.errorMessage}
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[9px] text-dim font-mono">
        <span>attempt: {log.attemptId.slice(0, 8)}</span>
        <span>hash: {log.requestHash.slice(0, 12)}</span>
        <span>logId: {log.id.slice(0, 8)}</span>
      </div>
    </div>
  );
}
