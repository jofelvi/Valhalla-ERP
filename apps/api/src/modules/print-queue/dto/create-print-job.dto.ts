import {
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PrintJobType, PrintStation } from '../schemas/print-job.schema';

export class PrintJobItemDto {
  @IsString() productId: string;
  @IsString() name: string;
  qty: number;
  @IsOptional() @IsString() station?: string;
  @IsOptional() @IsString() notes?: string;
}

export class CreatePrintJobDto {
  @IsEnum(PrintJobType)
  type: PrintJobType;

  // Shape completo (mobile/web actual): receipt/comanda/precuenta con items, totals, pagos, etc.
  // El print-service usa este objeto tal cual para construir el ESC/POS.
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  // Campos individuales (opcional, retrocompat)
  @IsOptional() @IsString() orderId?: string;
  @IsOptional() @IsString() orderNumber?: string;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrintJobItemDto)
  items?: PrintJobItemDto[];
  @IsOptional() @IsEnum(PrintStation) station?: PrintStation;
  @IsOptional() @IsString() userId?: string;
  @IsOptional() @IsString() waiterId?: string;
  @IsOptional() @IsString() waiterName?: string;
  @IsOptional() @IsString() tableId?: string;
  @IsOptional() @IsString() tableName?: string;
  @IsOptional() @IsString() sector?: string;
}
