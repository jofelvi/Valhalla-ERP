import { IsString, IsIn, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { InventoryArea } from '../units';

export class CreateWarehouseDto {
  @ApiProperty({ example: 'Nevera Cocina 1' })
  @IsString()
  name: string;

  @ApiProperty({ enum: ['GENERAL', 'COCINA', 'PIZZERIA', 'BARRA'] })
  @IsIn(['GENERAL', 'COCINA', 'PIZZERIA', 'BARRA'])
  area: InventoryArea;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
