import { ClipboardList, BarChart3, Copy } from 'lucide-react';
import Loader from '@/components/shared/Loader/Loader';
import { Badge } from '@/components/shared/badge/badge';
import { formatearUsd } from '@/shared/utils/dinero';
import { ShoppingList } from '@odin6/types';

interface ShoppingListTabProps {
  shoppingList: ShoppingList | null | undefined;
  isLoading: boolean;
  isBuildingAiPlan: boolean;
  onBuildAiPlan: () => void;
  onCopyAiPlanToWhatsapp: () => void;
}

export function ShoppingListTab({
  shoppingList,
  isLoading,
  isBuildingAiPlan,
  onBuildAiPlan,
  onCopyAiPlanToWhatsapp,
}: ShoppingListTabProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader size="md" text="" fullScreen={false} />
      </div>
    );
  }

  if (!shoppingList) {
    return (
      <div className="bg-surface rounded-xl border border-line p-6 text-center">
        <ClipboardList className="h-12 w-12 mx-auto mb-4 text-dim" />
        <p className="text-dim">Sin lista de compras activa</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-elevated rounded-lg p-4 border border-line">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-content">Lista de Compras</h3>
          <Badge
            variant={
              shoppingList.status === 'PROPUESTA'
                ? 'warning'
                : shoppingList.status === 'APROBADA'
                  ? 'success'
                  : 'secondary'
            }
          >
            {shoppingList.status}
          </Badge>
        </div>
        <p className="text-xs text-dim">
          {shoppingList.items?.length || 0} items
          {shoppingList.purchasedCount &&
            ` • ${shoppingList.purchasedCount} comprados`}
        </p>
      </div>

      {/* AI Plan Button */}
      <button
        onClick={onBuildAiPlan}
        disabled={isBuildingAiPlan || (shoppingList.items?.length ?? 0) === 0}
        className="w-full px-4 py-2 rounded-lg bg-accent/10 text-accent text-sm font-medium hover:bg-accent/20 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
      >
        <BarChart3 className="h-4 w-4" />
        Organizar con IA
      </button>

      {shoppingList.items && shoppingList.items.length > 0 && (
        <div className="bg-surface rounded-xl border border-line overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-elevated/50">
                <tr className="border-b border-line">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-content">
                    Insumo
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-content">
                    Sugerido
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-content">
                    Ajustado
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-content">
                    Últs. $
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-content">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody>
                {shoppingList.items.map((item) => (
                  <tr
                    key={item.productId}
                    className="border-b border-line hover:bg-elevated/30"
                  >
                    <td className="px-4 py-3 text-sm text-content">
                      {item.productName}
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-dim">
                      {item.suggestedQty || '—'}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-content font-medium">
                      {item.adjustedQty}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-content">
                      {item.lastCost != null
                        ? formatearUsd(item.lastCost)
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.purchased && (
                        <Badge variant="success">✓ Comprado</Badge>
                      )}
                      {item.discarded && (
                        <Badge variant="secondary">Descartado</Badge>
                      )}
                      {!item.purchased && !item.discarded && (
                        <Badge variant="outline">Pendiente</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AI Plan Display */}
      {shoppingList.aiPlanByPlace && shoppingList.aiPlanByPlace.length > 0 && (
        <div className="space-y-4">
          <div className="bg-accent/10 rounded-lg p-4 border border-accent/30">
            <h3 className="font-semibold text-content mb-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-accent" />
              Plan de Compra Optimizado
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {shoppingList.aiPlanByPlace.map((group, idx) => (
                <div
                  key={idx}
                  className="bg-surface rounded-lg border border-line p-3"
                >
                  <p className="font-semibold text-content text-sm mb-2">
                    {group.placeName}
                  </p>
                  <div className="space-y-1 text-xs text-dim mb-2">
                    {group.items.map((item, i) => (
                      <div key={i} className="flex justify-between">
                        <span>{item.productName}</span>
                        <span>
                          {item.qty} {item.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 border-t border-line">
                    <p className="font-medium text-content text-sm">
                      Total: {formatearUsd(group.estimatedTotal)}
                    </p>
                    {group.savingsVsWorst > 0 && (
                      <p className="text-xs text-ok font-medium mt-1">
                        Ahorro: {formatearUsd(group.savingsVsWorst)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Summary */}
          {shoppingList.aiSummary && (
            <div className="bg-elevated rounded-lg p-4 border border-line">
              <p className="text-sm text-content whitespace-pre-wrap leading-relaxed">
                {shoppingList.aiSummary}
              </p>
            </div>
          )}

          {/* Copy to WhatsApp Button */}
          <button
            onClick={onCopyAiPlanToWhatsapp}
            className="w-full px-4 py-2 rounded-lg bg-accent/10 text-accent text-sm font-medium hover:bg-accent/20 transition-colors flex items-center justify-center gap-2"
          >
            <Copy className="h-4 w-4" />
            Copiar para WhatsApp
          </button>
        </div>
      )}
    </div>
  );
}
