import { useCallback } from 'react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Order, OrderTypeEnum } from '../../../types';
import {
  orderService,
  productService,
  computePackaging,
  createPackagingItems,
  PACKAGING,
} from '../../../services';
import { toApiOrderItem } from '../../../services/orderItemPayload';
import { showAlert } from '../../../utils/alert';
import { RootStackParamList } from '../../../navigation/types';
import { useTarifas } from '../../../config/hooks';
import { tarifasDeOrden } from '../../../config/tarifasDeOrden';
import { totalesDeOrden } from '../../../config/totalesDeOrden';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface UseOrderActionsParams {
  order: Order | null;
  orderId: string;
  navigation: NavigationProp;
}

export const useOrderActions = ({
  order,
  orderId,
  navigation,
}: UseOrderActionsParams) => {
  const tarifasVigentes = useTarifas();
  const handleAddItems = useCallback(() => {
    if (!order) return;
    navigation.navigate('WaiterCreateOrder', {
      orderId: order.id,
      existingItems: JSON.stringify(order.items),
      tableId: order.tableId ?? undefined,
      tableName: order.tableName ?? undefined,
      sector: order.sector ?? undefined,
    });
  }, [order, navigation]);

  const handleToggleTakeaway = useCallback(async () => {
    if (!order) return;
    const newType =
      order.orderType === OrderTypeEnum.Takeaway
        ? order.sector
          ? OrderTypeEnum.Zone
          : OrderTypeEnum.DineIn
        : OrderTypeEnum.Takeaway;

    try {
      if (newType === OrderTypeEnum.Takeaway) {
        // Cambiar a "Para llevar": calcular y agregar envases
        const products = await productService.getActiveProducts();
        const productMap = new Map(products.map((p) => [p.id, p]));

        // Crear lookup para computePackaging
        const productLookup = (productId: string) => {
          const p = productMap.get(productId);
          if (!p) return undefined;
          return {
            categoryId: p.categoryId,
            station: p.station,
            name: p.name,
          };
        };

        // Calcular packaging (excluyendo items de packaging ya presentes)
        const nonPackagingItems = order.items.filter(
          (item) =>
            item.productId !== PACKAGING.envase.productId &&
            item.productId !== PACKAGING.cajaPizza.productId,
        );
        const packagingResult = computePackaging(
          nonPackagingItems,
          productLookup,
        );
        const packagingItemsToAdd = createPackagingItems(packagingResult);

        // Agregar items de packaging
        const updatedItems = [...order.items, ...packagingItemsToAdd];
        const t = totalesDeOrden(
          updatedItems,
          !!order.waiterId,
          tarifasDeOrden(order, tarifasVigentes),
        );

        await orderService.updateOrder(orderId, {
          orderType: newType,
          items: updatedItems.map(toApiOrderItem),
          subtotal: t.subtotal,
          serviceCharge: t.serviceCharge,
          total: t.total,
          updatedAt: new Date(),
        });
      } else {
        // Cambiar a "En local": eliminar items de packaging con deliveredQty === 0
        const packagingIds = new Set([
          PACKAGING.envase.productId,
          PACKAGING.cajaPizza.productId,
        ]);
        const updatedItems = order.items.filter(
          (item) =>
            !packagingIds.has(item.productId) || (item.deliveredQty ?? 0) > 0,
        );
        const t = totalesDeOrden(
          updatedItems,
          !!order.waiterId,
          tarifasDeOrden(order, tarifasVigentes),
        );

        await orderService.updateOrder(orderId, {
          orderType: newType,
          items: updatedItems.map(toApiOrderItem),
          subtotal: t.subtotal,
          serviceCharge: t.serviceCharge,
          total: t.total,
          updatedAt: new Date(),
        });
      }
    } catch {
      showAlert('Error', 'No se pudo cambiar el tipo de pedido');
    }
  }, [order, orderId, tarifasVigentes]);

  return {
    handleAddItems,
    handleToggleTakeaway,
  };
};
