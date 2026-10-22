import { PurchaseOrder } from '@/features/supply-chain/types/purchaseOrderTypes';
import { Supplier } from '@/features/supply-chain/types/supplierTypes';
import BackButton from '@/components/shared/BackButton/BackButton';
import { Badge } from '@/components/shared/badge/badge';
import { PRIVATE_ROUTES } from '@/shared/constantsRoutes/routes';
import { formatearUsdConMiles } from '@/shared/utils/dinero';

interface ReceiveHeaderProps {
  purchaseOrder: PurchaseOrder;
  supplier: Supplier | null;
}

export const ReceiveHeader: React.FC<ReceiveHeaderProps> = ({
  purchaseOrder,
  supplier,
}) => {
  return (
    <div className="mb-8">
      <BackButton
        href={PRIVATE_ROUTES.PURCHASE_ORDERS_DETAILS(purchaseOrder.id)}
        className="mb-4"
      />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-content">Recibir Mercancía</h1>
          <p className="text-dim mt-1">
            Orden de Compra #{purchaseOrder.id.slice(-8)} -{' '}
            {supplier?.name || purchaseOrder.supplierName}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-brand/15 text-brand border border-brand/20">
            Total: {formatearUsdConMiles(purchaseOrder.totalAmount)}
          </Badge>
        </div>
      </div>
    </div>
  );
};
