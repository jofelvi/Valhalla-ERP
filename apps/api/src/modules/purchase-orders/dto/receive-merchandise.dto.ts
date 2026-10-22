import { IsArray, IsObject, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReceiveMerchandiseDto {
  @ApiProperty({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        productId: { type: 'string' },
        quantityReceived: { type: 'number' },
      },
    },
    example: [{ productId: 'prod-001', quantityReceived: 50 }],
  })
  @IsArray()
  @IsObject({ each: true })
  receivedItems: Array<{
    productId: string;
    quantityReceived: number;
  }>;
}
