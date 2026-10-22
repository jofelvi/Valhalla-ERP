import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WeeklyReportService } from './weekly-report.service';
import { GenerateReportDto } from './dto/generate-report.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { weekStartOf } from './units';
import { ConfigsService } from '../configs/configs.service';

interface AuthedRequest {
  user?: { id?: string; sub?: string };
}

@ApiTags('inventory')
@Controller('api/inventory/weekly-reports')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WeeklyReportController {
  constructor(
    private readonly weeklyReportService: WeeklyReportService,
    private readonly configs: ConfigsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar últimos N informes semanales' })
  async list(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 12;
    return this.weeklyReportService.list(parsedLimit);
  }

  @Get('current')
  @ApiOperation({
    summary: 'Obtener informe de la semana actual',
    description:
      'Devuelve el informe de la semana en curso si existe, 404 en caso contrario',
  })
  async getCurrent() {
    const report = await this.weeklyReportService.getCurrent();
    if (!report) {
      throw new NotFoundException('Informe de la semana actual no encontrado');
    }
    return report;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener informe completo por ID' })
  async getById(@Param('id') id: string) {
    const report = await this.weeklyReportService.getById(id);
    if (!report) {
      throw new NotFoundException(`Informe ${id} no encontrado`);
    }
    return report;
  }

  @Post('generate')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Generar o regenerar informe semanal',
    description:
      'Sin weekStart genera la semana pasada completa (que contiene datos completos)',
  })
  async generate(@Body() dto: GenerateReportDto) {
    let weekStart: Date;
    if (dto.weekStart) {
      weekStart = new Date(dto.weekStart);
    } else {
      // Semana pasada completa: 7 días atrás desde el inicio de semana actual
      const now = new Date();
      const op = await this.configs.obtener('operacion');
      const currentWeekStart = weekStartOf(now, op);
      weekStart = new Date(currentWeekStart.getTime() - 7 * 24 * 3600 * 1000);
    }

    return this.weeklyReportService.generate(weekStart);
  }

  @Post(':id/retry-ai')
  @ApiOperation({
    summary: 'Reintentar narrativa IA',
    description:
      'Reintenta generar la narrativa de DeepSeek para los KPIs existentes',
  })
  async retryAi(@Param('id') id: string) {
    return this.weeklyReportService.retryAi(id);
  }

  @Post(':id/send-whatsapp')
  @ApiOperation({
    summary: 'Enviar informe por WhatsApp',
    description: 'Intenta enviar el informe resumido al teléfono configurado',
  })
  async sendWhatsapp(@Param('id') id: string) {
    return this.weeklyReportService.sendWhatsapp(id);
  }
}
