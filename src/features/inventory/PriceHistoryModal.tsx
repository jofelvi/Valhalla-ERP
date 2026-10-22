'use client';
import Modal from '@/components/shared/modal';
import { useEffect, useCallback } from 'react';
import { XIcon, Loader2, TrendingDown } from 'lucide-react';
import { usePriceHistory, useBestPlaces } from '@/hooks/useInventory';
import { formatearUsd } from '@/shared/utils/dinero';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface PriceHistoryModalProps {
  productId: string;
  productName: string;
  onClose: () => void;
}

export default function PriceHistoryModal({
  productId,
  productName,
  onClose,
}: PriceHistoryModalProps) {
  const { data: priceHistory = [], isLoading } = usePriceHistory(productId, 50);
  const { data: bestPlaces = [] } = useBestPlaces([productId]);

  // Cerrar modal con Escape
  const handleEscapeKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    },
    [onClose, isLoading],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [handleEscapeKey]);

  const chartData = priceHistory
    .map((point) => ({
      date: new Date(point.date).toLocaleDateString('es-VE'),
      cost: point.unitCost,
      place: point.placeName,
    }))
    .reverse();

  const bestPlace = bestPlaces[0];
  const lastThreePrices = priceHistory.slice(0, 3).reverse();
  const avgPrice =
    lastThreePrices.length > 0
      ? lastThreePrices.reduce((sum, p) => sum + p.unitCost, 0) /
        lastThreePrices.length
      : 0;

  return (
    <Modal
      isOpen
      estiloPropio
      onClose={onClose}
      classNameFondo="bg-black/50"
      classNameWrap="p-4"
      className="bg-surface rounded-2xl border border-line shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
    >
      {/* Header */}
      <div className="sticky top-0 bg-surface border-b border-line p-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-content">
            Histórico de Precios
          </h2>
          <p className="text-sm text-dim mt-1">{productName}</p>
        </div>
        <button
          onClick={onClose}
          className="text-dim hover:text-content transition-colors"
        >
          <XIcon className="h-6 w-6" />
        </button>
      </div>

      {/* Body */}
      <div className="p-6 space-y-6">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-accent" />
          </div>
        ) : priceHistory.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-dim">Sin histórico de precios</p>
          </div>
        ) : (
          <>
            {/* Chart */}
            <div className="bg-elevated rounded-lg border border-line p-4">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border-line)"
                  />
                  <XAxis
                    dataKey="date"
                    stroke="var(--color-text-dim)"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis
                    stroke="var(--color-text-dim)"
                    style={{ fontSize: '12px' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--color-bg-surface)',
                      border: '1px solid var(--color-border-line)',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: 'var(--color-text-content)' }}
                    formatter={(value: number) => formatearUsd(value)}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="cost"
                    stroke="var(--color-text-accent)"
                    dot={false}
                    strokeWidth={2}
                    name="Costo por Unidad Base"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Best Place */}
            {bestPlace && (
              <div className="bg-ok/10 border border-ok rounded-lg p-4 flex items-start gap-3">
                <TrendingDown className="h-5 w-5 text-ok mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-content">Mejor Lugar</p>
                  <p className="text-sm text-content mt-1">
                    {bestPlace.bestPlaceName}:{' '}
                    <span className="font-bold text-ok">
                      {formatearUsd(bestPlace.bestCost)}
                    </span>
                  </p>
                  <p className="text-xs text-ok/70 mt-1">
                    Ahorro: {bestPlace.savingPct.toFixed(1)}% vs. último costo
                  </p>
                </div>
              </div>
            )}

            {/* Price Summary Table */}
            <div className="bg-elevated rounded-lg border border-line overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surface border-b border-line">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-content">
                      Lugar
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-content">
                      Último Costo
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-content">
                      Fecha
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {priceHistory.slice(0, 10).map((point, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-line hover:bg-surface/50"
                    >
                      <td className="px-4 py-3 text-content">
                        {point.placeName}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-content">
                        {formatearUsd(point.unitCost)}
                      </td>
                      <td className="px-4 py-3 text-right text-dim text-xs">
                        {new Date(point.date).toLocaleDateString('es-VE')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-elevated rounded-lg border border-line p-4 text-center">
                <p className="text-xs text-dim mb-1">
                  Costo Promedio (últimas 3)
                </p>
                <p className="text-lg font-bold text-accent">
                  {formatearUsd(avgPrice)}
                </p>
              </div>
              <div className="bg-elevated rounded-lg border border-line p-4 text-center">
                <p className="text-xs text-dim mb-1">Más Alto</p>
                <p className="text-lg font-bold text-danger">
                  {formatearUsd(
                    Math.max(...priceHistory.map((p) => p.unitCost)),
                  )}
                </p>
              </div>
              <div className="bg-elevated rounded-lg border border-line p-4 text-center">
                <p className="text-xs text-dim mb-1">Más Bajo</p>
                <p className="text-lg font-bold text-ok">
                  {formatearUsd(
                    Math.min(...priceHistory.map((p) => p.unitCost)),
                  )}
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 bg-surface border-t border-line p-6 flex justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg bg-accent text-on-brand hover:bg-accent/90 transition-colors text-sm font-medium"
        >
          Cerrar
        </button>
      </div>
    </Modal>
  );
}
