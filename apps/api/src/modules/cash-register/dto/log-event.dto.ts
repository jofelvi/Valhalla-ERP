import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

const EVENT_TYPES = [
  'session_opened',
  'session_closed',
  'order_created',
  'payment_processed',
  'table_freed',
  'comanda_printed',
] as const;

export class LogEventDto {
  @ApiProperty({ enum: EVENT_TYPES })
  @IsIn(EVENT_TYPES as unknown as string[])
  type: (typeof EVENT_TYPES)[number];

  @ApiProperty()
  @IsString()
  description: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  amount?: number;
}
