import { Controller, Get, HttpCode, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SociosExcluidosService } from './socios-excluidos.service';
import { ModuloActivoGuard } from '../../common/modulos/modulo-activo.guard';
import { RequiereModulo } from '../../common/modulos/requiere-modulo.decorator';

@ApiTags('config')
@Controller('api/config/socios-excluidos')
@UseGuards(ModuloActivoGuard)
@RequiereModulo('partners')
export class SociosExcluidosController {
  constructor(private readonly service: SociosExcluidosService) {}

  /**
   * Socios cuyo consumo no suma al monto por cobrar. Lo consumen el dashboard
   * y la pantalla de cuentas por cobrar para que las dos muestren el MISMO
   * numero: si cada pantalla aplicara su propia regla, una diria 5.979 y la
   * otra 4.120 y nadie sabria cual creer.
   */
  @Get()
  @HttpCode(200)
  @ApiOperation({ summary: 'Socios excluidos del monto por cobrar' })
  @ApiResponse({ status: 200, description: 'Configuracion vigente' })
  async get() {
    return this.service.resolver();
  }
}
