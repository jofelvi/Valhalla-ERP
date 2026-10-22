import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsDateString,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

const IsNullable = () => ValidateIf((_, v) => v !== null && v !== undefined);

export class PrintLogItemDto {
  @IsString()
  productId: string;

  @IsString()
  name: string;

  @IsNumber()
  qty: number;

  @IsNullable()
  @IsString()
  station?: string;

  @IsNullable()
  @IsString()
  notes?: string;
}

export class CreatePrintLogDto {
  @IsString()
  attemptId: string;

  @IsString()
  orderId: string;

  @IsString()
  orderNumber: string;

  @IsString()
  type: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrintLogItemDto)
  items: PrintLogItemDto[];

  @IsNumber()
  itemsCount: number;

  @IsNullable()
  @IsString()
  waiterId?: string;

  @IsNullable()
  @IsString()
  waiterName?: string;

  @IsNullable()
  @IsString()
  tableId?: string;

  @IsNullable()
  @IsString()
  tableName?: string;

  @IsNullable()
  @IsString()
  sector?: string;

  @IsString()
  userId: string;

  @IsString()
  status: string;

  @IsNullable()
  @IsNumber()
  httpStatus?: number;

  @IsNullable()
  @IsString()
  errorMessage?: string;

  @IsNullable()
  @IsString()
  via?: string;

  @IsOptional()
  serviceResponse?: Record<string, unknown>;

  @IsString()
  requestHash: string;

  @IsOptional()
  requestAt: Date;

  @IsOptional()
  responseAt?: Date;

  @IsNullable()
  @IsNumber()
  durationMs?: number;

  @IsOptional()
  createdAt?: Date;
}
