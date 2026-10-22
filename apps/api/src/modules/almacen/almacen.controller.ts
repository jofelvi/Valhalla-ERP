import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AlmacenService } from './almacen.service';
import { OpenDayDto } from './dto/open-day.dto';
import { CloseDayDto } from './dto/close-day.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { LinkOrderDto } from './dto/link-order.dto';
import { TransferToDailyDto } from './dto/transfer-to-daily.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRoleEnum } from '@odin6/types';

@ApiTags('almacen')
@Controller('api/almacen')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AlmacenController {
  constructor(private readonly almacenService: AlmacenService) {}

  @Get('diario/activo')
  @ApiOperation({ summary: 'Get active inventory day' })
  @ApiResponse({
    status: 200,
    description: 'Active day, or empty body (null) when none is open',
  })
  getActiveDay() {
    return this.almacenService.getActiveDay();
  }

  @Get('diario/:fecha')
  @ApiOperation({ summary: 'Get inventory day by date' })
  @ApiResponse({ status: 200, description: 'Day found' })
  @ApiResponse({ status: 404, description: 'Day not found' })
  getDayByDate(@Param('fecha') fecha: string) {
    return this.almacenService.getDayByDate(fecha);
  }

  @Post('diario/abrir')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Open inventory day' })
  @ApiResponse({ status: 201, description: 'Day opened' })
  @ApiResponse({ status: 400, description: 'Day already open' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  openDay(@Body() openDayDto: OpenDayDto) {
    return this.almacenService.openDay(openDayDto);
  }

  @Post('diario/:fecha/cerrar')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Close inventory day' })
  @ApiResponse({ status: 200, description: 'Day closed' })
  @ApiResponse({ status: 404, description: 'Day not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  closeDay(@Param('fecha') fecha: string, @Body() closeDayDto: CloseDayDto) {
    return this.almacenService.closeDay(fecha, closeDayDto);
  }

  @Post('diario/:fecha/ajustar-stock')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Adjust stock for active day' })
  @ApiResponse({ status: 200, description: 'Stock adjusted' })
  @ApiResponse({ status: 404, description: 'Day not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  adjustStock(
    @Param('fecha') fecha: string,
    @Body() adjustStockDto: AdjustStockDto,
  ) {
    return this.almacenService.adjustStock(fecha, adjustStockDto);
  }

  @Post('diario/:fecha/vincular-orden')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER, UserRoleEnum.WAITER)
  @ApiOperation({ summary: 'Link order to inventory day' })
  @ApiResponse({ status: 200, description: 'Order linked' })
  @ApiResponse({ status: 404, description: 'Day not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  linkOrder(@Param('fecha') fecha: string, @Body() linkOrderDto: LinkOrderDto) {
    return this.almacenService.linkOrder(fecha, linkOrderDto);
  }

  @Get('plantillas/default')
  @ApiOperation({ summary: 'Get default stock template' })
  @ApiResponse({ status: 200, description: 'Default template' })
  async getDefaultTemplate() {
    return this.almacenService.getDefaultTemplate();
  }

  @Post('plantillas')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Save stock template' })
  @ApiResponse({ status: 201, description: 'Template saved' })
  async saveTemplate(
    @Body()
    body: {
      productos: unknown[];
      nombre: string;
      isDefault?: boolean;
      usuario?: string;
    },
  ) {
    return this.almacenService.saveTemplate(body);
  }

  @Get('general')
  @ApiOperation({ summary: 'Get general inventory' })
  @ApiResponse({ status: 200, description: 'General inventory' })
  getGeneralInventory() {
    return this.almacenService.getGeneralInventory();
  }

  @Post('general/transferir')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Transfer from general to daily inventory' })
  @ApiResponse({ status: 200, description: 'Transferred' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  transferToDaily(@Body() transferToDailyDto: TransferToDailyDto) {
    return this.almacenService.transferToDaily(transferToDailyDto);
  }
}
