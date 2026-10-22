import { IsArray, IsString } from 'class-validator';

export class BestPlacesDto {
  @IsArray()
  @IsString({ each: true })
  productIds: string[];
}
