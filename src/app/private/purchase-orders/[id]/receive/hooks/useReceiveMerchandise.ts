import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PurchaseOrder } from '@/features/supply-chain/types/purchaseOrderTypes';
import { Supplier } from '@/features/supply-chain/types/supplierTypes';
import { usePurchaseOrder } from '@/hooks/usePurchaseOrders';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useProducts } from '@/hooks/useProducts';
import { useToast } from '@/shared/hooks/useToast';
import { EnrichedPurchaseOrderItem, ReceiptFormData } from '../types';

interface UseReceiveMerchandiseReturn {
  purchaseOrder: PurchaseOrder | null;
  supplier: Supplier | null;
  loading: boolean;
  formItems: ReceiptFormData['items'];
}

/**
 * Hook que carga la orden de compra, proveedor y enriquece items
 * Maneja redirección si la orden no existe o no está en estado pendiente
 */
export const useReceiveMerchandise = (
  purchaseOrderId: string,
): UseReceiveMerchandiseReturn => {
  const router = useRouter();
  const { error } = useToast();

  const { data: purchaseOrderData, isLoading: isLoadingPO } =
    usePurchaseOrder(purchaseOrderId);
  const { data: productsData = [] } = useProducts();
  const { data: suppliersData = [] } = useSuppliers();

  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(
    null,
  );
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [formItems, setFormItems] = useState<ReceiptFormData['items']>([]);

  useEffect(() => {
    try {
      if (!purchaseOrderData) {
        if (!isLoadingPO) {
          error({ title: 'Orden de compra no encontrada' });
          router.push('/private/purchase-orders');
        }
        return;
      }

      // Verificar que la orden está en estado pendiente
      if (purchaseOrderData.status !== 'pending') {
        error({ title: 'Solo se pueden recibir órdenes pendientes' });
        router.push(`/private/purchase-orders/${purchaseOrderId}/details`);
        return;
      }

      setPurchaseOrder(purchaseOrderData);

      // Obtener información del proveedor
      const supplierData = suppliersData.find(
        (s) => s.id === purchaseOrderData.supplierId,
      );
      setSupplier(supplierData || null);

      // Enriquecer items con nombres de productos
      const enriched: EnrichedPurchaseOrderItem[] = purchaseOrderData.items.map(
        (item) => {
          const product = productsData.find((p) => p.id === item.productId);
          return {
            productId: item.productId,
            productName: product?.name || 'Producto no encontrado',
            quantity: item.quantity,
            unitPrice: item.unitCost,
            subtotal: item.subtotal,
            unit: 'unidad', // Default unit since Product doesn't have this property
          };
        },
      );

      // Inicializar formulario con datos de la orden
      const items: ReceiptFormData['items'] = enriched.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        orderedQuantity: item.quantity,
        receivedQuantity: item.quantity, // Por defecto, recibir todo
        orderedUnitPrice: item.unitPrice,
        receivedUnitPrice: item.unitPrice, // Por defecto, mismo precio
        unit: item.unit,
        notes: '',
      }));

      setFormItems(items);
      setLoading(false);
    } catch {
      error({ title: 'Error al cargar los datos' });
      router.push('/private/purchase-orders');
      setLoading(false);
    }
  }, [
    purchaseOrderData,
    isLoadingPO,
    suppliersData,
    productsData,
    purchaseOrderId,
    router,
    error,
  ]);

  return {
    purchaseOrder,
    supplier,
    loading,
    formItems,
  };
};
