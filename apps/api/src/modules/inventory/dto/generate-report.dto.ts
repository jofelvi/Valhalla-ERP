import { IsOptional, IsISO8601 } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateReportDto {
  @ApiPropertyOptional({
    description:
      'Fecha de inicio de la semana (ISO 8601). Si no se especifica, se utiliza la semana pasada completa.',
    example: '2026-01-13T00:00:00Z',
  })
  @IsOptional()
  @IsISO8601()
  weekStart?: string;
}
