import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  UnauthorizedException,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InsumoRequestsService } from './insumo-requests.service';
import {
  CreateInsumoRequestDto,
  RejectInsumoRequestDto,
} from './dto/create-insumo-request.dto';
import { ApproveInsumoRequestDto } from './dto/approve-insumo-request.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthService } from '../auth/auth.service';

interface AuthedRequest {
  user?: { id?: string; sub?: string; name?: string; role?: string };
}

@ApiTags('inventory')
@Controller('api/insumo-requests')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InsumoRequestsController {
  constructor(
    private readonly service: InsumoRequestsService,
    private readonly authService: AuthService,
  ) {}

  private actor(req: AuthedRequest) {
    const u = req.user;
    return { id: u?.id ?? u?.sub, name: u?.name, role: u?.role };
  }

  /**
   * Quien autoriza la solicitud.
   *
   * Sin PIN es el dueño del token, como siempre. Con PIN es el jefe al que
   * pertenece ese PIN: el traslado queda registrado a SU nombre aunque se haya
   * tecleado en el telefono de la estacion, que es justamente lo que hace
   * auditable la autorizacion en el acto.
   */
  private async autorizador(req: AuthedRequest, pin?: string) {
    if (!pin?.trim()) return this.actor(req);

    const { valid, adminName, adminId, adminRole } =
      await this.authService.verifyAdminPin(pin);
    if (!valid) {
      throw new UnauthorizedException('PIN incorrecto');
    }

    return {
      id: adminId ?? undefined,
      name: adminName ?? undefined,
      role: adminRole ?? undefined,
    };
  }

  @Post()
  @ApiOperation({ summary: 'Una estación solicita insumos al depósito' })
  create(@Body() dto: CreateInsumoRequestDto, @Req() req: AuthedRequest) {
    return this.service.create(dto, this.actor(req));
  }

  @Post('preview-production')
  @ApiOperation({
    summary:
      'Que descontaria una produccion (sin registrar nada): crudo, costo y faltantes',
  })
  previewProduction(
    @Body()
    body: {
      station: string;
      items: Array<{ productId: string; qty: number; unit?: string }>;
    },
  ) {
    return this.service.previewProduction(body.station, body.items ?? []);
  }

  @Get()
  @ApiOperation({ summary: 'Listar solicitudes (filtrable por status)' })
  list(@Query('status') status?: string) {
    return this.service.list(status);
  }

  @Get('pending/count')
  @ApiOperation({ summary: 'Cantidad de solicitudes pendientes (badge admin)' })
  async pendingCount() {
    return { count: await this.service.countPending() };
  }

  @Patch(':id/approve')
  @ApiOperation({
    summary:
      'Aprobar: transfiere el stock del depósito a la estación. Admin/gerente, o cualquiera con el PIN de un jefe.',
  })
  async approve(
    @Param('id') id: string,
    @Body() dto: ApproveInsumoRequestDto,
    @Req() req: AuthedRequest,
  ) {
    return this.service.approve(id, await this.autorizador(req, dto?.pin));
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Rechazar una solicitud. Admin/gerente.' })
  reject(
    @Param('id') id: string,
    @Body() dto: RejectInsumoRequestDto,
    @Req() req: AuthedRequest,
  ) {
    return this.service.reject(id, dto?.reason, this.actor(req));
  }
}
