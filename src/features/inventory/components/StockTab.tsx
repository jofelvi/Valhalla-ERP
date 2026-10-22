import { TrendingUp } from 'lucide-react';
import Loader from '@/components/shared/Loader/Loader';
import {
  formatQuantity,
  calculateValorization,
} from '@/shared/utils/inventoryFormatters';
import { EnrichedStockItem } from '@/features/inventory/hooks/useEnrichedInventoryData';

interface StockTabProps {
  items: EnrichedStockItem[];
  isLoading: boolean;
  onTransfer: () => void;
  onWaste: () => void;
  onViewPriceHistory: (productId: string, productName: string) => void;
}

export function StockTab({
  items,
  isLoading,
  onTransfer,
  onWaste,
  onViewPriceHistory,
}: StockTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={onTransfer}
          className="px-4 py-2 rounded-lg bg-accent text-on-brand text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          Registrar Traslado
        </button>
        <button
          onClick={onWaste}
          className="px-4 py-2 rounded-lg bg-danger text-on-brand text-sm font-medium hover:bg-danger/90 transition-colors"
        >
          Registrar Merma
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader size="md" text="" fullScreen={false} />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-surface rounded-xl border border-line p-6 text-center">
          <p className="text-dim">Sin insumos en este almacén</p>
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-line overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-elevated/50">
                <tr className="border-b border-line">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-content">
                    Insumo
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-content">
                    Cantidad
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-content">
                    Valorización
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-content">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.productId}
                    className="border-b border-line hover:bg-elevated/30"
                  >
                    <td className="px-4 py-3 text-sm text-content">
                      {item.productName}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-content">
                      {item.qty < 0 ? (
                        <span className="text-danger">
                          {formatQuantity(Math.abs(item.qty), item.baseUnit)}{' '}
                          (revisar)
                        </span>
                      ) : (
                        formatQuantity(item.qty, item.baseUnit)
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-content">
                      {calculateValorization(
                        item.qty,
                        item.cost,
                        item.presentationQuantity ?? undefined,
                        item.baseUnit,
                        item.presentation,
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() =>
                          onViewPriceHistory(item.productId, item.productName)
                        }
                        className="text-accent hover:bg-accent/10 rounded p-1.5 transition-colors"
                        title="Ver histórico de precios"
                      >
                        <TrendingUp className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
