import { IsString, IsNumber, Min } from 'class-validator';

export class MidPullDto {
  @IsString()
  productId: string;

  @IsString()
  productName: string;

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsString()
  unit: string;

  @IsString()
  by: string;
}
