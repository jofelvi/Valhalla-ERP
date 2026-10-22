import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class RecalcularCostosDto {
  @ApiPropertyOptional({
    description: 'Solo calcula y devuelve el plan, sin guardar nada',
  })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @ApiPropertyOptional({
    description:
      'Aplica también los cambios sospechosos (bajan más de 40% o suben más de 3 veces)',
  })
  @IsOptional()
  @IsBoolean()
  forzar?: boolean;
}
