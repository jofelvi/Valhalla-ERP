import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { PublicService } from './public.service';
import { ConsumoCreditoDto } from './dto/consumo-credito.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('public')
@Controller('api/public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get('accounts-receivable/:id')
  @ApiOperation({
    summary: 'Get limited accounts receivable info (no auth)',
  })
  @ApiResponse({
    status: 200,
    description: 'Accounts receivable info retrieved',
  })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getAccountReceivableInfo(@Param('id') id: string) {
    return this.publicService.getAccountReceivableInfo(id);
  }

  @Get('accounts-receivable/by-number/:invoiceNumber')
  @ApiOperation({
    summary:
      'Get account receivable by invoiceNumber with orders+customer (no auth)',
  })
  @ApiResponse({ status: 200, description: 'Account + orders + customer' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getAccountReceivableByInvoiceNumber(
    @Param('invoiceNumber') invoiceNumber: string,
  ) {
    return this.publicService.getAccountReceivableByInvoiceNumber(
      invoiceNumber,
    );
  }

  @Get('orders/:identifier')
  @ApiOperation({
    summary: 'Get order by ID or invoiceNumber (no auth)',
  })
  @ApiResponse({ status: 200, description: 'Order retrieved' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getOrderByIdOrInvoiceNumber(@Param('identifier') identifier: string) {
    return this.publicService.getOrderByIdOrInvoiceNumber(identifier);
  }

  @Get('members/:action')
  @ApiOperation({
    summary: 'Member lookup by action number (no auth)',
  })
  @ApiResponse({ status: 200, description: 'Member found' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async getMemberLookupByAction(@Param('action') action: string) {
    return this.publicService.getMemberLookupByAction(action);
  }

  @Get('members/by-cedula/:cedula')
  @ApiOperation({ summary: 'Member lookup by cedula (no auth)' })
  @ApiResponse({ status: 200, description: 'Member found' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async getMemberLookupByCedula(@Param('cedula') cedula: string) {
    return this.publicService.getMemberLookupByCedula(cedula);
  }

  /**
   * Anota el consumo a credito de un socio al cobrar.
   *
   * Unica ruta con sesion de este controlador: mueve dinero. Vive aqui porque
   * el padron (`members`) se sirve desde este modulo y no hay otro.
   */
  @Patch('members/:action/credito')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Registrar consumo a credito de un socio' })
  @ApiResponse({ status: 200, description: 'Credito actualizado' })
  @ApiResponse({ status: 400, description: 'Sin credito disponible' })
  @ApiResponse({ status: 404, description: 'Socio no encontrado' })
  async registrarConsumoDeCredito(
    @Param('action') action: string,
    @Body() dto: ConsumoCreditoDto,
  ) {
    return this.publicService.registrarConsumoDeCredito(action, dto.monto);
  }
}
