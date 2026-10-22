import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MovementsService } from './movements.service';
import { WarehousesService } from './warehouses.service';
import { TransferDto } from './dto/transfer.dto';
import { DeclareWasteDto, AnnulMovementDto } from './dto/declare-waste.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRoleEnum } from '@odin6/types';
import type { MovementType } from './schemas/inventory-movement.schema';
import { assertPuedeVerAlmacen } from './station-scope.util';

interface AuthedRequest {
  user?: { id?: string; sub?: string; role?: string };
}

// Operaciones que MUEVEN stock: solo dueños/gerencia. El inventario decide
// descuentos de dinero al personal — quien es medido no puede mover la regla.
const SOLO_GERENCIA = [UserRoleEnum.ADMIN, UserRoleEnum.MANAGER] as const;

@ApiTags('inventory')
@Controller('api/inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class MovementsController {
  constructor(
    private readonly movementsService: MovementsService,
    private readonly warehousesService: WarehousesService,
  ) {}

  private userId(req: AuthedRequest): string {
    return req.user?.id ?? req.user?.sub ?? 'desconocido';
  }

  @Get('stock/:warehouseId')
  @Roles(
    UserRoleEnum.ADMIN,
    UserRoleEnum.MANAGER,
    UserRoleEnum.KITCHEN,
    UserRoleEnum.BAR,
    UserRoleEnum.PIZZA,
    // Mesonero/cajero: solo lectura de BARRA (arman tobos mixtos). El scope
    // fino lo aplica assertPuedeVerAlmacen: solo pasan si el almacén es BARRA.
    UserRoleEnum.WAITER,
    UserRoleEnum.CASHIER,
  )
  @ApiOperation({ summary: 'Stock actual del almacén (unidad base)' })
  async getStock(
    @Param('warehouseId') warehouseId: string,
    @Request() req: AuthedRequest,
  ) {
    // Cada estación solo consulta SU almacén.
    const wh = await this.warehousesService.findById(warehouseId);
    assertPuedeVerAlmacen(req.user?.role, wh?.area);
    return this.movementsService.getStock(warehouseId);
  }

  @Get('available')
  @ApiOperation({
    summary: 'Insumos disponibles para una estación (barra/cocina/pizza)',
  })
  getAvailable(@Query('station') station?: string) {
    if (!station) return [];
    return this.movementsService.getAvailableByStation(station);
  }

  @Get('movements')
  @Roles(...SOLO_GERENCIA)
  @ApiOperation({ summary: 'Ledger de movimientos (filtrable)' })
  list(
    @Query('warehouseId') warehouseId?: string,
    @Query('productId') productId?: string,
    @Query('type') type?: MovementType,
    @Query('refId') refId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    return this.movementsService.list({
      warehouseId,
      productId,
      type,
      refId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  //  Todo lo que MUEVE stock: solo gerencia.
  //  Si el personal pudiera trasladar, declarar merma o anular movimientos,
  //  podría cuadrar un faltante antes del conteo — y el conteo es lo que va
  //  a determinar descuentos de su sueldo.
  // ─────────────────────────────────────────────────────────────────────

  @Post('transfer')
  @Roles(...SOLO_GERENCIA)
  @ApiOperation({ summary: 'Trasladar insumo entre almacenes (solo gerencia)' })
  transfer(@Body() dto: TransferDto, @Request() req: AuthedRequest) {
    return this.movementsService.transfer(dto, this.userId(req));
  }

  @Post('waste')
  @Roles(...SOLO_GERENCIA)
  @ApiOperation({ summary: 'Declarar merma (solo gerencia)' })
  declareWaste(@Body() dto: DeclareWasteDto, @Request() req: AuthedRequest) {
    return this.movementsService.declareWaste(dto, this.userId(req));
  }

  @Post('movements/:id/annul')
  @Roles(...SOLO_GERENCIA)
  @ApiOperation({ summary: 'Anular un movimiento (solo gerencia)' })
  annul(
    @Param('id') id: string,
    @Body() body: AnnulMovementDto,
    @Request() req: AuthedRequest,
  ) {
    return this.movementsService.annul(
      id,
      this.userId(req),
      body?.notes ?? 'anulado manualmente',
    );
  }

  @Post('reconcile/:warehouseId')
  @Roles(...SOLO_GERENCIA)
  @ApiOperation({ summary: 'Reconciliar snapshot vs ledger (solo gerencia)' })
  reconcile(@Param('warehouseId') warehouseId: string) {
    return this.movementsService.reconcile(warehouseId);
  }
}
