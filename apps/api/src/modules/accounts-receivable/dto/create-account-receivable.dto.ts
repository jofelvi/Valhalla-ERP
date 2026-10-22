import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsBoolean,
  IsArray,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAccountReceivableDto {
  @ApiPropertyOptional({ example: 'cust-123' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiProperty({ example: 'Juan Pérez' })
  @IsString()
  customerName: string;

  @ApiPropertyOptional({ example: 'ord-456' })
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiProperty({ example: 'INV-001' })
  @IsString()
  invoiceNumber: string;

  @ApiProperty({ example: 1500 })
  @IsNumber()
  amount: number;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @IsNumber()
  paidAmount?: number;

  @ApiProperty({ example: '2026-03-10' })
  @IsDateString()
  dueDate: Date;

  @ApiPropertyOptional({ example: 'pending' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 'Crédito por pedido #123' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isMerged?: boolean;

  @ApiPropertyOptional({ example: null })
  @IsOptional()
  @IsString()
  mergedIntoId?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isConsolidated?: boolean;

  @ApiPropertyOptional({ example: [] })
  @IsOptional()
  @IsArray()
  mergedAccountIds?: string[];

  @ApiPropertyOptional({ example: [] })
  @IsOptional()
  @IsArray()
  mergedOrderIds?: string[];

  @ApiPropertyOptional({ example: '2026-04-14T20:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  lastNotificationAt?: Date;

  @ApiPropertyOptional({ example: 'whatsapp' })
  @IsOptional()
  @IsString()
  lastNotificationChannel?: string;

  // Origen del cobro. Quien lo hizo (userId/email/fecha) NO se acepta del
  // cliente: el servicio lo escribe desde el JWT para que no se pueda falsear.
  @ApiPropertyOptional({
    example: 'PAYROLL',
    enum: ['CASH', 'PAYROLL', 'MANUAL'],
  })
  @IsOptional()
  @IsIn(['CASH', 'PAYROLL', 'MANUAL'])
  settlementSource?: 'CASH' | 'PAYROLL' | 'MANUAL';

  @ApiPropertyOptional({ example: 'payroll-123' })
  @IsOptional()
  @IsString()
  settlementPayrollId?: string;
}
