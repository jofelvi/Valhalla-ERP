import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';

export class ConsumoCreditoDto {
  @ApiProperty({
    description: 'Cuanto se le carga al credito del socio en esta venta',
    example: 12.5,
  })
  @IsNumber()
  @Min(0.01)
  monto: number;
}
