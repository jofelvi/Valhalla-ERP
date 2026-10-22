import { useRouter } from 'next/navigation';
import { PurchaseOrder } from '@/features/supply-chain/types/purchaseOrderTypes';
import { Button } from '@/components/shared/button/Button';
import { FilaDeResumen } from '@/components/shared/resumen/FilaDeResumen';
import { formatearUsdConMiles } from '@/shared/utils/dinero';
import { ReceiptFormData } from '../types';
import { calculateTotalReceived } from '../utils';

interface SidePanelProps {
  purchaseOrder: PurchaseOrder;
  itemCount: number;
  watchedItems: ReceiptFormData['items'] | undefined;
  saving: boolean;
  onSubmit: () => void;
}

export const SidePanel: React.FC<SidePanelProps> = ({
  purchaseOrder,
  itemCount,
  watchedItems,
  saving,
  onSubmit,
}) => {
  const router = useRouter();

  const totalReceived = calculateTotalReceived(watchedItems);

  return (
    <div className="space-y-6">
      {/* Resumen */}
      <div className="bg-surface rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-content mb-4">Resumen</h2>
        <div className="space-y-3">
          <FilaDeResumen
            className="text-dim"
            etiqueta="Items:"
            valor={itemCount}
          />
          <FilaDeResumen
            className="text-dim"
            etiqueta="Total Pedido:"
            valor={formatearUsdConMiles(purchaseOrder.totalAmount)}
          />
          <div className="flex justify-between text-dim">
            <span>Total Recibido:</span>
            <span>{formatearUsdConMiles(totalReceived)}</span>
          </div>
        </div>
      </div>

      {/* Acciones */}
      <div className="bg-surface rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-content mb-4">Acciones</h2>
        <div className="space-y-3">
          <Button
            type="submit"
            className="w-full"
            disabled={saving}
            onClick={onSubmit}
          >
            {saving ? 'Registrando...' : 'Registrar Recepción'}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() =>
              router.push(
                `/private/purchase-orders/${purchaseOrder.id}/details`,
              )
            }
          >
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
};
