import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class BudgetItemDto {
  @ApiProperty({ example: 'prod-123' })
  @IsString()
  productId: string;

  @ApiProperty({ example: 'Almuerzo completo' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Incluye entrada, plato principal y postre' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 30 })
  @IsNumber()
  quantity: number;

  @ApiProperty({ example: 50 })
  @IsNumber()
  unitPrice: number;

  @ApiProperty({ example: 1500 })
  @IsNumber()
  total: number;
}

export class CreateBudgetDto {
  @ApiProperty({ example: 'PRESUP-001' })
  @IsString()
  budgetNumber: string;

  @ApiProperty({ example: 'Juan Pérez' })
  @IsString()
  customerName: string;

  @ApiPropertyOptional({ example: '+15550100' })
  @IsOptional()
  @IsString()
  customerPhone?: string;

  @ApiPropertyOptional({ example: 'juan@example.com' })
  @IsOptional()
  @IsString()
  customerEmail?: string;

  @ApiPropertyOptional({ example: 'J-90000003-0' })
  @IsOptional()
  @IsString()
  customerRif?: string;

  @ApiPropertyOptional({ example: 'V', description: 'V/E/J/G/P' })
  @IsOptional()
  @IsString()
  customerIdType?: string;

  @ApiPropertyOptional({ example: 'Av. Principal, Ciudad' })
  @IsOptional()
  @IsString()
  customerAddress?: string;

  @ApiPropertyOptional({ example: 'contribuyente_ordinario' })
  @IsOptional()
  @IsString()
  customerType?: string;

  @ApiProperty({ example: 'Evento Corporativo' })
  @IsString()
  eventName: string;

  @ApiPropertyOptional({ example: '2026-03-15' })
  @IsOptional()
  @IsDateString()
  eventDate?: Date;

  @ApiPropertyOptional({ example: 150 })
  @IsOptional()
  @IsNumber()
  eventGuests?: number;

  @ApiProperty({ type: [BudgetItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BudgetItemDto)
  items: BudgetItemDto[];

  @ApiProperty({ example: 5000 })
  @IsNumber()
  subtotal: number;

  @ApiProperty({ example: 500 })
  @IsNumber()
  serviceCharge: number;

  @ApiProperty({ example: 800 })
  @IsNumber()
  tax: number;

  @ApiProperty({ example: 'percentage' })
  @IsString()
  discountType: string;

  @ApiProperty({ example: 10 })
  @IsNumber()
  discountValue: number;

  @ApiProperty({ example: 500 })
  @IsNumber()
  discount: number;

  @ApiProperty({ example: 5800 })
  @IsNumber()
  total: number;

  @ApiPropertyOptional({ example: 'Incluye servicio de meseros' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: 'draft' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: '2026-03-10' })
  @IsOptional()
  @IsDateString()
  validUntil?: Date;

  @ApiProperty({ example: 'user-123' })
  @IsString()
  createdBy: string;

  @ApiPropertyOptional({ example: '69f167312854b87ee8b1494e' })
  @IsOptional()
  @IsString()
  invoiceId?: string;
}
