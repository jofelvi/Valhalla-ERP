import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ApproveInsumoRequestDto {
  /**
   * PIN del jefe, tecleado en el telefono de la estacion.
   *
   * Existe para que barra o cocina no tengan que esperar a que un admin abra
   * su propia app: el jefe autoriza ahi mismo y el traslado ocurre al instante.
   * No relaja el control — la solicitud queda a nombre del dueño del PIN, no
   * de quien tenia el telefono en la mano.
   */
  @ApiPropertyOptional({
    description: 'PIN de admin/gerente para autorizar en el acto',
  })
  @IsOptional()
  @IsString()
  pin?: string;
}
