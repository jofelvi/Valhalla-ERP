import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsEnum,
  IsDate,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CurrencyEnum, PurchaseOrderStatusEnum } from '@odin6/types';
import { Type } from 'class-transformer';

export class CreatePurchaseOrderDto {
  @ApiProperty({ example: 'sup-001' })
  @IsString()
  supplierId: string;

  @ApiProperty({ example: 'user-001' })
  @IsString()
  userId: string;

  @ApiProperty({ example: 'Distribuidora ABC' })
  @IsString()
  supplierName: string;

  @ApiProperty({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        productId: { type: 'string' },
        quantity: { type: 'number' },
        unitCost: { type: 'number' },
        subtotal: { type: 'number' },
        productName: { type: 'string' },
      },
    },
    example: [
      {
        productId: 'prod-001',
        quantity: 50,
        unitCost: 5.0,
        subtotal: 250.0,
        productName: 'Producto A',
      },
    ],
  })
  @IsArray()
  items: Array<{
    productId: string;
    quantity: number;
    unitCost: number;
    subtotal: number;
    productName?: string;
  }>;

  @ApiProperty({ example: 250.0 })
  @IsNumber()
  totalAmount: number;

  @ApiPropertyOptional({ enum: CurrencyEnum, default: CurrencyEnum.USD })
  @IsOptional()
  @IsEnum(CurrencyEnum)
  currency?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  isPaid?: boolean;

  @ApiPropertyOptional({
    enum: PurchaseOrderStatusEnum,
    default: PurchaseOrderStatusEnum.PENDING,
  })
  @IsOptional()
  @IsEnum(PurchaseOrderStatusEnum)
  status?: string;

  @ApiPropertyOptional({ example: '2026-04-20T00:00:00Z' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  expectedDeliveryDate?: Date;

  @ApiPropertyOptional({ example: 'https://...' })
  @IsOptional()
  @IsString()
  imageUrl?: string;
}
