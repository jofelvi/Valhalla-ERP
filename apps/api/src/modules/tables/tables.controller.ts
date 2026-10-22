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
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { TablesService } from './tables.service';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { UpdateTableStatusDto } from './dto/update-table-status.dto';
import {
  ClaimTableDto,
  ReleaseTableDto,
  HeartbeatTableDto,
} from './dto/claim-table.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRoleEnum } from '@odin6/types';

@ApiTags('tables')
@Controller('api/tables')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  @Get()
  @ApiOperation({ summary: 'List all tables (optional status filter)' })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by table status (ISAVAILABLE, OCCUPIED, etc)',
  })
  @ApiResponse({ status: 200, description: 'Tables retrieved successfully' })
  async findAll(@Query('status') status?: string) {
    return this.tablesService.findAll(status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get table by ID' })
  @ApiResponse({ status: 200, description: 'Table retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Table not found' })
  async findById(@Param('id') id: string) {
    return this.tablesService.findById(id);
  }

  @Post()
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Create new table (ADMIN, MANAGER)' })
  @ApiResponse({ status: 201, description: 'Table created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async create(@Body() createTableDto: CreateTableDto) {
    return this.tablesService.create(createTableDto);
  }

  @Patch(':id')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Update table (ADMIN, MANAGER)' })
  @ApiResponse({ status: 200, description: 'Table updated successfully' })
  @ApiResponse({ status: 404, description: 'Table not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async update(
    @Param('id') id: string,
    @Body() updateTableDto: UpdateTableDto,
  ) {
    return this.tablesService.update(id, updateTableDto);
  }

  @Patch(':id/status')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER, UserRoleEnum.WAITER)
  @ApiOperation({
    summary: 'Update table status with 3 fields (status, isAvailable, orderId)',
  })
  @ApiResponse({
    status: 200,
    description: 'Table status updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Table not found' })
  async updateStatus(
    @Param('id') id: string,
    @Body() updateTableStatusDto: UpdateTableStatusDto,
  ) {
    return this.tablesService.updateStatus(id, updateTableStatusDto);
  }

  @Post(':id/claim')
  @Roles(
    UserRoleEnum.ADMIN,
    UserRoleEnum.MANAGER,
    UserRoleEnum.WAITER,
    UserRoleEnum.CASHIER,
  )
  @ApiOperation({
    summary: 'Reservar mesa para un mesonero antes de crear la orden',
  })
  @ApiResponse({ status: 201, description: 'Mesa reservada' })
  @ApiResponse({ status: 400, description: 'Mesa ya tomada u ocupada' })
  async claim(@Param('id') id: string, @Body() dto: ClaimTableDto) {
    return this.tablesService.claim(id, dto);
  }

  @Post(':id/release')
  @Roles(
    UserRoleEnum.ADMIN,
    UserRoleEnum.MANAGER,
    UserRoleEnum.WAITER,
    UserRoleEnum.CASHIER,
  )
  @ApiOperation({ summary: 'Liberar una mesa reservada sin orden' })
  @ApiResponse({ status: 201, description: 'Mesa liberada (idempotente)' })
  async release(@Param('id') id: string, @Body() dto: ReleaseTableDto) {
    return this.tablesService.release(id, dto);
  }

  @Post(':id/heartbeat')
  @Roles(
    UserRoleEnum.ADMIN,
    UserRoleEnum.MANAGER,
    UserRoleEnum.WAITER,
    UserRoleEnum.CASHIER,
  )
  @ApiOperation({
    summary: 'Renovar timestamp de reserva mientras se arma el pedido',
  })
  @ApiResponse({ status: 201, description: 'Heartbeat registrado' })
  async heartbeat(@Param('id') id: string, @Body() dto: HeartbeatTableDto) {
    return this.tablesService.heartbeat(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Soft delete table (ADMIN, MANAGER)' })
  @ApiResponse({ status: 204, description: 'Table deleted successfully' })
  @ApiResponse({ status: 404, description: 'Table not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async softDelete(@Param('id') id: string) {
    await this.tablesService.softDelete(id);
  }
}
