import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

/**
 * Body de `PATCH /api/configs/:id`. `valor` es un parcial del documento: el servicio lo mezcla
 * sobre lo vigente, lo normaliza y descarta lo inválido. Por eso aquí solo se exige que sea un
 * objeto; el contenido se valida al normalizar, campo por campo.
 */
export class ActualizarConfigDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Campos a cambiar del documento (parcial).',
  })
  @IsObject()
  valor: Record<string, unknown>;
}
