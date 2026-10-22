import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { CobrosIncompletosService } from './cobros-incompletos.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRoleEnum } from '@odin6/types';

@ApiTags('analytics')
@Controller('api/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly cobrosIncompletos: CobrosIncompletosService,
  ) {}

  /**
   * Ordenes cerradas como pagadas cuyos pagos no cubren la cuenta.
   *
   * Solo gerencia: expone quien atendio cada caso y la foto del comprobante,
   * o sea material para reclamarle a una persona por su nombre.
   */
  @Get('cobros-incompletos')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({
    summary: 'Ordenes pagadas sin pagos que las cubran (ADMIN, MANAGER)',
  })
  @ApiResponse({ status: 200, description: 'Listado con pagos y comprobantes' })
  async getCobrosIncompletos(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    // Por defecto el ultimo mes: es la ventana en la que todavia se puede
    // preguntar y alguien se acuerda.
    const hasta = to ? new Date(to) : new Date();
    const desde = from
      ? new Date(from)
      : new Date(hasta.getTime() - 30 * 24 * 60 * 60 * 1000);
    return this.cobrosIncompletos.listar(desde, hasta);
  }

  /**
   * Cronograma de administracion por semana (martes a domingo) cruzado con la
   * venta y los cobros incompletos de cada una.
   */
  @Get('cronograma-socios')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({
    summary: 'Semanas de administracion por socio con sus cobros incompletos',
  })
  @ApiResponse({ status: 200, description: 'Semanas listadas' })
  async getCronogramaSocios(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const hasta = to ? new Date(to) : new Date();
    // Desde mayo: antes hay ruido de la migracion de Firebase.
    const desde = from ? new Date(from) : new Date('2026-05-05T10:00:00Z');
    return this.cobrosIncompletos.porSemana(desde, hasta);
  }

  @Get('sales/weekly')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Get weekly sales data (ADMIN, MANAGER)' })
  @ApiResponse({ status: 200, description: 'Weekly sales data retrieved' })
  async getWeeklySales() {
    return this.analyticsService.getWeeklySales();
  }

  @Get('sales')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({
    summary: 'Get sales by interval: today|week|month (ADMIN, MANAGER)',
  })
  @ApiResponse({ status: 200, description: 'Sales data retrieved' })
  async getSalesByInterval(
    @Query('interval') interval: 'today' | 'week' | 'month' = 'today',
  ) {
    return this.analyticsService.getSalesByInterval(interval);
  }

  @Get('top-products')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Get top products by revenue (ADMIN, MANAGER)' })
  @ApiResponse({ status: 200, description: 'Top products retrieved' })
  async getTopProducts(@Query('from') from?: string, @Query('to') to?: string) {
    return this.analyticsService.getTopProducts(
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  @Get('top-waiters')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Get top waiters by orders (ADMIN, MANAGER)' })
  @ApiResponse({ status: 200, description: 'Top waiters retrieved' })
  async getTopWaiters(@Query('from') from?: string, @Query('to') to?: string) {
    return this.analyticsService.getTopWaiters(
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }
}
