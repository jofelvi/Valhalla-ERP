import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsEnum,
  IsBoolean,
  IsIn,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CurrencyEnum,
  ProductTypeEnum,
  ProductStationEnum,
} from '@odin6/types';

export class CreateProductDto {
  @ApiProperty({ example: 'Ceviche' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Ceviche de camarones fresco' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 25.99 })
  @IsNumber()
  // Un precio negativo se guardaba tal cual: se podia dejar un producto a
  // -$50 y cada venta habria REGALADO plata, con el margen saliendo > 100%.
  @Min(0, { message: 'El precio no puede ser negativo' })
  price: number;

  @ApiPropertyOptional({ enum: CurrencyEnum, default: CurrencyEnum.USD })
  @IsOptional()
  @IsEnum(CurrencyEnum)
  currency?: string;

  @ApiPropertyOptional({ enum: ProductTypeEnum, default: ProductTypeEnum.BASE })
  @IsOptional()
  @IsEnum(ProductTypeEnum)
  type?: string;

  @ApiPropertyOptional({ enum: ProductStationEnum })
  @IsOptional()
  @IsEnum(ProductStationEnum)
  station?: string;

  @ApiProperty({ example: 'cat-001' })
  @IsString()
  categoryId: string;

  // Subcategoría del insumo (opcional). Solo aplica a BASE; el servidor la
  // ignora/limpia para el resto de naturalezas.
  @ApiPropertyOptional({ example: 'cat-sub-001' })
  @IsOptional()
  @IsString()
  subcategoryId?: string;

  @ApiPropertyOptional({ type: [String], example: ['sup-001', 'sup-002'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  supplierIds?: string[];

  @ApiPropertyOptional({ example: 15.5 })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'El costo no puede ser negativo' })
  cost?: number;

  @ApiPropertyOptional({ example: 'CEV-001' })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional({ example: '5012345678901' })
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiPropertyOptional({
    example: ['5012345678901', 'TOBO-LATA-12'],
    description: 'Codigos adicionales (EAN + etiquetas propias impresas)',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  barcodes?: string[];

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsNumber()
  stock?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'El stock minimo no puede ser negativo' })
  minStock?: number;

  @ApiPropertyOptional({ example: 'Caja' })
  @IsOptional()
  @IsString()
  presentation?: string;

  @ApiPropertyOptional({ example: 24 })
  @IsOptional()
  @IsNumber()
  // El contenido divide el costo de la unidad de compra: en 0 o negativo
  // reventaria el costo por unidad de venta.
  @Min(0.0001, {
    message: 'El contenido de la unidad de compra debe ser mayor que 0',
  })
  presentationQuantity?: number;

  @ApiPropertyOptional({
    example: 0.12,
    description: 'Gramos del insumo por cada ml de la receta (peso ↔ volumen)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0.0001, { message: 'Los gramos por ml deben ser mayores que 0' })
  gramsPerMl?: number | null;

  @ApiPropertyOptional({
    example: 55,
    description: 'Gramos que pesa UNA unidad del insumo (contable ↔ peso)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0.0001, { message: 'Los gramos por unidad deben ser mayores que 0' })
  gramsPerUnit?: number | null;

  @ApiPropertyOptional({
    example: 355,
    description: 'ml que tiene UNA unidad del insumo (contable ↔ volumen)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0.0001, { message: 'Los ml por unidad deben ser mayores que 0' })
  mlPerUnit?: number | null;

  @ApiPropertyOptional({ example: 'https://...' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        productId: { type: 'string' },
        quantity: { type: 'number' },
        unit: { type: 'string' },
        wastePercentage: { type: 'number' },
      },
    },
  })
  @IsOptional()
  @IsArray()
  ingredients?: Array<{
    productId: string;
    quantity: number;
    unit: string;
    wastePercentage: number;
  }>;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  nivel?: number;

  @ApiPropertyOptional({
    example: false,
    description:
      'Si el producto es un insumo trackeable en inventario de cocina',
  })
  @IsOptional()
  @IsBoolean()
  isForInventory?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Si el producto está activo (visible/gestionable)',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Si el producto está disponible para la venta',
  })
  @IsOptional()
  @IsBoolean()
  isForSale?: boolean;

  @ApiPropertyOptional({ enum: ['COCINA', 'PIZZERIA', 'BARRA'] })
  @IsOptional()
  @IsIn(['COCINA', 'PIZZERIA', 'BARRA'])
  inventoryArea?: string;

  @ApiPropertyOptional({
    enum: ['ALTA', 'MEDIA', 'BAJA'],
    description:
      'Cuánto duele que falte. ALTA/MEDIA avisan "Agotado" en el POS; BAJA solo informa.',
  })
  @IsOptional()
  @IsIn(['ALTA', 'MEDIA', 'BAJA'])
  criticality?: string;

  @ApiPropertyOptional({
    description:
      'Naturaleza sin decidir (legacy). El servidor lo apaga al guardar una naturaleza.',
  })
  @IsOptional()
  @IsBoolean()
  naturalezaPendiente?: boolean;
}
