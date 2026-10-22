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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRoleEnum } from '@odin6/types';

@ApiTags('invoices')
@Controller('api/invoices')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  @ApiOperation({ summary: 'List all invoices' })
  @ApiResponse({ status: 200, description: 'Invoices listed' })
  @ApiQuery({ name: 'orderId', required: false })
  @ApiQuery({ name: 'customerId', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({
    name: 'vista',
    required: false,
    description:
      "'lista' recorta a los campos de la tabla (fuera `items`, el 56% del peso). Sin el parametro se manda la factura completa.",
  })
  async findAll(
    @Query('orderId') orderId?: string,
    @Query('customerId') customerId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
    @Query('vista') vista?: string,
  ) {
    return this.invoicesService.findAll({
      orderId,
      customerId,
      from,
      to,
      limit,
      page,
      vista,
    });
  }

  @Get('next-control-number')
  @ApiOperation({ summary: 'Get next sequential control number for invoice' })
  @ApiResponse({ status: 200, description: 'Next control number' })
  async getNextControlNumber() {
    return this.invoicesService.getNextControlNumber();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get invoice by ID' })
  @ApiResponse({ status: 200, description: 'Invoice retrieved' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async findById(@Param('id') id: string) {
    return this.invoicesService.findById(id);
  }

  @Get(':id/details')
  @ApiOperation({
    summary: 'Get invoice with enriched data (order, customer, payments)',
  })
  @ApiResponse({ status: 200, description: 'Invoice details retrieved' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async findDetails(@Param('id') id: string) {
    return this.invoicesService.findDetails(id);
  }

  @Get('by-number/:num')
  @ApiOperation({ summary: 'Find invoice by invoice number' })
  @ApiResponse({ status: 200, description: 'Invoice found' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async findByNumber(@Param('num') num: string) {
    return this.invoicesService.findByNumber(num);
  }

  @Get('by-order/:orderId')
  @ApiOperation({ summary: 'Find invoice by order ID' })
  @ApiResponse({ status: 200, description: 'Invoice found' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async findByOrderId(@Param('orderId') orderId: string) {
    return this.invoicesService.findByOrderId(orderId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(
    UserRoleEnum.ADMIN,
    UserRoleEnum.MANAGER,
    UserRoleEnum.CASHIER,
    UserRoleEnum.WAITER,
  )
  @ApiOperation({ summary: 'Create new invoice' })
  @ApiResponse({ status: 201, description: 'Invoice created' })
  async create(@Body() createInvoiceDto: CreateInvoiceDto) {
    return this.invoicesService.create(createInvoiceDto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update invoice' })
  @ApiResponse({ status: 200, description: 'Invoice updated' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async update(
    @Param('id') id: string,
    @Body() updateInvoiceDto: UpdateInvoiceDto,
  ) {
    return this.invoicesService.update(id, updateInvoiceDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete invoice' })
  @ApiResponse({ status: 200, description: 'Invoice deleted' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async remove(@Param('id') id: string) {
    return this.invoicesService.remove(id);
  }
}
