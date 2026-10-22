import { BadRequestException } from '@nestjs/common';
import { PurchaseOrder } from './schemas/purchase-order.schema';
import { ReceiveMerchandiseDto } from './dto/receive-merchandise.dto';
import {
  CreatePurchaseDto,
  PurchaseUnit,
} from '../inventory/dto/create-purchase.dto';

/**
 * Mapea una PurchaseOrder recibida a CreatePurchaseDto para PurchasesService.create().
 * Valida que todos los productIds estén en la orden y usa unitCost original.
 *
 * @param purchaseOrder Orden de compra original
 * @param receiveMerchandiseDto Datos de recepción (producto + cantidad recibida)
 * @returns CreatePurchaseDto listo para pasar a PurchasesService
 * @throws BadRequestException si productId no existe en la orden o cantidad es inválida
 */
export function mapPurchaseOrderToCreatePurchaseDto(
  purchaseOrder: PurchaseOrder,
  receiveMerchandiseDto: ReceiveMerchandiseDto,
): CreatePurchaseDto {
  // Validar que todos los productIds estén en la orden original
  const orderItemsByProductId = new Map(
    purchaseOrder.items.map((item) => [item.productId, item]),
  );

  // Validar y mapear items recibidos
  const createPurchaseItems = receiveMerchandiseDto.receivedItems.map(
    (received) => {
      const originalItem = orderItemsByProductId.get(received.productId);
      if (!originalItem) {
        throw new BadRequestException(
          `Producto ${received.productId} no existe en la orden de compra`,
        );
      }

      if (
        received.quantityReceived <= 0 ||
        received.quantityReceived > originalItem.quantity
      ) {
        throw new BadRequestException(
          `Cantidad recibida (${received.quantityReceived}) inválida para ${originalItem.productName || received.productId}. ` +
            `Máximo: ${originalItem.quantity}`,
        );
      }

      // El subtotal se recalcula en función de la cantidad recibida
      const receivedSubtotal =
        received.quantityReceived * originalItem.unitCost;

      return {
        productId: originalItem.productId,
        quantity: received.quantityReceived,
        unit: 'und' as PurchaseUnit, // Default: unidad genérica
        unitCost: originalItem.unitCost,
        subtotal: receivedSubtotal,
      };
    },
  );

  return {
    placeId: purchaseOrder.supplierId,
    items: createPurchaseItems,
    // Sin enviar 'date': el servicio usará new Date() automáticamente
    currency: (purchaseOrder.currency as 'USD' | 'BS') ?? 'USD',
    warehouseId: undefined, // Usar default general del servicio
    invoiceUrls: [],
    category: undefined, // No disponible en PurchaseOrder
  } as CreatePurchaseDto;
}
