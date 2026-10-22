import { BadRequestException } from '@nestjs/common';
import { PurchaseItemDto } from './dto/create-purchase.dto';
import { roundMoney } from './units';

/**
 * Normaliza un item de compra: asegura que tenga unitCost derivado correctamente
 * de unitCost o lineTotal (pero no ambos).
 *
 * @param item Item del DTO
 * @param productId Para mensajes de error
 * @returns Item normalizado con unitCost en la moneda solicitada (USD o Bs según currency)
 */
export function normalizePurchaseItem(
  item: PurchaseItemDto,
  productId: string,
): {
  unitCost: number;
  quantity: number;
  unit: string;
  productId: string;
  invoiceText?: string;
  unitsPerPack?: number;
  purchaseUnit?: string;
} {
  const hasUnitCost = item.unitCost !== undefined && item.unitCost !== null;
  const hasLineTotal = item.lineTotal !== undefined && item.lineTotal !== null;

  // Validar que venga uno u otro, no ambos ni ninguno
  if (hasUnitCost && hasLineTotal) {
    throw new BadRequestException(
      `Item ${productId}: debe enviarse unitCost O lineTotal, no ambos`,
    );
  }
  if (!hasUnitCost && !hasLineTotal) {
    throw new BadRequestException(
      `Item ${productId}: falta unitCost o lineTotal`,
    );
  }

  // Derivar unitCost de lineTotal si es necesario
  const unitCost = hasLineTotal
    ? roundMoney(item.lineTotal! / item.quantity)
    : item.unitCost!;

  return {
    ...item,
    unitCost,
    quantity: item.quantity,
    unit: item.unit,
    productId: item.productId,
    invoiceText: item.invoiceText,
    unitsPerPack: item.unitsPerPack,
    purchaseUnit: item.purchaseUnit,
  };
}

/**
 * Convierte un item normalizado según la moneda.
 *
 * @param item Item normalizado
 * @param currency Moneda de la compra ('USD' o 'BS')
 * @param bcvRate Tasa de cambio (requerida si currency === 'BS')
 * @returns Item con unitCostUsd y unitCostBs (si aplica)
 */
export function convertPurchaseItemByRate(
  item: ReturnType<typeof normalizePurchaseItem>,
  currency: string,
  bcvRate: number | undefined,
): {
  unitCost: number;
  quantity: number;
  unit: string;
  productId: string;
  invoiceText?: string;
  unitsPerPack?: number;
  purchaseUnit?: string;
  unitCostUsd: number;
  unitCostBs?: number;
} {
  const unitCostUsd =
    currency === 'BS' && bcvRate ? item.unitCost / bcvRate : item.unitCost;
  const unitCostBs = currency === 'BS' ? item.unitCost : undefined;

  return {
    ...item,
    unitCostUsd,
    unitCostBs,
  };
}
