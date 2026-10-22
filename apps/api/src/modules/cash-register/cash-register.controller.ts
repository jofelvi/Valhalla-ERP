import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { CashRegisterService } from './cash-register.service';
import { OpenSessionDto } from './dto/open-session.dto';
import { CloseSessionDto } from './dto/close-session.dto';
import { LogEventDto } from './dto/log-event.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('cash-register')
@Controller('api/cash-register')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CashRegisterController {
  constructor(private readonly cashRegisterService: CashRegisterService) {}

  @Get('active')
  @ApiOperation({ summary: 'Obtener sesion abierta del usuario' })
  @ApiQuery({ name: 'userId', required: true })
  getActive(@Query('userId') userId: string) {
    return this.cashRegisterService.getActiveSession(userId);
  }

  @Post('sessions')
  @ApiOperation({ summary: 'Abrir nueva sesion de caja' })
  @ApiResponse({ status: 201, description: 'Sesion abierta' })
  @ApiResponse({ status: 400, description: 'Ya existe una sesion abierta' })
  openSession(@Body() dto: OpenSessionDto) {
    return this.cashRegisterService.openSession(dto);
  }

  @Patch('sessions/:id/close')
  @ApiOperation({ summary: 'Cerrar sesion de caja con resumen' })
  closeSession(@Param('id') id: string, @Body() dto: CloseSessionDto) {
    return this.cashRegisterService.closeSession(id, dto);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Historial de sesiones cerradas del usuario' })
  @ApiQuery({ name: 'userId', required: true })
  @ApiQuery({ name: 'limit', required: false })
  getSessionHistory(
    @Query('userId') userId: string,
    @Query('limit') limit?: string,
  ) {
    const max = limit ? parseInt(limit, 10) : 20;
    return this.cashRegisterService.getSessionHistory(userId, max);
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: 'Obtener sesion por id' })
  getById(@Param('id') id: string) {
    return this.cashRegisterService.getSessionById(id);
  }

  @Get('sessions/:id/resumen')
  @ApiOperation({
    summary: 'Resumen de cobros de la sesion, agregado en el servidor',
  })
  @ApiResponse({
    status: 200,
    description:
      'Total, ordenes distintas y desglose por metodo de la ventana de la ' +
      'sesion. Reemplaza al GET /api/payments sin filtros que hacia la ' +
      'pantalla de cierre: 247 KB y 4.336 pagos para sumar unos pocos.',
  })
  getResumen(@Param('id') id: string) {
    return this.cashRegisterService.getResumenDeSesion(id);
  }

  @Post('sessions/:id/events')
  @ApiOperation({ summary: 'Registrar evento en el timeline de la sesion' })
  logEvent(@Param('id') id: string, @Body() dto: LogEventDto) {
    return this.cashRegisterService.logEvent(id, dto);
  }

  @Get('sessions/:id/events')
  @ApiOperation({ summary: 'Timeline de eventos de la sesion' })
  getEvents(@Param('id') id: string) {
    return this.cashRegisterService.getSessionEvents(id);
  }
}
