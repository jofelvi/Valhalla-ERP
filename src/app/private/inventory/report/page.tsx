'use client';
import { useState } from 'react';
import {
  BarChart3,
  AlertCircle,
  RotateCw,
  Send,
  ChevronLeft,
  TrendingDown,
} from 'lucide-react';
import Loader from '@/components/shared/Loader/Loader';
import { formatearUsd } from '@/shared/utils/dinero';
import {
  useWeeklyReports,
  useWeeklyReport,
  useGenerateReport,
  useRetryAi,
  useSendReportWhatsapp,
} from '@/hooks/useInventory';
import { WeeklyReport } from '@odin6/types';
import Link from 'next/link';
import { Panel } from '@/components/shared/panel/Panel';

export default function WeeklyReportPage() {
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const { data: reports = [], isLoading: reportsLoading } =
    useWeeklyReports(12);
  const { data: selectedReport } = useWeeklyReport(selectedReportId ?? '');
  const generateReport = useGenerateReport();
  const retryAi = useRetryAi(selectedReportId || '');
  const sendWhatsapp = useSendReportWhatsapp(selectedReportId || '');

  const displayReport = selectedReportId ? selectedReport : null;

  const handleGeneratePreviousWeek = async () => {
    try {
      await generateReport.mutateAsync();
      alert('Informe generado exitosamente');
    } catch (err) {
      alert(
        `Error: ${err instanceof Error ? err.message : 'Error al generar informe'}`,
      );
    }
  };

  const handleRetryAi = async () => {
    if (!selectedReportId) return;
    try {
      await retryAi.mutateAsync();
      alert('Narrativa IA regenerada');
    } catch (err) {
      alert(
        `Error: ${err instanceof Error ? err.message : 'Error al regenerar IA'}`,
      );
    }
  };

  const handleSendWhatsapp = async () => {
    if (!selectedReportId) return;
    try {
      const result = await sendWhatsapp.mutateAsync();
      if (result.sent) {
        alert('Informe enviado por WhatsApp exitosamente');
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (err) {
      alert(
        `Error: ${err instanceof Error ? err.message : 'Error al enviar WhatsApp'}`,
      );
    }
  };

  if (reportsLoading) {
    return <Loader size="lg" text="Cargando informes semanales..." />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-page via-surface to-elevated">
      <div className="w-full px-3 sm:px-4 lg:px-6 xl:px-8 py-4">
        {/* Header with back button */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/private/inventory"
            className="p-2 rounded-lg hover:bg-elevated transition-colors"
            title="Volver a Inventario"
          >
            <ChevronLeft className="h-5 w-5 text-content" />
          </Link>
          <h1 className="text-2xl font-bold text-content flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-accent" />
            Informe Semanal
          </h1>
        </div>

        {/* Selector + Generate button */}
        <Panel className="p-4 mb-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-dim mb-2">
                Seleccionar Informe
              </label>
              <select
                value={selectedReportId || ''}
                onChange={(e) => setSelectedReportId(e.target.value || null)}
                className="w-full px-3 py-2 rounded-lg border border-line bg-elevated text-content text-sm"
              >
                <option value="">-- Más recientes --</option>
                {reports.map((report) => (
                  <option key={report.id} value={report.id}>
                    {new Date(report.weekStart).toLocaleDateString('es-VE')} -{' '}
                    {new Date(report.weekEnd).toLocaleDateString('es-VE')}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleGeneratePreviousWeek}
              disabled={generateReport.isPending}
              className="px-4 py-2 rounded-lg bg-accent text-on-brand text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-40 self-start sm:self-auto"
            >
              Generar Semana Pasada
            </button>
          </div>
        </Panel>

        {!displayReport && reports.length === 0 ? (
          <div className="bg-surface rounded-xl border border-line p-12 text-center">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 text-dim" />
            <p className="text-dim mb-4">Sin informes disponibles</p>
            <button
              onClick={handleGeneratePreviousWeek}
              disabled={generateReport.isPending}
              className="px-4 py-2 rounded-lg bg-accent text-on-brand text-sm font-medium hover:bg-accent/90 disabled:opacity-40"
            >
              Generar Primer Informe
            </button>
          </div>
        ) : displayReport ? (
          <WeeklyReportDetail
            report={displayReport}
            onRetryAi={handleRetryAi}
            onSendWhatsapp={handleSendWhatsapp}
            isRetryingAi={retryAi.isPending}
            isSendingWhatsapp={sendWhatsapp.isPending}
          />
        ) : null}
      </div>
    </div>
  );
}

interface WeeklyReportDetailProps {
  report: WeeklyReport;
  onRetryAi: () => void;
  onSendWhatsapp: () => void;
  isRetryingAi: boolean;
  isSendingWhatsapp: boolean;
}

function WeeklyReportDetail({
  report,
  onRetryAi,
  onSendWhatsapp,
  isRetryingAi,
  isSendingWhatsapp,
}: WeeklyReportDetailProps) {
  const { kpis } = report;

  const foodCostColor =
    kpis.foodCost.foodCostPct !== null
      ? kpis.foodCost.foodCostPct < 30
        ? 'text-ok'
        : kpis.foodCost.foodCostPct > 35
          ? 'text-danger'
          : 'text-dim'
      : 'text-dim';

  const mermaPercentage =
    kpis.merma.pctSobreCompras !== null ? kpis.merma.pctSobreCompras : null;

  const mermaColor =
    mermaPercentage !== null
      ? mermaPercentage < 5
        ? 'text-ok'
        : mermaPercentage > 10
          ? 'text-danger'
          : 'text-dim'
      : 'text-dim';

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Ventas Totales"
          value={formatearUsd(kpis.ventas.totalUsd)}
          subtitle={`${kpis.ventas.ordenes} órdenes`}
        />
        <KpiCard
          label="Ticket Promedio"
          value={formatearUsd(kpis.ventas.ticketPromedio)}
          subtitle={
            kpis.ventas.vsSemanaAnterior.deltaPct != null
              ? `${kpis.ventas.vsSemanaAnterior.deltaPct >= 0 ? '+' : ''}${kpis.ventas.vsSemanaAnterior.deltaPct.toFixed(1)}% vs semana anterior`
              : 'Sin comparativo'
          }
        />
        <KpiCard
          label="Food Cost"
          value={`${kpis.foodCost.foodCostPct !== null ? kpis.foodCost.foodCostPct.toFixed(1) : '—'}%`}
          subtitle={`${formatearUsd(kpis.foodCost.consumoUsd)} consumo`}
          valueClassName={foodCostColor}
        />
        <KpiCard
          label="Merma Total"
          value={formatearUsd(kpis.merma.totalUsd)}
          subtitle={
            mermaPercentage !== null
              ? `${mermaPercentage.toFixed(1)}% sobre compras`
              : 'Sin datos de compras'
          }
          valueClassName={mermaColor}
        />
      </div>

      {/* Top Vendidos Table */}
      <div className="bg-surface rounded-xl border border-line overflow-hidden">
        <div className="bg-elevated/50 px-4 py-3 border-b border-line">
          <h3 className="font-semibold text-content">Top 10 Vendidos</h3>
        </div>
        {kpis.rentabilidad.topVendidos.length === 0 ? (
          <div className="px-4 py-6 text-center text-dim">
            Sin datos de ventas
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-elevated/30">
                <tr className="border-b border-line">
                  <th className="px-4 py-2 text-left font-semibold text-content">
                    Producto
                  </th>
                  <th className="px-4 py-2 text-right font-semibold text-content">
                    Unidades
                  </th>
                  <th className="px-4 py-2 text-right font-semibold text-content">
                    Ingreso
                  </th>
                  <th className="px-4 py-2 text-right font-semibold text-content">
                    Costo Receta
                  </th>
                  <th className="px-4 py-2 text-right font-semibold text-content">
                    Margen $
                  </th>
                  <th className="px-4 py-2 text-right font-semibold text-content">
                    Margen %
                  </th>
                </tr>
              </thead>
              <tbody>
                {kpis.rentabilidad.topVendidos.map((item, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-line hover:bg-elevated/30"
                  >
                    <td className="px-4 py-3 text-content">{item.name}</td>
                    <td className="px-4 py-3 text-right text-dim">
                      {item.unidades}
                    </td>
                    <td className="px-4 py-3 text-right text-content font-medium">
                      {formatearUsd(item.ingreso)}
                    </td>
                    <td className="px-4 py-3 text-right text-dim">
                      {item.costoReceta != null
                        ? formatearUsd(item.costoReceta)
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-content">
                      {item.margenPct != null
                        ? formatearUsd(item.ingreso - (item.costoReceta ?? 0))
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {item.margenPct != null
                        ? `${item.margenPct.toFixed(1)}%`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top Variaciones Table */}
      {kpis.compras.topVariaciones.length > 0 && (
        <div className="bg-surface rounded-xl border border-line overflow-hidden">
          <div className="bg-elevated/50 px-4 py-3 border-b border-line">
            <h3 className="font-semibold text-content flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Top Variaciones de Precio
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-elevated/30">
                <tr className="border-b border-line">
                  <th className="px-4 py-2 text-left font-semibold text-content">
                    Producto
                  </th>
                  <th className="px-4 py-2 text-right font-semibold text-content">
                    Costo Anterior
                  </th>
                  <th className="px-4 py-2 text-right font-semibold text-content">
                    Costo Nuevo
                  </th>
                  <th className="px-4 py-2 text-right font-semibold text-content">
                    Variación %
                  </th>
                </tr>
              </thead>
              <tbody>
                {kpis.compras.topVariaciones.map((item, idx) => (
                  <tr
                    key={idx}
                    className={`border-b border-line hover:bg-elevated/30 ${item.variationPct > 0 ? '' : ''}`}
                  >
                    <td className="px-4 py-3 text-content">{item.name}</td>
                    <td className="px-4 py-3 text-right text-dim">
                      ${item.prevCost.toFixed(4)}
                    </td>
                    <td className="px-4 py-3 text-right text-content">
                      ${item.newCost.toFixed(4)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        item.variationPct > 0 ? 'text-danger' : 'text-ok'
                      }`}
                    >
                      {item.variationPct > 0 ? '+' : ''}
                      {item.variationPct.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AI Summary Section */}
      <div className="bg-surface rounded-xl border border-line overflow-hidden">
        <div className="bg-elevated/50 px-4 py-3 border-b border-line flex items-center justify-between">
          <h3 className="font-semibold text-content">Análisis de IA</h3>
          {report.aiError && (
            <button
              onClick={onRetryAi}
              disabled={isRetryingAi}
              className="px-3 py-1 rounded text-xs bg-accent/10 text-accent hover:bg-accent/20 transition-colors disabled:opacity-40 flex items-center gap-1"
            >
              <RotateCw className="h-3 w-3" />
              Reintentar
            </button>
          )}
        </div>

        {report.aiError ? (
          <div className="px-4 py-4">
            <div className="flex gap-3 items-start p-3 rounded-lg bg-danger/10 border border-danger/30">
              <AlertCircle className="h-5 w-5 text-danger flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-danger text-sm">
                  IA pendiente de configurar
                </p>
                <p className="text-xs text-dim mt-1">{report.aiError}</p>
              </div>
            </div>
          </div>
        ) : report.aiSummary ? (
          <div className="px-4 py-4">
            <p className="text-sm text-content whitespace-pre-wrap leading-relaxed">
              {report.aiSummary}
            </p>
          </div>
        ) : (
          <div className="px-4 py-6 text-center text-dim text-sm">
            Generando análisis...
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 justify-end">
        <button
          onClick={onSendWhatsapp}
          disabled={isSendingWhatsapp || !report.aiSummary}
          className="px-4 py-2 rounded-lg bg-accent text-on-brand text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-40 flex items-center gap-2"
        >
          <Send className="h-4 w-4" />
          Enviar por WhatsApp
        </button>
      </div>
    </div>
  );
}

interface KpiCardProps {
  label: string;
  value: string;
  subtitle?: string;
  valueClassName?: string;
}

function KpiCard({
  label,
  value,
  subtitle,
  valueClassName = 'text-accent',
}: KpiCardProps) {
  return (
    <div className="bg-surface rounded-xl border border-line p-4">
      <p className="text-xs font-semibold text-dim mb-2">{label}</p>
      <p className={`text-2xl font-bold ${valueClassName}`}>{value}</p>
      {subtitle && <p className="text-xs text-dim mt-2">{subtitle}</p>}
    </div>
  );
}
