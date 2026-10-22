import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsEmail,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePaymentReportDto {
  @ApiProperty({ example: 'acc-123' })
  @IsString()
  accountReceivableId: string;

  @ApiPropertyOptional({ example: 'INV-001' })
  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @ApiPropertyOptional({ example: 'cust-123' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiProperty({ example: 'Juan Pérez' })
  @IsString()
  customerName: string;

  @ApiProperty({ example: 500 })
  @IsNumber()
  amount: number;

  @ApiPropertyOptional({ example: 10000 })
  @IsOptional()
  @IsNumber()
  amountBs?: number;

  @ApiProperty({ example: 'pago_movil' })
  @IsString()
  method: string;

  @ApiPropertyOptional({ example: 'REF-12345678' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ example: '+15550100' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'V-90000002-0' })
  @IsOptional()
  @IsString()
  cedula?: string;

  @ApiPropertyOptional({ example: 'Banco ejemplo' })
  @IsOptional()
  @IsString()
  banco?: string;

  @ApiPropertyOptional({ example: '01020304050607080910' })
  @IsOptional()
  @IsString()
  destinationAccount?: string;

  @ApiProperty({ example: '2026-02-10T14:30:00Z' })
  @IsDateString()
  paidAt: Date;

  @ApiPropertyOptional({ example: 'Pago recibido sin problemas' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ example: 'https://example.com/proof.jpg' })
  @IsString()
  proofImageUrl: string;

  @ApiPropertyOptional({ example: 'Juan' })
  @IsOptional()
  @IsString()
  reporterName?: string;

  @ApiPropertyOptional({ example: '+15550100' })
  @IsOptional()
  @IsString()
  reporterPhone?: string;
}
