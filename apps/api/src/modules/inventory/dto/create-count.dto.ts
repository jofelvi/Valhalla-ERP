import {
  IsString,
  IsIn,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  IsBoolean,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CountItemDto {
  @ApiProperty() @IsString() productId: string;

  @ApiProperty({ description: 'Cantidad física contada' })
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiProperty({ example: 'kg', description: 'Unidad en que se contó' })
  @IsString()
  unit: string;
}

export class CreateCountDto {
  @ApiProperty() @IsString() warehouseId: string;

  @ApiProperty({ enum: ['DIARIO', 'SEMANAL', 'INICIAL'] })
  @IsIn(['DIARIO', 'SEMANAL', 'INICIAL'])
  type: 'DIARIO' | 'SEMANAL' | 'INICIAL';

  @ApiProperty({ type: [CountItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CountItemDto)
  items: CountItemDto[];

  // Spec §13: diferencia >50% pide confirmación explícita (probable error de unidad)
  @ApiPropertyOptional({
    description: 'Confirmar diferencias mayores al 50% del stock',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  confirmLargeDiffs?: boolean;
}
