import { IsNumber, IsPositive, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Abono parcial (o total) a un préstamo desde la nómina.
export class AbonoEmployeeLoanDto {
  @ApiProperty({ example: 10, description: 'Monto a abonar en USD (> 0)' })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({
    description: 'ID del pago de nómina que originó el abono',
  })
  @IsOptional()
  @IsString()
  payrollId?: string;
}
