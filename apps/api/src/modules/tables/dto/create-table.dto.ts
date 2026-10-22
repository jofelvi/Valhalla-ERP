import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTableDto {
  @ApiProperty({ example: 'Mesa 1' })
  @IsString()
  name: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  number: number;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @IsNumber()
  capacity?: number;

  @ApiPropertyOptional({ example: 'ISAVAILABLE' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  // Al liberar la mesa se envia orderId:null explicito. IsOptional no pasa con
  // null; ValidateIf salta la validacion cuando es null.
  @ApiPropertyOptional({ example: null, nullable: true })
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  orderId?: string | null;
}
