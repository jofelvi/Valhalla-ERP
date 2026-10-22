import {
  IsString,
  IsArray,
  IsNumber,
  IsOptional,
  ValidateNested,
  IsIn,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProposeItemDto {
  @ApiProperty({ description: 'ID del insumo' })
  @IsString()
  productId: string;

  @ApiProperty({
    description: 'Cantidad sugerida en unidad de entrada (kg, gr, l, ml, und)',
  })
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiProperty({
    example: 'kg',
    description: 'Unidad de entrada (kg, gr, l, ml, und)',
  })
  @IsString()
  unit: string;

  @ApiPropertyOptional({
    description: 'Motivo de la sugerencia (si es MANUAL)',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ProposeItemsDto {
  @ApiPropertyOptional({
    description: 'Estación que propone (COCINA, PIZZERIA, BARRA, GENERAL)',
  })
  @IsOptional()
  @IsIn(['COCINA', 'PIZZERIA', 'BARRA', 'GENERAL'])
  station?: string;

  @ApiProperty({ type: [ProposeItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProposeItemDto)
  items: ProposeItemDto[];
}

export class UpdateListItemDto {
  @ApiPropertyOptional({
    description: 'Cantidad ajustada por el aprobador (en unidad base)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  adjustedQty?: number;

  @ApiPropertyOptional({
    description: 'Marcar como descartado (no incluir en compra)',
  })
  @IsOptional()
  discarded?: boolean;
}
