import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class RecipeIngredientDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  // Tope absoluto y grosero: el de verdad depende de la unidad y se aplica
  // en el servicio (recipe-limits.util). Este solo frena lo que ni vale la pena
  // convertir, como el 999.999.999 que antes se aceptaba sin chistar.
  @IsNumber()
  @Min(0.0001)
  @Max(1_000_000)
  quantity: number;

  @IsString()
  @IsNotEmpty()
  unit: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  wastePercentage?: number;
}

/**
 * Edicion de receta por el personal de estacion (cocina/pizza/barra).
 *
 * DTO deliberadamente MINIMO: el whitelist global descarta cualquier otro
 * campo, asi que desde este endpoint el precio, el nombre o la categoria son
 * inalcanzables por diseño. Cada estacion solo puede tocar productos de SU
 * station (se valida en el servicio, no aqui).
 */
export class UpdateRecipeDto {
  // La receta mas larga del catalogo tiene 21 ingredientes. El tope corta un
  // pegado accidental sin estorbar a nadie.
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientDto)
  ingredients: RecipeIngredientDto[];

  // Venta directa (botella/lata): el producto descuenta 1:1 sin receta.
  // Lo usa barra para aguas/refrescos/cervezas que no llevan preparacion.
  @IsOptional()
  @IsBoolean()
  isForInventory?: boolean;

  // Minutos que toma preparar UNA unidad. El tope de 8 horas es un cerco
  // contra el dedazo (un "120" donde iba "12" no debe volverse una jornada).
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(480)
  prepTimeMinutes?: number;

  // Quien lo prepara (empleado activo). De ahi sale el sueldo con el que se
  // costea el tiempo; el personal nunca ve ni manda el monto.
  @IsOptional()
  @IsString()
  preparedByEmployeeId?: string;
}
