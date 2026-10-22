'use client';
import Modal from '@/components/shared/modal';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  usePaymentReports,
  useUpdatePaymentReport,
} from '@/hooks/usePaymentReports';
import {
  useAccountsReceivableRecord,
  useUpdateAccountsReceivable,
} from '@/hooks/useAccountsReceivable';
import { useCreatePayment } from '@/hooks/usePayments';
import { InvoiceStatusEnum, PaymentStatusEnum } from '@/shared';
import { PaymentReport, PaymentReportStatusEnum } from '@odin6/types';
import { PRIVATE_ROUTES } from '@/shared/constantsRoutes/routes';
import { PaymentMethodEnum } from '@/shared/types/enumShared';
import { Badge } from '@/components/shared/badge/badge';
import { Card, CardContent } from '@/components/shared/card/card';
import { Button } from '@/components/shared/button/Button';
import Loader from '@/components/shared/Loader/Loader';
import {
  AlertCircle,
  Calendar,
  Check,
  Clock,
  DollarSign,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Phone,
  User,
  X,
} from 'lucide-react';
import { formatearUsdConMiles } from '@/shared/utils/dinero';

const paymentMethodLabels: Record<PaymentMethodEnum, string> = {
  [PaymentMethodEnum.CASH_USD]: 'Efectivo USD',
  [PaymentMethodEnum.CASH_BS]: 'Efectivo Bs',
  [PaymentMethodEnum.TRANSFER]: 'Transferencia',
  [PaymentMethodEnum.PAGO_MOVIL]: 'Pago Movil',
  [PaymentMethodEnum.PAGO_MOVIL_MANUAL]: 'Pago Movil Manual',
  [PaymentMethodEnum.CARD]: 'Tarjeta',
  [PaymentMethodEnum.MIXED]: 'Mixto',
  [PaymentMethodEnum.PENDING]: 'Pendiente',
  [PaymentMethodEnum.PAYROLL_DEDUCTION]: 'Deducción nómina',
};

const formatDateTime = (date: Date | string) => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return String(date);
  return d.toLocaleString('es-VE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDate = (date: Date | string) => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return String(date);
  return d.toLocaleDateString('es-VE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export default function PaymentReportsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<PaymentReportStatusEnum | 'all'>(
    PaymentReportStatusEnum.PENDING_REVIEW,
  );
  const [selectedReport, setSelectedReport] = useState<PaymentReport | null>(
    null,
  );
  const [processing, setProcessing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const { data: reports = [], isLoading } = usePaymentReports();
  const updatePaymentReport = useUpdatePaymentReport();
  const updateAccountsReceivable = useUpdateAccountsReceivable();
  const createPayment = useCreatePayment();
  const { data: selectedAccount } = useAccountsReceivableRecord(
    selectedReport?.accountReceivableId ?? '',
  );

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/public/login');
    }
  }, [status, router]);

  const sortedReports = useMemo(() => {
    return [...reports].sort(
      (a, b) =>
        new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime(),
    );
  }, [reports]);

  const filtered = useMemo(() => {
    return tab === 'all'
      ? sortedReports
      : sortedReports.filter((r) => r.status === tab);
  }, [tab, sortedReports]);

  const pendingCount = useMemo(() => {
    return reports.filter(
      (r) => r.status === PaymentReportStatusEnum.PENDING_REVIEW,
    ).length;
  }, [reports]);

  const approvedCount = useMemo(() => {
    return reports.filter((r) => r.status === PaymentReportStatusEnum.APPROVED)
      .length;
  }, [reports]);

  const rejectedCount = useMemo(() => {
    return reports.filter((r) => r.status === PaymentReportStatusEnum.REJECTED)
      .length;
  }, [reports]);

  const getStatusBadge = (s: PaymentReportStatusEnum) => {
    switch (s) {
      case PaymentReportStatusEnum.PENDING_REVIEW:
        return <Badge variant="warning">Pendiente</Badge>;
      case PaymentReportStatusEnum.APPROVED:
        return <Badge variant="success">Aprobado</Badge>;
      case PaymentReportStatusEnum.REJECTED:
        return <Badge variant="destructive">Rechazado</Badge>;
    }
  };

  const handleApprove = async (report: PaymentReport) => {
    if (
      !confirm(
        `Aprobar este reporte por ${formatearUsdConMiles(report.amount)}?`,
      )
    )
      return;
    setProcessing(true);
    try {
      // Ensure we have the account data
      if (!selectedAccount) {
        throw new Error('Cuenta por cobrar no encontrada');
      }

      // 2. Calcular nuevo paidAmount (acumula pagos parciales)
      const currentPaid = selectedAccount.paidAmount || 0;
      const newPaidAmount = Math.min(
        currentPaid + report.amount,
        selectedAccount.amount,
      );
      const remaining = selectedAccount.amount - newPaidAmount;

      let newStatus: InvoiceStatusEnum;
      if (remaining <= 0.01) {
        newStatus = InvoiceStatusEnum.PAID;
      } else if (newPaidAmount > 0) {
        newStatus = InvoiceStatusEnum.PARTIALLY_PAID;
      } else {
        newStatus = InvoiceStatusEnum.PENDING;
      }

      // 3. Actualizar la cuenta por cobrar
      await updateAccountsReceivable.mutateAsync({
        id: report.accountReceivableId,
        data: {
          paidAmount: newPaidAmount,
          status: newStatus,
          updatedAt: new Date(),
        },
      });

      // 4. Crear registro de pago para auditoria
      await createPayment.mutateAsync({
        orderId: selectedAccount.orderId ?? report.accountReceivableId,
        amount: report.amount,
        method: report.method,
        status: PaymentStatusEnum.PAID,
        notes:
          `Reporte de pago aprobado ${report.id}` +
          (report.reference ? ` — Ref: ${report.reference}` : ''),
        createdAt: new Date(report.paidAt),
        userId: 'payment-report-approval',
        ...(report.amountBs && report.amountBs > 0
          ? { expectedAmountBS: report.amountBs }
          : {}),
        ...(report.reference ? { transactionId: report.reference } : {}),
      });

      // 5. Marcar el reporte como aprobado
      await updatePaymentReport.mutateAsync({
        id: report.id,
        data: {
          status: PaymentReportStatusEnum.APPROVED,
          reviewedAt: new Date(),
        },
      });

      setSelectedReport(null);
    } catch (err) {
      alert(
        'Error al aprobar: ' +
          (err instanceof Error ? err.message : 'desconocido'),
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (report: PaymentReport) => {
    if (!rejectionReason.trim()) {
      alert('Ingresa un motivo de rechazo');
      return;
    }
    setProcessing(true);
    try {
      await updatePaymentReport.mutateAsync({
        id: report.id,
        data: {
          status: PaymentReportStatusEnum.REJECTED,
          reviewedAt: new Date(),
          rejectionReason,
        },
      });
      setSelectedReport(null);
      setRejectionReason('');
    } catch (err) {
      alert(
        'Error al rechazar: ' +
          (err instanceof Error ? err.message : 'desconocido'),
      );
    } finally {
      setProcessing(false);
    }
  };

  if (status === 'loading' || isLoading) {
    return <Loader fullScreen text="Cargando reportes..." />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-page via-surface to-elevated p-6">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-brand to-brand-light bg-clip-text text-transparent mb-1">
            Reportes de Pago
          </h1>
          <p className="text-brand/80 text-sm">
            Pagos reportados por clientes desde el link publico
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-surface/80 backdrop-blur-sm rounded-xl border border-accent/30 p-4 shadow-md">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-accent" />
              <span className="text-xs font-medium text-accent">
                Pendientes
              </span>
            </div>
            <p className="text-2xl font-bold text-accent">{pendingCount}</p>
          </div>
          <div className="bg-surface/80 backdrop-blur-sm rounded-xl border border-ok/30 p-4 shadow-md">
            <div className="flex items-center gap-2 mb-2">
              <Check className="w-4 h-4 text-ok" />
              <span className="text-xs font-medium text-ok">Aprobados</span>
            </div>
            <p className="text-2xl font-bold text-ok">{approvedCount}</p>
          </div>
          <div className="bg-surface/80 backdrop-blur-sm rounded-xl border border-danger/30 p-4 shadow-md">
            <div className="flex items-center gap-2 mb-2">
              <X className="w-4 h-4 text-danger" />
              <span className="text-xs font-medium text-danger">
                Rechazados
              </span>
            </div>
            <p className="text-2xl font-bold text-danger">{rejectedCount}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {[
            {
              value: PaymentReportStatusEnum.PENDING_REVIEW,
              label: 'Pendientes',
            },
            { value: PaymentReportStatusEnum.APPROVED, label: 'Aprobados' },
            { value: PaymentReportStatusEnum.REJECTED, label: 'Rechazados' },
            { value: 'all' as const, label: 'Todos' },
          ].map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.value
                  ? 'bg-brand text-on-brand'
                  : 'bg-surface text-dim hover:bg-elevated border border-line'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Lista */}
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-dim mx-auto mb-3" />
              <p className="text-dim">No hay reportes en esta categoria</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((report) => (
              <Card
                key={report.id}
                className="bg-surface/90 backdrop-blur-sm shadow-md hover:shadow-lg transition-all cursor-pointer"
                onClick={() => setSelectedReport(report)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 bg-gradient-to-br from-brand to-accent rounded-xl flex items-center justify-center shrink-0">
                        <DollarSign className="h-5 w-5 text-on-brand" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-bold text-content text-base">
                            #{report.invoiceNumber}
                          </h3>
                          {getStatusBadge(report.status)}
                          <Badge variant="secondary">
                            {paymentMethodLabels[report.method]}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1.5 text-dim text-sm mb-1">
                          <User className="w-3.5 h-3.5 text-dim" />
                          {report.customerName}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-dim">
                          <Calendar className="w-3 h-3" />
                          Reportado: {formatDateTime(report.reportedAt)}
                        </div>
                        {report.reference && (
                          <p className="text-xs text-dim mt-1">
                            Ref: {report.reference}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xl font-bold text-content">
                        {formatearUsdConMiles(report.amount)}
                      </p>
                      {report.amountBs && (
                        <p className="text-xs text-dim">
                          Bs. {report.amountBs.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Modal de detalle */}
      {selectedReport && (
        <Modal
          isOpen
          estiloPropio
          onClose={() => {
            setSelectedReport(null);
            setRejectionReason('');
          }}
          classNameFondo="bg-black/50 backdrop-blur-sm"
          classNameWrap="p-4"
          className="bg-surface rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        >
          <div className="flex items-center justify-between p-5 border-b border-line">
            <div>
              <h2 className="text-lg font-bold text-content">
                Reporte de Pago
              </h2>
              <p className="text-sm text-dim">
                #{selectedReport.invoiceNumber}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedReport(null);
                setRejectionReason('');
              }}
              className="p-2 rounded-lg hover:bg-elevated"
            >
              <X className="w-5 h-5 text-dim" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Estado */}
            <div>{getStatusBadge(selectedReport.status)}</div>

            {/* Datos del pago */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-dim mb-1">Monto USD</p>
                <p className="text-lg font-bold">
                  {formatearUsdConMiles(selectedReport.amount)}
                </p>
              </div>
              {selectedReport.amountBs && (
                <div>
                  <p className="text-xs text-dim mb-1">Monto Bs</p>
                  <p className="text-lg font-bold">
                    Bs. {selectedReport.amountBs.toFixed(2)}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-dim mb-1">Metodo</p>
                <p className="text-sm font-medium">
                  {paymentMethodLabels[selectedReport.method]}
                </p>
              </div>
              <div>
                <p className="text-xs text-dim mb-1">Fecha de pago</p>
                <p className="text-sm font-medium">
                  {formatDate(selectedReport.paidAt)}
                </p>
              </div>
              {selectedReport.reference && (
                <div>
                  <p className="text-xs text-dim mb-1">Referencia</p>
                  <p className="text-sm font-medium font-mono">
                    {selectedReport.reference}
                  </p>
                </div>
              )}
              {selectedReport.banco && (
                <div>
                  <p className="text-xs text-dim mb-1">Banco origen</p>
                  <p className="text-sm font-medium">{selectedReport.banco}</p>
                </div>
              )}
              {selectedReport.phone && (
                <div>
                  <p className="text-xs text-dim mb-1">Telefono</p>
                  <p className="text-sm font-medium">{selectedReport.phone}</p>
                </div>
              )}
              {selectedReport.cedula && (
                <div>
                  <p className="text-xs text-dim mb-1">Cedula</p>
                  <p className="text-sm font-medium">{selectedReport.cedula}</p>
                </div>
              )}
              {selectedReport.destinationAccount && (
                <div className="col-span-2">
                  <p className="text-xs text-dim mb-1">
                    Cuenta destino (a donde llego el pago)
                  </p>
                  <p className="text-sm font-medium text-ok">
                    {selectedReport.destinationAccount}
                  </p>
                </div>
              )}
            </div>

            {selectedReport.notes && (
              <div>
                <p className="text-xs text-dim mb-1">Notas</p>
                <p className="text-sm bg-elevated rounded-lg p-3">
                  {selectedReport.notes}
                </p>
              </div>
            )}

            {/* Imagen del comprobante */}
            <div>
              <p className="text-xs text-dim mb-2 flex items-center gap-1">
                <ImageIcon className="w-3.5 h-3.5" />
                Comprobante
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedReport.proofImageUrl}
                alt="Comprobante"
                className="w-full max-h-96 object-contain rounded-lg border border-line bg-elevated"
              />
              <a
                href={selectedReport.proofImageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-brand hover:text-content flex items-center gap-1 mt-2"
              >
                <ExternalLink className="w-3 h-3" />
                Abrir en tamano completo
              </a>
            </div>

            {/* Reportante */}
            {(selectedReport.reporterName || selectedReport.reporterPhone) && (
              <div className="bg-elevated rounded-lg p-3 border border-brand/30">
                <p className="text-xs font-semibold text-brand mb-2">
                  Datos del reportante
                </p>
                {selectedReport.reporterName && (
                  <div className="flex items-center gap-1.5 text-sm text-brand mb-1">
                    <User className="w-3.5 h-3.5" />
                    {selectedReport.reporterName}
                  </div>
                )}
                {selectedReport.reporterPhone && (
                  <div className="flex items-center gap-1.5 text-sm text-brand">
                    <Phone className="w-3.5 h-3.5" />
                    {selectedReport.reporterPhone}
                  </div>
                )}
              </div>
            )}

            {/* Link a la cuenta */}
            <Link
              href={PRIVATE_ROUTES.ACCOUNTS_RECEIVABLE_DETAILS(
                selectedReport.accountReceivableId,
              )}
              className="text-sm text-brand hover:text-content flex items-center gap-1"
            >
              <FileText className="w-4 h-4" />
              Ver cuenta por cobrar
            </Link>

            {/* Reason de rechazo */}
            {selectedReport.status ===
              PaymentReportStatusEnum.PENDING_REVIEW && (
              <div>
                <label className="block text-xs font-medium text-dim mb-1.5">
                  Motivo de rechazo (opcional)
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={2}
                  className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50 resize-none"
                  placeholder="Solo si vas a rechazar..."
                />
              </div>
            )}

            {selectedReport.rejectionReason && (
              <div className="bg-danger/10 border border-danger/30 rounded-lg p-3">
                <p className="text-xs font-semibold text-danger mb-1">
                  Motivo de rechazo
                </p>
                <p className="text-sm text-danger">
                  {selectedReport.rejectionReason}
                </p>
              </div>
            )}
          </div>

          {/* Acciones */}
          {selectedReport.status === PaymentReportStatusEnum.PENDING_REVIEW && (
            <div className="flex gap-2 p-4 border-t border-line">
              <Button
                type="button"
                variant="outline"
                className="flex-1 border-danger/30 text-danger hover:bg-danger/10"
                onClick={() => void handleReject(selectedReport)}
                disabled={processing}
              >
                <X className="w-4 h-4 mr-1.5" />
                Rechazar
              </Button>
              <Button
                type="button"
                className="flex-1 bg-gradient-to-r from-ok to-brand hover:from-ok/90 hover:to-brand/90"
                onClick={() => void handleApprove(selectedReport)}
                disabled={processing}
              >
                <Check className="w-4 h-4 mr-1.5" />
                Aprobar
              </Button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
