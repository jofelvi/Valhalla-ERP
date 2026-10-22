import {
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
  ApiQuery,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AccountsReceivableService } from './accounts-receivable.service';
import { CreateAccountReceivableDto } from './dto/create-account-receivable.dto';
import { UpdateAccountReceivableDto } from './dto/update-account-receivable.dto';
import { MergeAccountsDto, UnmergeAccountDto } from './dto/merge-accounts.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRoleEnum } from '@odin6/types';
import {
  parseBandera,
  parseCustomerIds,
} from './accounts-receivable-filter.util';

interface AuthedRequest {
  user?: { id: string; email?: string; role?: string };
}

@ApiTags('accounts-receivable')
@Controller('api/accounts-receivable')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AccountsReceivableController {
  constructor(
    private readonly accountsReceivableService: AccountsReceivableService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List accounts receivable' })
  @ApiResponse({ status: 200, description: 'Accounts retrieved successfully' })
  @ApiQuery({ name: 'customerId', required: false })
  @ApiQuery({
    name: 'customerIds',
    required: false,
    description: 'Comma-separated customer IDs; wins over customerId',
  })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({
    name: 'soloVivas',
    required: false,
    description: 'Aparta las unificadas y las anuladas',
  })
  @ApiQuery({ name: 'tab', required: false, description: 'pending | history' })
  @ApiQuery({ name: 'desde', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'hasta', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Cliente, N° de accion, factura o descripcion',
  })
  async findAll(
    @Query('customerId') customerId?: string,
    @Query('customerIds') customerIds?: string,
    @Query('status') status?: string,
    @Query('soloVivas') soloVivas?: string,
    @Query('tab') tab?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('q') q?: string,
  ) {
    return this.accountsReceivableService.findAll({
      customerId,
      customerIds: parseCustomerIds(customerIds),
      status,
      soloVivas: parseBandera(soloVivas),
      tab,
      desde,
      hasta,
      q,
    });
  }

  /**
   * Va ANTES de `:id` a proposito: Nest resuelve por orden de declaracion y
   * abajo `resumen` se leeria como el id de una cuenta.
   */
  @Get('resumen')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER, UserRoleEnum.CASHIER)
  @ApiOperation({ summary: 'Totales de la cartera, calculados en la base' })
  @ApiResponse({ status: 200, description: 'Resumen calculado' })
  @ApiQuery({ name: 'customerId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'tab', required: false })
  @ApiQuery({ name: 'desde', required: false })
  @ApiQuery({ name: 'hasta', required: false })
  @ApiQuery({ name: 'q', required: false })
  async resumen(
    @Query('customerId') customerId?: string,
    @Query('status') status?: string,
    @Query('tab') tab?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('q') q?: string,
  ) {
    return this.accountsReceivableService.resumen({
      customerId,
      status,
      tab,
      desde,
      hasta,
      q,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get account by ID' })
  @ApiResponse({ status: 200, description: 'Account retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  async findById(@Param('id') id: string) {
    return this.accountsReceivableService.findById(id);
  }

  @Post()
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER, UserRoleEnum.CASHIER)
  @ApiOperation({
    summary: 'Create new account receivable (ADMIN, MANAGER, CASHIER)',
  })
  @ApiResponse({ status: 201, description: 'Account created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async create(@Body() createAccountReceivableDto: CreateAccountReceivableDto) {
    return this.accountsReceivableService.create(createAccountReceivableDto);
  }

  @Patch(':id')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER, UserRoleEnum.CASHIER)
  @ApiOperation({ summary: 'Update account (ADMIN, MANAGER, CASHIER)' })
  @ApiResponse({ status: 200, description: 'Account updated successfully' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async update(
    @Param('id') id: string,
    @Body() updateAccountReceivableDto: UpdateAccountReceivableDto,
    @Request() req: AuthedRequest,
  ) {
    return this.accountsReceivableService.update(
      id,
      updateAccountReceivableDto,
      req.user,
    );
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Soft delete account (ADMIN, MANAGER)' })
  @ApiResponse({ status: 204, description: 'Account deleted successfully' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async softDelete(@Param('id') id: string) {
    await this.accountsReceivableService.softDelete(id);
  }

  @Post('merge')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Merge multiple accounts (ADMIN, MANAGER)' })
  @ApiResponse({ status: 201, description: 'Accounts merged successfully' })
  @ApiResponse({ status: 400, description: 'Invalid merge request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async mergeAccounts(
    @Body() mergeAccountsDto: MergeAccountsDto,
    @Request() req: AuthedRequest,
  ) {
    return this.accountsReceivableService.mergeAccounts(mergeAccountsDto, {
      id: req.user?.id,
      email: req.user?.email,
    });
  }

  @Post(':id/recompute')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({
    summary: 'Recompute account amount from its orders (ADMIN, MANAGER)',
  })
  @ApiResponse({ status: 201, description: 'Amount recomputed successfully' })
  @ApiResponse({ status: 400, description: 'Missing orders, cannot recompute' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  async recompute(@Param('id') id: string) {
    return this.accountsReceivableService.recomputeAmount(id);
  }

  @Post('unmerge')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Unmerge consolidated account (ADMIN, MANAGER)' })
  @ApiResponse({ status: 201, description: 'Account unmerged successfully' })
  @ApiResponse({ status: 400, description: 'Invalid unmerge request' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async unmergeAccounts(@Body() unmergeAccountDto: UnmergeAccountDto) {
    return this.accountsReceivableService.unmergeAccounts(unmergeAccountDto);
  }
}
