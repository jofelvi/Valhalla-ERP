import {
  IsArray,
  IsString,
  IsNumber,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PhysicalCountItemDto {
  @IsString()
  productId: string;

  @IsNumber()
  @Min(0)
  quantity: number;
}

export class CloseKitchenSessionDto {
  @IsString()
  closedBy: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PhysicalCountItemDto)
  physicalCount: PhysicalCountItemDto[];
}
