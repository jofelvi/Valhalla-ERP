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
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PagoMovilService } from './pago-movil.service';
import { CreatePagoMovilDto } from './dto/create-pago-movil.dto';
import {
  UpdatePagoMovilDto,
  VerifyPagoMovilDto,
} from './dto/update-pago-movil.dto';
import { BankVerifyDto } from './dto/bank-verify.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ModuloActivoGuard } from '../../common/modulos/modulo-activo.guard';
import { RequiereModulo } from '../../common/modulos/requiere-modulo.decorator';

@ApiTags('pago-movil')
@Controller('api/pago-movil')
@UseGuards(JwtAuthGuard, ModuloActivoGuard)
@ApiBearerAuth()
export class PagoMovilController {
  constructor(private readonly pagoMovilService: PagoMovilService) {}

  @Get()
  @ApiOperation({
    summary: 'List PagoMovil records (filterable by orderId, status)',
  })
  @ApiResponse({ status: 200, description: 'PagoMovil records listed' })
  async findAll(
    @Query('orderId') orderId?: string,
    @Query('status') status?: string,
  ) {
    return this.pagoMovilService.findAll({ orderId, status });
  }

  @Get('by-reference/:ref')
  @ApiOperation({
    summary: 'Find PagoMovil by reference number (returns null if not found)',
  })
  @ApiResponse({ status: 200, description: 'PagoMovil found or null' })
  async findByReference(@Param('ref') ref: string) {
    return this.pagoMovilService.findByReference(ref);
  }

  @Get('is-verified/:ref')
  @ApiOperation({
    summary: 'Check if reference is verified, returns existing payment if so',
  })
  @ApiResponse({ status: 200, description: 'Verification status checked' })
  async isVerified(@Param('ref') ref: string) {
    return this.pagoMovilService.isVerified(ref);
  }

  @Post()
  @ApiOperation({ summary: 'Create new PagoMovil record' })
  @ApiResponse({ status: 201, description: 'PagoMovil created' })
  async create(@Body() createPagoMovilDto: CreatePagoMovilDto) {
    return this.pagoMovilService.create(createPagoMovilDto);
  }

  @Post('verify')
  @ApiOperation({
    summary: 'Verificar PagoMovil manualmente (actualiza status en BD)',
  })
  @ApiResponse({ status: 200, description: 'PagoMovil verified' })
  @ApiResponse({ status: 404, description: 'PagoMovil not found' })
  async verify(@Body() verifyDto: VerifyPagoMovilDto) {
    return this.pagoMovilService.verify(verifyDto);
  }

  @Post('bank-verify')
  @ApiOperation({
    summary:
      'Verificar Pago Móvil consultando directamente el banco (Banvenez)',
    description:
      'Lanza Playwright headless, inicia sesión en la banca en línea y busca la referencia. ' +
      'Si se provee pagoMovilId, actualiza el status en BD: verified | amount_mismatch | not_found. ' +
      'Tarda ~30-60s por login bancario.',
  })
  @ApiResponse({
    status: 200,
    description: 'Resultado de la verificación bancaria',
  })
  @ApiResponse({ status: 404, description: 'PagoMovilId no encontrado en BD' })
  @RequiereModulo('bankReconciliation')
  async bankVerify(@Body() bankVerifyDto: BankVerifyDto) {
    return this.pagoMovilService.bankVerify(bankVerifyDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get PagoMovil by ID' })
  @ApiResponse({ status: 200, description: 'PagoMovil retrieved' })
  @ApiResponse({ status: 404, description: 'PagoMovil not found' })
  async findById(@Param('id') id: string) {
    return this.pagoMovilService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update PagoMovil record' })
  @ApiResponse({ status: 200, description: 'PagoMovil updated' })
  @ApiResponse({ status: 404, description: 'PagoMovil not found' })
  async update(
    @Param('id') id: string,
    @Body() updatePagoMovilDto: UpdatePagoMovilDto,
  ) {
    return this.pagoMovilService.update(id, updatePagoMovilDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete PagoMovil record' })
  @ApiResponse({ status: 200, description: 'PagoMovil deleted' })
  @ApiResponse({ status: 404, description: 'PagoMovil not found' })
  async remove(@Param('id') id: string) {
    return this.pagoMovilService.remove(id);
  }
}
