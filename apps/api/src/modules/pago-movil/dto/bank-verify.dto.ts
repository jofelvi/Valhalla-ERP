import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class BankVerifyDto {
  @ApiProperty({
    example: '12345678',
    description: 'Número de referencia del Pago Móvil a verificar',
  })
  @IsString()
  @IsNotEmpty()
  referenceNumber: string;

  @ApiProperty({
    example: 3650.5,
    description: 'Monto esperado en Bolívares (Bs)',
  })
  @IsNumber()
  expectedAmountBS: number;

  @ApiProperty({
    example: '683f1a2b3c4d5e6f78901234',
    description:
      'ID del documento PagoMovil en BD a actualizar con el resultado (opcional)',
    required: false,
  })
  @IsString()
  @IsOptional()
  pagoMovilId?: string;
}
