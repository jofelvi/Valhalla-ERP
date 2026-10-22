import { IsString, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AdjustStockDto {
  @ApiProperty({ example: 'prod-001' })
  @IsString()
  productId: string;

  @ApiProperty({ example: 10 })
  @IsNumber()
  cantidad: number;

  @ApiProperty({ example: 'ajuste' })
  @IsString()
  tipo: string;

  @ApiPropertyOptional({ example: 'Ajuste por rotura' })
  @IsOptional()
  @IsString()
  motivo?: string;

  @ApiPropertyOptional({ example: 'user-001' })
  @IsOptional()
  @IsString()
  usuario?: string;
}
