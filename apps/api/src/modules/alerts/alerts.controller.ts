import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRoleEnum } from '@odin6/types';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  AlertsService,
  AlertasResumen,
  ResumenAlertas,
} from './alerts.service';

@ApiTags('alerts')
@Controller('api/alerts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  /**
   * Campana del header (formato clásico). Se mantiene este contrato porque
   * `CampanaAlertas.tsx` de la web ya lo consume como `ResumenAlertas`
   * ({ total, graves, alertas[] }): cambiarlo aquí rompería la campana en el
   * próximo deploy. El formato estructurado nuevo vive en `GET /api/alerts/panel`.
   */
  @Get()
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Campana del header (márgenes + pendientes)' })
  async resumen(): Promise<ResumenAlertas> {
    return this.alerts.resumenLegacy();
  }

  /**
   * Panel de alertas estructurado (para el Panel del APK admin).
   *
   * Devuelve:
   * - `margenes`: productos con margen bajo, nulo o negativo.
   * - `pendientes`: productos que se venden pero no descuentan nada (naturaleza sin decidir).
   * - `agotados`: productos baratos sin stock (Task 3).
   *
   * Query params:
   * - `desde?`: fecha ISO para filtrar alertas (default: últimos 7 días).
   */
  @Get('panel')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({
    summary: 'Panel de alertas estructurado (márgenes, pendientes, agotados)',
  })
  async panel(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @Query('desde') desde?: string,
  ): Promise<AlertasResumen> {
    // TODO: Task 3 — filtrar por `desde` si se proporciona
    return this.alerts.resumen();
  }
}
