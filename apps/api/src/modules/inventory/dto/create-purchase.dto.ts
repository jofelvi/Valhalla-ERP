import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';

export const PURCHASE_UNITS = [
  'kg',
  'gr',
  'l',
  'ml',
  'und',
  'unidad-compra',
] as const;
export type PurchaseUnit = (typeof PURCHASE_UNITS)[number];

export const PURCHASE_CURRENCIES = ['USD', 'BS'] as const;
export type PurchaseCurrency = (typeof PURCHASE_CURRENCIES)[number];

export class PurchaseItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @IsPositive()
  quantity: number;

  @IsIn(PURCHASE_UNITS as unknown as string[])
  unit: PurchaseUnit;

  /**
   * Costo unitario (USD o Bs según currency).
   * Alternativo a `lineTotal`: si vienen ambos, el backend rechaza.
   */
  @IsOptional()
  @IsNumber()
  @IsPositive()
  unitCost?: number;

  /**
   * Total de la línea (USD o Bs según currency).
   * Alternativo a `unitCost`: si unitCost falta, se calcula = lineTotal / quantity.
   * Usualmente enviado por la web (interfaz simplificada).
   */
  @IsOptional()
  @IsNumber()
  @IsPositive()
  lineTotal?: number;

  /**
   * Unidad de compra (ej: "caja", "kg", "und").
   * Si falta, se deriva de product.presentationQuantity + product.presentation.
   * Solo relevante si `unit === 'unidad-compra'`.
   */
  @IsOptional()
  @IsString()
  purchaseUnit?: string;

  /**
   * Renglon crudo de la factura del que salio este item. Si viene, al guardar
   * la compra se aprende el alias: la proxima factura de este proveedor
   * reconoce el renglon sola. Lo manda la pantalla de OCR.
   */
  @IsOptional()
  @IsString()
  invoiceText?: string;

  /** Unidades por bulto confirmadas por el usuario, para respaldar al OCR. */
  @IsOptional()
  @IsNumber()
  @IsPositive()
  unitsPerPack?: number;
}

export class CreatePurchaseDto {
  /** Categoria del gasto (insumos de cocina, bebidas, limpieza...). */
  @IsOptional()
  @IsString()
  category?: string;

  @IsString()
  @IsNotEmpty()
  placeId: string;

  @IsOptional()
  @IsISO8601()
  date?: string; // default: ahora

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items: PurchaseItemDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  invoiceUrls?: string[];

  @IsOptional()
  @IsString()
  warehouseId?: string; // default: isDefault del área GENERAL

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsIn(PURCHASE_CURRENCIES as unknown as string[])
  currency?: PurchaseCurrency; // default: 'USD' en service

  @IsOptional()
  @IsNumber()
  @IsPositive()
  bcvRate?: number; // obligatoria si currency === 'BS'

  // Idempotencia: id único de esta compra. Si se reintenta con el mismo
  // clientRequestId, el backend devuelve la compra existente (no duplica).
  @IsOptional()
  @IsString()
  clientRequestId?: string;
}
