export const dynamic = 'force-dynamic';
import PurchaseOrderForm from '@/features/purchaseOrders/PurchaseOrderForm';
import BackIcon from '@/components/shared/BackButton/BackButton';
import { PRIVATE_ROUTES } from '@/shared';

export default function NewPurchaseOrderPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-page via-surface to-elevated">
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <BackIcon
            href={PRIVATE_ROUTES.PURCHASE_ORDERS}
            tooltip="Volver a Órdenes de Compra"
          />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-brand/10 to-ok/5 bg-clip-text text-transparent mt-4">
            Nueva Orden de Compra
          </h1>
          <p className="text-brand/80 mt-1">
            Crea una nueva orden de compra para tus proveedores
          </p>
        </div>
        <div className="bg-surface/90 backdrop-blur-sm shadow-xl rounded-2xl p-8 border border-line/50">
          <PurchaseOrderForm isNew />
        </div>
      </div>
    </div>
  );
}
