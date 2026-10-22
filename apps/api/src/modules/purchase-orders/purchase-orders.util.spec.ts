import { BadRequestException } from '@nestjs/common';
import { mapPurchaseOrderToCreatePurchaseDto } from './purchase-orders.util';
import { PurchaseOrder } from './schemas/purchase-order.schema';
import { ReceiveMerchandiseDto } from './dto/receive-merchandise.dto';

describe('purchase-orders.util', () => {
  const mockPurchaseOrder: PurchaseOrder = {
    _id: 'po-001',
    supplierId: 'sup-001',
    userId: 'user-001',
    supplierName: 'Distribuidora ABC',
    items: [
      {
        productId: 'prod-001',
        quantity: 50,
        unitCost: 5.0,
        subtotal: 250.0,
        productName: 'Producto A',
      },
      {
        productId: 'prod-002',
        quantity: 100,
        unitCost: 2.5,
        subtotal: 250.0,
        productName: 'Producto B',
      },
    ],
    totalAmount: 500.0,
    currency: 'USD',
    isPaid: false,
    status: 'PENDING',
    expectedDeliveryDate: new Date('2026-09-15'),
    receivedAt: undefined,
    imageUrl: undefined,
    createdAt: new Date('2026-09-14'),
    updatedAt: new Date('2026-09-14'),
  } as unknown as PurchaseOrder;

  describe('mapPurchaseOrderToCreatePurchaseDto', () => {
    it('debe mapear correctamente una recepción total', () => {
      const receiveMerchandiseDto: ReceiveMerchandiseDto = {
        receivedItems: [
          { productId: 'prod-001', quantityReceived: 50 },
          { productId: 'prod-002', quantityReceived: 100 },
        ],
      };

      const result = mapPurchaseOrderToCreatePurchaseDto(
        mockPurchaseOrder,
        receiveMerchandiseDto,
      );

      expect(result.placeId).toBe('sup-001');
      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toEqual({
        productId: 'prod-001',
        quantity: 50,
        unit: 'und',
        unitCost: 5.0,
        subtotal: 250.0,
      });
      expect(result.items[1]).toEqual({
        productId: 'prod-002',
        quantity: 100,
        unit: 'und',
        unitCost: 2.5,
        subtotal: 250.0,
      });
      expect(result.currency).toBe('USD');
    });

    it('debe mapear correctamente una recepción parcial', () => {
      const receiveMerchandiseDto: ReceiveMerchandiseDto = {
        receivedItems: [
          { productId: 'prod-001', quantityReceived: 30 },
          { productId: 'prod-002', quantityReceived: 50 },
        ],
      };

      const result = mapPurchaseOrderToCreatePurchaseDto(
        mockPurchaseOrder,
        receiveMerchandiseDto,
      );

      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toEqual({
        productId: 'prod-001',
        quantity: 30,
        unit: 'und',
        unitCost: 5.0,
        subtotal: 150.0,
      });
      expect(result.items[1]).toEqual({
        productId: 'prod-002',
        quantity: 50,
        unit: 'und',
        unitCost: 2.5,
        subtotal: 125.0,
      });
    });

    it('debe lanzar error si productId no existe en la orden', () => {
      const receiveMerchandiseDto: ReceiveMerchandiseDto = {
        receivedItems: [{ productId: 'prod-999', quantityReceived: 10 }],
      };

      expect(() =>
        mapPurchaseOrderToCreatePurchaseDto(
          mockPurchaseOrder,
          receiveMerchandiseDto,
        ),
      ).toThrow(BadRequestException);
      expect(() =>
        mapPurchaseOrderToCreatePurchaseDto(
          mockPurchaseOrder,
          receiveMerchandiseDto,
        ),
      ).toThrow('no existe en la orden de compra');
    });

    it('debe lanzar error si cantidad recibida es cero', () => {
      const receiveMerchandiseDto: ReceiveMerchandiseDto = {
        receivedItems: [{ productId: 'prod-001', quantityReceived: 0 }],
      };

      expect(() =>
        mapPurchaseOrderToCreatePurchaseDto(
          mockPurchaseOrder,
          receiveMerchandiseDto,
        ),
      ).toThrow(BadRequestException);
      expect(() =>
        mapPurchaseOrderToCreatePurchaseDto(
          mockPurchaseOrder,
          receiveMerchandiseDto,
        ),
      ).toThrow('Cantidad recibida');
    });

    it('debe lanzar error si cantidad recibida excede la cantidad ordenada', () => {
      const receiveMerchandiseDto: ReceiveMerchandiseDto = {
        receivedItems: [{ productId: 'prod-001', quantityReceived: 60 }],
      };

      expect(() =>
        mapPurchaseOrderToCreatePurchaseDto(
          mockPurchaseOrder,
          receiveMerchandiseDto,
        ),
      ).toThrow(BadRequestException);
      expect(() =>
        mapPurchaseOrderToCreatePurchaseDto(
          mockPurchaseOrder,
          receiveMerchandiseDto,
        ),
      ).toThrow('Máximo: 50');
    });

    it('debe preservar la moneda de la orden original', () => {
      const poBS = { ...mockPurchaseOrder, currency: 'BS' };
      const receiveMerchandiseDto: ReceiveMerchandiseDto = {
        receivedItems: [{ productId: 'prod-001', quantityReceived: 50 }],
      };

      const result = mapPurchaseOrderToCreatePurchaseDto(
        poBS,
        receiveMerchandiseDto,
      );

      expect(result.currency).toBe('BS');
    });

    it('no debe incluir fecha para permitir que el servicio use new Date()', () => {
      const receiveMerchandiseDto: ReceiveMerchandiseDto = {
        receivedItems: [{ productId: 'prod-001', quantityReceived: 50 }],
      };

      const result = mapPurchaseOrderToCreatePurchaseDto(
        mockPurchaseOrder,
        receiveMerchandiseDto,
      );

      expect(result.date).toBeUndefined();
    });
  });
});
