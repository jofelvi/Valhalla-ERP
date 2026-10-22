import {
  Max,
  Min,
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePagoComisionDto {
  @ApiProperty({ example: 'waiter-123' })
  @IsString()
  waiterId: string;

  @ApiProperty({ example: 'Juan Pérez' })
  @IsString()
  waiterName: string;

  @ApiPropertyOptional({ example: ['liq-1', 'liq-2'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiProperty({ example: ['ord-1', 'ord-2', 'ord-3'] })
  @IsArray()
  @IsString({ each: true })
  orderIds: string[];

  // Estos campos se aceptan opcionales: si no llegan del cliente, el servicio
  // los computa automaticamente a partir de orderIds + waiterId (montoTotal =
  // comision de cada orden con su tasa, tipTotal = sum(order.tipAmount), periodos = min/max
  // createdAt de las ordenes, fechaPago = ahora, usuarioPago del JWT).
  @ApiPropertyOptional({ example: 5000 })
  @IsOptional()
  @IsNumber()
  montoTotal?: number;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @IsNumber()
  tipTotal?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsNumber()
  sesionesCubiertas?: number;

  @ApiPropertyOptional({ example: '2026-02-01' })
  @IsOptional()
  @IsDateString()
  periodoDesde?: Date;

  @ApiPropertyOptional({ example: '2026-02-28' })
  @IsOptional()
  @IsDateString()
  periodoHasta?: Date;

  @ApiPropertyOptional({ example: '2026-03-01' })
  @IsOptional()
  @IsDateString()
  fechaPago?: Date;

  @ApiPropertyOptional({ example: 'user-123' })
  @IsOptional()
  @IsString()
  usuarioPago?: string;

  @ApiPropertyOptional({ example: 'Comisión de febrero pagada' })
  @IsOptional()
  @IsString()
  notas?: string;

  @ApiPropertyOptional({
    example: 7,
    description:
      'Override explicito de la tasa de comision de este pago, en porcentaje sobre la base (7 = 7 %). Sin valor, cada orden usa la tasa que guardo al nacer.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  comisionPct?: number;

  @ApiPropertyOptional({
    example: 10.5,
    description: 'Monto a descontar por consumos u otros descuentos.',
  })
  @IsOptional()
  @IsNumber()
  descuentos?: number;

  @ApiPropertyOptional({ example: 'Consumo: almuerzo 3 días' })
  @IsOptional()
  @IsString()
  descuentosDetalle?: string;

  @ApiPropertyOptional({
    example: 45.5,
    description:
      'Monto neto real entregado (comision + propinas + bono - descuentos). Lo calcula el cliente.',
  })
  @IsOptional()
  @IsNumber()
  montoNeto?: number;

  @ApiPropertyOptional({
    example: 5,
    description: 'Dias asistidos esta semana (0-7)',
  })
  @IsOptional()
  @IsNumber()
  diasAsistidos?: number;

  @ApiPropertyOptional({
    example: 25,
    description: 'Bono de asistencia (diasAsistidos x $5/dia)',
  })
  @IsOptional()
  @IsNumber()
  bonoAsistencia?: number;
}
