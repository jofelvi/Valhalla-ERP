import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PrintQueueService } from './print-queue.service';
import { CreatePrintJobDto } from './dto/create-print-job.dto';
import { UpdatePrintJobStatusDto } from './dto/update-print-job-status.dto';
import { ReportIncidentDto } from './dto/report-incident.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PrintServiceKeyGuard } from '../../common/guards/print-service-key.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRoleEnum } from '@odin6/types';
import { PrintGateway } from '../websockets/gateways/print.gateway';

@ApiTags('print-queue')
@Controller('api/print-queue')
export class PrintQueueController {
  constructor(
    private readonly printQueueService: PrintQueueService,
    private readonly printGateway: PrintGateway,
  ) {}

  /**
   * Indica si hay al menos un print-service conectado al gateway WS.
   * La web consulta este endpoint cuando el fetch local a 127.0.0.1:6441
   * falla (ocurre cuando el cajero abre la web desde una PC distinta a
   * la del restaurante). Si hay al menos un print-service vivo, la web
   * encola el job via POST /api/print-queue y el servicio local lo
   * consume via WebSocket o polling.
   */
  @Get('service-status')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Remote print service status (used by web fallback)',
  })
  getServiceStatus() {
    const connected = this.printGateway.getConnectedCount();
    return { connected: connected > 0, connectedClients: connected };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(
    UserRoleEnum.ADMIN,
    UserRoleEnum.MANAGER,
    UserRoleEnum.CASHIER,
    UserRoleEnum.WAITER,
  )
  @ApiOperation({ summary: 'Create print job' })
  @ApiResponse({ status: 201, description: 'Print job created successfully' })
  async create(@Body() createPrintJobDto: CreatePrintJobDto) {
    return this.printQueueService.create(createPrintJobDto);
  }

  @Get('pending')
  @UseGuards(PrintServiceKeyGuard)
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Get pending print jobs (print-service key - see print-service-key.ts)',
  })
  @ApiResponse({
    status: 200,
    description: 'Pending jobs retrieved successfully',
  })
  async getPending() {
    return this.printQueueService.findPending();
  }

  /**
   * Incidentes de impresion reportados por la PC de la caja.
   *
   * Sin auth, igual que `pending` y `:id/status`: lo llaman el watchdog en
   * PowerShell y el print-service, que corren como SYSTEM y no tienen sesion.
   * Es el aviso que faltaba — entre el 9 y el 16 de agosto se perdieron 493
   * comandas de barra y la API nunca se entero porque los jobs se marcaban
   * 'done' aunque el papel jamas saliera.
   */
  @Post('incident')
  @UseGuards(PrintServiceKeyGuard)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Report a printing incident (no auth - used by print service)',
  })
  @ApiResponse({ status: 200, description: 'Incident recorded' })
  reportIncident(@Body() incidente: ReportIncidentDto) {
    return this.printQueueService.reportIncident(incidente);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Get all print jobs' })
  @ApiResponse({
    status: 200,
    description: 'Print jobs retrieved successfully',
  })
  async findAll() {
    return this.printQueueService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get print job by ID' })
  @ApiResponse({ status: 200, description: 'Print job retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Print job not found' })
  async findById(@Param('id') id: string) {
    return this.printQueueService.findById(id);
  }

  @Patch(':id/status')
  @UseGuards(PrintServiceKeyGuard)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Update print job status (no auth - used by print service)',
  })
  @ApiResponse({
    status: 200,
    description: 'Print job status updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Print job not found' })
  async updateStatus(
    @Param('id') id: string,
    @Body() updateDto: UpdatePrintJobStatusDto,
  ) {
    return this.printQueueService.updateStatus(id, updateDto);
  }
}
