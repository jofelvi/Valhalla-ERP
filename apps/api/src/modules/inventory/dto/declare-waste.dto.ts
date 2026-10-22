import {
  IsString,
  IsNumber,
  IsPositive,
  IsOptional,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DeclareWasteDto {
  @ApiProperty()
  @IsString()
  warehouseId: string;

  @ApiProperty()
  @IsString()
  productId: string;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  quantity: number;

  @ApiProperty({ example: 'gr' })
  @IsString()
  unit: string;

  @ApiProperty({ example: 'Se dañó en la nevera' })
  @IsString()
  @IsNotEmpty()
  reason: string;

  // FOTO OBLIGATORIA (decisión del spec §7.3)
  @ApiProperty({
    description: 'URL de la foto del insumo dañado (obligatoria)',
  })
  @IsString()
  @IsNotEmpty()
  photoUrl: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class AnnulMovementDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
