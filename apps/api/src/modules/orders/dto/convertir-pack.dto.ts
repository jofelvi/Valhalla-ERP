import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsInt, Min } from 'class-validator';

/**
 * Lo que manda el cliente para convertir cervezas sueltas en un pack.
 *
 * Fijate en lo que NO esta: el precio. El cliente elige QUE convertir y
 * CUANTO, nunca por cuanto. El precio lo pone el servidor desde el catalogo.
 *
 * Esto no es celo: el mapa que usaba la web tenia el tobo de lata cableado en
 * $11 mientras la ficha del producto decia $14. Si el precio viajara en el
 * cuerpo, un cliente desactualizado cobraria de menos y nadie se enteraria.
 */
export class ConvertirPackDto {
  @ApiProperty({
    example: 'prod-botella-b',
    description: 'Producto suelto que se convierte (la cerveza)',
  })
  @IsString()
  @IsNotEmpty()
  sourceProductId: string;

  @ApiProperty({
    example: 'pack-tobo-12',
    description: 'Pack elegido de los que ofrece /opciones-conversion',
  })
  @IsString()
  @IsNotEmpty()
  targetPackId: string;

  @ApiProperty({
    example: 1,
    description: 'Cuantos packs armar. Nunca mas de numPacksPossible.',
  })
  @IsInt()
  @Min(1)
  packsToConvert: number;
}
