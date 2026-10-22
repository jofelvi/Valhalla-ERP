import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
  Param,
  UseGuards,
  HttpCode,
  Query,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { PayrollService } from './payroll.service';
import { PizzaBonusService } from './pizza-bonus.service';
import { CreatePayrollDto } from './dto/create-payroll.dto';
import { UpdatePayrollDto } from './dto/update-payroll.dto';
import { UpdatePayrollStatusDto } from './dto/update-payroll-status.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ModuloActivoGuard } from '../../common/modulos/modulo-activo.guard';
import { RequiereModulo } from '../../common/modulos/requiere-modulo.decorator';
import { UserRoleEnum } from '@odin6/types';

interface AuthedRequest {
  user?: { id: string; email?: string; role?: string };
}

@ApiTags('payroll')
@Controller('api/payroll')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PayrollController {
  constructor(
    private readonly payrollService: PayrollService,
    private readonly pizzaBonusService: PizzaBonusService,
  ) {}

  /**
   * Bono del pizzero de un rango. La pantalla de nómina lo precarga como
   * ajuste en vez de que el dueño lo copie a mano del correo del lunes — que
   * es como se termina pagando un número distinto al avisado.
   *
   * Recibe el rango de la semana MOSTRADA, no uno fijo: la pantalla permite
   * moverse entre semanas y precargar el bono de otra semana sería peor que
   * no precargar nada.
   */
  @Get('pizza-bonus')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @UseGuards(ModuloActivoGuard)
  @RequiereModulo('productBonus')
  @ApiOperation({ summary: 'Bono del pizzero calculado para un rango' })
  @ApiQuery({ name: 'from', required: true, description: 'ISO date inicio' })
  @ApiQuery({
    name: 'to',
    required: true,
    description: 'ISO date fin (excluyente)',
  })
  async pizzaBonus(@Query('from') from: string, @Query('to') to: string) {
    const desde = new Date(from);
    const hasta = new Date(to);
    if (isNaN(desde.getTime()) || isNaN(hasta.getTime())) {
      throw new BadRequestException('Rango de fechas inválido');
    }
    return this.pizzaBonusService.calcular(desde, hasta);
  }

  @Get('count')
  @ApiOperation({ summary: 'Cuantos pagos de nomina hay' })
  @ApiResponse({ status: 200, description: '{ total }' })
  async count(@Query('employeeId') employeeId?: string) {
    // La cabecera de /private/payroll solo pintaba "N pagos" y para eso se
    // bajaba el historico entero: 194 KB por abrir la pantalla.
    return { total: await this.payrollService.count({ employeeId }) };
  }

  @Get()
  @ApiOperation({ summary: 'List payroll records' })
  @ApiResponse({ status: 200, description: 'Records retrieved successfully' })
  async findAll(
    @Query('employeeId') employeeId?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.payrollService.findAll({
      employeeId,
      month: month ? parseInt(month, 10) : undefined,
      year: year ? parseInt(year, 10) : undefined,
      from,
      to,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get payroll record by ID' })
  @ApiResponse({ status: 200, description: 'Record retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Record not found' })
  async findById(@Param('id') id: string) {
    return this.payrollService.findById(id);
  }

  @Post()
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Create new payroll record (ADMIN, MANAGER)' })
  @ApiResponse({ status: 201, description: 'Record created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async create(
    @Body() createPayrollDto: CreatePayrollDto,
    @Request() req: AuthedRequest,
  ) {
    return this.payrollService.create(createPayrollDto, req.user);
  }

  @Patch(':id')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Update payroll record (ADMIN, MANAGER)' })
  @ApiResponse({ status: 200, description: 'Record updated successfully' })
  @ApiResponse({ status: 404, description: 'Record not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async update(
    @Param('id') id: string,
    @Body() updatePayrollDto: UpdatePayrollDto,
  ) {
    return this.payrollService.update(id, updatePayrollDto);
  }

  @Patch(':id/status')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Update payroll status (ADMIN, MANAGER)' })
  @ApiResponse({ status: 200, description: 'Status updated successfully' })
  @ApiResponse({ status: 404, description: 'Record not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async updateStatus(
    @Param('id') id: string,
    @Body() updatePayrollStatusDto: UpdatePayrollStatusDto,
  ) {
    return this.payrollService.updateStatus(id, updatePayrollStatusDto);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Soft delete payroll record (ADMIN, MANAGER)' })
  @ApiResponse({ status: 204, description: 'Record deleted successfully' })
  @ApiResponse({ status: 404, description: 'Record not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async softDelete(@Param('id') id: string) {
    await this.payrollService.softDelete(id);
  }
}
