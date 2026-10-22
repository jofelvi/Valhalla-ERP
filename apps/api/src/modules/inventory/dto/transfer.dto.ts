import { IsString, IsNumber, IsPositive, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TransferDto {
  @ApiProperty()
  @IsString()
  fromWarehouseId: string;

  @ApiProperty()
  @IsString()
  toWarehouseId: string;

  @ApiProperty()
  @IsString()
  productId: string;

  @ApiProperty({ description: 'Cantidad en la unidad indicada' })
  @IsNumber()
  @IsPositive()
  quantity: number;

  @ApiProperty({
    example: 'kg',
    description: 'Unidad en que se ingresó (kg, gr, L, unidad, lata...)',
  })
  @IsString()
  unit: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
