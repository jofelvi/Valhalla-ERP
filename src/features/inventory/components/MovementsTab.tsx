import { Trash2 } from 'lucide-react';
import Loader from '@/components/shared/Loader/Loader';
import { Badge } from '@/components/shared/badge/badge';
import { MovementType } from '@odin6/types';
import { formatearUsd } from '@/shared/utils/dinero';
import {
  formatSignedQty,
  getMovementTypeBadge,
} from '@/shared/utils/inventoryFormatters';
import { EnrichedMovement } from '@/features/inventory/hooks/useEnrichedInventoryData';

const MANUAL_MOVEMENT_TYPES: MovementType[] = [
  'COMPRA',
  'TRASLADO',
  'MERMA_DECLARADA',
  'CONTEO_AJUSTE',
];

interface MovementsTabProps {
  movements: EnrichedMovement[];
  isLoading: boolean;
  onAnnul: (movementId: string) => void;
  isAnnulling: boolean;
}

export function MovementsTab({
  movements,
  isLoading,
  onAnnul,
  isAnnulling,
}: MovementsTabProps) {
  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader size="md" text="" fullScreen={false} />
        </div>
      ) : movements.length === 0 ? (
        <div className="bg-surface rounded-xl border border-line p-6 text-center">
          <p className="text-dim">Sin movimientos en este almacén</p>
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
                    Tipo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-content">
                    Insumo
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-content">
                    Cantidad
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-content">
                    Costo Total
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-content">
                    Notas
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-content">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => {
                  const badge = getMovementTypeBadge(movement.type);
                  const isManual = MANUAL_MOVEMENT_TYPES.includes(
                    movement.type,
                  );
                  const signed = formatSignedQty(
                    movement.qty,
                    movement.baseUnit,
                  );

                  return (
                    <tr
                      key={movement.id}
                      className={`border-b border-line hover:bg-elevated/30 ${
                        movement.type === 'ANULACION' ? 'opacity-50' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-xs text-dim">
                        {new Date(movement.createdAt).toLocaleDateString(
                          'es-VE',
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-content">
                        {movement.productName}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-medium ${
                          signed.isNegative ? 'text-danger' : 'text-ok'
                        }`}
                      >
                        {signed.text}
                      </td>
                      <td className="px-4 py-3 text-right text-content">
                        {formatearUsd(movement.totalCost)}
                      </td>
                      <td className="px-4 py-3 text-xs text-dim">
                        {movement.notes || '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isManual && movement.type !== 'ANULACION' && (
                          <button
                            onClick={() => onAnnul(movement.id)}
                            disabled={isAnnulling}
                            className="text-danger hover:bg-danger/10 rounded p-1.5 transition-colors"
                            title="Anular"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
