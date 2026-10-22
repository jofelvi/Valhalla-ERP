import {
  IsArray,
  IsString,
  IsNumber,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class StockItemDto {
  @IsString()
  productId: string;

  @IsString()
  productName: string;

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsString()
  unit: string;
}

export class OpenKitchenSessionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StockItemDto)
  initialStock: StockItemDto[];
}
