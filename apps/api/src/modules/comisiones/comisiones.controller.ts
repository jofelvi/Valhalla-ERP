import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Body,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ComisionesService } from './comisiones.service';
import { CreatePagoComisionDto } from './dto/create-pago-comision.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRoleEnum } from '@odin6/types';

@ApiTags('comisiones')
@Controller('api/comisiones')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ComisionesController {
  constructor(private readonly comisionesService: ComisionesService) {}

  @Get('ordenes-pendientes')
  @ApiOperation({ summary: 'Get pending orders for waiter' })
  @ApiResponse({
    status: 200,
    description: 'Pending orders retrieved successfully',
  })
  async findOrdenesPendientes(@Query('waiterId') waiterId: string) {
    return this.comisionesService.findOrdenespendientes(waiterId);
  }

  @Get('calcular')
  @ApiOperation({ summary: 'Calculate commission for waiter' })
  @ApiResponse({
    status: 200,
    description: 'Commission calculated successfully',
  })
  async calcularComision(@Query('waiterId') waiterId: string) {
    return this.comisionesService.calcularComision(waiterId);
  }

  @Get('historial')
  @ApiOperation({ summary: 'Get commission payment history for waiter' })
  @ApiResponse({ status: 200, description: 'History retrieved successfully' })
  @ApiQuery({ name: 'waiterId', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  async findHistorial(
    @Query('waiterId') waiterId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.comisionesService.findHistorial(waiterId, { from, to });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get commission payment by ID' })
  @ApiResponse({ status: 200, description: 'Payment retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async findById(@Param('id') id: string) {
    return this.comisionesService.findById(id);
  }

  @Post('pagar')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Record commission payment (ADMIN, MANAGER)' })
  @ApiResponse({ status: 201, description: 'Payment recorded successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async pagarComision(@Body() createPagoComisionDto: CreatePagoComisionDto) {
    return this.comisionesService.pagarComision(createPagoComisionDto);
  }
}
