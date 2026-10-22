import { IsString, IsOptional, IsArray, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OpenDayDto {
  @ApiPropertyOptional({ example: 'user-001' })
  @IsOptional()
  @IsString()
  usuarioApertura?: string;

  @ApiPropertyOptional({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        productId: { type: 'string' },
        cantidad: { type: 'number' },
      },
    },
  })
  @IsOptional()
  @IsArray()
  stockInicial?: Array<{
    productId: string;
    cantidad: number;
  }>;

  @ApiPropertyOptional({ example: 'Notas de apertura' })
  @IsOptional()
  @IsString()
  notas?: string;
}
