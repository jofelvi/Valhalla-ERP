import { BadRequestException } from '@nestjs/common';
import { normalizePurchaseItem, convertPurchaseItemByRate } from './purchases.util';
import { PurchaseItemDto } from './dto/create-purchase.dto';

describe('purchases.util', () => {
  describe('normalizePurchaseItem', () => {
    it('debe calcular unitCost desde lineTotal', () => {
      const item: PurchaseItemDto = {
        productId: 'prod-1',
        quantity: 10,
        unit: 'kg',
        lineTotal: 50,
      };

      const result = normalizePurchaseItem(item, 'prod-1');

      expect(result.unitCost).toBe(5);
      expect(result.quantity).toBe(10);
    });

    it('debe aceptar unitCost directamente', () => {
      const item: PurchaseItemDto = {
        productId: 'prod-1',
        quantity: 10,
        unit: 'kg',
        unitCost: 5,
      };

      const result = normalizePurchaseItem(item, 'prod-1');

      expect(result.unitCost).toBe(5);
    });

    it('debe rechazar si vienen ambos unitCost y lineTotal', () => {
      const item: PurchaseItemDto = {
        productId: 'prod-1',
        quantity: 10,
        unit: 'kg',
        unitCost: 5,
        lineTotal: 50,
      };

      expect(() => normalizePurchaseItem(item, 'prod-1')).toThrow(
        BadRequestException,
      );
    });

    it('debe rechazar si faltan ambos', () => {
      const item: PurchaseItemDto = {
        productId: 'prod-1',
        quantity: 10,
        unit: 'kg',
      };

      expect(() => normalizePurchaseItem(item, 'prod-1')).toThrow(
        BadRequestException,
      );
    });

    it('debe redondear correctamente al derivar desde lineTotal', () => {
      const item: PurchaseItemDto = {
        productId: 'prod-1',
        quantity: 3,
        unit: 'und',
        lineTotal: 10, // 10 / 3 = 3.333...
      };

      const result = normalizePurchaseItem(item, 'prod-1');

      // roundMoney devuelve 4 decimales: Math.round(n * 10000) / 10000
      expect(result.unitCost).toBe(3.3333);
    });

    it('debe preservar purchaseUnit si viene', () => {
      const item: PurchaseItemDto = {
        productId: 'prod-1',
        quantity: 36,
        unit: 'unidad-compra',
        unitCost: 12,
        purchaseUnit: 'caja',
      };

      const result = normalizePurchaseItem(item, 'prod-1');

      expect(result.purchaseUnit).toBe('caja');
    });

    it('debe preservar invoiceText', () => {
      const item: PurchaseItemDto = {
        productId: 'prod-1',
        quantity: 10,
        unit: 'kg',
        unitCost: 5,
        invoiceText: 'Cerveza Negra Lata',
      };

      const result = normalizePurchaseItem(item, 'prod-1');

      expect(result.invoiceText).toBe('Cerveza Negra Lata');
    });
  });

  describe('convertPurchaseItemByRate', () => {
    it('debe mantener unitCostUsd si currency es USD', () => {
      const item = {
        productId: 'prod-1',
        quantity: 10,
        unit: 'kg',
        unitCost: 5,
        invoiceText: undefined,
        unitsPerPack: undefined,
        purchaseUnit: undefined,
      };

      const result = convertPurchaseItemByRate(item, 'USD', undefined);

      expect(result.unitCostUsd).toBe(5);
      expect(result.unitCostBs).toBeUndefined();
    });

    it('debe convertir a USD si currency es BS', () => {
      const item = {
        productId: 'prod-1',
        quantity: 10,
        unit: 'kg',
        unitCost: 50, // 50 Bs
        invoiceText: undefined,
        unitsPerPack: undefined,
        purchaseUnit: undefined,
      };

      const result = convertPurchaseItemByRate(item, 'BS', 10);

      expect(result.unitCostUsd).toBe(5); // 50 / 10 = 5
      expect(result.unitCostBs).toBe(50);
    });

    it('debe guardar unitCostBs original cuando currency es BS', () => {
      const item = {
        productId: 'prod-1',
        quantity: 1,
        unit: 'und',
        unitCost: 100,
        invoiceText: undefined,
        unitsPerPack: undefined,
        purchaseUnit: undefined,
      };

      const result = convertPurchaseItemByRate(item, 'BS', 20);

      expect(result.unitCostBs).toBe(100);
      expect(result.unitCostUsd).toBe(5);
    });
  });
});
