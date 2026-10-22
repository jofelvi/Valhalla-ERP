import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MergeOrderDto {
  @ApiProperty({
    description: 'Orden que se absorbe. Sus items pasan al destino.',
  })
  @IsString()
  @IsNotEmpty()
  sourceOrderId: string;

  /**
   * Mover consumo de una cuenta a otra es un vector de fraude evidente: sirve
   * para hacer desaparecer una mesa dentro de otra. Va con PIN de gerencia,
   * igual que cancelar una orden.
   */
  @ApiProperty({ description: 'PIN de admin/gerente' })
  @IsString()
  @IsNotEmpty()
  pin: string;
}
