import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CountsService } from './counts.service';
import { CreateCountDto } from './dto/create-count.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRoleEnum } from '@odin6/types';
import { WarehousesService } from './warehouses.service';
import { assertPuedeVerAlmacen } from './station-scope.util';

interface AuthedRequest {
  user?: { id?: string; sub?: string; role?: string };
}

@ApiTags('inventory')
@Controller('api/inventory/counts')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CountsController {
  constructor(
    private readonly countsService: CountsService,
    private readonly warehousesService: WarehousesService,
  ) {}

  /**
   * Un conteo AJUSTA el stock al valor declarado: es la operación con la que
   * se podría "cuadrar" un faltante antes de que nadie lo note. Y el conteo es
   * justamente lo que se compara para descontar dinero al personal.
   * Por eso queda en manos de gerencia.
   */
  @Post()
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({
    summary:
      'Registrar y confirmar conteo físico — ajusta stock (solo gerencia)',
  })
  create(@Body() dto: CreateCountDto, @Request() req: AuthedRequest) {
    return this.countsService.createAndConfirm(
      dto,
      req.user?.id ?? req.user?.sub ?? 'desconocido',
    );
  }

  @Get()
  @Roles(
    UserRoleEnum.ADMIN,
    UserRoleEnum.MANAGER,
    UserRoleEnum.KITCHEN,
    UserRoleEnum.BAR,
    UserRoleEnum.PIZZA,
  )
  @ApiOperation({ summary: 'Historial de conteos (la estación ve el suyo)' })
  async list(
    @Request() req: AuthedRequest,
    @Query('warehouseId') warehouseId?: string,
  ) {
    if (warehouseId) {
      const wh = await this.warehousesService.findById(warehouseId);
      assertPuedeVerAlmacen(req.user?.role, wh?.area);
    } else {
      // Sin almacén concreto devolvería el historial de TODOS: solo gerencia.
      assertPuedeVerAlmacen(req.user?.role, undefined);
    }
    return this.countsService.list(warehouseId);
  }
}
