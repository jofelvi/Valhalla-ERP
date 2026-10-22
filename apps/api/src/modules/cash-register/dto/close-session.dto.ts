import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsNumber,
  IsObject,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PaymentMethodSummaryDto {
  @ApiProperty()
  @IsString()
  method: string;

  @ApiProperty()
  @IsString()
  methodLabel: string;

  @ApiProperty()
  @IsNumber()
  count: number;

  @ApiProperty()
  @IsNumber()
  amount: number;
}

export class SessionSummaryDto {
  @ApiProperty()
  @IsNumber()
  totalOrders: number;

  @ApiProperty()
  @IsNumber()
  totalAmount: number;

  @ApiProperty()
  @IsNumber()
  totalAmountBs: number;

  @ApiProperty({ type: [PaymentMethodSummaryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentMethodSummaryDto)
  byPaymentMethod: PaymentMethodSummaryDto[];
}

export class CloseSessionDto {
  @ApiProperty({ type: SessionSummaryDto })
  @IsObject()
  @ValidateNested()
  @Type(() => SessionSummaryDto)
  summary: SessionSummaryDto;
}
