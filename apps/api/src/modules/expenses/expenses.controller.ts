import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { UserRoleEnum } from '@odin6/types';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ExpensesService } from './expenses.service';
import { ExpensesReportService } from './expenses-report.service';
import type { FundsSource } from './schemas/expense.schema';

interface AuthedRequest {
  user?: { id?: string; sub?: string; name?: string };
}

class PagarDto {
  @IsIn(['EMPRESA', 'PROPIOS']) fundsSource: FundsSource;
  @IsOptional() @IsString() socio?: string;
}

// Lo mismo que ve el bot, para cuando haga falta una pantalla web.
@ApiTags('expenses')
@Controller('api/expenses')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
@ApiBearerAuth()
export class ExpensesController {
  constructor(
    private readonly expenses: ExpensesService,
    private readonly report: ExpensesReportService,
  ) {}

  @Get('report')
  @ApiOperation({
    summary:
      'Informe semanal de gastos (?week=ISO de cualquier dia de esa semana | anterior)',
  })
  informe(@Query('week') week?: string) {
    if (week === 'anterior') return this.report.semana('anterior');
    return this.report.semana(week ? new Date(week) : new Date());
  }

  @Get('por-pagar')
  porPagar() {
    return this.expenses.porPagar();
  }

  @Get('reembolsos')
  reembolsos() {
    return this.expenses.reembolsosPendientes();
  }

  @Get()
  listar(@Query('from') from: string, @Query('to') to: string) {
    // Validar que los parametros sean fechas validas
    if (!from || !to) {
      throw new BadRequestException(
        'Los parámetros "from" y "to" son requeridos (formato: YYYY-MM-DD o ISO 8601)',
      );
    }

    const desde = new Date(from);
    const hasta = new Date(to);

    if (isNaN(desde.getTime())) {
      throw new BadRequestException(`Fecha "from" inválida: ${from}`);
    }
    if (isNaN(hasta.getTime())) {
      throw new BadRequestException(`Fecha "to" inválida: ${to}`);
    }

    return this.expenses.listar({ desde, hasta });
  }

  @Patch(':id/pagar')
  pagar(
    @Param('id') id: string,
    @Body() dto: PagarDto,
    @Request() req: AuthedRequest,
  ) {
    return this.expenses.marcarPagado(id, {
      fundsSource: dto.fundsSource,
      socio: dto.socio ?? req.user?.name ?? 'web',
    });
  }

  @Patch(':id/reembolsar')
  reembolsar(@Param('id') id: string, @Request() req: AuthedRequest) {
    return this.expenses.marcarReembolsado(id, req.user?.name ?? 'web');
  }
}
