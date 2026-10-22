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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { BudgetsService } from './budgets.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { UpdateBudgetStatusDto } from './dto/update-budget-status.dto';
import { AcceptBudgetDto } from './dto/accept-budget.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRoleEnum } from '@odin6/types';

@ApiTags('budgets')
@Controller('api/budgets')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Get('calendar')
  @ApiOperation({ summary: 'Get approved budgets for calendar view' })
  @ApiResponse({ status: 200, description: 'Calendar events retrieved' })
  async findCalendar() {
    return this.budgetsService.findCalendar();
  }

  @Get()
  @ApiOperation({ summary: 'List all budgets' })
  @ApiResponse({ status: 200, description: 'Budgets retrieved successfully' })
  async findAll() {
    return this.budgetsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get budget by ID' })
  @ApiResponse({ status: 200, description: 'Budget retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Budget not found' })
  async findById(@Param('id') id: string) {
    return this.budgetsService.findById(id);
  }

  @Post()
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Create new budget (ADMIN, MANAGER)' })
  @ApiResponse({ status: 201, description: 'Budget created successfully' })
  async create(@Body() createBudgetDto: CreateBudgetDto) {
    return this.budgetsService.create(createBudgetDto);
  }

  @Post(':id/accept')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Accept budget with deposit (ADMIN, MANAGER)' })
  @ApiResponse({
    status: 200,
    description: 'Budget accepted, EVT account created',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid data or missing eventDate',
  })
  @ApiResponse({ status: 404, description: 'Budget not found' })
  @ApiResponse({
    status: 409,
    description: 'Another event already accepted on that date',
  })
  async accept(@Param('id') id: string, @Body() dto: AcceptBudgetDto) {
    return this.budgetsService.acceptBudget(id, dto);
  }

  @Patch(':id')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Update budget (ADMIN, MANAGER)' })
  @ApiResponse({ status: 200, description: 'Budget updated successfully' })
  @ApiResponse({ status: 404, description: 'Budget not found' })
  async update(
    @Param('id') id: string,
    @Body() updateBudgetDto: UpdateBudgetDto,
  ) {
    return this.budgetsService.update(id, updateBudgetDto);
  }

  @Patch(':id/status')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Update budget status (ADMIN, MANAGER)' })
  @ApiResponse({ status: 200, description: 'Status updated successfully' })
  async updateStatus(
    @Param('id') id: string,
    @Body() updateBudgetStatusDto: UpdateBudgetStatusDto,
  ) {
    return this.budgetsService.updateStatus(id, updateBudgetStatusDto);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.MANAGER)
  @ApiOperation({ summary: 'Soft delete budget (ADMIN, MANAGER)' })
  @ApiResponse({ status: 204, description: 'Budget deleted successfully' })
  async softDelete(@Param('id') id: string) {
    await this.budgetsService.softDelete(id);
  }
}
