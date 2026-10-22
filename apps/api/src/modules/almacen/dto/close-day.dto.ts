import { IsString, IsOptional, IsArray } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CloseDayDto {
  @ApiPropertyOptional({ example: 'user-001' })
  @IsOptional()
  @IsString()
  usuarioCierre?: string;

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
  stockFinal?: Array<{
    productId: string;
    cantidad: number;
  }>;

  @ApiPropertyOptional({ example: 'Notas de cierre' })
  @IsOptional()
  @IsString()
  notas?: string;
}
