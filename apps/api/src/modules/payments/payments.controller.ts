import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { PaymentsService, PaymentWithOrder } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRoleEnum } from '@odin6/types';

@ApiTags('payments')
@Controller('api/payments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @ApiOperation({ summary: 'List payments with optional filters' })
  @ApiQuery({ name: 'orderId', required: false })
  @ApiResponse({ status: 200, description: 'Payments listed' })
  async findAll(@Query('orderId') orderId?: string) {
    return this.paymentsService.findAll({ orderId });
  }

  @Get('estado-de-cobro/:orderId')
  @ApiOperation({
    summary:
      'Estado de cobro autoritativo de una orden (consultar ANTES de cerrar)',
  })
  @ApiResponse({
    status: 200,
    description:
      'Consumo, propina, total a cobrar, ya cobrado y cuanto falta. La pantalla ' +
      'del cajero puede estar vieja o haber dos dispositivos en la misma cuenta: ' +
      'la verdad la tiene el servidor.',
  })
  async estadoDeCobro(@Param('orderId') orderId: string) {
    return this.paymentsService.estadoDeCobro(orderId);
  }

  @Get('by-order/:orderId')
  @ApiOperation({ summary: 'Get payments for specific order' })
  @ApiResponse({ status: 200, description: 'Payments retrieved' })
  async findByOrderId(@Param('orderId') orderId: string) {
    return this.paymentsService.findByOrderId(orderId);
  }

  @Get('check-reference/:ref')
  @ApiOperation({ summary: 'Check if reference/transaction already used' })
  @ApiResponse({ status: 200, description: 'Reference status checked' })
  async checkReference(@Param('ref') ref: string) {
    return this.paymentsService.checkReference(ref);
  }

  @Get('check-reference-used/:ref')
  @ApiOperation({
    summary:
      'Check if reference is used in payments or pagoMoviles (with excludeOrderId)',
  })
  @ApiResponse({ status: 200, description: 'Conflict info or null' })
  async checkReferenceUsed(
    @Param('ref') ref: string,
    @Query('excludeOrderId') excludeOrderId?: string,
    @Query('method') method?: string,
  ) {
    return this.paymentsService.checkReferenceUsed(ref, excludeOrderId, method);
  }

  @Get('by-waiter')
  @ApiOperation({
    summary: 'Get payments for a waiter with optional date range',
  })
  @ApiQuery({ name: 'waiterId', required: true })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiResponse({
    status: 200,
    description: 'Payments with embedded order data',
  })
  @ApiResponse({
    status: 400,
    description: 'waiterId es requerido',
  })
  async findByWaiter(
    @Query('waiterId') waiterId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<PaymentWithOrder[]> {
    if (!waiterId) {
      throw new BadRequestException('waiterId es requerido');
    }
    return this.paymentsService.findByWaiter(waiterId, from, to);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(
    UserRoleEnum.ADMIN,
    UserRoleEnum.MANAGER,
    UserRoleEnum.CASHIER,
    UserRoleEnum.WAITER,
  )
  @ApiOperation({ summary: 'Create new payment' })
  @ApiResponse({ status: 201, description: 'Payment created' })
  async create(@Body() createPaymentDto: CreatePaymentDto) {
    return this.paymentsService.create(createPaymentDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get payment by ID' })
  @ApiResponse({ status: 200, description: 'Payment retrieved' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async findById(@Param('id') id: string) {
    return this.paymentsService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update payment' })
  @ApiResponse({ status: 200, description: 'Payment updated' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async update(
    @Param('id') id: string,
    @Body() updatePaymentDto: UpdatePaymentDto,
  ) {
    return this.paymentsService.update(id, updatePaymentDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete payment' })
  @ApiResponse({ status: 200, description: 'Payment deleted' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async remove(@Param('id') id: string) {
    return this.paymentsService.remove(id);
  }
}
