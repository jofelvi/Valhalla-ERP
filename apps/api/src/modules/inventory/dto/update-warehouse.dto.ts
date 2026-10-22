import { IsString, IsIn, IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import type { InventoryArea } from '../units';

export class UpdateWarehouseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: ['GENERAL', 'COCINA', 'PIZZERIA', 'BARRA'] })
  @IsOptional()
  @IsIn(['GENERAL', 'COCINA', 'PIZZERIA', 'BARRA'])
  area?: InventoryArea;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
