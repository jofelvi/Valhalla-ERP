import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PurchaseOrderStatusEnum } from '@odin6/types';

export class ChangeStatusDto {
  @ApiProperty({ enum: PurchaseOrderStatusEnum })
  @IsEnum(PurchaseOrderStatusEnum)
  status: string;
}
