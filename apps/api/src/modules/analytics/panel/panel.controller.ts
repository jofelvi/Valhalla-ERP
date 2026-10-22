import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRoleEnum } from '@odin6/types';
import { PanelService } from './panel.service';
import {
  INTERVALOS_VALIDOS,
  IntervaloPanel,
  esIntervaloValido,
} from './panel-rango.util';

/**
 * Un endpoint por tarjeta del panel.
 *
 * Estan separados a proposito: cada tarjeta se pide sola, se pinta sola y
 * falla sola. Antes el panel esperaba 14,35 MB (las cuatro colecciones
 * completas) antes de mostrar un pixel, y si una peticion fallaba las tarjetas
 * mostraban USD 0,00 — indistinguible de un dia sin ventas.
 */
@ApiTags('analytics')
@Controller('api/analytics/panel')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PanelController {
  constructor(private readonly panel: PanelService) {}

  private intervalo(valor?: string): IntervaloPanel {
    if (valor === undefined) return IntervaloPanel.HOY;
    if (!esIntervaloValido(valor)) {
      throw new BadRequestException(
        `Intervalo desconocido: "${valor}". Validos: ${INTERVALOS_VALIDOS.join(', ')}`,
      );
    }
    return valor;
  }

  @Get('ventas')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Venta, cobrado y propina del periodo' })
  @ApiQuery({ name: 'interval', required: false, enum: INTERVALOS_VALIDOS })
  @ApiResponse({ status: 200, description: 'Resumen de venta del periodo' })
  async ventas(@Query('interval') interval?: string) {
    return this.panel.ventas(this.intervalo(interval));
  }

  @Get('metodos-pago')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Por donde entro la plata en el periodo' })
  @ApiQuery({ name: 'interval', required: false, enum: INTERVALOS_VALIDOS })
  @ApiResponse({ status: 200, description: 'Desglose de cobros por metodo' })
  async metodosPago(@Query('interval') interval?: string) {
    return this.panel.metodosDePago(this.intervalo(interval));
  }

  @Get('venta-por-dia')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Venta por jornada dentro del periodo elegido' })
  @ApiQuery({ name: 'interval', required: false, enum: INTERVALOS_VALIDOS })
  @ApiResponse({ status: 200, description: 'Serie diaria del periodo' })
  async ventaPorDia(@Query('interval') interval?: string) {
    return this.panel.ventaPorDia(this.intervalo(interval));
  }

  @Get('top-productos')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Productos mas (o menos) vendidos del periodo' })
  @ApiQuery({ name: 'interval', required: false, enum: INTERVALOS_VALIDOS })
  @ApiQuery({ name: 'orden', required: false, enum: ['desc', 'asc'] })
  @ApiQuery({ name: 'limite', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Ranking de productos' })
  async topProductos(
    @Query('interval') interval?: string,
    @Query('orden') orden?: string,
    @Query('limite') limite?: string,
  ) {
    return this.panel.topProductos(
      this.intervalo(interval),
      orden === 'asc' ? 'asc' : 'desc',
      Number(limite) || 10,
    );
  }

  @Get('top-mesoneros')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Mesoneros por venta del periodo' })
  @ApiQuery({ name: 'interval', required: false, enum: INTERVALOS_VALIDOS })
  @ApiResponse({ status: 200, description: 'Ranking de mesoneros' })
  async topMesoneros(@Query('interval') interval?: string) {
    return this.panel.topMesoneros(this.intervalo(interval));
  }

  @Get('actividad')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Ultimas ordenes registradas' })
  @ApiQuery({ name: 'limite', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Ordenes recientes' })
  async actividad(@Query('limite') limite?: string) {
    return this.panel.actividad(Number(limite) || 8);
  }
}
