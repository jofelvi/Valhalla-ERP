import { IsArray, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class TransferToDailyDto {
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
  productos?: Array<{
    productId: string;
    cantidad: number;
  }>;

  @ApiPropertyOptional({ example: 'Transferencia inicial' })
  @IsOptional()
  @IsString()
  motivo?: string;
}
