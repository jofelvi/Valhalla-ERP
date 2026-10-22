import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { EmployeeLoansService } from './employee-loans.service';
import { CreateEmployeeLoanDto } from './dto/create-employee-loan.dto';
import { UpdateEmployeeLoanDto } from './dto/update-employee-loan.dto';
import { AbonoEmployeeLoanDto } from './dto/abono-employee-loan.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('employee-loans')
@Controller('api/employee-loans')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class EmployeeLoansController {
  constructor(private readonly employeeLoansService: EmployeeLoansService) {}

  @Get()
  @ApiOperation({ summary: 'List employee loans' })
  @ApiResponse({ status: 200, description: 'Loans retrieved successfully' })
  async findAll(
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: string,
  ) {
    return this.employeeLoansService.findAll({ employeeId, status });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get loan by ID' })
  @ApiResponse({ status: 200, description: 'Loan retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Loan not found' })
  async findById(@Param('id') id: string) {
    return this.employeeLoansService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create employee loan (amount in USD)' })
  @ApiResponse({ status: 201, description: 'Loan created successfully' })
  async create(@Body() dto: CreateEmployeeLoanDto) {
    return this.employeeLoansService.create(dto);
  }

  @Post(':id/abono')
  @ApiOperation({
    summary: 'Abono parcial (o total) a un préstamo desde la nómina',
  })
  @ApiResponse({ status: 201, description: 'Abono aplicado' })
  @ApiResponse({
    status: 400,
    description: 'Monto inválido o préstamo saldado',
  })
  @ApiResponse({ status: 404, description: 'Loan not found' })
  async abono(@Param('id') id: string, @Body() dto: AbonoEmployeeLoanDto) {
    return this.employeeLoansService.abono(id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update loan (status, notes)' })
  @ApiResponse({ status: 200, description: 'Loan updated successfully' })
  @ApiResponse({ status: 404, description: 'Loan not found' })
  async update(@Param('id') id: string, @Body() dto: UpdateEmployeeLoanDto) {
    return this.employeeLoansService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete loan' })
  @ApiResponse({ status: 200, description: 'Loan deleted successfully' })
  @ApiResponse({ status: 404, description: 'Loan not found' })
  async remove(@Param('id') id: string) {
    return this.employeeLoansService.remove(id);
  }
}
