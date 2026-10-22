import { IsString, IsOptional, IsArray, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSupplierDto {
  @ApiProperty({ example: 'Distribuidora ABC' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Juan Pérez' })
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiPropertyOptional({ example: '+15550100' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'contact@abc.com' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: 'Calle Principal 123, Ciudad' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ type: [String], example: ['prod-001', 'prod-002'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  productIds?: string[];

  @ApiPropertyOptional({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        position: { type: 'string' },
        phone: { type: 'string' },
        email: { type: 'string' },
        isPrimaryContact: { type: 'boolean' },
        isDeliveryContact: { type: 'boolean' },
      },
    },
  })
  @IsOptional()
  @IsArray()
  contacts?: Array<{
    name: string;
    position?: string;
    phone?: string;
    email?: string;
    isPrimaryContact?: boolean;
    isDeliveryContact?: boolean;
  }>;

  @ApiPropertyOptional({
    type: 'object',
    properties: {
      preferredPaymentMethod: { type: 'string' },
      paymentTerms: { type: 'string' },
      creditLimit: { type: 'number' },
      taxId: { type: 'string' },
      bankAccount: { type: 'string' },
      bankName: { type: 'string' },
    },
  })
  @IsOptional()
  @IsObject()
  paymentInfo?: {
    preferredPaymentMethod?: string;
    paymentTerms?: string;
    creditLimit?: number;
    taxId?: string;
    bankAccount?: string;
    bankName?: string;
  };

  @ApiPropertyOptional({ example: 'https://www.abc.com' })
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional({ example: 'Proveedor confiable' })
  @IsOptional()
  @IsString()
  notes?: string;
}
