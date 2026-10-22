import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  ValidateNested,
  ArrayNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

class InsumoRequestItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsString()
  @IsNotEmpty()
  productName: string;

  @IsNumber()
  @IsPositive()
  qty: number;

  @IsString()
  @IsNotEmpty()
  unit: string;
}

/** Insumo que la estación propone crear porque no existe en el catálogo. */
class ProposedProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  /** GR / ML / UND — gerencia puede corregirla al aprobar. */
  @IsOptional()
  @IsString()
  unit?: string;

  /** Para qué lo usa: ayuda a gerencia a decidir sin ir a preguntar. */
  @IsOptional()
  @IsString()
  purpose?: string;
}

export class CreateInsumoRequestDto {
  @IsIn(['BAR', 'KITCHEN', 'PIZZA'])
  station: string;

  /**
   * TRASLADO (reponer del depósito) · PRODUCCION (la estación elaboró) ·
   * ALTA_INSUMO (proponer un insumo nuevo). Ausente = TRASLADO, para no
   * romper las APKs que ya están instaladas.
   */
  @IsOptional()
  @IsIn(['TRASLADO', 'PRODUCCION', 'ALTA_INSUMO'])
  type?: string;

  // Vacío solo cuando es ALTA_INSUMO: ahí lo que se pide aún no existe.
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InsumoRequestItemDto)
  items: InsumoRequestItemDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ProposedProductDto)
  proposedProduct?: ProposedProductDto;

  @IsOptional()
  @IsString()
  note?: string;
}

export class RejectInsumoRequestDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
