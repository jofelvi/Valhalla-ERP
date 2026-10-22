import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ClientLogsService, ClientLogInput } from './client-logs.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRoleEnum } from '@odin6/types';

interface ClientLogPayload extends Partial<ClientLogInput> {
  timestamp?: string;
}

@ApiTags('client-logs')
@Controller('api/client-logs')
export class ClientLogsController {
  constructor(private readonly service: ClientLogsService) {}

  /**
   * POST sin auth — cualquier cliente (APK o web) puede enviar su log.
   * Errores y warns se persisten a Mongo (TTL 30 dias), info solo pm2.
   */
  @Post()
  @HttpCode(204)
  @ApiOperation({ summary: 'Log evento del cliente (APK/web)' })
  async log(@Body() payload: ClientLogPayload): Promise<void> {
    await this.service.record({
      level: payload.level ?? 'info',
      source: payload.source ?? 'unknown',
      message: payload.message ?? '',
      context: payload.context ?? null,
      stack: payload.stack ?? null,
      userId: payload.userId ?? null,
      userEmail: payload.userEmail ?? null,
      platform: payload.platform ?? null,
      appVersion: payload.appVersion ?? null,
      clientTime: payload.clientTime,
    });
  }

  /**
   * POST batch — permite enviar varios logs acumulados en un solo request
   * (util para sincronizar queue offline al recuperar conexion).
   */
  @Post('batch')
  @HttpCode(204)
  @ApiOperation({ summary: 'Log batch de eventos del cliente' })
  async logBatch(
    @Body() payload: { items: ClientLogPayload[] },
  ): Promise<void> {
    const items = Array.isArray(payload?.items) ? payload.items : [];
    if (items.length === 0) return;
    const inputs: ClientLogInput[] = items.slice(0, 100).map((p) => ({
      level: p.level ?? 'info',
      source: p.source ?? 'unknown',
      message: p.message ?? '',
      context: p.context ?? null,
      stack: p.stack ?? null,
      userId: p.userId ?? null,
      userEmail: p.userEmail ?? null,
      platform: p.platform ?? null,
      appVersion: p.appVersion ?? null,
      clientTime: p.clientTime, // Preservar clientTime si viene
    }));
    await this.service.recordBatch(inputs);
  }

  /**
   * GET con auth admin: lista los errores recientes persistidos.
   */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Listar errores recientes (ADMIN/MANAGER)' })
  @ApiQuery({ name: 'level', required: false, enum: ['info', 'warn', 'error'] })
  @ApiQuery({ name: 'source', required: false })
  @ApiQuery({ name: 'platform', required: false })
  @ApiQuery({ name: 'appVersion', required: false })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'max 1000, default 200',
  })
  @ApiQuery({
    name: 'sinceHours',
    required: false,
    description: 'Solo eventos de las ultimas N horas',
  })
  async findRecent(
    @Query('level') level?: 'info' | 'warn' | 'error',
    @Query('source') source?: string,
    @Query('platform') platform?: string,
    @Query('appVersion') appVersion?: string,
    @Query('userId') userId?: string,
    @Query('limit') limit?: string,
    @Query('sinceHours') sinceHours?: string,
  ) {
    const since = sinceHours
      ? new Date(Date.now() - Number(sinceHours) * 60 * 60 * 1000)
      : undefined;
    return this.service.findRecent({
      level,
      source,
      platform,
      appVersion,
      userId,
      limit: limit ? Number(limit) : undefined,
      since,
    });
  }

  /**
   * GET /episodes — episodios de conectividad (outages) del mes.
   * Solo ADMIN/MANAGER, requiere ?year=2026&month=9.
   * Retorna: array de episodios + summary con cantidad, max duración, total minutos offline.
   */
  @Get('episodes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({
    summary: 'Episodios de conectividad del mes (ADMIN/MANAGER)',
  })
  @ApiQuery({
    name: 'year',
    required: true,
    description: 'Año (ej: 2026)',
  })
  @ApiQuery({
    name: 'month',
    required: true,
    description: 'Mes (1-12)',
  })
  async getConnectivityEpisodes(
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const y = year ? Number(year) : new Date().getFullYear();
    const m = month ? Number(month) : new Date().getMonth() + 1;

    if (m < 1 || m > 12 || y < 2000 || y > 2100) {
      return {
        error: 'year debe estar entre 2000-2100, month entre 1-12',
      };
    }

    return this.service.getConnectivityEpisodes({ year: y, month: m });
  }
}
