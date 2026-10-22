import Loader from '@/components/shared/Loader/Loader';
import { Badge } from '@/components/shared/badge/badge';
import { formatearUsd } from '@/shared/utils/dinero';
import { Purchase } from '@odin6/types';

interface PurchasesTabProps {
  purchases: Purchase[];
  isLoading: boolean;
  onNewPurchase: () => void;
  onPlaces: () => void;
}

export function PurchasesTab({
  purchases,
  isLoading,
  onNewPurchase,
  onPlaces,
}: PurchasesTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={onNewPurchase}
          className="px-4 py-2 rounded-lg bg-accent text-on-brand text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          Registrar Compra
        </button>
        <button
          onClick={onPlaces}
          className="px-4 py-2 rounded-lg bg-elevated text-content text-sm font-medium hover:bg-elevated/80 transition-colors"
        >
          Lugares
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader size="md" text="" fullScreen={false} />
        </div>
      ) : purchases.length === 0 ? (
        <div className="bg-surface rounded-xl border border-line p-6 text-center">
          <p className="text-dim">Sin compras registradas</p>
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-line overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-elevated/50">
                <tr className="border-b border-line">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-content">
                    Fecha
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-content">
                    Lugar
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-content">
                    Items
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-content">
                    Total USD
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-content">
                    Alertas
                  </th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((purchase) => (
                  <tr
                    key={purchase.id}
                    className="border-b border-line hover:bg-elevated/30"
                  >
                    <td className="px-4 py-3 text-xs text-dim">
                      {new Date(purchase.date).toLocaleDateString('es-VE')}
                    </td>
                    <td className="px-4 py-3 text-sm text-content">
                      {purchase.placeName}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-content">
                      {purchase.items?.length || 0}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-content font-medium">
                      {formatearUsd(purchase.total)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {purchase.alerts && purchase.alerts.length > 0 && (
                        <Badge variant="warning">
                          ⚠ {purchase.alerts.length}
                        </Badge>
                      )}
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
