import { IsString, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LinkOrderDto {
  @ApiProperty({ example: 'order-001' })
  @IsString()
  orderId: string;

  @ApiProperty({ example: 250.5 })
  @IsNumber()
  total: number;
}
