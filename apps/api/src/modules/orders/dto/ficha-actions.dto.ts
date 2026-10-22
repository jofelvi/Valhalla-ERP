import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
  ArrayNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

// Estaciones controladas que entregan por ficha. La pantalla que escanea manda
// la suya y el backend rechaza items de otra estacion (blindaje anti-robo).
const CONTROLLED_STATIONS = ['BAR', 'KITCHEN', 'PIZZA'];

// Una entrega/devolucion puntual dentro de una tanda. En el Plan 2 este DTO
// gana un variantProductId opcional para tobos mixtos.
export class FichaDeliveryDto {
  @IsString()
  @IsNotEmpty()
  itemId: string;

  @IsInt()
  @Min(1)
  @Max(999)
  delta: number;

  // Tobos mixtos: si el ítem tiene composición, la entrega/devolución es contra
  // esta variante (Light/Pilsen/Azul). Ausente para ítems sueltos.
  @IsOptional()
  @IsString()
  variantProductId?: string;
}

// POST /api/orders/ficha/:token/deliver
export class FichaDeliverDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => FichaDeliveryDto)
  deliveries: FichaDeliveryDto[];

  // Estacion de la pantalla que entrega. Si viene, el backend rechaza items de
  // otra estacion. Opcional por retrocompat con APKs viejas que no la mandan.
  @IsOptional()
  @IsIn(CONTROLLED_STATIONS)
  station?: string;

  // Idempotencia: id único de esta tanda de entregas. Si se reintenta con el
  // mismo opId, el backend no aplica nada y devuelve la ficha actual (mismo
  // retorno que entrega exitosa). Ausente en reintentos antiguos sin soporte.
  @IsOptional()
  @IsString()
  opId?: string;
}

// POST /api/orders/ficha/:token/return
export class FichaReturnDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => FichaDeliveryDto)
  returns: FichaDeliveryDto[];

  @IsOptional()
  @IsIn(CONTROLLED_STATIONS)
  station?: string;

  // Idempotencia: id unico de esta tanda de devoluciones. Si se reintenta con el
  // mismo opId, el backend no aplica nada y devuelve la ficha actual (mismo
  // retorno que devolucion exitosa). Ausente en reintentos antiguos sin soporte.
  @IsOptional()
  @IsString()
  opId?: string;
}

// POST /api/orders/:id/ficha/regenerate
export class FichaRegenerateDto {
  @IsString()
  @IsNotEmpty()
  adminPin: string;
}
