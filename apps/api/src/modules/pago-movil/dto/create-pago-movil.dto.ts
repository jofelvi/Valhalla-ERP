import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class CreatePagoMovilDto {
  @ApiProperty({ example: 'order123', description: 'Order ID' })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({ example: '12345678', description: 'Reference number' })
  @IsString()
  @IsNotEmpty()
  referenceNumber: string;

  @ApiProperty({ example: '+15550100200', description: 'Phone number' })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @ApiProperty({
    example: '12345678',
    description: 'Cedula pagador',
    required: false,
  })
  @IsString()
  @IsOptional()
  cedulaPagador?: string;

  @ApiProperty({
    example: '0102',
    description: 'Banco origen',
    required: false,
  })
  @IsString()
  @IsOptional()
  bancoOrigen?: string;

  @ApiProperty({
    example: '2026-04-10',
    description: 'Fecha pago',
    required: false,
  })
  @IsString()
  @IsOptional()
  fechaPago?: string;

  @ApiProperty({
    example: 100,
    description: 'Expected amount USD',
    required: false,
  })
  @IsNumber()
  @IsOptional()
  expectedAmountUSD?: number;

  @ApiProperty({
    example: 3650,
    description: 'Expected amount BS',
    required: false,
  })
  @IsNumber()
  @IsOptional()
  expectedAmountBS?: number;

  @ApiProperty({ example: 36.5, description: 'BCV rate', required: false })
  @IsNumber()
  @IsOptional()
  bcvRate?: number;
}
