import Loader from '@/components/shared/Loader/Loader';
import {
  formatQuantity,
  formatSignedQty,
} from '@/shared/utils/inventoryFormatters';
import { formatearUsd } from '@/shared/utils/dinero';
import { EnrichedCount } from '@/features/inventory/hooks/useEnrichedInventoryData';

interface CountsTabProps {
  counts: EnrichedCount[];
  isLoading: boolean;
  onNewCount: () => void;
}

export function CountsTab({ counts, isLoading, onNewCount }: CountsTabProps) {
  return (
    <div className="space-y-4">
      <button
        onClick={onNewCount}
        className="px-4 py-2 rounded-lg bg-accent text-on-brand text-sm font-medium hover:bg-accent/90 transition-colors"
      >
        Nuevo Conteo
      </button>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader size="md" text="" fullScreen={false} />
        </div>
      ) : counts.length === 0 ? (
        <div className="bg-surface rounded-xl border border-line p-6 text-center">
          <p className="text-dim">Sin conteos en este almacén</p>
        </div>
      ) : (
        <div className="space-y-3">
          {counts.map((count) => (
            <div
              key={count.id}
              className="bg-surface rounded-xl border border-line overflow-hidden"
            >
              <div className="p-4 border-b border-line bg-elevated/20 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-content">
                    Conteo {count.type.toLowerCase()}
                  </p>
                  <p className="text-xs text-dim">
                    {new Date(count.createdAt).toLocaleDateString('es-VE')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-content">
                    {count.items.length} items
                  </p>
                  <p
                    className={`text-sm font-medium ${count.totalDiffCost ? 'text-danger' : 'text-ok'}`}
                  >
                    {count.totalDiffCost
                      ? `-${formatearUsd(count.totalDiffCost)}`
                      : 'Sin diferencias'}
                  </p>
                </div>
              </div>

              {/* Count items */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-elevated/30">
                    <tr className="border-b border-line">
                      <th className="px-4 py-2 text-left font-semibold text-content">
                        Insumo
                      </th>
                      <th className="px-4 py-2 text-right font-semibold text-content">
                        Sistema
                      </th>
                      <th className="px-4 py-2 text-right font-semibold text-content">
                        Contado
                      </th>
                      <th className="px-4 py-2 text-right font-semibold text-content">
                        Diferencia
                      </th>
                      <th className="px-4 py-2 text-right font-semibold text-content">
                        Costo Diff.
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {count.items.map((item) => (
                      <tr key={item.productId} className="border-b border-line">
                        <td className="px-4 py-2 text-content">
                          {item.productName}
                        </td>
                        <td className="px-4 py-2 text-right text-dim">
                          {formatQuantity(item.systemQty, item.baseUnit)}
                        </td>
                        <td className="px-4 py-2 text-right text-content">
                          {formatQuantity(item.countedQty, item.baseUnit)}
                        </td>
                        <td
                          className={`px-4 py-2 text-right font-medium ${
                            item.diff < 0 ? 'text-danger' : 'text-ok'
                          }`}
                        >
                          {formatSignedQty(item.diff, item.baseUnit).text}
                        </td>
                        <td className="px-4 py-2 text-right text-content">
                          {item.diffCost ? formatearUsd(item.diffCost) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
