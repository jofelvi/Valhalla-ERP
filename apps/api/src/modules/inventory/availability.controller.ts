import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRoleEnum } from '@odin6/types';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AvailabilityService } from './availability.service';
import { esGerencia } from './station-scope.util';

interface AuthedRequest {
  user?: { id?: string; email?: string; role?: string };
}

@ApiTags('inventory')
@Controller('api/inventory/availability')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Get()
  // Todo el personal que vende o despacha necesita saber si hay: el aviso
  // pierde el sentido si solo lo ve gerencia.
  @Roles(
    UserRoleEnum.ADMIN,
    UserRoleEnum.MANAGER,
    UserRoleEnum.CASHIER,
    UserRoleEnum.WAITER,
    UserRoleEnum.KITCHEN,
    UserRoleEnum.BAR,
    UserRoleEnum.PIZZA,
  )
  @ApiOperation({
    summary: 'Que se puede vender ahora (avisa, no bloquea)',
  })
  listar(@Query('station') station: string, @Req() req: AuthedRequest) {
    return this.availability.listar({
      station: station || undefined,
      esGerencia: esGerencia(req.user?.role),
    });
  }
}
